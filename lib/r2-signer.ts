// lib/r2-signer.ts
// Minimal AWS SigV4 presigner for Cloudflare R2 (S3-compatible). No extra deps.
//
// ENV (Vercel):
//   R2_ACCOUNT_ID            // preferred; we derive endpoint as https://<acct>.r2.cloudflarestorage.com
//   R2_REGION
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET
// Optional:
//   R2_ENDPOINT              // if set, overrides the derived endpoint completely
//
// Exposes:
//   presignUrl({ method, key, expiresSeconds?, contentType? }): string
//   signHeadersForGet(key): { url: string; headers: Record<string, string> }
//
// Notes:
// - Uploads use presigned PUT (UNSIGNED-PAYLOAD).
// - Downloads use server-side signed headers (no client creds).
import crypto from "crypto";

export type PresignInput = {
  method: "PUT" | "GET" | "HEAD" | "DELETE";
  key: string;
  expiresSeconds?: number; // default 900 (15m). Max 7 days.
  contentType?: string; // if provided, client must send this exact header on upload
};

const env = () => {
  const {
    R2_ACCOUNT_ID,
    R2_REGION,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_ENDPOINT,
  } = process.env;

  if (!R2_REGION || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error(
      "Missing required R2 vars: R2_REGION, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET"
    );
  }

  let endpointUrl: URL | null = null;
  if (R2_ENDPOINT && R2_ENDPOINT.trim()) {
    endpointUrl = new URL(R2_ENDPOINT);
  } else {
    if (!R2_ACCOUNT_ID) {
      throw new Error(
        "Provide R2_ACCOUNT_ID (preferred) or R2_ENDPOINT to construct the R2 S3 endpoint"
      );
    }
    endpointUrl = new URL(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
  }

  return {
    endpoint: endpointUrl, // e.g. https://<acct>.r2.cloudflarestorage.com
    region: R2_REGION,
    accessKeyId: R2_ACCESS_KEY_ID as string,
    secretAccessKey: R2_SECRET_ACCESS_KEY as string,
    bucket: R2_BUCKET as string,
  };
};

const toAmzDate = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const MM = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return {
    amzDate: `${yyyy}${MM}${dd}T${hh}${mm}${ss}Z`,
    shortDate: `${yyyy}${MM}${dd}`,
  };
};

const sha256Hex = (data: string | Buffer) =>
  crypto.createHash("sha256").update(data).digest("hex");

const hmac = (key: Buffer | string, data: string) =>
  crypto.createHmac("sha256", key).update(data).digest();

const signingKey = (secret: string, date: string, region: string, service: string) => {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
};

const canonicalQuery = (q: Record<string, string>) =>
  Object.keys(q)
    .sort()
    .map(
      (k) => `${encodeURIComponent(k)}=${encodeURIComponent(q[k]).replace(/%7E/g, "~")}`
    )
    .join("&");

const canonicalHeadersString = (headers: Record<string, string>) => {
  const entries = Object.entries(headers).map(([k, v]) => [
    k.toLowerCase().trim(),
    v.trim().replace(/\s+/g, " "),
  ]);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    canonical: entries.map(([k, v]) => `${k}:${v}\n`).join(""),
    signedHeaders: entries.map(([k]) => k).join(";"),
  };
};

const service = "s3";

const objectUrl = (endpoint: URL, bucket: string, key: string) => {
  const u = new URL(endpoint.toString());
  u.pathname = `/${bucket}/${key}`.replace(/\/{2,}/g, "/");
  return u;
};

export function presignUrl({ method, key, expiresSeconds = 900, contentType }: PresignInput) {
  const { endpoint, region, accessKeyId, secretAccessKey, bucket } = env();
  const url = objectUrl(endpoint, bucket, key);
  const now = new Date();
  const { amzDate, shortDate } = toAmzDate(now);

  const credential = `${accessKeyId}/${shortDate}/${region}/${service}/aws4_request`;
  const headers: Record<string, string> = {
    host: url.host,
  };
  if (contentType) headers["content-type"] = contentType;

  const { canonical, signedHeaders } = canonicalHeadersString(headers);
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  };

  const canonicalRequest = [
    method,
    url.pathname,
    canonicalQuery(query),
    canonical,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    `${shortDate}/${region}/${service}/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const sigKey = signingKey(secretAccessKey, shortDate, region, service);
  const signature = crypto.createHmac("sha256", sigKey).update(stringToSign).digest("hex");

  const presigned = new URL(url.toString());
  for (const [k, v] of Object.entries(query)) presigned.searchParams.set(k, v);
  presigned.searchParams.set("X-Amz-Signature", signature);

  return presigned.toString();
}

// For server-side streaming (signed header auth). Returns headers to send to R2 on GET/HEAD.
export function signHeadersForGet(key: string) {
  const { endpoint, region, accessKeyId, secretAccessKey, bucket } = env();
  const url = objectUrl(endpoint, bucket, key);
  const method = "GET";
  const now = new Date();
  const { amzDate, shortDate } = toAmzDate(now);
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
    "x-amz-date": amzDate,
  };
  const { canonical, signedHeaders } = canonicalHeadersString(headers);
  const canonicalRequest = [
    method,
    url.pathname,
    "",
    canonical,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    `${shortDate}/${region}/${service}/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const sigKey = signingKey(secretAccessKey, shortDate, region, service);
  const signature = crypto.createHmac("sha256", sigKey).update(stringToSign).digest("hex");

  const authorization = [
    "AWS4-HMAC-SHA256 Credential=" + accessKeyId + "/" + shortDate + "/" + region + "/" + service + "/aws4_request",
    "SignedHeaders=" + signedHeaders,
    "Signature=" + signature,
  ].join(", ");

  return {
    url: objectUrl(endpoint, bucket, key).toString(),
    headers: {
      ...headers,
      Authorization: authorization,
    },
  };
}

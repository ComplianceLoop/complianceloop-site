// lib/r2-signer.ts
import crypto from "node:crypto";

type PresignOpts = {
  method: "GET" | "PUT";
  bucket: string;
  key: string;
  endpoint: string;   // e.g., https://<accountid>.r2.cloudflarestorage.com
  region: string;     // e.g., auto or us-east-1 (use what your R2 account expects)
  accessKeyId: string;
  secretAccessKey: string;
  expiresIn?: number; // seconds, max 7 days for S3 presign; default 900 (15m)
  contentType?: string;
};

const hmac = (key: Buffer | string, msg: string) =>
  crypto.createHmac("sha256", key).update(msg, "utf8").digest();

const sha256Hex = (s: string | Buffer) =>
  crypto.createHash("sha256").update(s).digest("hex");

export function presignS3Url(opts: PresignOpts): string {
  const {
    method, bucket, key, endpoint, region,
    accessKeyId, secretAccessKey, expiresIn = 900, contentType
  } = opts;

  const host = new URL(endpoint).host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const date = amzDate.slice(0, 8);
  const service = "s3";

  // Virtual-hosted–style URL
  const url = new URL(`${endpoint.replace(/\/+$/,"")}/${bucket}/${encodeURIComponent(key)}`);

  const credential = `${accessKeyId}/${date}/${region}/${service}/aws4_request`;
  const alg = "AWS4-HMAC-SHA256";

  const params: Record<string,string> = {
    "X-Amz-Algorithm": alg,
    "X-Amz-Credential": encodeURIComponent(credential),
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host"
  };
  if (contentType && method === "PUT") {
    // content-type is not signed header unless added; keep simple = host only
  }

  // Canonical request
  const canonicalQuery = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`).sort().join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    method,
    url.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");

  // String to sign
  const stringToSign = [
    alg,
    amzDate,
    `${date}/${region}/${service}/aws4_request`,
    sha256Hex(canonicalRequest)
  ].join("\n");

  // Derive signing key
  const kDate = hmac(`AWS4${secretAccessKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");

  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const qs = `${canonicalQuery}&X-Amz-Signature=${signature}`;
  url.search = qs;
  return url.toString();
}

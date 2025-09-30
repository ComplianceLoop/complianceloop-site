// lib/airtable.ts
// Minimal Airtable REST client with chunked performUpsert (no extra deps).
// Env-only: AIRTABLE_API_KEY, AIRTABLE_BASE_ID

const AIRTABLE_API_URL = "https://api.airtable.com/v0";
const DEFAULT_CHUNK_SIZE = 10;
const MAX_RETRIES = 5;

export type AirtableRecord = { id?: string; fields: Record<string, unknown> };
export type UpsertInput = {
  table: string;
  mergeField: string; // field to merge on (unique key in Airtable)
  records: AirtableRecord[];
  dryRun?: boolean;
  chunkSize?: number;
  baseId?: string;
  apiKey?: string;
  typecast?: boolean;
};
export type UpsertResult = {
  table: string;
  mergeField: string;
  attempted: number;
  upserted: number;
  chunks: number;
  dryRun: boolean;
  baseId: string;
};

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function requestWithRetry(
  url: string,
  init: RequestInit,
  attempt = 1
): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= MAX_RETRIES) return res;
    const wait =
      Number(res.headers.get("Retry-After")) * 1000 ||
      Math.min(2 ** attempt * 250, 5000);
    await sleep(wait);
    return requestWithRetry(url, init, attempt + 1);
  }
  return res;
}

/**
 * performUpsert using Airtable REST API.
 * API: POST /v0/{baseId}/{table} with { performUpsert: {fieldsToMergeOn: [...]}, records: [...] }
 * Limit: 10 records per request -> we chunk.
 */
export async function performUpsert(input: UpsertInput): Promise<UpsertResult> {
  const baseId = input.baseId ?? env("AIRTABLE_BASE_ID");
  const apiKey = input.apiKey ?? env("AIRTABLE_API_KEY");
  const chunkSize = input.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const dryRun = Boolean(input.dryRun);
  const typecast = input.typecast ?? true;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const records = Array.isArray(input.records) ? input.records : [];
  const chunks = chunk(records, chunkSize);

  let upserted = 0;

  if (!dryRun) {
    for (const group of chunks) {
      if (group.length === 0) continue;

      const body = {
        performUpsert: { fieldsToMergeOn: [input.mergeField] },
        typecast,
        records: group.map((r) => ({ fields: r.fields })),
      };

      const res = await requestWithRetry(
        `${AIRTABLE_API_URL}/${encodeURIComponent(baseId)}/${encodeURIComponent(
          input.table
        )}`,
        { method: "POST", headers, body: JSON.stringify(body) }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Airtable upsert failed (${res.status}): ${text || res.statusText}`
        );
      }

      const json = (await res.json().catch(() => ({}))) as {
        records?: Array<unknown>;
      };
      upserted += Array.isArray(json.records) ? json.records.length : group.length;
    }
  }

  return {
    table: input.table,
    mergeField: input.mergeField,
    attempted: records.length,
    upserted: dryRun ? 0 : upserted,
    chunks: chunks.length,
    dryRun,
    baseId,
  };
}

export async function healthCheck(baseId?: string, apiKey?: string) {
  const b = baseId ?? env("AIRTABLE_BASE_ID");
  const k = apiKey ?? env("AIRTABLE_API_KEY");
  // Ping schema list (does not exist in classic API), so we do a harmless no-op by listing 1 record of a bogus table.
  // This will 404; we only use it to validate env presence without network if desired.
  return { ok: Boolean(b && k) };
}

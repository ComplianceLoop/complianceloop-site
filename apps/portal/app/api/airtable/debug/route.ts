// apps/portal/app/api/airtable/debug/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";

function normalize(v: string | null | undefined) {
  if (!v) return "";
  const trimmed = v.trim();
  return trimmed.replace(/^['"]+|['"]+$/g, "");
}

/**
 * Safe debug endpoint to validate X-Sync-Key wiring (no secret revealed).
 * GET /api/airtable/debug  (optionally send X-Sync-Key header)
 */
export async function GET() {
  const h = headers();
  const envRaw = process.env.AIRTABLE_SYNC_KEY || "";
  const hdrRaw = h.get("x-sync-key") || "";

  const envVal = normalize(envRaw);
  const hdrVal = normalize(hdrRaw);

  return NextResponse.json({
    envSeen: Boolean(envRaw),
    envLen: envRaw.length,
    envNormLen: envVal.length,
    headerSeen: Boolean(hdrRaw),
    headerLen: hdrRaw.length,
    headerNormLen: hdrVal.length,
    headerEqualsEnv: Boolean(envVal) && envVal === hdrVal
  });
}

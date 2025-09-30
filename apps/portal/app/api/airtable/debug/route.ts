// apps/portal/app/api/airtable/debug/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Safe debug endpoint to validate X-Sync-Key wiring.
 * Does NOT reveal the secret value — only booleans/lengths.
 *
 * GET /api/airtable/debug  (optionally send X-Sync-Key header)
 * Response:
 * {
 *   envSeen: boolean,        // did the server see AIRTABLE_SYNC_KEY env set?
 *   envLen: number,          // length of env value (0 if absent)
 *   headerSeen: boolean,     // did the request include X-Sync-Key?
 *   headerLen: number,       // length of header value (0 if absent)
 *   headerEqualsEnv: boolean // exact match between header and env?
 * }
 */
export async function GET() {
  const h = headers();
  const envVal = process.env.AIRTABLE_SYNC_KEY || "";
  const hdrVal = h.get("x-sync-key") || "";

  return NextResponse.json({
    envSeen: Boolean(envVal),
    envLen: envVal.length,
    headerSeen: Boolean(hdrVal),
    headerLen: hdrVal.length,
    headerEqualsEnv: Boolean(envVal) && envVal === hdrVal,
  });
}

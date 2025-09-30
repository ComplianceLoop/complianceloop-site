// app/api/airtable/source/route.ts
import { NextResponse } from "next/server";

/**
 * Source of truth export for Airtable sync.
 * Minimal surface: table name, mergeField, and normalized records.
 *
 * Env (optional):
 * - SYNC_SOURCE_URL: if set, this route proxies that JSON (must match shape).
 *
 * Shape:
 * {
 *   table: "Users",
 *   mergeField: "email",
 *   records: [{ fields: { email: string, name?: string, createdAt?: string, ... } }]
 * }
 */

export const dynamic = "force-dynamic";

type AirtableSource = {
  table: string;
  mergeField: string;
  records: Array<{ fields: Record<string, unknown> }>;
};

async function fetchExternal(url: string): Promise<AirtableSource | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as AirtableSource;
    if (
      !data ||
      typeof data.table !== "string" ||
      typeof data.mergeField !== "string" ||
      !Array.isArray(data.records)
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function GET() {
  // If an upstream JSON source is provided, proxy it 1:1.
  const upstream = process.env.SYNC_SOURCE_URL;
  if (upstream) {
    const data = await fetchExternal(upstream);
    if (data) return NextResponse.json(data, { status: 200 });
    return NextResponse.json(
      { error: "SYNC_SOURCE_URL fetch failed or invalid shape" },
      { status: 502 }
    );
  }

  // Fallback: minimal Users surface (empty set is allowed; count >= 0)
  // NOTE: In Phase 4 we keep it simple; Neon remains source of record.
  // Future: replace with real DB query mapping to Airtable fields.
  const payload: AirtableSource = {
    table: "Users",
    mergeField: "email",
    records: [], // OK if empty; sync will no-op.
  };

  return NextResponse.json(payload, { status: 200 });
}

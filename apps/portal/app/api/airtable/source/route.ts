// apps/portal/app/api/airtable/source/route.ts
import { NextResponse } from "next/server";

/**
 * Source of truth export for Airtable sync (portal app).
 * Minimal surface: table name, mergeField, and normalized records.
 *
 * Env (optional):
 * - SYNC_SOURCE_URL: if set, this route proxies that JSON (must match shape).
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
  const upstream = process.env.SYNC_SOURCE_URL;
  if (upstream) {
    const data = await fetchExternal(upstream);
    if (data) return NextResponse.json(data, { status: 200 });
    return NextResponse.json(
      { error: "SYNC_SOURCE_URL fetch failed or invalid shape" },
      { status: 502 }
    );
  }

  // Fallback: minimal Users surface (empty set allowed)
  const payload: AirtableSource = {
    table: "Users",
    mergeField: "email",
    records: [],
  };

  return NextResponse.json(payload, { status: 200 });
}

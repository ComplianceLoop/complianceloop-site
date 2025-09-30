// apps/portal/app/api/airtable/sync/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { performUpsert } from "@/lib/airtable";

export const dynamic = "force-dynamic";

type AirtableSource = {
  table: string;
  mergeField: string;
  records: Array<{ fields: Record<string, unknown> }>;
};

function detectOrigin(): string {
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host");
  if (!host) throw new Error("Missing Host header");
  return `${proto}://${host}`;
}

function airtableEnvOkay() {
  const hasBase = Boolean(process.env.AIRTABLE_BASE_ID);
  const hasKey = Boolean(process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN);
  if (!hasBase) throw new Error("Missing required env: AIRTABLE_BASE_ID");
  if (!hasKey) throw new Error("Missing required env: AIRTABLE_API_KEY or AIRTABLE_TOKEN");
  return true;
}

export async function POST(req: Request) {
  // Header gate
  const providedKey = headers().get("x-sync-key") || "";
  const expectedKey = process.env.AIRTABLE_SYNC_KEY || "";
  if (!expectedKey || providedKey !== expectedKey) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Locate source (external or same app)
  const baseUrl = process.env.SYNC_SOURCE_URL ? "" : detectOrigin();
  const sourceUrl = process.env.SYNC_SOURCE_URL || `${baseUrl}/api/airtable/source`;

  let source: AirtableSource;
  try {
    const res = await fetch(sourceUrl, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Source fetch failed ${res.status}: ${t}` },
        { status: 502 }
      );
    }
    source = (await res.json()) as AirtableSource;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Source fetch error" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const dryRun = Boolean(body?.dryRun);

  if (!source?.table || !source?.mergeField || !Array.isArray(source?.records)) {
    return NextResponse.json({ error: "Invalid source shape" }, { status: 400 });
  }

  try {
    airtableEnvOkay();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Airtable env error" }, { status: 500 });
  }

  try {
    const result = await performUpsert({
      table: source.table,
      mergeField: source.mergeField,
      records: source.records,
      dryRun,
    });

    return NextResponse.json({ ok: true, summary: result }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Upsert failed" }, { status: 500 });
  }
}

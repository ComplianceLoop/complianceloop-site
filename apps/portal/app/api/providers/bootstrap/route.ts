// apps/portal/app/api/providers/bootstrap/route.ts
import { NextResponse } from "next/server";
import { getSql } from "@/lib/neon";

/**
 * Idempotent bootstrap for provider onboarding.
 * - NO raw .sql imports (avoids build-time loaders)
 * - Executes a small set of CREATE IF NOT EXISTS statements
 * - Safe to run repeatedly (preview/prod)
 */

const MIGRATIONS: string[] = [
  // Helpful extension for UUID default (safe on Neon/Postgres)
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,

  // Providers (minimal shape for onboarding)
  `CREATE TABLE IF NOT EXISTS providers (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     company_name TEXT NOT NULL,
     contact_email TEXT NOT NULL,
     contact_phone TEXT,
     status TEXT NOT NULL DEFAULT 'pending'
   )`,

  // Which services a provider supports
  `CREATE TABLE IF NOT EXISTS provider_services (
     provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
     service_code TEXT NOT NULL,
     PRIMARY KEY (provider_id, service_code)
   )`,

  // ZIP coverage per provider (THIS is the missing table)
  `CREATE TABLE IF NOT EXISTS provider_zips (
     provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
     zip TEXT NOT NULL CHECK (zip ~ '^[0-9]{5}$'),
     PRIMARY KEY (provider_id, zip)
   )`,

  // Helpful indexes
  `CREATE INDEX IF NOT EXISTS idx_provider_services_code ON provider_services (service_code)`,
  `CREATE INDEX IF NOT EXISTS idx_provider_zips_zip ON provider_zips (zip)`,
  `CREATE INDEX IF NOT EXISTS idx_provider_zips_provider_id ON provider_zips (provider_id)`
];

export async function GET() {
  try {
    const { exec } = await getSql();

    // Execute statements one-by-one; all are idempotent.
    let applied = 0;
    for (const stmt of MIGRATIONS) {
      const s = stmt.trim().replace(/;$/, "");
      if (!s) continue;
      await exec(s, []);
      applied += 1;
    }

    return NextResponse.json({ ok: true, applied });
  } catch (err: any) {
    console.error("bootstrap error", err);
    return NextResponse.json(
      { ok: false, error: "bootstrap_failed", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

// Optional HEAD for quick health-checks (same result code as GET)
export async function HEAD() {
  const res = await GET();
  return new NextResponse(null, { status: (res as any)?.status ?? 200 });
}

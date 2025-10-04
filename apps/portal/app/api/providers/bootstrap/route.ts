// apps/portal/app/api/providers/bootstrap/route.ts
import { NextResponse } from "next/server";

/**
 * Self-contained DB helper that avoids any local import path issues.
 * Uses @neondatabase/serverless directly and allows executing raw SQL.
 */
async function getExec() {
  const { neon, neonConfig } = await import("@neondatabase/serverless");

  // keep connections hot across invocations (Vercel/Edge best practice)
  neonConfig.fetchConnectionCache = true;

  const conn =
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL; // try a few common names

  if (!conn) {
    throw new Error(
      "Missing database URL. Set DATABASE_URL (or NEON_DATABASE_URL / POSTGRES_URL)."
    );
  }

  const sql = neon(conn);

  // neon() returns a tagged template; .unsafe lets us run arbitrary text
  const exec = async (text: string) => {
    const q = text.trim().replace(/;$/, "");
    if (!q) return;
    await (sql as any).unsafe(q);
  };

  return { exec };
}

/**
 * Idempotent bootstrap to ensure required tables & indexes exist.
 * Safe to run repeatedly in any environment (prod/preview/dev).
 */
const MIGRATIONS: string[] = [
  // Extension for gen_random_uuid()
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,

  // Providers core table
  `CREATE TABLE IF NOT EXISTS providers (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     company_name   TEXT NOT NULL,
     contact_email  TEXT NOT NULL,
     contact_phone  TEXT,
     status         TEXT NOT NULL DEFAULT 'pending'
   )`,

  // Provider services
  `CREATE TABLE IF NOT EXISTS provider_services (
     provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
     service_code TEXT NOT NULL,
     PRIMARY KEY (provider_id, service_code)
   )`,

  // Provider ZIP coverage (the missing relation from logs)
  `CREATE TABLE IF NOT EXISTS provider_zips (
     provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
     zip         TEXT NOT NULL CHECK (zip ~ '^[0-9]{5}$'),
     PRIMARY KEY (provider_id, zip)
   )`,

  // Helpful indexes
  `CREATE INDEX IF NOT EXISTS idx_provider_services_code
     ON provider_services (service_code)`,

  `CREATE INDEX IF NOT EXISTS idx_provider_zips_zip
     ON provider_zips (zip)`,

  `CREATE INDEX IF NOT EXISTS idx_provider_zips_provider_id
     ON provider_zips (provider_id)`
];

export async function GET() {
  try {
    const { exec } = await getExec();
    let applied = 0;
    for (const stmt of MIGRATIONS) {
      await exec(stmt);
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

// HEAD for a quick health check (optional)
export async function HEAD() {
  const res = await GET();
  return new NextResponse(null, { status: (res as any)?.status ?? 200 });
}

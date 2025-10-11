// apps/portal/app/api/db/bootstrap/route.ts
// Purpose: Idempotently create Assignment Engine tables on Neon.
// Notes:
// - Exposes GET /api/db/bootstrap
// - Runs safely multiple times
// - Works even if reading the SQL file fails (falls back to inline DDL)

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import fs from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

const INLINE_DDL = `
-- 1) jobs
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code TEXT NOT NULL,
  zip TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','offered','assigned','expired','cancelled')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) job_offers
CREATE TABLE IF NOT EXISTS job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('offered','accepted','declined','expired','cancelled')) DEFAULT 'offered',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, provider_id)
);

-- 3) job_assignments
CREATE TABLE IF NOT EXISTS job_assignments (
  job_id UUID PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) assignment_logs
CREATE TABLE IF NOT EXISTS assignment_logs (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID,
  provider_id UUID,
  event TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_job_offers_job_expires ON job_offers (job_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_job_offers_status ON job_offers (status);
`.trim();

// Very simple splitter; assumes no semicolons inside function bodies.
function splitSql(sql: string): string[] {
  return sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s + ';');
}

async function loadDDL(): Promise<string> {
  // Try to read the committed SQL file first; if it fails, use inline.
  try {
    const sqlPath = path.resolve(process.cwd(), 'apps/portal/db/bootstrap.sql');
    const ddl = await fs.readFile(sqlPath, 'utf8');
    return ddl;
  } catch {
    return INLINE_DDL;
  }
}

export async function GET() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: 'DATABASE_URL is not set' },
      { status: 500 }
    );
  }

  const client = neon(DATABASE_URL);
  try {
    const ddl = await loadDDL();
    const statements = splitSql(ddl);

    await client`BEGIN`;
    await client`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;

    // Execute each statement individually
    for (const stmt of statements) {
      // neon supports calling the client as a function with a raw SQL string
      // @ts-ignore
      await client(stmt);
    }

    await client`COMMIT`;
    return NextResponse.json({ ok: true, statements: statements.length });
  } catch (err: any) {
    try {
      await client`ROLLBACK`;
    } catch {
      // ignore rollback errors
    }
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

// apps/portal/app/api/db/bootstrap/route.ts
// Purpose: Idempotently create Assignment Engine tables on Neon.
// IMPORTANT: Uses INLINE DDL for the assign_* tables so we don't depend on reading files.
// Safe to run multiple times.

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const runtime = 'nodejs';

const INLINE_DDL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) assign_jobs
CREATE TABLE IF NOT EXISTS assign_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code TEXT NOT NULL,
  zip TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','offered','assigned','expired','cancelled')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assign_jobs_status ON assign_jobs (status);

-- 2) assign_job_offers
CREATE TABLE IF NOT EXISTS assign_job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES assign_jobs(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('offered','accepted','declined','expired','cancelled')) DEFAULT 'offered',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, provider_id)
);
CREATE INDEX IF NOT EXISTS idx_assign_job_offers_job_expires ON assign_job_offers (job_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_assign_job_offers_status ON assign_job_offers (status);

-- 3) assign_job_assignments
CREATE TABLE IF NOT EXISTS assign_job_assignments (
  job_id UUID PRIMARY KEY REFERENCES assign_jobs(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) assign_logs
CREATE TABLE IF NOT EXISTS assign_logs (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID,
  provider_id UUID,
  event TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`.trim();

// Split on semicolons; no function bodies so this is safe.
function splitSql(sql: string): string[] {
  return sql
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s + ';');
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
    const statements = splitSql(INLINE_DDL);

    await client`BEGIN`;
    await client`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;

    for (const stmt of statements) {
      // Execute each statement as raw text
      // @ts-ignore neon allows calling the client as a function with a raw SQL string
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

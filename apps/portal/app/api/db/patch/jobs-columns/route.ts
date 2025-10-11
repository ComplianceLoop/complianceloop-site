// apps/portal/app/api/db/patch/jobs-columns/route.ts
// Purpose: One-shot migration to ensure jobs has service_code, zip, status columns.
// Safe to call multiple times (IF NOT EXISTS everywhere).
// GET /api/db/patch/jobs-columns

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const runtime = 'nodejs';

export async function GET() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'DATABASE_URL is not set' }, { status: 500 });
  }

  const sql = neon(DATABASE_URL);

  try {
    await sql`BEGIN`;
    // Create table shell if not present
    await sql`
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    // Add missing columns
    await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_code TEXT`;
    await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS zip TEXT`;
    await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status TEXT`;

    // Optional: add simple CHECK if not exists (name-scoped)
    // Neon doesn't support "ADD CONSTRAINT IF NOT EXISTS", so guard with a query
    const hasCheck = await sql`
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'jobs_status_check' AND conrelid = 'jobs'::regclass
      LIMIT 1
    `;
    if ((hasCheck as any[]).length === 0) {
      await sql`
        ALTER TABLE jobs
        ADD CONSTRAINT jobs_status_check
        CHECK (status IN ('pending','offered','assigned','expired','cancelled'))
      `;
    }

    await sql`COMMIT`;
    return NextResponse.json({ ok: true, patched: true });
  } catch (err: any) {
    try { await sql`ROLLBACK`; } catch {}
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

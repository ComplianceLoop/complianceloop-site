// apps/portal/app/api/assign/admin/logs/route.ts
// Purpose: Minimal admin observability – list recent assignment logs for a job.
// GET /api/assign/admin/logs?job_id=<uuid>&limit=100
//
// Response 200:
// { ok: true, logs: [{ id, job_id, provider_id, event, meta, created_at } ...] }

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'DATABASE_URL is not set' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const job_id = (searchParams.get('job_id') || '').trim();
  const limitParam = Number(searchParams.get('limit') || '100');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(1, limitParam), 200) : 100;

  if (!job_id) {
    return NextResponse.json({ ok: false, error: 'job_id is required' }, { status: 400 });
  }

  const sql = neon(DATABASE_URL);

  try {
    const rows = await sql`
      SELECT id, job_id, provider_id, event, meta, created_at
      FROM assign_logs
      WHERE job_id = ${job_id}
      ORDER BY id DESC
      LIMIT ${limit}
    `;
    return NextResponse.json({ ok: true, logs: rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

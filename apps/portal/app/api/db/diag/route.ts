// apps/portal/app/api/db/diag/route.ts
// Purpose: Quick DB introspection to verify table/columns exist in Neon.
// GET /api/db/diag → returns column lists for key tables.

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
    const jobsCols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'jobs'
      ORDER BY ordinal_position
    `;
    const offersCols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'job_offers'
      ORDER BY ordinal_position
    `;
    const assignsCols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'job_assignments'
      ORDER BY ordinal_position
    `;

    return NextResponse.json({
      ok: true,
      tables: {
        jobs: jobsCols,
        job_offers: offersCols,
        job_assignments: assignsCols,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

// apps/portal/app/api/assign/accept/route.ts
// Purpose: First-accept-wins for assign_jobs (namespaced tables).
// Includes GET and OPTIONS so you can health-check the route and avoid 405s.

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const runtime = 'nodejs';

type AcceptBody = { job_id?: string; provider_id?: string };

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  return NextResponse.json({ ok: true, methods: ['POST'] });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Allow': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Vercel-Protection-Bypass',
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function POST(req: Request) {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) return bad('DATABASE_URL is not set', 500);

  let body: AcceptBody;
  try { body = await req.json(); } catch { return bad('Invalid JSON body'); }

  const job_id = (body.job_id || '').trim();
  const provider_id = (body.provider_id || '').trim();
  if (!job_id) return bad('job_id is required');
  if (!provider_id) return bad('provider_id is required');

  const sql = neon(DATABASE_URL);

  await sql`BEGIN`;
  await sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
  try {
    // Validate offer exists and is still 'offered'
    const offerRows = await sql`
      SELECT status, expires_at
      FROM assign_job_offers
      WHERE job_id = ${job_id} AND provider_id = ${provider_id}
      LIMIT 1
    `;
    if ((offerRows as any[]).length === 0) {
      await sql`ROLLBACK`;
      return NextResponse.json({ ok: false, error: 'offer not found' }, { status: 404 });
    }
    const offer = (offerRows as any[])[0];

    if (offer.status !== 'offered') {
      await sql`ROLLBACK`;
      return NextResponse.json({ ok: false, error: `offer is ${offer.status}` }, { status: 404 });
    }

    const notExpired = await sql`
      SELECT now() < expires_at AS ok
      FROM assign_job_offers
      WHERE job_id = ${job_id} AND provider_id = ${provider_id}
      LIMIT 1
    `;
    if (!(notExpired as any[])[0]?.ok) {
      await sql`
        UPDATE assign_job_offers SET status = 'expired'
        WHERE job_id = ${job_id} AND provider_id = ${provider_id}
      `;
      await sql`COMMIT`;
      return NextResponse.json({ ok: false, error: 'offer expired' }, { status: 410 });
    }

    // Try to claim the assignment (PK on assign_job_assignments.job_id enforces single winner)
    try {
      await sql`
        INSERT INTO assign_job_assignments (job_id, provider_id)
        VALUES (${job_id}, ${provider_id})
      `;
    } catch {
      const winner = await sql`
        SELECT provider_id FROM assign_job_assignments
        WHERE job_id = ${job_id}
        LIMIT 1
      `;
      await sql`ROLLBACK`;
      return NextResponse.json(
        { job_id, winner: { provider_id: (winner as any[])[0]?.provider_id ?? 'unknown' } },
        { status: 409 }
      );
    }

    await sql`
      UPDATE assign_job_offers
      SET status = CASE WHEN provider_id = ${provider_id} THEN 'accepted' ELSE 'expired' END
      WHERE job_id = ${job_id}
    `;
    await sql`UPDATE assign_jobs SET status = 'assigned' WHERE id = ${job_id}`;
    await sql`
      INSERT INTO assign_logs (job_id, provider_id, event)
      VALUES (${job_id}, ${provider_id}, 'offer_accepted')
    `;

    await sql`COMMIT`;
    return NextResponse.json({ job_id, assigned: { provider_id } });
  } catch (err: any) {
    try { await sql`ROLLBACK`; } catch {}
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

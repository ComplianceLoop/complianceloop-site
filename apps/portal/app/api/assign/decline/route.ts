// apps/portal/app/api/assign/decline/route.ts
// Purpose: Providers can explicitly decline an offer before it expires.
// Tables: assign_jobs, assign_job_offers, assign_job_assignments, assign_logs
//
// POST body:
// { "job_id": "uuid", "provider_id": "uuid" }
//
// Success (200):
// { "ok": true, "state": "declined" | "noop" }
//
// Already assigned (409):
// { "ok": false, "winner": { "provider_id": "uuid" } }
//
// Not found/expired:
// 404 { "ok": false, "error": "offer not found" }
// 410 { "ok": false, "error": "offer expired" }

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const runtime = 'nodejs';

type DeclineBody = { job_id?: string; provider_id?: string };

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
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function POST(req: Request) {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) return bad('DATABASE_URL is not set', 500);

  let body: DeclineBody;
  try {
    body = await req.json();
  } catch {
    return bad('Invalid JSON body');
  }

  const job_id = (body.job_id || '').trim();
  const provider_id = (body.provider_id || '').trim();
  if (!job_id) return bad('job_id is required');
  if (!provider_id) return bad('provider_id is required');

  const sql = neon(DATABASE_URL);

  await sql`BEGIN`;
  await sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
  try {
    // 0) If already assigned, return winner
    const winner = await sql`
      SELECT provider_id FROM assign_job_assignments
      WHERE job_id = ${job_id}
      LIMIT 1
    `;
    if ((winner as any[]).length > 0) {
      await sql`ROLLBACK`;
      return NextResponse.json(
        { ok: false, winner: { provider_id: (winner as any[])[0].provider_id as string } },
        { status: 409 }
      );
    }

    // 1) Fetch offer for this provider
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

    // 2) If expired, mark expired (idempotent) and return 410
    const notExpired = await sql`
      SELECT now() < expires_at AS ok
      FROM assign_job_offers
      WHERE job_id = ${job_id} AND provider_id = ${provider_id}
      LIMIT 1
    `;
    if (!(notExpired as any[])[0]?.ok) {
      await sql`
        UPDATE assign_job_offers
        SET status = 'expired'
        WHERE job_id = ${job_id} AND provider_id = ${provider_id} AND status = 'offered'
      `;
      await sql`
        INSERT INTO assign_logs (job_id, provider_id, event)
        VALUES (${job_id}, ${provider_id}, 'offer_decline_expired')
      `;
      await sql`COMMIT`;
      return NextResponse.json({ ok: false, error: 'offer expired' }, { status: 410 });
    }

    // 3) If still offered → set to declined; if already declined/accepted, noop
    if (offer.status === 'offered') {
      await sql`
        UPDATE assign_job_offers
        SET status = 'declined'
        WHERE job_id = ${job_id} AND provider_id = ${provider_id}
      `;
      await sql`
        INSERT INTO assign_logs (job_id, provider_id, event)
        VALUES (${job_id}, ${provider_id}, 'offer_declined')
      `;
    } else {
      await sql`
        INSERT INTO assign_logs (job_id, provider_id, event, meta)
        VALUES (${job_id}, ${provider_id}, 'offer_decline_noop', ${JSON.stringify({ status: offer.status })}::jsonb)
      `;
      await sql`COMMIT`;
      return NextResponse.json({ ok: true, state: 'noop' });
    }

    // 4) Optional: if no active offers remain, leave job as 'offered' (winner can still accept later).
    // We do not auto-expire the job here to keep logic simple.

    await sql`COMMIT`;
    return NextResponse.json({ ok: true, state: 'declined' });
  } catch (err: any) {
    try { await sql`ROLLBACK`; } catch {}
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

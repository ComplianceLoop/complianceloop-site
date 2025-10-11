// apps/portal/app/api/assign/broadcast/route.ts
// Purpose: Create an assign_job and broadcast soft-hold offers to eligible providers,
// or auto-assign immediately if exactly one eligible provider exists.
// Uses namespaced tables: assign_jobs, assign_job_offers, assign_job_assignments, assign_logs.

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const runtime = 'nodejs';

type BroadcastBody = {
  service_code?: string;
  zip?: string;
  hold_minutes?: number;
  meta?: Record<string, unknown>;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) return bad('DATABASE_URL is not set', 500);

  let body: BroadcastBody;
  try {
    body = await req.json();
  } catch {
    return bad('Invalid JSON body');
  }

  const service_code = (body.service_code || '').trim();
  const zip = (body.zip || '').trim();
  const hold_minutes = Number.isFinite(body.hold_minutes)
    ? Math.max(1, Math.floor(Number(body.hold_minutes)))
    : 15;
  const meta = body.meta ?? {};
  const metaJson = JSON.stringify(meta); // cast as ::jsonb in SQL

  if (!service_code) return bad('service_code is required');
  if (!zip) return bad('zip is required');

  const sql = neon(DATABASE_URL);

  await sql`BEGIN`;
  await sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
  try {
    // 1) Create a pending assign_job
    const jobRow = await sql`
      INSERT INTO assign_jobs (service_code, zip, status)
      VALUES (${service_code}, ${zip}, 'pending')
      RETURNING id
    `;
    const job_id: string = (jobRow as any[])[0].id;

    // 2) Compute eligibility (ZIP + service + allowed provider statuses)
    const eligible = await sql`
      WITH eligible AS (
        SELECT p.id
        FROM providers p
        JOIN provider_services ps ON ps.provider_id = p.id
        JOIN provider_zips pz ON pz.provider_id = p.id
        WHERE ps.service_code = ${service_code}
          AND pz.zip = ${zip}
          AND p.status IN ('active','approved','pending')
        GROUP BY p.id
      )
      SELECT id FROM eligible
    `;
    const eligible_count: number = (eligible as any[]).length;

    // 3) Exactly one eligible → auto-assign
    if (eligible_count === 1) {
      const winner: string = (eligible as any[])[0].id as string;

      await sql`
        INSERT INTO assign_job_assignments (job_id, provider_id)
        VALUES (${job_id}, ${winner})
        ON CONFLICT (job_id) DO NOTHING
      `;

      await sql`UPDATE assign_jobs SET status = 'assigned' WHERE id = ${job_id}`;

      await sql`
        INSERT INTO assign_logs (job_id, provider_id, event, meta)
        VALUES (${job_id}, ${winner}, 'auto_assigned_single_eligible', ${metaJson}::jsonb)
      `;

      await sql`COMMIT`;
      return NextResponse.json({ job_id, eligible_count, assigned: { provider_id: winner } });
    }

    // 3b) Multiple eligible → insert offers, expire in hold_minutes
    if (eligible_count > 1) {
      await sql`
        INSERT INTO assign_job_offers (id, job_id, provider_id, expires_at)
        SELECT gen_random_uuid(), ${job_id}, p.id, now() + (interval '1 minute' * ${hold_minutes})
        FROM providers p
        JOIN provider_services ps ON ps.provider_id = p.id
        JOIN provider_zips pz ON pz.provider_id = p.id
        WHERE ps.service_code = ${service_code}
          AND pz.zip = ${zip}
          AND p.status IN ('active','approved','pending')
        GROUP BY p.id
        ON CONFLICT (job_id, provider_id) DO NOTHING
      `;

      await sql`UPDATE assign_jobs SET status = 'offered' WHERE id = ${job_id}`;

      await sql`
        INSERT INTO assign_logs (job_id, event, meta)
        VALUES (${job_id}, 'broadcast_offers_created', ${JSON.stringify({
          ...meta,
          hold_minutes,
          eligible_count,
        })}::jsonb)
      `;

      await sql`COMMIT`;
      return NextResponse.json({ job_id, eligible_count });
    }

    // 3c) No eligible providers
    await sql`UPDATE assign_jobs SET status = 'expired' WHERE id = ${job_id}`;
    await sql`
      INSERT INTO assign_logs (job_id, event, meta)
      VALUES (${job_id}, 'no_eligible_providers', ${metaJson}::jsonb)
    `;
    await sql`COMMIT`;
    return NextResponse.json({ job_id, eligible_count: 0 });
  } catch (err: any) {
    try { await sql`ROLLBACK`; } catch {}
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

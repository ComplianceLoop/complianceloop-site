// apps/portal/app/api/providers/seed/route.ts
// Purpose: Simple test-only seeding endpoint to insert a provider plus its ZIP and service,
// bypassing any stricter validation in /api/providers/apply.
// This helps us verify the Assignment Engine end-to-end.
//
// POST body:
// {
//   "company_name": "Agent Test Provider 1",
//   "zip": "00901",
//   "service_code": "telehealth_consult",
//   "status": "active"       // optional: active | approved | pending (default: active)
// }
//
// Response 200:
// { "ok": true, "provider_id": "uuid", "created": { "provider": bool, "zip": bool, "service": bool } }
//
// Notes:
// - Idempotent-ish: if the same provider/zip/service exists, we no-op those inserts.
// - Uses minimal columns only (company_name, status) to avoid clashing with other schemas.

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const runtime = 'nodejs';

type SeedBody = {
  company_name?: string;
  zip?: string;
  service_code?: string;
  status?: 'active' | 'approved' | 'pending';
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) return bad('DATABASE_URL is not set', 500);

  let body: SeedBody;
  try {
    body = await req.json();
  } catch {
    return bad('Invalid JSON body');
  }

  const company_name = (body.company_name || '').trim();
  const zip = (body.zip || '').trim();
  const service_code = (body.service_code || '').trim();
  const status = (body.status || 'active') as 'active' | 'approved' | 'pending';

  if (!company_name) return bad('company_name is required');
  if (!zip) return bad('zip is required');
  if (!service_code) return bad('service_code is required');

  const sql = neon(DATABASE_URL);

  await sql`BEGIN`;
  await sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
  try {
    // 1) Ensure providers table has a unique key we can rely on.
    // If there is no unique constraint, we dedupe by company_name manually.
    const existing = await sql`
      SELECT id FROM providers WHERE company_name = ${company_name} LIMIT 1
    `;

    let provider_id: string;
    let created_provider = false;

    if ((existing as any[]).length > 0) {
      provider_id = (existing as any[])[0].id as string;
    } else {
      const inserted = await sql`
        INSERT INTO providers (company_name, status)
        VALUES (${company_name}, ${status})
        RETURNING id
      `;
      provider_id = (inserted as any[])[0].id as string;
      created_provider = true;
    }

    // 2) Upsert ZIP
    let created_zip = false;
    await sql`
      INSERT INTO provider_zips (provider_id, zip)
      VALUES (${provider_id}, ${zip})
      ON CONFLICT DO NOTHING
    `;
    // Best-effort: check existence
    const zipExists = await sql`
      SELECT 1 FROM provider_zips WHERE provider_id = ${provider_id} AND zip = ${zip} LIMIT 1
    `;
    created_zip = (zipExists as any[]).length > 0 && !created_provider ? false : true;

    // 3) Upsert service
    let created_service = false;
    await sql`
      INSERT INTO provider_services (provider_id, service_code)
      VALUES (${provider_id}, ${service_code})
      ON CONFLICT DO NOTHING
    `;
    const svcExists = await sql`
      SELECT 1 FROM provider_services WHERE provider_id = ${provider_id} AND service_code = ${service_code} LIMIT 1
    `;
    created_service = (svcExists as any[]).length > 0 && !created_provider ? false : true;

    await sql`COMMIT`;
    return NextResponse.json({
      ok: true,
      provider_id,
      created: { provider: created_provider, zip: created_zip, service: created_service }
    });
  } catch (err: any) {
    try { await sql`ROLLBACK`; } catch {}
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

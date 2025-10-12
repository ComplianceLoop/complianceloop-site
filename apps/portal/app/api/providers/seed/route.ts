// apps/portal/app/api/providers/seed/route.ts
// Purpose: Test-only seeding endpoint to insert a provider + its ZIP + service,
// bypassing stricter validations in /api/providers/apply.
//
// POST body (all fields required):
// {
//   "company_name": "Agent Test Provider 1",
//   "contact_email": "agent1@example.com",
//   "zip": "00901",
//   "service_code": "telehealth_consult",
//   "status": "active"            // one of: active | approved | pending
// }
//
// Response 200:
// { "ok": true, "provider_id": "uuid", "created": { "provider": bool, "zip": bool, "service": bool } }
//
// Notes:
// - We insert contact_email because your `providers` table has a NOT NULL constraint on it.
// - Idempotent-ish: if a provider already exists with the same contact_email or company_name, we reuse it.

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const runtime = 'nodejs';

type SeedBody = {
  company_name?: string;
  contact_email?: string;
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
  const contact_email = (body.contact_email || '').trim().toLowerCase();
  const zip = (body.zip || '').trim();
  const service_code = (body.service_code || '').trim();
  const status = (body.status || 'active') as 'active' | 'approved' | 'pending';

  if (!company_name) return bad('company_name is required');
  if (!contact_email) return bad('contact_email is required');
  if (!zip) return bad('zip is required');
  if (!service_code) return bad('service_code is required');

  const sql = neon(DATABASE_URL);

  await sql`BEGIN`;
  await sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
  try {
    // Try to find an existing provider by contact_email first, then by company_name.
    const existingByEmail = await sql`
      SELECT id FROM providers WHERE contact_email = ${contact_email} LIMIT 1
    `;
    let provider_id: string | null = (existingByEmail as any[])[0]?.id ?? null;

    if (!provider_id) {
      const existingByName = await sql`
        SELECT id FROM providers WHERE company_name = ${company_name} LIMIT 1
      `;
      provider_id = (existingByName as any[])[0]?.id ?? null;
    }

    let created_provider = false;
    if (!provider_id) {
      // Insert with the minimal known-good columns used by your system.
      // contact_email is included to satisfy NOT NULL constraint.
      const inserted = await sql`
        INSERT INTO providers (company_name, status, contact_email)
        VALUES (${company_name}, ${status}, ${contact_email})
        RETURNING id
      `;
      provider_id = (inserted as any[])[0].id as string;
      created_provider = true;
    } else {
      // Best-effort nudge to ensure status/contact_email are set; ignore errors if cols differ.
      try {
        await sql`
          UPDATE providers
          SET status = ${status}, contact_email = ${contact_email}
          WHERE id = ${provider_id}
        `;
      } catch {
        // If providers schema differs (e.g., no status), ignore quietly for seeding purposes.
      }
    }

    // Upsert ZIP mapping
    await sql`
      INSERT INTO provider_zips (provider_id, zip)
      VALUES (${provider_id}, ${zip})
      ON CONFLICT DO NOTHING
    `;

    // Upsert service mapping
    await sql`
      INSERT INTO provider_services (provider_id, service_code)
      VALUES (${provider_id}, ${service_code})
      ON CONFLICT DO NOTHING
    `;

    // Confirm existence for response flags
    const zipExists = await sql`
      SELECT 1 FROM provider_zips WHERE provider_id = ${provider_id} AND zip = ${zip} LIMIT 1
    `;
    const svcExists = await sql`
      SELECT 1 FROM provider_services WHERE provider_id = ${provider_id} AND service_code = ${service_code} LIMIT 1
    `;

    await sql`COMMIT`;
    return NextResponse.json({
      ok: true,
      provider_id,
      created: {
        provider: created_provider,
        zip: (zipExists as any[]).length > 0,
        service: (svcExists as any[]).length > 0
      }
    });
  } catch (err: any) {
    try { await sql`ROLLBACK`; } catch {}
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

// apps/portal/app/api/providers/apply/route.ts
import { NextResponse } from "next/server";
import { getSql } from "../../../../lib/neon";
import bootstrap from "../../../../db/bootstrap.sql";

export const dynamic = "force-dynamic";

type Body = {
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  services: string[];     // ["EXIT_SIGN","E_LIGHT","EXTINGUISHER"]
  postalCodes: string[];  // ["06010","10001"]
  country?: string;       // default "US"
};

export async function POST(req: Request) {
  const sql = getSql();
  await sql`${bootstrap}`; // ensure tables

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const errors: string[] = [];
  if (!body.companyName || body.companyName.trim().length < 2) errors.push("companyName");
  if (!body.contactEmail || !body.contactEmail.includes("@")) errors.push("contactEmail");
  if (!Array.isArray(body.services) || body.services.length === 0) errors.push("services");
  if (!Array.isArray(body.postalCodes) || body.postalCodes.length === 0) errors.push("postalCodes");
  if (errors.length) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  const country = (body.country ?? "US").toUpperCase();

  // INSERT provider using (text, params[]) form to satisfy Neon TS overloads
  const insertProviderSQL = `
    INSERT INTO providers (company_name, contact_email, contact_phone, status)
    VALUES ($1, $2, $3, 'pending')
    RETURNING id;
  `;
  const provRows = (await sql(insertProviderSQL, [
    body.companyName,
    body.contactEmail,
    body.contactPhone ?? null
  ] as any)) as Array<{ id: string }>;
  const providerId = provRows[0].id;

  // Insert services one-by-one (ON CONFLICT DO NOTHING)
  for (const s of body.services) {
    await sql(
      `INSERT INTO provider_services (provider_id, service_code)
       VALUES ($1, $2)
       ON CONFLICT (provider_id, service_code) DO NOTHING;`,
      [providerId, s] as any
    );
  }

  // Insert service areas one-by-one (ON CONFLICT DO NOTHING)
  for (const zip of body.postalCodes) {
    await sql(
      `INSERT INTO service_areas (provider_id, postal_code, country)
       VALUES ($1, $2, $3)
       ON CONFLICT (provider_id, postal_code, country) DO NOTHING;`,
      [providerId, zip, country] as any
    );
  }

  return NextResponse.json({ ok: true, providerId }, { status: 201 });
}

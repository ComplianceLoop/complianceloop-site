// apps/portal/app/api/providers/apply/route.ts
import { NextResponse } from "next/server";
import { getSql } from "../../../../lib/neon";
import bootstrap from "../../../../db/bootstrap.sql";

export const dynamic = "force-dynamic";

type Body = {
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  services: string[]; // e.g., ["EXIT_SIGN","E_LIGHT","EXTINGUISHER"]
  postalCodes: string[]; // e.g., ["06010","10001"]
  country?: string; // default US
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

  const country = body.country?.toUpperCase() || "US";

  // Create provider
  const [prov] = await sql<
    { id: string }
  >`
    INSERT INTO providers (company_name, contact_email, contact_phone, status)
    VALUES (${body.companyName}, ${body.contactEmail}, ${body.contactPhone || null}, 'pending')
    RETURNING id;
  `;

  // Services
  const svcValues = body.services.map((s) => sql`(${prov.id}, ${s})`);
  if (svcValues.length) {
    await sql`INSERT INTO provider_services (provider_id, service_code) VALUES ${sql.join(svcValues, sql`,`) }
      ON CONFLICT (provider_id, service_code) DO NOTHING;`;
  }

  // Service areas
  const areaValues = body.postalCodes.map((zip) => sql`(${prov.id}, ${zip}, ${country})`);
  if (areaValues.length) {
    await sql`INSERT INTO service_areas (provider_id, postal_code, country) VALUES ${sql.join(areaValues, sql`,`) }
      ON CONFLICT (provider_id, postal_code, country) DO NOTHING;`;
  }

  return NextResponse.json({ ok: true, providerId: prov.id }, { status: 201 });
}

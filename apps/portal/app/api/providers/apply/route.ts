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

function badRequest(msg: string, details?: unknown) {
  return NextResponse.json({ ok: false, error: "bad_request", message: msg, details }, { status: 400 });
}
function serverError(msg: string, details?: unknown) {
  return NextResponse.json({ ok: false, error: "server_error", message: msg, details }, { status: 500 });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const errors: string[] = [];
  if (!body.companyName || body.companyName.trim().length < 2) errors.push("companyName");
  if (!body.contactEmail || !body.contactEmail.includes("@")) errors.push("contactEmail");
  if (!Array.isArray(body.services) || body.services.length === 0) errors.push("services");
  if (!Array.isArray(body.postalCodes) || body.postalCodes.length === 0) errors.push("postalCodes");
  if (errors.length) return badRequest("Missing or invalid fields", { fields: errors });

  const companyName = body.companyName.trim();
  const contactEmail = body.contactEmail.trim();
  const contactPhone = (body.contactPhone || "").trim() || null;
  const services = body.services;
  const postalCodes = body.postalCodes.map((z) => String(z).trim()).filter(Boolean);
  const country = (body.country ?? "US").toUpperCase();

  const sql = getSql();

  // Ensure tables exist; if this errors, return a clear message.
  try {
    await sql`${bootstrap}`;
  } catch (err) {
    console.error("bootstrap error", err);
    return serverError("Database bootstrap failed");
  }

  try {
    // INSERT provider (params[] form to satisfy Neon TS)
    const insertProviderSQL = `
      INSERT INTO providers (company_name, contact_email, contact_phone, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING id;
    `;
    const provRows = (await sql(insertProviderSQL, [
      companyName,
      contactEmail,
      contactPhone
    ] as any)) as Array<{ id: string }>;

    if (!provRows?.length) {
      console.error("insert provider returned no rows");
      return serverError("Failed to create provider");
    }
    const providerId = provRows[0].id;

    // Services
    for (const s of services) {
      try {
        await sql(
          `INSERT INTO provider_services (provider_id, service_code)
           VALUES ($1, $2)
           ON CONFLICT (provider_id, service_code) DO NOTHING;`,
          [providerId, s] as any
        );
      } catch (err) {
        console.error("provider_services insert error", { providerId, s, err });
        return serverError("Failed to save provider services");
      }
    }

    // Areas
    for (const zip of postalCodes) {
      try {
        await sql(
          `INSERT INTO service_areas (provider_id, postal_code, country)
           VALUES ($1, $2, $3)
           ON CONFLICT (provider_id, postal_code, country) DO NOTHING;`,
          [providerId, zip, country] as any
        );
      } catch (err) {
        console.error("service_areas insert error", { providerId, zip, country, err });
        return serverError("Failed to save service areas");
      }
    }

    return NextResponse.json({ ok: true, providerId }, { status: 201 });
  } catch (err: any) {
    // Catch-all with useful diagnostics
    console.error("apply route unhandled error", err);
    // Don’t leak internals; send concise message to client
    return serverError("Unexpected error while creating provider");
  }
}

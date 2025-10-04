// apps/portal/app/api/providers/apply/route.ts
import { NextResponse } from "next/server";
import { exec } from "../../../../lib/neon"; // from apps/portal/app/api/providers/apply -> apps/portal/lib/neon.ts

type ApplyBody = {
  companyName: string;
  contactEmail: string;
  contactPhone?: string | null;
  postalCodes?: string; // comma or space separated: "06010,06011 06012"
  services?: string[];  // e.g., ["EXIT_SIGN","E_LIGHT"]
};

function bad(message = "bad_request") {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}
function fail(message: string, detail?: unknown) {
  return NextResponse.json({ ok: false, error: "server_error", message, detail }, { status: 500 });
}
function ok(data: unknown) {
  return NextResponse.json(data, { status: 200 });
}

export async function POST(request: Request) {
  // Parse + validate body
  let body: ApplyBody;
  try {
    body = (await request.json()) as ApplyBody;
  } catch {
    return bad();
  }
  if (!body?.companyName || !body?.contactEmail) {
    return bad();
  }

  try {
    // 1) Insert provider row (exec with text + params[])
    const insertProviderSql = `
      INSERT INTO providers (company_name, contact_email, contact_phone, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING id
    `;
    const [prov] = await exec<{ id: string }>(insertProviderSql, [
      body.companyName,
      body.contactEmail,
      body.contactPhone ?? null,
    ]);
    const providerId = prov.id;

    // 2) Upsert selected services (each as its own exec call)
    if (Array.isArray(body.services) && body.services.length) {
      const insertSvcSql = `
        INSERT INTO provider_services (provider_id, service_code)
        VALUES ($1, $2)
        ON CONFLICT (provider_id, service_code) DO NOTHING
      `;
      for (const svc of body.services) {
        await exec(insertSvcSql, [providerId, svc]);
      }
    }

    // 3) Insert ZIP coverage (accept comma/space separated; only 5-digit tokens)
    if (body.postalCodes) {
      const zips = body.postalCodes
        .split(/[,\s]+/g)
        .map((t) => t.trim())
        .filter((t) => /^\d{5}$/.test(t));

      if (zips.length) {
        const insertZipSql = `
          INSERT INTO provider_zips (provider_id, zip)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `;
        for (const z of zips) {
          await exec(insertZipSql, [providerId, z]);
        }
      }
    }

    return ok({ ok: true, providerId });
  } catch (err) {
    console.error("providers/apply error", err);
    return fail("Failed to apply provider", (err as Error)?.message ?? String(err));
  }
}

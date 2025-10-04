// apps/portal/app/api/providers/apply/route.ts
import { NextResponse } from "next/server";
import { getSql } from "../../../../lib/neon"; // NOTE: this path is correct from /app/api/providers/apply/route.ts

type ApplyBody = {
  companyName: string;
  contactEmail: string;
  contactPhone?: string | null;
  postalCodes?: string; // can be comma or space separated
  services?: string[];  // e.g., ["EXIT_SIGN","E_LIGHT"]
};

function serverError(message: string, detail?: unknown) {
  return NextResponse.json({ ok: false, error: "server_error", message, detail }, { status: 500 });
}

export async function POST(request: Request) {
  const sql = getSql();

  let body: ApplyBody;
  try {
    body = (await request.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  if (!body?.companyName || !body?.contactEmail) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  try {
    // 1) Insert provider row
    const [prov] = await sql<{ id: string }>`
      INSERT INTO providers (company_name, contact_email, contact_phone, status)
      VALUES (${body.companyName}, ${body.contactEmail}, ${body.contactPhone || null}, 'pending')
      RETURNING id;
    `;
    const providerId = prov.id;

    // 2) Upsert selected services
    if (Array.isArray(body.services) && body.services.length) {
      for (const svc of body.services) {
        await sql`
          INSERT INTO provider_services (provider_id, service_code)
          VALUES (${providerId}, ${svc})
          ON CONFLICT (provider_id, service_code) DO NOTHING;
        `;
      }
    }

    // 3) Insert ZIP coverage (one row per zip)
    // Accept both comma or space separated; keep only 5-digit zip tokens.
    if (body.postalCodes) {
      const tokens = body.postalCodes
        .split(/[,\s]+/g)
        .map((t) => t.trim())
        .filter(Boolean);
      const zips = tokens.filter((t) => /^\d{5}$/.test(t));
      for (const z of zips) {
        await sql`
          INSERT INTO provider_zips (provider_id, zip)
          VALUES (${providerId}, ${z})
          ON CONFLICT DO NOTHING;
        `;
      }
    }

    return NextResponse.json({ ok: true, providerId }, { status: 200 });
  } catch (err) {
    console.error("providers/apply error", err);
    return serverError("Failed to apply provider", (err as Error)?.message ?? String(err));
  }
}

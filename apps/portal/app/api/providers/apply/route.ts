// apps/portal/app/api/providers/apply/route.ts
import { NextResponse } from "next/server";
import { getSql } from "../../../lib/neon";

const VALID_CODES = new Set(["EXIT_SIGN", "E_LIGHT", "EXTINGUISHER"]);

function parseZips(raw?: string): string[] {
  if (!raw) return [];
  return raw
    // allow comma or space separated
    .split(/[\s,]+/)
    .map((z) => z.trim())
    .filter(Boolean)
    // normalize to 5-digit strings
    .map((z) => z.padStart(5, "0"))
    .filter((z) => /^[0-9]{5}$/.test(z));
}

export async function POST(req: Request) {
  const sql = getSql();

  try {
    const body = await req.json();

    const companyName: string = (body.companyName ?? body.company ?? "").trim();
    const contactEmail: string = (body.contactEmail ?? body.email ?? "").trim();
    const contactPhone: string | null = (body.contactPhone ?? body.phone ?? null)?.toString().trim() || null;
    const services: string[] = Array.isArray(body.services)
      ? body.services.filter((s: string) => VALID_CODES.has(s))
      : [];
    const zips = parseZips(body.postalCodes ?? body.zipCodes ?? body.postal_codes);

    if (!companyName || !contactEmail || services.length === 0) {
      return NextResponse.json(
        { ok: false, error: "invalid_input" },
        { status: 400 }
      );
    }

    // Insert or update provider (use contact_email as a stable key)
    const [{ id: providerId }] = await sql<{ id: string }>`
      INSERT INTO providers (company_name, contact_email, contact_phone, status)
      VALUES (${companyName}, ${contactEmail}, ${contactPhone}, 'pending')
      ON CONFLICT (contact_email) DO UPDATE
        SET company_name = EXCLUDED.company_name,
            contact_phone = EXCLUDED.contact_phone
      RETURNING id
    `;

    // Upsert selected service codes
    for (const code of services) {
      await sql`
        INSERT INTO provider_services (provider_id, service_code)
        VALUES (${providerId}, ${code})
        ON CONFLICT (provider_id, service_code) DO NOTHING
      `;
    }

    // Insert ZIP coverage, one row per ZIP (ignore duplicates)
    for (const zip of zips) {
      await sql`
        INSERT INTO provider_zips (provider_id, zip)
        VALUES (${providerId}, ${zip})
        ON CONFLICT (provider_id, zip) DO NOTHING
      `;
    }

    return NextResponse.json({ ok: true, providerId });
  } catch (err: any) {
    console.error("providers/apply error", err);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}

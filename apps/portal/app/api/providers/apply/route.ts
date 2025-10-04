// apps/portal/app/api/providers/apply/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "../../../lib/neon";

const BodySchema = z.object({
  companyName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional().nullable(),
  // UI sends a single string like: "06010 06011 06012" (spaces or commas)
  postalCodes: z.string().optional().default(""),
  // The UI checkboxes already produce these values
  services: z.array(z.enum(["EXIT_SIGN", "E_LIGHT", "EXTINGUISHER"])).min(1),
});

export async function POST(req: Request) {
  const sql = getSql();

  // Parse body
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // Normalize zip list from string field
  const zips = body.postalCodes
    .split(/[,\s]+/)
    .map((z) => z.trim())
    .filter((z) => /^\d{5}$/.test(z));

  try {
    // Insert provider and return id
    const [prov] = await sql<{ id: string }>`
      INSERT INTO providers (company_name, contact_email, contact_phone, status)
      VALUES (${body.companyName}, ${body.contactEmail}, ${body.contactPhone || null}, 'pending')
      RETURNING id;
    `;
    const providerId = prov.id;

    // Upsert services (one call per row; Neon supports one statement per call)
    for (const svc of body.services) {
      await sql`
        INSERT INTO provider_services (provider_id, service_code)
        VALUES (${providerId}, ${svc})
        ON CONFLICT (provider_id, service_code) DO NOTHING;
      `;
    }

    // Ensure provider_zips exists (safe to run on every call; single-statement calls)
    await sql`
      CREATE TABLE IF NOT EXISTS provider_zips (
        provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        zip         TEXT NOT NULL CHECK (zip ~ '^[0-9]{5}$'),
        PRIMARY KEY (provider_id, zip)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_provider_zips_zip ON provider_zips (zip);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_provider_zips_provider ON provider_zips (provider_id);`;

    // Insert ZIP coverage (one row per ZIP) – ON CONFLICT = idempotent
    for (const zip of zips) {
      await sql`
        INSERT INTO provider_zips (provider_id, zip)
        VALUES (${providerId}, ${zip})
        ON CONFLICT (provider_id, zip) DO NOTHING;
      `;
    }

    return NextResponse.json({ ok: true, providerId });
  } catch (err) {
    console.error("providers/apply error", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

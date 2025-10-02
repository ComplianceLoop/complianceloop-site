import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "../../../../lib/neon";

/**
 * Input schema
 *  - zip: 5-digit (we accept a prefix and do LIKE 'zip%')
 *  - services: array of service codes we require
 *  - limit: optional max rows (default 10)
 */
const BodySchema = z.object({
  zip: z.string().min(3).max(10),
  services: z
    .array(z.enum(["EXIT_SIGN", "E_LIGHT", "EXTINGUISHER"]))
    .min(1),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_body", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { zip, services, limit } = parsed.data;
    const sql = getSql();

    // Find providers that serve the ZIP prefix and have ALL requested services.
    const rows = await sql<{
      id: string;
      company_name: string;
      email: string | null;
      phone: string | null;
    }>`
      WITH req AS (
        SELECT UNNEST(${sql.array(services)}::text[]) AS svc
      ),
      prov AS (
        SELECT p.id, p.company_name, p.contact_email AS email, p.contact_phone AS phone
        FROM providers p
        JOIN provider_zips z
          ON z.provider_id = p.id
         AND z.zip LIKE ${zip + "%"}
      )
      SELECT p.id,
             p.company_name,
             p.email,
             p.phone
      FROM prov p
      WHERE NOT EXISTS (
        SELECT 1
        FROM req r
        WHERE NOT EXISTS (
          SELECT 1
          FROM provider_services s
          WHERE s.provider_id = p.id
            AND s.service_code = r.svc
        )
      )
      ORDER BY p.company_name ASC
      LIMIT ${limit}
    `;

    return NextResponse.json(
      { ok: true, input: { zip, services, limit }, candidates: rows },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", message: err?.message ?? "unknown" },
      { status: 500 }
    );
  }
}

// Explicit 405 for GET to avoid accidental navigation hits
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405 }
  );
}

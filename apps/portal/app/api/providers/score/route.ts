// apps/portal/app/api/providers/score/route.ts
import { NextResponse } from "next/server";
import { getSql } from "../../../../lib/neon";
import bootstrap from "../../../../db/bootstrap.sql";

export const dynamic = "force-dynamic";

/**
 * Very lightweight scoring:
 * - Provider must offer ALL requested services
 * - Postal code must match exactly in service_areas (or you can insert "00000" to mean statewide later)
 * - Score = number of matched services (i.e., requiredServices.length)
 */
type ReqBody = {
  postalCode: string;
  requiredServices: string[]; // e.g., ["EXIT_SIGN","E_LIGHT"]
  limit?: number;
};

export async function POST(req: Request) {
  const sql = getSql();
  await sql`${bootstrap}`;

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const required = Array.isArray(body.requiredServices) ? body.requiredServices : [];
  const postal = (body.postalCode || "").trim();
  const limit = Math.min(Math.max(body.limit ?? 10, 1), 50);

  if (!postal || required.length === 0) {
    return NextResponse.json({ ok: false, error: "postalCode and requiredServices required" }, { status: 400 });
  }

  // Find providers that have all required services AND cover the postal code
  const rows = await sql<{
    provider_id: string;
    company_name: string;
    contact_email: string;
    contact_phone: string | null;
    status: string;
    svc_count: number;
  }>`
    WITH candidates AS (
      SELECT p.id AS provider_id, p.company_name, p.contact_email, p.contact_phone, p.status
      FROM providers p
      JOIN service_areas a ON a.provider_id = p.id
      WHERE a.postal_code = ${postal} AND p.status IN ('pending','active')
    ),
    svc AS (
      SELECT ps.provider_id, COUNT(*) AS svc_count
      FROM provider_services ps
      WHERE ps.service_code = ANY(${required})
      GROUP BY ps.provider_id
    )
    SELECT c.provider_id, c.company_name, c.contact_email, c.contact_phone, c.status, COALESCE(s.svc_count,0) AS svc_count
    FROM candidates c
    LEFT JOIN svc s ON s.provider_id = c.provider_id
    WHERE COALESCE(s.svc_count,0) = ${required.length}
    ORDER BY c.status DESC, c.company_name ASC
    LIMIT ${limit};
  `;

  return NextResponse.json({
    ok: true,
    postalCode: postal,
    requiredServices: required,
    count: rows.length,
    providers: rows
  });
}

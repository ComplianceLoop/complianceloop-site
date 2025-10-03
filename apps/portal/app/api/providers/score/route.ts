import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "../../../lib/neon"; // use relative import to avoid path alias issues

const ScoreInput = z.object({
  zip: z.string().min(3).max(10),
  services: z.array(z.string()).min(1),
  limit: z.number().int().positive().max(50).default(10),
});

type CandidateRow = {
  id: string;
  company_name: string;
  email: string | null;
  phone: string | null;
};

// POST /api/providers/score
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = ScoreInput.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { zip, services, limit } = parsed.data;
    const sql = getSql();

    // Use positional parameters ($1..$n) to avoid template-type overload issues
    const query = `
      WITH prov AS (
        SELECT p.id,
               p.company_name,
               p.contact_email AS email,
               p.contact_phone AS phone
        FROM providers p
        JOIN provider_zips z
          ON z.provider_id = p.id
         AND z.zip LIKE $1
      )
      SELECT p.id,
             p.company_name,
             p.email,
             p.phone
      FROM prov p
      WHERE (
        SELECT COUNT(DISTINCT s.service_code)
        FROM provider_services s
        WHERE s.provider_id = p.id
          AND s.service_code = ANY($2::text[])
      ) = $3
      ORDER BY p.company_name ASC
      LIMIT $4;
    `;

    const values = [zip + "%", services, services.length, limit];
    const rows = (await sql(query, values)) as CandidateRow[];

    return NextResponse.json({
      ok: true,
      input: parsed.data,
      candidates: rows.map(r => ({
        id: r.id,
        companyName: r.company_name,
        email: r.email,
        phone: r.phone,
      })),
    });
  } catch (err) {
    console.error("providers/score error:", err);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}

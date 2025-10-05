// apps/portal/app/api/providers/score/route.ts
// Provider scoring / eligibility endpoint
//
// POST body: { zip: string, services: string[] }
// Returns: { eligible: Array<{ providerId: string; companyName: string; status: string }>, count: number }
//
// Logic:
//  • Find providers covering the ZIP (provider_zips.zip).
//  • Ensure provider has ALL requested services (provider_services.service_code).
//  • Filter status in ('approved','active') first; allow 'pending' only if no approved/active match.
//  • Sort: status DESC (active > approved > pending), company_name ASC.
//  • Limit 100.
//
// Security:
//  • Keep public for now; friendly to rate-limiting via CDN/edge (documented here).
//  • Do not leak secrets. Validate input strictly; return 400 on invalid input.
//
// Runtime:
//  • Node runtime for Neon serverless client.
export const runtime = "nodejs";

import { neon } from "@neondatabase/serverless";
import type { NextRequest } from "next/server";
import { rankStatus, validateEligibilityInput } from "@/lib/eligibility";

type ProviderRow = {
  id: string;
  company_name: string;
  status: "active" | "approved" | "pending" | string;
  status_rank: number;
};

type EligibleItem = {
  providerId: string;
  companyName: string;
  status: string;
};

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  return neon(url);
}

async function queryEligible(
  zip: string,
  services: string[],
  allowedStatuses: string[]
): Promise<ProviderRow[]> {
  const sql = getSql();

  // Ensure text[] typing and status array typing in SQL.
  const rows = await sql<ProviderRow[]>`
    with matches as (
      select
        p.id,
        p.company_name,
        p.status,
        case
          when p.status = 'active' then 3
          when p.status = 'approved' then 2
          when p.status = 'pending' then 1
          else 0
        end as status_rank
      from providers p
      join provider_zips z
        on z.provider_id = p.id
      join provider_services ps
        on ps.provider_id = p.id
       and ps.service_code = any(${services}::text[])
      where z.zip = ${zip}
        and p.status = any(${allowedStatuses}::text[])
      group by p.id, p.company_name, p.status
      having count(distinct ps.service_code) = array_length(${services}::text[], 1)
    )
    select id, company_name, status, status_rank
    from matches
    order by status_rank desc, company_name asc
    limit 100
  `;

  return rows;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const validation = validateEligibilityInput(body);
  if (!validation.ok) {
    return new Response(
      JSON.stringify({ error: validation.error }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const { zip, services } = validation.value;

  try {
    // First pass: only 'active' and 'approved'
    const primary = await queryEligible(zip, services, ["active", "approved"]);

    const rows =
      primary.length > 0
        ? primary
        : await queryEligible(zip, services, ["active", "approved", "pending"]);

    // Defensive sort in app layer to guarantee deterministic order.
    const sorted = rows
      .map((r) => ({
        providerId: r.id,
        companyName: r.company_name,
        status: r.status,
        _rank: rankStatus(r.status),
      }))
      .sort((a, b) => {
        if (b._rank !== a._rank) return b._rank - a._rank;
        return a.companyName.localeCompare(b.companyName);
      })
      .map<EligibleItem>(({ providerId, companyName, status }) => ({
        providerId,
        companyName,
        status,
      }));

    return new Response(
      JSON.stringify({ eligible: sorted, count: sorted.length }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    // Avoid leaking internals.
    console.error("[providers/score] error", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

/**
 * NOTES:
 * - This route is intentionally public (no session hard requirement) to simplify initial provider lookup.
 * - Apply CDN/edge rate limiting (e.g., Vercel Protect or middleware) in production. Suggested soft limit: 60 req/min per IP.
 * - All SQL is parameterized via @neondatabase/serverless neon tag; no string concatenation.
 */

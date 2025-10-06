// apps/portal/app/api/providers/score/route.ts
// Provider scoring / eligibility endpoint
//
// POST body: { zip: string, services: string[] }
// Returns: { eligible: Array<{ providerId: string; companyName: string; status: string }>, count: number }
//
// Logic:
//  • Find providers covering the ZIP (provider_zips.zip).
//  • Ensure provider has ALL requested services (provider_services.service_code).
//  • Prefer statuses 'active' and 'approved'; include 'pending' only if no active/approved match.
//  • Sort: status DESC (active > approved > pending), company_name ASC.
//  • Limit 100.
//
// Security: public for now; rate-limit at the CDN. Validate input; 400 on invalid.
// CORS: enabled below so browser tools (Hoppscotch/Postman Web) can call this route.
// Runtime: Node.js for Neon serverless client.
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

// --- CORS helpers (simple, permissive) ---
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "content-type": "application/json"
} as const;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
// -----------------------------------------

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  return neon(url);
}

/**
 * Implementation notes:
 * - Use UNNEST CTEs for array filters (services, statuses).
 * - Use parameterized text + params to avoid ANY($1) typed-template edge cases.
 * - Narrow cast the result to ProviderRow[] to bypass Neon TS overload ambiguity.
 */
async function queryEligible(
  zip: string,
  services: string[],
  allowedStatuses: string[]
): Promise<ProviderRow[]> {
  const sql = getSql();

  const text = `
    with svc as (
      select unnest($1::text[]) as service_code
    ),
    st as (
      select unnest($2::text[]) as status
    ),
    matches as (
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
      join st on st.status = p.status
      join provider_zips z
        on z.provider_id = p.id
       and z.zip = $3
      join provider_services ps
        on ps.provider_id = p.id
      join svc
        on svc.service_code = ps.service_code
      group by p.id, p.company_name, p.status
      having count(distinct ps.service_code) = (select count(*) from svc)
    )
    select id, company_name, status, status_rank
    from matches
    order by status_rank desc, company_name asc
    limit 100
  ` as const;

  const rows = (await (sql as unknown as (q: string, params?: unknown[]) => Promise<unknown>)(text, [
    services,
    allowedStatuses,
    zip
  ])) as ProviderRow[];

  return rows;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const validation = validateEligibilityInput(body);
  if (!validation.ok) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const { zip, services } = validation.value;

  try {
    // Prefer active/approved; only include pending if nothing matches.
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
        _rank: rankStatus(r.status)
      }))
      .sort((a, b) => {
        if (b._rank !== a._rank) return b._rank - a._rank;
        return a.companyName.localeCompare(b.companyName);
      })
      .map<EligibleItem>(({ providerId, companyName, status }) => ({
        providerId,
        companyName,
        status
      }));

    return new Response(JSON.stringify({ eligible: sorted, count: sorted.length }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err) {
    console.error("[providers/score] error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

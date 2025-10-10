/* apps/portal/app/api/providers/apply/route.ts
 *
 * Creates a provider and UPSERTS coverage + services in one transaction.
 * Contract (JSON body):
 * {
 *   "companyName": "Acme Co",
 *   "status": "pending" | "approved" | "active",
 *   "services": ["EXIT_SIGN","E_LIGHT"],
 *   "zips": ["11223"],
 *   "contactName": "Optional",
 *   "contactEmail": "agent@example.com"
 * }
 *
 * Returns: { ok: true, providerId: "uuid" } on success
 * Errors:  400 { ok:false, error:"bad_request" } for invalid body
 *          500 { ok:false, error:"server_error" } for unexpected failures
 */

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type ApplyBody = {
  companyName?: string;
  status?: string;
  services?: string[];
  zips?: string[];
  contactName?: string;
  contactEmail?: string;
};

const ALLOWED_STATUS = new Set(["pending", "approved", "active"]);
const ZIP_RE = /^[0-9]{5}$/;

function badRequest(msg = "bad_request") {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

function serverError(msg = "server_error") {
  return NextResponse.json({ ok: false, error: msg }, { status: 500 });
}

export async function POST(req: NextRequest) {
  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    return badRequest("invalid_json");
  }

  const companyName = (body.companyName ?? "").trim();
  const status = (body.status ?? "").trim().toLowerCase();
  const contactEmail = (body.contactEmail ?? "").trim();

  // Normalize arrays
  const services = Array.isArray(body.services)
    ? body.services
        .map((s) => String(s).trim())
        .filter(Boolean)
        .map((s) => s.toUpperCase())
    : [];

  const zips = Array.isArray(body.zips)
    ? body.zips.map((z) => String(z).trim()).filter(Boolean)
    : [];

  // Validate
  if (!companyName) return badRequest("missing_companyName");
  if (!ALLOWED_STATUS.has(status)) return badRequest("invalid_status");
  if (!contactEmail) return badRequest("missing_contactEmail");
  if (zips.length === 0) return badRequest("missing_zips");
  if (services.length === 0) return badRequest("missing_services");
  if (!zips.every((z) => ZIP_RE.test(z))) return badRequest("invalid_zip_format");

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) return serverError("db_not_configured");

  const sql = neon(DATABASE_URL);

  try {
    // ---- Transaction (function-call form) ----
    await sql("begin");

    // Insert provider and return id
    const rows = (await sql<{ id: string }[]>(
      "insert into providers (company_name, status, contact_email) values ($1, $2, $3) returning id",
      [companyName, status, contactEmail]
    )) as { id: string }[];

    const providerId = rows?.[0]?.id;
    if (!providerId) {
      await sql("rollback");
      return serverError("insert_failed");
    }

    // Upsert services
    await sql(
      `
      insert into provider_services (provider_id, service_code)
      select $1::uuid, s as service_code
      from unnest($2::text[]) as s
      on conflict do nothing
      `,
      [providerId, services]
    );

    // Upsert zips
    await sql(
      `
      insert into provider_zips (provider_id, zip)
      select $1::uuid, z as zip
      from unnest($2::text[]) as z
      on conflict do nothing
      `,
      [providerId, zips]
    );

    await sql("commit");

    return NextResponse.json({ ok: true, providerId }, { status: 200 });
  } catch (err) {
    try {
      await sql("rollback");
    } catch {
      // ignore rollback failure
    }
    return serverError();
  }
}

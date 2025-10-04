// apps/portal/app/api/providers/bootstrap/route.ts
import { NextResponse } from "next/server";
import { getSql } from "../../../../lib/neon";

/**
 * This route initializes the minimal tables needed by the provider flows.
 * IMPORTANT: We DO NOT import any .sql files here. Each statement is executed
 * separately to avoid multi-statement + loader issues in serverless builds.
 */

function ok(data: unknown = { ok: true }) {
  return NextResponse.json(data, { status: 200 });
}
function fail(message: string, detail?: unknown) {
  return NextResponse.json({ ok: false, error: "server_error", message, detail }, { status: 500 });
}

export async function POST() {
  const sql = getSql();

  try {
    // Extension helper; safe to attempt each deploy
    await sql`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    `;

    // Base providers table (minimal columns used by the app)
    await sql`
      CREATE TABLE IF NOT EXISTS providers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        contact_phone TEXT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    // Provider service capabilities (composite PK)
    await sql`
      CREATE TABLE IF NOT EXISTS provider_services (
        provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        service_code TEXT NOT NULL,
        PRIMARY KEY (provider_id, service_code)
      );
    `;

    // Provider ZIP coverage (composite PK + validation)
    await sql`
      CREATE TABLE IF NOT EXISTS provider_zips (
        provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        zip TEXT NOT NULL CHECK (zip ~ '^[0-9]{5}$'),
        PRIMARY KEY (provider_id, zip)
      );
    `;

    // Helpful indexes for lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_provider_zips_zip
      ON provider_zips (zip);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_provider_zips_provider
      ON provider_zips (provider_id);
    `;

    return ok({ ok: true, created: ["providers", "provider_services", "provider_zips"] });
  } catch (err) {
    console.error("providers/bootstrap error", err);
    return fail("Bootstrap failed", (err as Error)?.message ?? String(err));
  }
}

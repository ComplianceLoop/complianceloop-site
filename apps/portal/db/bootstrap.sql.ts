// apps/portal/db/bootstrap.sql.ts
// Lightweight DDL helpers to ensure tables exist (idempotent).
import { getSql } from "@/app/../lib/neon";

export async function ensureJobTables() {
  const sql = getSql();

  // jobs: one row per booking
  await sql(`
    create table if not exists jobs (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      customer_email text not null,
      site_label text,
      estimate_total_min_cents int not null,
      estimate_total_max_cents int not null,
      cap_amount_cents int not null,
      estimate_source text not null check (estimate_source in ('customer_known','example_bucket')),
      example_key text,
      preauth_id text,            -- Stripe PaymentIntent id (or placeholder)
      preauth_status text,        -- e.g., requires_action, authorized, mock
      status text not null default 'draft'
    );
  `);

  // job_items: one per service on job
  await sql(`
    create table if not exists job_items (
      id uuid primary key default gen_random_uuid(),
      job_id uuid not null references jobs(id) on delete cascade,
      service_code text not null check (service_code in ('EXIT_SIGN','E_LIGHT','EXTINGUISHER')),
      quantity_estimated int,
      quantity_confirmed int,
      unit_price_cents int not null,
      tier_snapshot jsonb
    );
  `);

  // customer_assets: stores discovered counts for future prefill (per site/customer/service)
  await sql(`
    create table if not exists customer_assets (
      id uuid primary key default gen_random_uuid(),
      customer_email text not null,
      site_label text,
      service_code text not null check (service_code in ('EXIT_SIGN','E_LIGHT','EXTINGUISHER')),
      last_confirmed_qty int not null,
      updated_at timestamptz not null default now(),
      unique (customer_email, coalesce(site_label, ''), service_code)
    );
  `);
}

// apps/portal/db/bootstrap.sql.ts
// Idempotent DDL for core job flow + provider directory & eligibility.
// NOTE: Keep this file pure SQL in a default export string.
// Routes import and execute it to ensure tables exist on-demand.

const sql = `
-- Enable UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- Jobs (existing Phase 5)
-- =========================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_email TEXT NOT NULL,
  site_label TEXT,
  estimate_source TEXT NOT NULL,
  example_key TEXT,
  total_min_cents INTEGER NOT NULL,
  total_max_cents INTEGER NOT NULL,
  cap_amount_cents INTEGER NOT NULL,
  preauth_mode TEXT NOT NULL,
  preauth_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_items (
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  quantity_estimated INTEGER NOT NULL DEFAULT 0,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (job_id, service_code)
);

CREATE INDEX IF NOT EXISTS idx_jobs_email ON jobs(customer_email);

-- Counts per customer/site/service_code discovered during reconciliation
CREATE TABLE IF NOT EXISTS customer_assets (
  customer_email TEXT NOT NULL,
  site_label TEXT NOT NULL DEFAULT '',
  service_code TEXT NOT NULL,
  last_confirmed_qty INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_email, site_label, service_code)
);

-- =========================
-- Providers (Phase 6)
-- =========================
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|active|rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Services a provider offers (codes match job_items.service_code)
CREATE TABLE IF NOT EXISTS provider_services (
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  PRIMARY KEY (provider_id, service_code)
);

-- Basic service area model by postal code (US by default)
CREATE TABLE IF NOT EXISTS service_areas (
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  PRIMARY KEY (provider_id, postal_code, country)
);

-- Eligibility rules bucket (JSON-based)
CREATE TABLE IF NOT EXISTS eligibility_rules (
  id SERIAL PRIMARY KEY,
  rule_key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_providers_status ON providers(status);
CREATE INDEX IF NOT EXISTS idx_service_areas_zip ON service_areas(postal_code);
`;

export default sql;

-- apps/portal/db/bootstrap.sql
-- Idempotent bootstrap for prod & preview environments

-- 1) UUID helper (used by tables with DEFAULT gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Providers
CREATE TABLE IF NOT EXISTS providers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name  TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Services offered by providers
CREATE TABLE IF NOT EXISTS provider_services (
  provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  PRIMARY KEY (provider_id, service_code)
);

CREATE INDEX IF NOT EXISTS idx_provider_services_service
  ON provider_services (service_code);
CREATE INDEX IF NOT EXISTS idx_provider_services_provider
  ON provider_services (provider_id);

-- 4) ZIP coverage per provider  (<< newly added table)
CREATE TABLE IF NOT EXISTS provider_zips (
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  zip         TEXT NOT NULL CHECK (zip ~ '^[0-9]{5}$'),
  PRIMARY KEY (provider_id, zip)
);

CREATE INDEX IF NOT EXISTS idx_provider_zips_zip
  ON provider_zips (zip);
CREATE INDEX IF NOT EXISTS idx_provider_zips_provider
  ON provider_zips (provider_id);

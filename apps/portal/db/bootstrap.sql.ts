-- apps/portal/db/bootstrap.sql
-- Idempotent bootstrap for prod & preview environments

-- UUID helper (used by tables with DEFAULT gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

------------------------------------------------------------
-- PROVIDERS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS providers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name   TEXT NOT NULL,
  contact_email  TEXT NOT NULL UNIQUE,
  contact_phone  TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------
-- PROVIDER SERVICES (one row per provider x service)
-- Valid codes used in the app: EXIT_SIGN, E_LIGHT, EXTINGUISHER
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provider_services (
  provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  PRIMARY KEY (provider_id, service_code),
  CONSTRAINT chk_service_code CHECK (service_code IN ('EXIT_SIGN','E_LIGHT','EXTINGUISHER'))
);

CREATE INDEX IF NOT EXISTS idx_provider_services_provider_id
  ON provider_services (provider_id);

CREATE INDEX IF NOT EXISTS idx_provider_services_service_code
  ON provider_services (service_code);

------------------------------------------------------------
-- PROVIDER ZIP COVERAGE (one row per provider x ZIP)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provider_zips (
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  zip         TEXT NOT NULL CHECK (zip ~ '^[0-9]{5}$'),
  PRIMARY KEY (provider_id, zip)
);

CREATE INDEX IF NOT EXISTS idx_provider_zips_zip
  ON provider_zips (zip);

CREATE INDEX IF NOT EXISTS idx_provider_zips_provider_id
  ON provider_zips (provider_id);

------------------------------------------------------------
-- (Optional / already present in your repo) JOBS
-- Kept idempotent in case bootstrap runs before these existed.
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email      TEXT NOT NULL,
  site_label          TEXT,
  total_min_cents     INTEGER,
  total_max_cents     INTEGER,
  cap_amount_cents    INTEGER,
  estimate_source     TEXT,
  example_key         TEXT,
  preauth_id          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_customer_email
  ON jobs (customer_email);

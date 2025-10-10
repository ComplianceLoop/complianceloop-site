-- apps/portal/db/bootstrap.sql
-- Idempotent DDL for Assignment Engine
-- Safe to run multiple times.

-- 1) jobs: lifecycle of a request to assign
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code TEXT NOT NULL,
  zip TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','offered','assigned','expired','cancelled')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) job_offers: broadcast offers to eligible providers with soft-hold expiry
CREATE TABLE IF NOT EXISTS job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('offered','accepted','declined','expired','cancelled')) DEFAULT 'offered',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, provider_id)
);

-- 3) job_assignments: single winner per job (enforced by PK)
CREATE TABLE IF NOT EXISTS job_assignments (
  job_id UUID PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) assignment_logs: append-only audit trail
CREATE TABLE IF NOT EXISTS assignment_logs (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID,
  provider_id UUID,
  event TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_job_offers_job_expires ON job_offers (job_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_job_offers_status ON job_offers (status);

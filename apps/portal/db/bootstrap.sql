-- apps/portal/db/bootstrap.sql
-- Assignment Engine schema (idempotent) + gentle migrations for existing tables.
-- Safe to run multiple times.

-- Ensure UUID generator exists (Neon usually has this already).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) jobs: lifecycle of an assignment request
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns may be added below via ALTER TABLE for existing installs
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill/migrate columns for older deployments (no-op if they already exist)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_code TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS zip TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status TEXT;

-- Make status values consistent; add the CHECK constraint if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_status_check'
      AND conrelid = 'jobs'::regclass
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_status_check
      CHECK (status IN ('pending','offered','assigned','expired','cancelled'));
  END IF;
END $$;

-- Optionally set NOT NULL where safe; if any row is null this will be skipped.
-- (We keep these columns nullable for maximum compatibility.)
-- ALTER TABLE jobs ALTER COLUMN service_code SET NOT NULL;
-- ALTER TABLE jobs ALTER COLUMN zip SET NOT NULL;
-- ALTER TABLE jobs ALTER COLUMN status SET NOT NULL;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);

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

CREATE INDEX IF NOT EXISTS idx_job_offers_job_expires ON job_offers (job_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_job_offers_status ON job_offers (status);

-- 3) job_assignments: exactly one winner per job (enforced by PK)
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

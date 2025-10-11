-- apps/portal/db/bootstrap.sql
-- Assignment Engine schema (idempotent) — **namespaced** to avoid clashing with any existing "jobs" table.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- NAMESPACED TABLES (prefix: assign_)
-- =========================================================

-- 1) assign_jobs: lifecycle of an assignment request
CREATE TABLE IF NOT EXISTS assign_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code TEXT NOT NULL,
  zip TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','offered','assigned','expired','cancelled')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assign_jobs_status ON assign_jobs (status);

-- 2) assign_job_offers: broadcast offers to eligible providers with soft-hold expiry
CREATE TABLE IF NOT EXISTS assign_job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES assign_jobs(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('offered','accepted','declined','expired','cancelled')) DEFAULT 'offered',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_assign_job_offers_job_expires ON assign_job_offers (job_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_assign_job_offers_status ON assign_job_offers (status);

-- 3) assign_job_assignments: exactly one winner per job (enforced by PK)
CREATE TABLE IF NOT EXISTS assign_job_assignments (
  job_id UUID PRIMARY KEY REFERENCES assign_jobs(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) assign_logs: append-only audit trail
CREATE TABLE IF NOT EXISTS assign_logs (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID,
  provider_id UUID,
  event TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- NOTE:
-- We intentionally do NOT touch any pre-existing "jobs" table.
-- All Assignment Engine code uses the assign_* tables above.
-- =========================================================

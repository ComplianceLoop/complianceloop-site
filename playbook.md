# ComplianceLoop Playbook

**Canonical Repo:** `ComplianceLoop/complianceloop-site` (branch: `main`)  
Repo: https://github.com/ComplianceLoop/complianceloop-site

**Hosting:** Vercel (team: `compliance-loop`)  
- Marketing project: `complianceloop-site` → https://vercel.com/compliance-loop/complianceloop-site  
- Portal project: `complianceloop-portal` → https://vercel.com/compliance-loop/complianceloop-portal  
- Domains:  
  - Marketing: https://www.complianceloop.com  
  - Portal: https://portal.complianceloop.com

## Architecture (Hybrid + R2 + Next.js)
- **System of record:** Neon Postgres.
- **Back-office UI:** Airtable (Postgres → Airtable sync).
- **Storage:** Cloudflare R2 (private). Files are only streamed to authenticated sessions.
- **Email:** Resend (email code login).
- **Portal/Admin app:** Next.js in `/apps/portal`.

### Security & Access
- Portal links are **stable** per customer; actual access requires fresh email code.
- Sessions are **short-lived** and stored in Postgres.
- **Preview deployments** are restricted to staff (middleware allowlist by email domain and optional IP allowlist).

### Sync Strategy
- Default: one-way Postgres → Airtable (nightly + manual “Export to Airtable”).
- Two-way can be added later with webhooks and a clear conflict policy (Postgres wins).

## Environments & Secrets
- Use Vercel project env vars. Never commit secrets.
- Common env vars (prod/preview/dev):
  - `DATABASE_URL` (Neon)
  - `RESEND_API_KEY`
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
  - `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`

## Repos & Files (create/edit via these links)
- Smoke workflow: `.github/workflows/agent-smoke.yml`  
  Edit: https://github.com/ComplianceLoop/complianceloop-site/edit/main/.github/workflows/agent-smoke.yml
- Smoke script: `scripts/agent-smoke.mjs`  
  Edit: https://github.com/ComplianceLoop/complianceloop-site/edit/main/scripts/agent-smoke.mjs
- Portal CI: `.github/workflows/portal-ci.yml`  
  Edit: https://github.com/ComplianceLoop/complianceloop-site/edit/main/.github/workflows/portal-ci.yml
- Airtable Sync: `.github/workflows/sync-airtable.yml`  
  Edit: https://github.com/ComplianceLoop/complianceloop-site/edit/main/.github/workflows/sync-airtable.yml
- Portal app root: `/apps/portal`  
  New file in folder: https://github.com/ComplianceLoop/complianceloop-site/new/main/apps/portal

## Operational Notes (Dynamic)
- Preview URLs change per PR; middleware must enforce allowlists at runtime.
- Rotate per-customer portal secrets from the Admin if access needs to be revoked.
- Use canary deploys or staged rollouts for auth/file-route changes.

## Runbook: High-Level Steps
1. **Create/Attach Neon** to `complianceloop-portal` project; confirm `DATABASE_URL` exists.
2. **Configure R2** bucket (private) and add four env vars in Vercel.
3. **Verify Resend** domain and add `RESEND_API_KEY`.
4. **Set Airtable** token and base ID for sync job.
5. **Deploy Portal** (`/apps/portal`) to `complianceloop-portal` project on Vercel.
6. **Enable Middleware** to restrict preview deployments to staff.
7. **Run Smoke** workflow to verify auth + one sample file stream.

## Success Criteria
- Customer can open stable portal URL, receive code, sign in, and view Upcoming/Past jobs.
- Job page shows certificate, photos, and invoice; private files stream from R2 only when signed in.
- Admin can create jobs, upload assets, rotate portal links, and export to Airtable.
- Previews are restricted; production domain is public.

## Safe Rollbacks
- If portal deploy fails: unassign `portal.complianceloop.com` from the failing deployment in Vercel; re-point to last good build.
- If auth or file routes break: revert PR; Postgres and R2 are unchanged. Sessions auto-expire.

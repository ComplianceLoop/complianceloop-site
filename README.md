# ComplianceLoop — site

[![Agent smoke](https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/agent-smoke.yml/badge.svg?branch=main)](https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/agent-smoke.yml)
[![Vercel + GitHub Inventory](https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/vercel-inventory.yml/badge.svg?branch=main)](https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/vercel-inventory.yml)

Operational home for the public site and CI checks.

---

## Quick links

- Vercel project: https://vercel.com/compliance-loop/complianceloop-site  
- Domains: https://vercel.com/compliance-loop/complianceloop-site/settings/domains  
- Deployment Protection: https://vercel.com/compliance-loop/complianceloop-site/settings/deployment-protection  

### Workflows
- **Agent smoke** (manual): https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/agent-smoke.yml  
- **Vercel + GitHub Inventory** (manual): https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/vercel-inventory.yml  

---

## Playbook

> One page procedures for agents and humans.

### A. Update the Origin Allowlist
- Source of truth: **`playbook/allowlist.md`**  
  https://github.com/ComplianceLoop/complianceloop-site/blob/main/playbook/allowlist.md
- Vercel env var that powers CORS/ingest: typically **`ORIGIN_ALLOWLIST`**  
  (Project → Settings → *Environment Variables*):  
  https://vercel.com/compliance-loop/complianceloop-site/settings/environment-variables
- If preview links change frequently, include a wildcard entry for preview deployments (example shown in the allowlist page).

**Standard steps (quick):**
1. Run **Inventory** to see the latest preview domains:  
   https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/vercel-inventory.yml → **Run workflow**.
2. Append any missing preview origins to the allowlist (see rules + examples in `playbook/allowlist.md`).
3. Update the Vercel env var `ORIGIN_ALLOWLIST` **and** commit the same change to `playbook/allowlist.md` (keeps docs and runtime in sync).
4. Re-run **Agent smoke** to verify:  
   https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/agent-smoke.yml → **Run workflow**.

### B. Re-run the smoke test
1. Open: https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/agent-smoke.yml  
2. **Run workflow** → keep defaults → **Run**.  
   The job bypasses preview protection, hits `/api/ping` and `/api/ingest`, and logs pass/fail.

---

## Notes

- The bypass token is configured under **Protection Bypass for Automation** in Vercel and mirrored in GitHub repo secrets.  
  Vercel: https://vercel.com/compliance-loop/complianceloop-site/settings/deployment-protection  
  GitHub Secrets: https://github.com/ComplianceLoop/complianceloop-site/settings/secrets/actions
- The **Inventory** workflow prints a readable JSON of projects and is the first step before adjusting allowlists.

## Previews & Deploys

This repository is deployed via [Vercel](https://vercel.com) using a single canonical project: **complianceloop-site**.  The following steps explain how to work with preview deployments and run smoke tests:

1. **Get the preview URL**  
   – Navigate to the GitHub Actions tab and run the **Scan Vercel Refs** workflow.  This job prints the URL of the most recent preview deployment for the current branch.  
   – Copy the URL from the workflow logs.  It typically looks like `https://complianceloop-site-git-<branch>-compliance-loop.vercel.app`.

2. **Trigger smoke tests**  
   – Run the **Agent Smoke** workflow and paste the preview URL into the `preview_url` input.  The workflow will run end‑to‑end smoke tests against the deployment using the `VERCEL_BYPASS_TOKEN` secret to bypass preview protection.  
   – Review the artifacts and logs to ensure the site is functioning correctly.

3. **Required secrets and variables**  
   – The repository requires several secrets to be set in GitHub before deployments succeed.  At a minimum, ensure the following secrets exist (values are stored securely in GitHub and not checked into the repository):  
     – `VERCEL_BYPASS_TOKEN` – matches the Protection Bypass token configured on the Vercel project.  
     – `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (or define `VercelTeamSlug` variable) – used by the scan workflow.  
   – See `scripts/check-env.mjs` for a full list of runtime environment variables expected on Vercel.  Missing variables will cause deployments to fail.

4. **Redeploy**  
   – After adding new environment variables or changing root settings in the Vercel UI, trigger a redeploy from the **Deployments** tab on Vercel.  A green deployment indicates success.

All other Vercel projects related to this repo (e.g. `complianceloop-next-root`, `complianceloop-site-ievg`, etc.) should be considered legacy and will be decommissioned once consolidation is complete.

# ComplianceLoop Playbook

_Last updated: {{TODAY}}_

## Mission
Keep `complianceloop.com` reliable and fast. Automate smoke checks, preview auth, domain config sanity, and API health.

## Canonical Sources
- **Repo (site):** https://github.com/ComplianceLoop/complianceloop-site
- **Vercel Project:** https://vercel.com/compliance-loop/complianceloop-site
- **Deployments:** https://vercel.com/compliance-loop/complianceloop-site/deployments

## Secrets (in GitHub → Actions)
- `VERCEL_TOKEN`
- `VERCEL_TEAM_ID`
- `VERCEL_TEAM_SLUG`
- `VERCEL_PROJECT_ID`
- `VERCEL_BYPASS_TOKEN`
- `PREVIEW_URL` _(optional default for ad-hoc runs)_
- `GH_TOKEN` _(optional, for repo queries / PRs)_

## Preview Access
Previews are protected. Always set a bypass cookie + send header:
- Query: `?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=$VERCEL_BYPASS_TOKEN`
- Header: `x-vercel-protection-bypass: $VERCEL_BYPASS_TOKEN`

## Health Checks (what “passes”)
- `/api/ping` → 2xx/3xx OR `/` → 2xx/3xx
- `/api/ingest` → 2xx/3xx (if route exists)
- No 401 after bypass cookie+header
- Root renders within 5s TTFB on preview

## Domains
Manage here: https://vercel.com/compliance-loop/complianceloop-site/settings/domains  
Expected:
- `complianceloop.com` → Production
- `www.complianceloop.com` → Redirects to apex (or production)
- `…vercel.app` → Preview/Production OK  
If “DNS Change Recommended” appears, verify DNS and click **Refresh**.

## Allowlist & CORS _(if applicable)_
- `ORIGIN_ALLOWLIST` should include:
  - `https://complianceloop.com`
  - `https://www.complianceloop.com` (if used)
  - `https://*.vercel.app`
  - `http://localhost:3000`

## Agent Workflows
- **Agent smoke:** manual + reusable to verify a preview
- **Agent maintenance:** scheduled; inventories Vercel+GitHub and opens PRs for fixes

## Operational Notes
- Previews rotate per deploy — pass the latest preview URL into manual runs.
- If a 401 persists after cookie+header, confirm the token belongs to **this** project.
- Keep this playbook updated as the source of truth.

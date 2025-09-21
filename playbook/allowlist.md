# Origin Allowlist (Source of Truth)

This page is the **canonical list** of allowed origins for browser requests to `POST /api/ingest` (and any CORS-gated endpoints).

- Runtime uses the Vercel project env var: **`ORIGIN_ALLOWLIST`**  
  Manage it here → https://vercel.com/compliance-loop/complianceloop-site/settings/environment-variables
- CI helpers:  
  – **Inventory** (list projects/domains): https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/vercel-inventory.yml  
  – **Agent smoke** (ping + ingest): https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/agent-smoke.yml

---

## Update procedure (for agents)

1. **Discover**: Run the Inventory workflow to see the latest preview deployment URL(s).  
   https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/vercel-inventory.yml → **Run workflow**.
2. **Edit this file** and add any new origins to the list below (keep it sorted).  
   Use a wildcard for the per-deploy preview host when possible.
3. **Apply to Vercel**: Update `ORIGIN_ALLOWLIST` with the **exact same list** (comma-separated).  
   https://vercel.com/compliance-loop/complianceloop-site/settings/environment-variables
4. **Verify**: Re-run Agent smoke and ensure **PASS**.  
   https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/agent-smoke.yml
5. **Record**: Add a short changelog entry under “History” below.

> Tip: For preview deployments created by Vercel, a robust wildcard entry looks like:  
> `https://complianceloop-site-*-compliance-loop.vercel.app`

---

## Current allowlist (one per line; mirrors the env var, sorted)
https://complianceloop.com
https://www.complianceloop.com
https://complianceloop-site.vercel.app
https://complianceloop-site-*-compliance-loop.vercel.app
http://localhost:3000

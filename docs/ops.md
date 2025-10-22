# ComplianceLoop Ops Runbook (Vercel + GitHub)

**Canonical Vercel project:** `complianceloop-site` (team: `compliance-loop`)  
**Repo:** https://github.com/ComplianceLoop/complianceloop-site

## Restore Production Quickly

**Instant Rollback (no rebuild, to prior prod)**
1. Project → Deployments → open a known-good **Production** deployment.
2. ▾ (next to Visit) → **Instant Rollback** → confirm.
3. Domains: https://vercel.com/compliance-loop/complianceloop-site/settings/domains → **Refresh** both.
4. Smoke: https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/agent-smoke.yml → **Run workflow**.

**Promote by Alias (no rebuild, to a Preview)**
- Run: https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/ops-promote-alias.yml  
- Input: paste the Preview URL.  
- Refresh domains → run Smoke.

## Consolidation

- Inventory: https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/vercel-inventory.yml  
- Decommission (dry-run → real): https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/ops-vercel-decommission.yml  
- Re-run Inventory + Smoke and attach links in the PR.

## Guardrails

- Canonical project: `complianceloop-site`.  
- Automation branches (e.g., `agent-sync`) do **not** auto-deploy Production (Ignored Build Step).  
- Secrets live in GitHub **Environments**; reference by name only (e.g., `VERCEL_TOKEN`).  
- Merges to `main` require Smoke green.

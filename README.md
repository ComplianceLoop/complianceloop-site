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
- Run **Agent smoke**: https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/agent-smoke.yml  
- Run **Vercel + GitHub Inventory**: https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/vercel-inventory.yml  

---

## How to re-run the smoke test

1. Open the workflow page: https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/agent-smoke.yml  
2. Click **Run workflow** → keep defaults → **Run**.

The job uses the Vercel automation-bypass token and current preview URL to probe:
- `GET /api/ping`
- `POST /api/ingest` (form-encoded)
and prints pass/fail in the logs.

---

## Notes

- Bypass secret is configured in Vercel (**Protection Bypass for Automation**) and mirrored in repo secrets.  
- Inventory job lists Vercel projects and basic GitHub repo signals to help keep a single “source of truth”.

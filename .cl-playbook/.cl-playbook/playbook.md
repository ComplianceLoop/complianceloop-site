# ComplianceLoop Playbook (Living Doc)

## Scope
Single source of truth for how we build, deploy, test, and automate the ComplianceLoop website and APIs.

## Canonical Targets
- GitHub repo (canonical): `ComplianceLoop/complianceloop-site` (branch `main`)
- Vercel team: `compliance-loop`
- Vercel project: `complianceloop-site`
- Production domain(s): `complianceloop.com`, `www.complianceloop.com`

## Non-Secret Identifiers
- `VERCEL_TEAM_SLUG`: compliance-loop
- `VERCEL_PROJECT_ID`: (in secrets; reference name only)
- `VERCEL_TEAM_ID`: (in secrets; reference name only)

## Secrets (names only; values live in GitHub > Settings > Secrets and Vercel)
- GitHub Actions: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `VERCEL_TEAM_SLUG`, `VERCEL_BYPASS_TOKEN`, `GH_TOKEN` (optional), `PREVIEW_URL` (optional override)
- Vercel: `VERCEL_AUTOMATION_BYPASS_SECRET` (a.k.a. protection bypass for automation)

## Workflows
- Smoke test: `.github/workflows/agent-smoke.yml`
  - Inputs: `preview_url` (optional), `redeploy` (default true)
  - Behavior: resolves latest READY preview if none provided; runs `scripts/agent-smoke.mjs`; optionally redeploys preview
- Inventory (read-only): `.github/workflows/vercel-inventory.yml` (optional)

## Operational Notes
- Preview URLs rotate per deployment; the smoke workflow can auto-resolve the latest READY preview.
- For protected previews, we use the Vercel automation bypass token (via `x-vercel-protection-bypass` when needed).

## Response Rules (for assistants/agents)
- Provide **full-file** replacements for any code/config edits.
- Always include **clickable** GitHub edit links and Vercel settings links.
- Never print secret values; only refer to secret names.

## Runbooks
### Runbook: “Run smoke”
1. Go to: `https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/agent-smoke.yml`
2. Click **Run workflow** → (optional) paste explicit preview URL → Run.
3. Pass criteria: ping OK, CORS OK, 2xx on key endpoints; workflow status **success**.

### Runbook: “Update allowlist”
- Update allowlist via maintenance workflow or code (path documented where it lives).
- Re-run smoke with `redeploy=true` or let auto-redeploy step run.
- Confirm via inventory or production preview.

## Change Log
- 2025-09-20: Canonical repo/project set; smoke redeploy automation enabled.

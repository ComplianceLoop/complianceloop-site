# Agent Readme — Canonical, Public Read Access

This repository is **public**. Agents must use these public endpoints to **read** files/folders (no auth required):

## 1) Raw file URLs (preferred for single files)

**Pattern**  
`https://raw.githubusercontent.com/ComplianceLoop/complianceloop-site/main/<path>`

**Examples**  
- decisions.json  
  https://raw.githubusercontent.com/ComplianceLoop/complianceloop-site/main/decisions.json
- Provider score route  
  https://raw.githubusercontent.com/ComplianceLoop/complianceloop-site/main/apps/portal/app/api/providers/score/route.ts
- Eligibility helper  
  https://raw.githubusercontent.com/ComplianceLoop/complianceloop-site/main/apps/portal/lib/eligibility.ts
- DB bootstrap  
  https://raw.githubusercontent.com/ComplianceLoop/complianceloop-site/main/apps/portal/db/bootstrap.sql

## 2) GitHub Contents API (preferred for folder listings)

**Pattern**  
`https://api.github.com/repos/ComplianceLoop/complianceloop-site/contents/<path>?ref=main`

**Examples**  
- Repo root listing  
  https://api.github.com/repos/ComplianceLoop/complianceloop-site/contents?ref=main
- API folder listing  
  https://api.github.com/repos/ComplianceLoop/complianceloop-site/contents/apps/portal/app/api?ref=main
- Provider score folder  
  https://api.github.com/repos/ComplianceLoop/complianceloop-site/contents/apps/portal/app/api/providers/score?ref=main

> Public API reads are rate-limited (~60/h per IP). Prefer **Raw** URLs for direct file fetches.

## 3) Canonical Link Index

The repo includes `links.agent.json` at the root with the **authoritative list** of important raw/API endpoints. Agents should prefer using that file first.

- Raw: https://raw.githubusercontent.com/ComplianceLoop/complianceloop-site/main/links.agent.json

## 4) No Secrets

Do **not** commit or request secrets. Refer to them by **name** only (e.g., `DATABASE_URL`, `AIRTABLE_API_KEY`). Build and runtime secrets live in Vercel/GitHub.

## 5) Verify (copy/paste)

```bash
# Read decisions.json via raw:
curl -sfL https://raw.githubusercontent.com/ComplianceLoop/complianceloop-site/main/decisions.json | jq '.version, .currentPhase'

# List the repo root via Contents API:
curl -sfL https://api.github.com/repos/ComplianceLoop/complianceloop-site/contents?ref=main | jq '.[0]'

# Fetch an app source file via raw:
curl -sfL https://raw.githubusercontent.com/ComplianceLoop/complianceloop-site/main/apps/portal/app/api/providers/score/route.ts | sed -n '1,30p'

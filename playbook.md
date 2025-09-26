# ComplianceLoop Playbook
_Last updated: 2025-09-26 by CL Playbook_

## Authoring Standard (MANDATORY)
**Use this exact wording in every chat and document.**

- Write instructions step-by-step with explicit UI clicks (e.g., “Vercel → Project → Settings → Security → Protection → Preview Deployments”).
- Include a direct, clickable URL for every external step (GitHub pages, Vercel settings, deployments, etc.).
- Provide copy-pasteable commands with clearly marked placeholders (e.g., <PASTE_URL>, <TEAM_ID>), and show Windows + macOS variants when relevant.
- Never print secrets; refer to them by secret name (e.g., `VERCEL_TOKEN`). If a token is needed, say where to create/copy it and where to store it.
- When editing repo files, provide full-file replacements (no “insert above/below line”). Also include the direct GitHub **edit URL** for that file.
- State success criteria and safe rollback steps for every procedure.
- If the UI can differ, include a brief “What you might see” note and the fallback path.
- Default tone: concise, kind, senior-developer practical.

---

## Canonical Repos & Projects
- **Repo (canonical):** `ComplianceLoop/complianceloop-site` (branch: `main`)
- **Vercel Team:** `compliance-loop`
- **Vercel Projects:**
  - `complianceloop-site` — marketing/docs
  - `complianceloop-portal` — app/portal (Phase-1). **Used by CI smoke.**

## Preview URL Policy (Dynamic)
Preview URLs change on every deployment. CI resolves the correct URL by querying the Vercel API for a **READY** deployment where `meta.githubCommitRef` matches the PR branch and `app=complianceloop-portal`. If none exists, CI **falls back** to the latest READY preview.

---

## CI: Agent Smoke on Every PR
**Workflow file:** `.github/workflows/agent-smoke.yml`  
**Edit URL:** https://github.com/ComplianceLoop/complianceloop-site/edit/main/.github/workflows/agent-smoke.yml

### What it does
1. Resolves a Vercel **Preview** URL (branch match; falls back to latest READY).
2. Runs `scripts/agent-smoke.mjs` against that URL.
3. **Success criteria:** logs include **“Root page probe passed.”** and **“✅ smoke passed.”**

### One-time Setup (Secrets) — CLICK-BY-CLICK
1. **Create a Vercel token**  
   - https://vercel.com/account/tokens → **Create** → copy token.  
   - GitHub secrets: https://github.com/ComplianceLoop/complianceloop-site/settings/secrets/actions → **New repository secret** → **Name:** `VERCEL_TOKEN` → paste → **Add secret**.
2. **Find the Vercel Team ID**  
   - https://vercel.com/teams/compliance-loop/settings → copy **Team ID** (`team_...`).  
   - GitHub secrets → **New repository secret** → **Name:** `VERCEL_TEAM_ID` → paste → **Add secret**.
3. **(If previews are protected) Get Protection Bypass token**  
   - https://vercel.com/compliance-loop/complianceloop-portal/settings/security  
   - **Protection → Preview Deployments → Protection Bypass for Automation** → **Create Token** or **Reveal** → copy.  
   - GitHub secrets → edit or add **`VERCEL_BYPASS_TOKEN`** → paste → **Update/Add secret**.

### Run the workflow
- **Automatically:** open any Pull Request; the workflow triggers on `pull_request`.  
- **Manually:** https://github.com/ComplianceLoop/complianceloop-site/actions → **Agent Smoke (Vercel Preview)** → **Run workflow** → **Run workflow**.

### Verify success
- Actions: https://github.com/ComplianceLoop/complianceloop-site/actions  
- Open the job → check for:
  - `Found READY preview: https://...` (or fallback message)  
  - `Bypass cookie set (status 307).` *(when protection is enabled)*  
  - `Root page probe passed.`  
  - `✅ smoke passed.`

### Troubleshooting
- **Timeout waiting for READY preview**  
  - Project may be connected to a different repo or branch doesn’t deploy. Check:  
    https://vercel.com/compliance-loop/complianceloop-portal/settings/git  
  - Or rely on the workflow’s **fallback** to latest READY preview.
- **401 on bypass cookie request (CI or local)**  
  - Token is wrong or for a different project. Get the correct one here:  
    https://vercel.com/compliance-loop/complianceloop-portal/settings/security → **Protection → Preview Deployments → Protection Bypass for Automation** → **Reveal/Create Token**.  
  - Update GitHub secret: https://github.com/ComplianceLoop/complianceloop-site/settings/secrets/actions → edit **`VERCEL_BYPASS_TOKEN`**.  
  - Re-run jobs from the PR’s **Checks** tab or Actions run page.
- **404 on PR link**  
  - PR list: https://github.com/ComplianceLoop/complianceloop-site/pulls → **Sort → Recently updated** → open your PR → **Checks** → **Re-run all jobs**.

---

## Human Runbook: Run Smoke Locally (Windows)
1. **Open PowerShell**.  
2. Allow scripts for this window:  
   `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
3. **Clone/enter repo:**  
   - First time: `cd %USERPROFILE% && git clone https://github.com/ComplianceLoop/complianceloop-site`  
   - Then: `cd %USERPROFILE%\complianceloop-site`
4. **Get Preview URL:**  
   https://vercel.com/compliance-loop/complianceloop-portal/deployments → click latest **Ready / Preview** row → **Visit** → copy URL.
5. **Set env vars:**  
   ```powershell
   $env:PREVIEW_URL = "<paste preview url>"
   # If protected:
   $env:VERCEL_BYPASS_TOKEN = "<paste bypass token>"

<!-- CL:START -->
# ComplianceLoop — Canonical Plan (Generated)

**Repo:** ComplianceLoop/complianceloop-site ()
**Vercel project:** complianceloop-portal (team: compliance-loop)

## Workflows (index)
- `.github/workflows/agent-smoke.yml`
- `.github/workflows/design-skin-kit.yml`
- `.github/workflows/phase-1-auth-db.yml`
- `.github/workflows/phase-2-files-r2.yml`
- `.github/workflows/seed-phase-1.yml`
- `.github/workflows/update-allowlist.yml`

## 13 Phases
1) Admin console
2) Airtable bridge (hybrid)
3) Assignment engine (first-accept, soft-hold cascade, single-eligible auto-assign)
4) Auth + DB base
5) Customer dashboard
6) Design Skin Kit
7) Files & Certificates (R2)
8) Job model + booking skeleton
9) Notifications (email/SMS)
10) Payments & invoices
11) Polish & launch (SEO, A11y, QA, rate limits)
12) Provider dashboard (+ day-of checklist, conflict)
13) Provider directory & eligibility

> Edit *decisions.json* to change phases/workflows, then re-run this workflow.
<!-- CL:END -->

# ComplianceLoop Playbook
_Last updated: 2025-09-25 by CL Playbook_

## Authoring Standard (MANDATORY)
We write instructions **step-by-step with clicks and direct links**.

- Include **click paths** (e.g., _Vercel → Project → Settings → Security → Protection → Preview Deployments_).
- Provide **copy-pasteable commands** with placeholders clearly marked.
- **Never** print secrets; refer to them by secret name (e.g., `VERCEL_TOKEN`).

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
1. Waits for (or resolves) a Vercel **Preview** URL.  
2. Runs `scripts/agent-smoke.mjs` against that URL.  
3. Pass condition: prints **“Root page probe passed.”** and **“✅ smoke passed.”**

### One-time Setup (Secrets) — CLICK-BY-CLICK
1. **Create a Vercel token**  
   - https://vercel.com/account/tokens → **Create** → copy token.  
   - In GitHub: https://github.com/ComplianceLoop/complianceloop-site/settings/secrets/actions → **New repository secret** → **Name:** `VERCEL_TOKEN` → **Secret:** paste → **Add secret**.

2. **Find the Vercel Team ID**  
   - https://vercel.com/teams/compliance-loop/settings → copy **Team ID** (`team_...`).  
   - In GitHub secrets → **New repository secret** → **Name:** `VERCEL_TEAM_ID` → paste ID → **Add secret**.

3. **(If previews are protected) Get Protection Bypass token**  
   - https://vercel.com/compliance-loop/complianceloop-portal/settings/security  
   - **Protection → Preview Deployments → Protection Bypass for Automation** → **Create Token** or **Reveal** → copy.  
   - In GitHub secrets → **Name:** `VERCEL_BYPASS_TOKEN` → paste → **Add/Update secret**.

### Run the workflow (two ways)
- **Automatically:** open any Pull Request; the workflow triggers on `pull_request`.  
- **Manually:** https://github.com/ComplianceLoop/complianceloop-site/actions → **Agent Smoke (Vercel Preview)** → **Run workflow** → **Run workflow**.

### Verify success
- Open the job logs: https://github.com/ComplianceLoop/complianceloop-site/actions  
- Look for:
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
  - The token is wrong or for a different project. Get the correct one here:  
    https://vercel.com/compliance-loop/complianceloop-portal/settings/security → **Protection → Preview Deployments → Protection Bypass for Automation** → **Reveal/Create Token**.  
  - Update GitHub secret: https://github.com/ComplianceLoop/complianceloop-site/settings/secrets/actions → edit **`VERCEL_BYPASS_TOKEN`**.  
  - Re-run the job from the PR’s **Checks** tab.

- **404 on PR link**
  - Find PRs here: https://github.com/ComplianceLoop/complianceloop-site/pulls → **Sort → Recently updated** → open your PR → **Checks** → **Re-run all jobs**.

---

## Human Runbook: Run Smoke Locally (Windows)
1. **Open PowerShell**.  
2. Allow scripts for this window:  
   `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
3. **Clone/enter repo:**  
   - First time: `cd %USERPROFILE% && git clone https://github.com/ComplianceLoop/complianceloop-site`  
   - Then: `cd %USERPROFILE%\complianceloop-site`
4. **Set env vars:**  
   - Get Preview URL: https://vercel.com/compliance-loop/complianceloop-portal/deployments → click latest **Ready / Preview** → **Visit** → copy URL.  
   - PowerShell:  
     ```
     $env:PREVIEW_URL = "<paste preview url>"
     # If protected:
     $env:VERCEL_BYPASS_TOKEN = "<paste bypass token>"
     ```
5. **Run:** `node scripts/agent-smoke.mjs`  
   Expect **“Root page probe passed.”** and **“✅ smoke passed.”**

---

## Current Status (logged)
- **2025-09-25:** Agent Smoke succeeded on PR **#21** (`feat/phase-1-auth-db`). Logs show bypass cookie set and root page probe passed.

---

## Quick Links
- **Actions (runs):** https://github.com/ComplianceLoop/complianceloop-site/actions  
- **Repo secrets:** https://github.com/ComplianceLoop/complianceloop-site/settings/secrets/actions  
- **Vercel deployments:** https://vercel.com/compliance-loop/complianceloop-portal/deployments  
- **Vercel security (bypass token):** https://vercel.com/compliance-loop/complianceloop-portal/settings/security  
- **Vercel Git settings:** https://vercel.com/compliance-loop/complianceloop-portal/settings/git

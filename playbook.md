# ComplianceLoop Playbook

_Last updated: 2025-09-25 by CL Playbook_

## Authoring Standard (MANDATORY)
We write instructions **step-by-step with clicks and direct links**.

- Always include **click trails** (e.g., _GitHub → Repo → Settings → Secrets and variables → Actions_).
- Include **direct URLs** for every external step.
- Provide **copy-pasteable commands** with clearly marked placeholders.
- **Never** print secrets; refer to them by name (e.g., `VERCEL_TOKEN`).

---

## Canonical Repos & Projects
- **Repo (canonical):** `ComplianceLoop/complianceloop-site` (branch: `main`)
- **Vercel Team:** `compliance-loop`
- **Vercel Projects:**
  - `complianceloop-site` — marketing/docs
  - `complianceloop-portal` — app/portal (Phase-1). **Used by CI smoke.**

## Preview URL Policy (Dynamic)
Preview URLs change on every deployment. CI resolves the correct URL by querying Vercel’s API for a READY deployment where `meta.githubCommitRef` matches the PR branch and `app=complianceloop-portal`.

## Allowlist / Protection
If Preview protection is ON, set a repo secret **`VERCEL_BYPASS_TOKEN`** with the project’s **Protection Bypass for Automation** token  
(**Vercel → Project → Settings → Security → Protection → Preview Deployments**).

- Project Security page: https://vercel.com/compliance-loop/complianceloop-portal/settings/security

---

## CI: Agent Smoke on Every PR

**Workflow file:** `.github/workflows/agent-smoke.yml`  
**Edit URL:** https://github.com/ComplianceLoop/complianceloop-site/edit/main/.github/workflows/agent-smoke.yml

**What it does:** waits for the Vercel Preview (READY) for the PR branch, then runs `scripts/agent-smoke.mjs` against it.

### One-time Setup (Secrets) — CLICK-BY-CLICK

1. **Create a Vercel token**
   - Go to: https://vercel.com/account/tokens  
   - Click **Create** → copy the token.  
   - **Do not paste it into the repo**; we’ll store it as a GitHub secret.

2. **Find your Vercel Team ID**
   - Go to: https://vercel.com/teams/compliance-loop/settings  
   - Copy the **Team ID** (starts with `team_`).

3. **(If previews are protected) Get the Protection Bypass token**
   - Go to: https://vercel.com/compliance-loop/complianceloop-portal/settings/security  
   - In **Protection → Preview Deployments**, click **Protection Bypass for Automation → Create Token** (or **Reveal**) → copy it.

4. **Add secrets to GitHub Actions**
   - Open: https://github.com/ComplianceLoop/complianceloop-site/settings/secrets/actions  
   - Click **New repository secret** and add:
     - **Name:** `VERCEL_TOKEN` → **Secret:** _paste token from Step 1_ → **Add secret**  
     - **Name:** `VERCEL_TEAM_ID` → **Secret:** _paste Team ID from Step 2_ → **Add secret**  
     - (Optional, recommended if protection is ON)  
       **Name:** `VERCEL_BYPASS_TOKEN` → **Secret:** _paste token from Step 3_ → **Add secret**

5. **Verify the workflow exists**
   - File: `.github/workflows/agent-smoke.yml`  
   - If missing, create it using the edit URL above and paste the full file.

### How the workflow resolves the Preview URL
- Polls `https://api.vercel.com/v6/deployments?teamId=$VERCEL_TEAM_ID&app=$VERCEL_APP&limit=20&state=READY`
- Picks the first deployment where `.meta.githubCommitRef == <PR branch>`
- Emits `https://<deployment>.vercel.app` as `PREVIEW_URL` and runs the smoke script.

### Success criteria
- Workflow prints the Preview URL and ends with `✅ smoke passed.`

### Safe rollback
- Disable or delete the workflow file.
- In Vercel, promote a previous READY deployment if needed.

---

## Human Runbook: Run smoke locally (Windows)

1. **Open PowerShell**  
2. Allow scripts for this window:  
   `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
3. **Clone or update the repo**
   - `cd %USERPROFILE%`
   - If first time: `git clone https://github.com/ComplianceLoop/complianceloop-site`
   - Else: `cd complianceloop-site && git pull`
4. **Set env vars**
   - `setx PREVIEW_URL "<paste Vercel Preview URL>"`
   - If protected: `setx VERCEL_BYPASS_TOKEN "<bypass token>"`
5. **Run the smoke**
   - `cd %USERPROFILE%\complianceloop-site`
   - `node scripts/agent-smoke.mjs`

_Notes:_ No dependencies required for the smoke script; Node 20+ is enough.  
The script will set a bypass cookie automatically when `VERCEL_BYPASS_TOKEN` is present.

---

## Troubleshooting

- **Missing VERCEL_BYPASS_TOKEN**  
  → Add the token as a secret (CI) or set it in your shell (local).  
- **Timeout waiting for READY preview**  
  → Ensure the PR actually triggered a Vercel deploy for `complianceloop-portal`.  
- **404s on `/api/*`**  
  → Expected if those routes don’t exist yet; only `/` 200 is required by the script.

---

## Quick Links
- GitHub Actions secrets: https://github.com/ComplianceLoop/complianceloop-site/settings/secrets/actions  
- Vercel tokens: https://vercel.com/account/tokens  
- Vercel team settings (Team ID): https://vercel.com/teams/compliance-loop/settings  
- Vercel project security (bypass token): https://vercel.com/compliance-loop/complianceloop-portal/settings/security  
- Workflow edit: https://github.com/ComplianceLoop/complianceloop-site/edit/main/.github/workflows/agent-smoke.yml  
- Playbook edit: https://github.com/ComplianceLoop/complianceloop-site/edit/main/playbook.md  
- Decisions edit: https://github.com/ComplianceLoop/complianceloop-site/edit/main/decisions.json

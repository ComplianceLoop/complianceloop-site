# ComplianceLoop Playbook — Agent Start Prompt (copy/paste)

> Use this block as the very first message to any new chat agent.

You are the **ComplianceLoop Playbook Agent (“CL Playbook”)**. Follow these rules exactly.

## Project IDs (source of truth)
- **Repo:** `ComplianceLoop/complianceloop-site` (branch: `main`)
- **Vercel team:** `ComplianceLoop`
- **Vercel project:** `complianceloop-portal`
- **Production base URL:** `https://complianceloop-portal.vercel.app`  
  - **Preview protection:** If you must hit a preview URL, include header `x-vercel-protection-bypass: <token>` (create in Vercel → Project → Settings → Deployments → Preview Protection → Bypass Tokens).

## House Style — GOLDEN RULES
1) **FULL-FILE REPLACEMENTS ONLY.** No partial diffs/snippets.  
2) **LINKS FIRST.** Put the direct GitHub EDIT/CREATE link immediately above each file.  
3) **STEPS + COMMIT TITLE** after the files.  
4) **VERIFY CHECKLIST** with exact URLs/cURL and the expected output.  
5) **DECISIONS ARE CANONICAL.** If a decision changes, update `decisions.json` (ASCII-only) with a **full-file** replacement, then run the Reconciler and merge.  
6) **Never edit** inside `<!-- CL:START --> … <!-- CL:END -->` in `playbook.md`. If stale, reset to that block only and run the Reconciler.  
7) **No secrets** in repo. Refer to secret names (e.g., `DATABASE_URL`).  
8) **Imports:** avoid deep `@/app/../..`; prefer `@/lib/*`, `@/db/*`, or stable relatives.  
9) **Vercel debug:** redeploy with **“Use existing Build Cache” unchecked** when builds are flaky.

## Current Phase & Status
- **Phase:** Provider directory & eligibility — **`in_progress`**  
- Already **implemented** this phase:  
  - `POST /api/providers/apply` (creates provider; upserts services; inserts ZIP rows)  
  - `POST /api/providers/score` (zip + services; status rank active > approved > pending; then name ASC; limit 100)  
- **Next to land before marking phase `landed`:** criteria engine + how-to-qualify guidance.

## What to read first (repo orientation)
1) Open `decisions.json` and read: currentPhase, phaseProgress, operationalNotes.  
   - Edit link: https://github.com/ComplianceLoop/complianceloop-site/edit/main/decisions.json  
   - Raw (for quick grep): https://raw.githubusercontent.com/ComplianceLoop/complianceloop-site/main/decisions.json
2) Check the provider routes under `apps/portal/app/api/providers/*`.
3) Review workflows under `.github/workflows/`:
   - Reconciler: `reconcile-decisions-and-playbook.yml`
   - Agent Read Self-Test: `agent-read-selftest.yml`
   - JSON diagnostics: `diagnose-decisions-json.yml`

## Allowed changes (allowlist)
- `apps/portal/app/api/providers/*`
- `apps/portal/db/bootstrap.sql` (idempotent DDL/indexes)
- `lib/*` helpers used by the routes
- `.github/workflows/*` (reconcile, self-test, diagnose)
- `decisions.json` (full-file + reconcile)
- `handoff/*` (handoff docs like this file)

## Standard workflows to run
- **Reconciler:** https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/reconcile-decisions-and-playbook.yml  
  → Run it after any `decisions.json` change; then merge the PR it opens.
- **Agent Read Self-Test:** validates link hygiene.
- **Diagnose decisions JSON:** if the Reconciler fails with `position NNNN`, run:  
  https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/diagnose-decisions-json.yml  
  (enter the byte offset; patch exactly that spot; re-run Reconciler.)

## Browser/API tooling notes (important)
- Prefer **Production alias** when testing APIs: `https://complianceloop-portal.vercel.app`.
- Hoppscotch: set **Interceptor = Proxy** (avoids CORS/OPTIONS 405).
- Preview URLs require header: `x-vercel-protection-bypass: <token>`.
- Visiting an API URL in a browser is a **GET** and will show **405**; send **POST** via Hoppscotch or cURL.

## Quick verify — Provider scoring
**Score endpoint sanity:**
- POST `/api/providers/score` `{}` → **400** (`Invalid zip`)
- POST `/api/providers/score` `{"zip":"00000","services":["EXIT_SIGN","E_LIGHT"]}` → **200** with `{ eligible: [], count: 0 }`

**Happy path (apply then score):**
1) POST `/api/providers/apply`  
   ```json
   {
     "companyName": "TestCo QA",
     "contactEmail": "qa@example.com",
     "zips": ["11223"],
     "services": ["EXIT_SIGN", "E_LIGHT"]
   }

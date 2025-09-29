SYNC FROM REPO — ComplianceLoop (MANDATORY)

Single source of truth
- decisions.json (raw): https://raw.githubusercontent.com/ComplianceLoop/complianceloop-site/main/decisions.json
- playbook.md (raw): https://raw.githubusercontent.com/ComplianceLoop/complianceloop-site/main/playbook.md

Direct edit / run links
- Edit decisions.json: https://github.com/ComplianceLoop/complianceloop-site/edit/main/decisions.json
- Reconciler workflow (run): https://github.com/ComplianceLoop/complianceloop-site/actions/workflows/reconcile-decisions-and-playbook.yml
- Pull requests: https://github.com/ComplianceLoop/complianceloop-site/pulls

Repo & project context
- Repo: ComplianceLoop/complianceloop-site (branch: main)
- Vercel project: complianceloop-portal (team: ComplianceLoop)

Rules for the assistant
- Fetch BOTH raw files first. If you can’t browse, ask me to paste the contents. Do not guess.
- Treat decisions.json as the only editable truth. The CL block in playbook.md is generated; never hand-edit inside <!-- CL:START --> … <!-- CL:END -->.
- If phases/workflows are missing/out of sync, tell me to run the Reconciler. I will merge the PR.
- When I ask for changes, produce a minimal JSON patch for decisions.json (exact keys/values), plus a concise commit title. Prefer full-file replacements for code/workflows when needed.
- After merge, ask me to re-run the Reconciler to refresh the Playbook block.
- Always give direct edit links and Run workflow link when you reference files/actions.
- Never write secrets; only reference them by name (e.g., VERCEL_TOKEN, RESEND_API_KEY).

Troubleshooting (no PR appears)
- If the workflow logs show “no changes to commit,” playbook.md likely didn’t change.
  Fix: reset the block once → edit playbook.md to contain only:
    <!-- CL:START -->
    <!-- CL:END -->
  Commit to main, re-run the Reconciler, then merge the PR it opens.

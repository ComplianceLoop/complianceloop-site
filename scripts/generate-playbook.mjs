// scripts/generate-playbook.mjs
// Deterministic generator for the <!-- CL:START --> ... <!-- CL:END --> block in playbook.md

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const decisionsPath = path.join(repoRoot, "decisions.json");
const playbookPath = path.join(repoRoot, "playbook.md");

function readJson(p) {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function money(n) {
  return typeof n === "number" ? `$${n.toFixed(2)}` : n;
}

function render(decisions) {
  const phases = decisions.phases ?? [];
  const finances = decisions.finances ?? {};
  const version = decisions.version ?? "unversioned";

  const oneTime = finances.oneTime?.total ?? 0;
  const mrr = finances.subscriptions?.monthlyTotal ?? 0;
  const arr = finances.subscriptions?.arr ?? (mrr ? mrr * 12 : 0);

  const links = decisions.links ?? {};

  const lines = [];
  lines.push("<!-- CL:START -->");
  lines.push(`# ComplianceLoop — Canonical Plan (Generated)`);
  lines.push(``);
  lines.push(`Version: ${version}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`## Phases (${phases.length})`);
  for (const p of phases) {
    const status = p.status ? ` — _${p.status}_` : "";
    lines.push(`- **${p.phase}**: ${p.objective ?? ""}${status}`);
  }
  lines.push(``);
  lines.push(`## Finances (summary)`);
  lines.push(`- One-time total: ${money(oneTime)}`);
  lines.push(`- Monthly total: ${money(mrr)}`);
  lines.push(`- ARR: ${money(arr)}`);
  lines.push(``);
  lines.push(`## Quick links`);
  if (links.editDecisions) lines.push(`- Edit decisions.json: ${links.editDecisions}`);
  if (links.editPlaybook) lines.push(`- Edit playbook.md: ${links.editPlaybook}`);
  if (links.runReconciler) lines.push(`- Run Reconciler: ${links.runReconciler}`);
  if (links.pulls) lines.push(`- Pull Requests: ${links.pulls}`);
  lines.push("");
  lines.push("<!-- CL:END -->");
  return lines.join("\n");
}

function upsertBlock(fullText, block) {
  const start = "<!-- CL:START -->";
  const end = "<!-- CL:END -->";
  const startIdx = fullText.indexOf(start);
  const endIdx = fullText.indexOf(end);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return fullText.slice(0, startIdx) + block + fullText.slice(endIdx + end.length);
  }
  // No block yet — just replace the whole file with the block
  return block + "\n";
}

(function main() {
  const decisions = readJson(decisionsPath);
  const block = render(decisions);

  let current = "";
  try {
    current = fs.readFileSync(playbookPath, "utf8");
  } catch {
    current = "";
  }

  const next = upsertBlock(current, block);
  if (next !== current) {
    fs.writeFileSync(playbookPath, next);
    console.log("playbook.md updated");
  } else {
    console.log("playbook.md already up to date");
  }
})();

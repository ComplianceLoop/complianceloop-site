#!/usr/bin/env node
/**
 * Agent smoke wrapper:
 * - If scripts/smoke-vercel-preview.mjs exists, run it (preserves your legacy smoke).
 * - Capture logs, write out/report.json + out/report.md for CI feedback contract.
 * - Exit with the child’s exit code (keeps pass/fail semantics identical).
 * - Fallback: run generic npm checks (lint/typecheck/build) if no child script.
 *
 * Usage: node scripts/agent-smoke.mjs --json out/report.json --md out/report.md
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const JSON_PATH = getArg("--json", "out/report.json");
const MD_PATH   = getArg("--md",   "out/report.md");

function ensureDir(p) {
  try { mkdirSync(dirname(p), { recursive: true }); } catch {}
}
ensureDir(JSON_PATH); ensureDir(MD_PATH);

function redact(s) { return s.replace(/[A-Za-z0-9_\-]{24,}/g, "[REDACTED]"); }

function writeOutputs({ status, steps, advice, error }) {
  const json = { status, ts: new Date().toISOString(), steps, advice, error };
  writeFileSync(JSON_PATH, JSON.stringify(json, null, 2));
  const md = [
    "# Smoke Report",
    `- **status:** \`${status}\``,
    "",
    "## Steps",
    ...steps.map((s) =>
      `### ${s.name}\n- exit: \`${s.exitCode}\`\n- duration: \`${s.durationMs}ms\`\n\n` +
      (s.stderrTail ? "#### stderr (tail)\n```\n" + s.stderrTail + "\n```\n" : "") +
      (s.stdoutTail ? "#### stdout (tail)\n```\n" + s.stdoutTail + "\n```\n" : "")
    ),
    "",
    "## Advice",
    advice || "—",
    "",
  ].join("\n");
  writeFileSync(MD_PATH, md);
}

async function runCmd(name, cmd, required = true) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(cmd, { shell: true, env: { ...process.env, CI: "1" } });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => {
      const step = {
        name,
        exitCode: code ?? 1,
        durationMs: Date.now() - started,
        stdoutTail: redact(out).split("\n").slice(-40).join("\n"),
        stderrTail: redact(err).split("\n").slice(-40).join("\n"),
        required,
      };
      resolve(step);
    });
  });
}

function hasScript(n) {
  try {
    const pkg = JSON.parse(readFileSync("package.json","utf8"));
    return !!(pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts, n));
  } catch { return false; }
}

(async () => {
  const steps = [];
  let exitCode = 0;
  let advice = "";

  const childPath = "scripts/smoke-vercel-preview.mjs";
  if (existsSync(childPath)) {
    // Preserve your existing Vercel smoke exactly as-is
    const step = await runCmd("smoke-vercel-preview", `node ${childPath}`);
    steps.push(step);
    exitCode = step.exitCode;
    advice = exitCode === 0
      ? "Vercel preview smoke passed."
      : "Vercel preview smoke failed. Check logs and verify PREVIEW_URL + VERCEL_BYPASS_TOKEN.";
  } else {
    // Fallback generic checks when no child script exists
    const plan = [];
    if (hasScript("lint"))      plan.push(["npm run lint", false, "lint"]);
    if (hasScript("typecheck")) plan.push(["npm run typecheck", false, "typecheck"]);
    if (hasScript("build"))     plan.push(["npm run build", true,  "build"]);
    if (plan.length === 0) {
      steps.push({ name: "noop", exitCode: 1, durationMs: 0,
        stdoutTail: "", stderrTail: "No npm scripts found (lint/typecheck/build).",
        required: true });
      exitCode = 1;
      advice = "Add build/typecheck/lint scripts or restore smoke-vercel-preview.mjs.";
    } else {
      for (const [cmd, required, name] of plan) {
        const s = await runCmd(name, cmd, required);
        steps.push(s);
      }
      const requiredFailed = steps.some(s => s.required && s.exitCode !== 0);
      const anyFailed      = steps.some(s => s.exitCode !== 0);
      exitCode = requiredFailed ? 1 : 0;
      advice = requiredFailed ? "Fix required step failures (e.g., build)."
             : anyFailed ? "Optional checks failed (lint/typecheck). Consider fixing."
             : "All checks passed.";
    }
  }

  const status = exitCode === 0 ? "passed" : "failed";
  writeOutputs({ status, steps, advice });
  process.exit(exitCode);
})().catch((e) => {
  writeOutputs({
    status: "failed",
    steps: [],
    advice: "Agent smoke wrapper crashed.",
    error: String(e),
  });
  process.exit(1);
});

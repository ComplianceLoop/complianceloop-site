// scripts/fix-auth-imports.mjs
// Purpose: rewrite quirky imports in auth route files:
// - "@/app/../lib/db"     -> "@/lib/db"
// - "@/app/../db/schema"  -> "@/db/schema"
// - "@/app/../lib/auth"   -> "@/lib/auth"
//
// Safe: Only touches files under app/api/auth/**/route.ts and only
// when those exact substrings are present.

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const targets = [
  path.join(repoRoot, "app", "api", "auth", "send-code", "route.ts"),
  path.join(repoRoot, "app", "api", "auth", "verify-code", "route.ts")
];

const replacements = [
  { from: '@/app/../lib/db', to: '@/lib/db' },
  { from: '@/app/../db/schema', to: '@/db/schema' },
  { from: '@/app/../lib/auth', to: '@/lib/auth' }
];

let touched = 0;
for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  let next = src;
  for (const { from, to } of replacements) {
    next = next.split(from).join(to);
  }
  if (next !== src) {
    fs.writeFileSync(file, next);
    console.log(`patched: ${path.relative(repoRoot, file)}`);
    touched++;
  } else {
    console.log(`no change: ${path.relative(repoRoot, file)}`);
  }
}

if (touched === 0) {
  console.log("No auth files changed (already clean or missing).");
  process.exit(0);
}

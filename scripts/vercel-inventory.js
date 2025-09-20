// scripts/vercel-inventory.js
// Read-only Vercel inventory (projects, domains, recent deployments) and write inventory.json

import fs from "node:fs";

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
let TEAM = process.env.VERCEL_TEAM_SLUG; // may be slug or ID (UUID)
if (!VERCEL_TOKEN) {
  console.error("❌ Missing VERCEL_TOKEN");
  process.exit(1);
}
if (!TEAM) {
  console.error("❌ Missing VERCEL_TEAM_SLUG (or ID)");
  process.exit(1);
}

// Decide whether TEAM is a slug or ID (UUID contains dashes)
const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(s);
const teamParam = isUuid(TEAM) ? `teamId=${encodeURIComponent(TEAM)}` 
                               : `teamSlug=${encodeURIComponent(TEAM)}`;

const BASE = "https://api.vercel.com";

async function fetchJSON(url, opts = {}, retries = 3) {
  const headers = {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 429 && retries > 0) {
    // Rate-limited: wait and retry
    const retryAfter = Number(res.headers.get("retry-after") || 1);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return fetchJSON(url, opts, retries - 1);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} for ${url} :: ${text}`);
  }
  return res.json();
}

async function listAllProjects() {
  const out = [];
  let next = `${BASE}/v9/projects?${teamParam}&limit=100`;
  while (next) {
    const page = await fetchJSON(next);
    out.push(...(page.projects || []));
    next = page.pagination?.next ? `${BASE}${page.pagination.next}` : null;
  }
  return out;
}

async function listProjectDomains(projectId) {
  // v6 domains API
  const url = `${BASE}/v6/domains?${teamParam}&projectId=${encodeURIComponent(projectId)}`;
  const json = await fetchJSON(url);
  return json.domains || [];
}

async function listProjectDeployments(projectId, limit = 5) {
  // v6 deployments API
  const url = `${BASE}/v6/deployments?${teamParam}&projectId=${encodeURIComponent(projectId)}&limit=${limit}`;
  const json = await fetchJSON(url);
  return json.deployments || [];
}

async function run() {
  const result = {
    team: TEAM,
    fetchedAt: new Date().toISOString(),
    projects: [],
  };

  console.log("🔎 Listing Vercel projects...");
  const projects = await listAllProjects();
  console.log(`✅ Found ${projects.length} project(s)`);

  for (const p of projects) {
    const [domains, deployments] = await Promise.all([
      listProjectDomains(p.id).catch((e) => ({ error: String(e) })),
      listProjectDeployments(p.id, 5).catch((e) => ({ error: String(e) })),
    ]);

    result.projects.push({
      id: p.id,
      name: p.name,
      framework: p.framework,
      link: p.link,
      latestProductionBuild: p.latestProductionBuild,
      targets: p.targets,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      domains,
      deployments,
    });
  }

  fs.writeFileSync("inventory.json", JSON.stringify(result, null, 2));
  console.log("📝 Wrote inventory.json");
}

run().catch((err) => {
  console.error("❌ Inventory failed:", err);
  process.exit(1);
});

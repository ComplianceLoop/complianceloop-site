// scripts/airtable-sync.mjs
// CLI to run Airtable bridge. Prefer server-hosted logic (POST /api/airtable/sync)
// so we don't add Node-only deps. Supports --dry-run (default true).

/**
 * Env:
 * - BASE_URL or NEXT_PUBLIC_BASE_URL: site origin (e.g., https://complianceloop-portal.vercel.app)
 * - AIRTABLE_SYNC_KEY (optional, but required for real sync via POST route)
 * - SYNC_SOURCE_URL (optional override for GET /api/airtable/source)
 *
 * Usage:
 *   node scripts/airtable-sync.mjs --dry-run
 *   node scripts/airtable-sync.mjs --no-dry-run
 */

function getFlag(name, def = false) {
  const yes = new Set(["1", "true", "yes", "on"]);
  const no = new Set(["0", "false", "no", "off"]);
  const argv = process.argv.slice(2);
  const has = argv.find((a) => a === `--${name}` || a === `--no-${name}`);
  if (!has) return def;
  return has.startsWith(`--no-`) ? false : true;
}

function getBaseUrl() {
  return (
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    ""
  ).replace(/\/+$/, "");
}

async function main() {
  const dryRun = getFlag("dry-run", true);
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    console.error("ERROR: Set BASE_URL or NEXT_PUBLIC_BASE_URL to your deployed site origin.");
    process.exit(2);
  }

  const sourceUrl =
    process.env.SYNC_SOURCE_URL || `${baseUrl}/api/airtable/source`;

  // Always fetch the source first for visibility.
  const srcRes = await fetch(sourceUrl, { headers: { Accept: "application/json" } });
  if (!srcRes.ok) {
    const t = await srcRes.text().catch(() => "");
    console.error(`Source fetch failed ${srcRes.status}: ${t}`);
    process.exit(1);
  }
  const srcJson = await srcRes.json();
  const count = Array.isArray(srcJson.records) ? srcJson.records.length : 0;

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          table: srcJson.table,
          mergeField: srcJson.mergeField,
          records: count,
        },
        null,
        2
      )
    );
    return;
  }

  // Real sync via secured POST route.
  const syncKey = process.env.AIRTABLE_SYNC_KEY || "";
  if (!syncKey) {
    console.error("ERROR: AIRTABLE_SYNC_KEY env must be set for real sync.");
    process.exit(2);
  }

  const syncUrl = `${baseUrl}/api/airtable/sync`;
  const res = await fetch(syncUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sync-Key": syncKey,
    },
    body: JSON.stringify({ dryRun: false }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error(`Sync failed ${res.status}: ${t}`);
    process.exit(1);
  }

  const out = await res.json();
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

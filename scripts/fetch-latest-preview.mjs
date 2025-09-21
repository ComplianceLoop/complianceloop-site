// scripts/fetch-latest-preview.mjs
// Purpose: get latest READY preview deployment URL for the project on Vercel.

const {
  VERCEL_TOKEN,
  VERCEL_PROJECT_ID,   // project id (preferred)
  VERCEL_TEAM_ID,      // team id (preferred)
  VERCEL_TEAM_SLUG,    // fallback if you only have the slug
} = process.env;

if (!VERCEL_TOKEN) { console.error('Missing VERCEL_TOKEN.'); process.exit(1); }
if (!VERCEL_PROJECT_ID) { console.error('Missing VERCEL_PROJECT_ID.'); process.exit(1); }
if (!VERCEL_TEAM_ID && !VERCEL_TEAM_SLUG) {
  console.error('Missing VERCEL_TEAM_ID or VERCEL_TEAM_SLUG.');
  process.exit(1);
}

const teamParam = VERCEL_TEAM_ID
  ? `teamId=${encodeURIComponent(VERCEL_TEAM_ID)}`
  : `teamSlug=${encodeURIComponent(VERCEL_TEAM_SLUG)}`;

const u = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(
  VERCEL_PROJECT_ID
)}&${teamParam}&state=READY&limit=50`;

async function main() {
  const res = await fetch(u, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } });
  if (!res.ok) {
    const text = await res.text();
    console.error('Vercel API error:', res.status, text.slice(0, 1000));
    process.exit(1);
  }
  const data = await res.json();
  const items = Array.isArray(data.deployments) ? data.deployments : data;

  const previews = items
    .filter((d) => (d.target || d.meta?.githubCommitRef) !== 'production')
    .filter((d) => (d.readyState || d.state) === 'READY')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const latest = previews[0];
  if (!latest?.url) {
    console.error('No READY preview deployment found.');
    process.exit(1);
  }

  console.log(`https://${latest.url}`);
}

main().catch((e) => { console.error('Unexpected error:', e); process.exit(1); });

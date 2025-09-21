// scripts/maintain-allowlist.mjs
// Appends the current preview *origin* to Vercel env var ORIGIN_ALLOWLIST if missing.
// Safe to run multiple times (no duplicates). No-op if already present.

const token = process.env.VERCEL_TOKEN;
const teamId = process.env.VERCEL_TEAM_ID;
const teamSlug = process.env.VERCEL_TEAM_SLUG;
const projectId = process.env.VERCEL_PROJECT_ID;
const PREVIEW_URL = process.env.PREVIEW_URL;

if (!token) throw new Error('Missing VERCEL_TOKEN');
if (!(teamId || teamSlug)) throw new Error('Missing VERCEL_TEAM_ID or VERCEL_TEAM_SLUG');
if (!projectId) throw new Error('Missing VERCEL_PROJECT_ID');
if (!PREVIEW_URL) throw new Error('Missing PREVIEW_URL in env');

const teamParam = teamId ? `teamId=${encodeURIComponent(teamId)}` : `teamSlug=${encodeURIComponent(teamSlug)}`;

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}${teamParam}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel API ${path} failed ${res.status}: ${text}`);
  }
  return res.json();
};

const toOrigin = (urlStr) => {
  try { return new URL(urlStr).origin; } catch { return null; }
};

const uniqueCSV = (csv) => {
  const set = new Set(csv.split(',').map(s => s.trim()).filter(Boolean));
  return Array.from(set).join(',');
};

(async () => {
  const origin = toOrigin(PREVIEW_URL);
  if (!origin) throw new Error(`Could not parse origin from PREVIEW_URL=${PREVIEW_URL}`);
  console.log(`Preview origin: ${origin}`);

  // 1) List envs (preview target) and find ORIGIN_ALLOWLIST
  const envs = await api(`/v10/projects/${projectId}/env?target=preview`);
  const existing = envs.envs?.find(e => e.key === 'ORIGIN_ALLOWLIST');

  if (!existing) {
    // 2a) Create env if missing
    console.log('ORIGIN_ALLOWLIST not found — creating…');
    await api(`/v10/projects/${projectId}/env`, {
      method: 'POST',
      body: JSON.stringify({
        key: 'ORIGIN_ALLOWLIST',
        value: origin,
        target: ['preview'],        // keep scope to preview; promote later if desired
        type: 'plain',
      }),
    });
    console.log('✅ Created ORIGIN_ALLOWLIST (preview) with:', origin);
    console.log('ℹ️ You may need to re-deploy for changes to take effect.');
    return;
  }

  // 2b) Append if missing
  const current = existing.value || '';
  const list = current.split(',').map(s => s.trim()).filter(Boolean);
  if (list.includes(origin)) {
    console.log('✅ ORIGIN_ALLOWLIST already contains preview origin. No update.');
    return;
  }

  const updated = uniqueCSV([...list, origin].join(','));
  console.log(`Updating ORIGIN_ALLOWLIST → ${updated}`);

  await api(`/v10/projects/${projectId}/env/${existing.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      value: updated,
      target: ['preview'],
      type: 'plain',
    }),
  });

  console.log('✅ ORIGIN_ALLOWLIST updated (preview).');
  console.log('ℹ️ Re-deploy the project to apply the new env value to running previews.');
})().catch(err => {
  console.error('❌ maintenance error:', err);
  process.exit(1);
});

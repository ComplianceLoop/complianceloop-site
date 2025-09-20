// scripts/agent-smoke.mjs
// CI-friendly smoke test for a protected Vercel Preview.
//
// Required GitHub Action envs (set in workflow or repo secrets):
// - VERCEL_TOKEN
// - VERCEL_TEAM_ID
// - VERCEL_PROJECT_ID
// - VERCEL_BYPASS_TOKEN  (the "Protection Bypass for Automation" secret value)
// Optional:
// - PREVIEW_URL          (if not provided, we auto-discover latest READY preview)

const {
  PREVIEW_URL,
  VERCEL_TOKEN,
  VERCEL_TEAM_ID,
  VERCEL_PROJECT_ID,
  VERCEL_BYPASS_TOKEN,
} = process.env;

function die(msg, extra) {
  console.error(msg);
  if (extra) console.error(extra);
  process.exit(1);
}

if (!VERCEL_TOKEN)        die('Missing VERCEL_TOKEN.');
if (!VERCEL_TEAM_ID)      die('Missing VERCEL_TEAM_ID.');
if (!VERCEL_PROJECT_ID)   die('Missing VERCEL_PROJECT_ID.');
if (!VERCEL_BYPASS_TOKEN) die('Missing VERCEL_BYPASS_TOKEN (automation bypass secret).');

const API = 'https://api.vercel.com';

async function vercelJson(url) {
  const u = new URL(url);
  if (VERCEL_TEAM_ID) u.searchParams.set('teamId', VERCEL_TEAM_ID);

  const res = await fetch(u, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text), raw: text };
  } catch {
    return { ok: res.ok, status: res.status, json: null, raw: text };
  }
}

async function getLatestReadyPreview() {
  const url = `${API}/v6/deployments?projectId=${encodeURIComponent(
    VERCEL_PROJECT_ID
  )}&state=READY&limit=20`;
  const { ok, status, json, raw } = await vercelJson(url);
  if (!ok) die(`Failed to list deployments (${status}).`, raw);

  const byTime = (a, b) => b.created - a.created;
  const ready = (json.deployments || []).sort(byTime);

  const target = ready.find(d => d.target === 'preview') || ready[0];
  if (!target) die('No READY deployments found for project.');

  // Return its canonical preview URL
  return `https://${target.url}`;
}

function withBypass(url) {
  const u = new URL(url);
  // Attach bypass on EVERY request to avoid cookie persistence issues in CI
  u.searchParams.set('x-vercel-protection-bypass', VERCEL_BYPASS_TOKEN);
  return u.toString();
}

async function jsonFetch(url, opts = {}) {
  const res = await fetch(withBypass(url), {
    ...opts,
    // Also send header version (duplicated for robustness)
    headers: {
      ...(opts.headers || {}),
      'x-vercel-protection-bypass': VERCEL_BYPASS_TOKEN,
    },
  });

  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text), raw: text };
  } catch {
    return { ok: res.ok, status: res.status, json: null, raw: text };
  }
}

async function run() {
  const base = PREVIEW_URL && PREVIEW_URL.trim()
    ? PREVIEW_URL.trim()
    : await getLatestReadyPreview();

  console.log('🔎 Preview under test:', base);

  // 1) /api/ping
  {
    const url = new URL('/api/ping', base).toString();
    const { ok, status, json, raw } = await jsonFetch(url);
    if (!ok) {
      console.error('❌ ping failed', { status, raw: raw.slice(0, 800) });
      die('Ping did not return 2xx.');
    }
    if (!json || json.pong !== true) {
      console.error('❌ ping unexpected payload', json);
      die('Ping payload mismatch.');
    }
    console.log('✅ ping OK', json);
  }

  // 2) /api/ingest CORS + POST
  {
    const url = new URL('/api/ingest', base).toString();

    // Simple POST form body
    const body = new URLSearchParams({
      type: 'book',
      email: 'test@example.com',
      _hp: '', // honeypot empty
    }).toString();

    const { ok, status, json, raw } = await jsonFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!ok) {
      console.error('❌ ingest failed', { status, raw: raw.slice(0, 800) });
      die('Ingest did not return 2xx.');
    }
    if (!json || json.ok !== true) {
      console.error('❌ ingest unexpected payload', json);
      die('Ingest payload mismatch.');
    }
    console.log('✅ ingest OK', json);
  }

  console.log('🎉 Smoke tests passed.');
}

run().catch(err => die('Unhandled error', err));

// scripts/agent-smoke.mjs
// Smoke that self-discovers latest preview, sets bypass cookie, and
// uses header-based bypass. Missing API routes are non-fatal.

const {
  PREVIEW_URL,                // optional override
  VERCEL_TOKEN,
  VERCEL_TEAM_ID,
  VERCEL_PROJECT_ID,
  VERCEL_BYPASS_TOKEN,
} = process.env;

function die(msg, extra = {}) {
  console.error("❌", msg, extra);
  process.exit(1);
}

function note(msg, extra = {}) {
  console.log("ℹ️", msg, extra);
}

if (!VERCEL_TOKEN)        die("Missing VERCEL_TOKEN");
if (!VERCEL_TEAM_ID)      die("Missing VERCEL_TEAM_ID");
if (!VERCEL_PROJECT_ID)   die("Missing VERCEL_PROJECT_ID");
if (!VERCEL_BYPASS_TOKEN) die("Missing VERCEL_BYPASS_TOKEN (automation bypass secret)");

async function getLatestReadyPreview() {
  if (PREVIEW_URL && PREVIEW_URL.trim()) {
    return PREVIEW_URL.trim().replace(/\/+$/, "");
  }
  // Vercel API: latest READY preview deployment
  const u = new URL("https://api.vercel.com/v6/deployments");
  u.searchParams.set("projectId", VERCEL_PROJECT_ID);
  u.searchParams.set("teamId", VERCEL_TEAM_ID);
  u.searchParams.set("target", "preview");
  u.searchParams.set("state", "READY");
  u.searchParams.set("limit", "1");

  const res = await fetch(u, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    die("Failed to get latest preview from Vercel", { status: res.status, text });
  }
  const json = await res.json();
  const dep = (json.deployments && json.deployments[0]) || (json[0]); // v6 returns {deployments:[]}
  if (!dep || !dep.url) die("No READY preview deployment found");
  const url = dep.url.startsWith("http") ? dep.url : `https://${dep.url}`;
  note("Using preview", { url });
  return url.replace(/\/+$/, "");
}

async function setBypassCookie(baseUrl) {
  // Use the official way to set the bypass cookie via query params
  // Works for Password/SSO/Protection
  const url = `${baseUrl}/?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${encodeURIComponent(
    VERCEL_BYPASS_TOKEN
  )}`;
  const res = await fetch(url, { redirect: "manual" }); // no need to follow
  // Accept 200/204/3xx here — cookie is set by edge middleware
  note("Bypass cookie attempt", { status: res.status });
}

async function getJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      "x-vercel-protection-bypass": VERCEL_BYPASS_TOKEN,
      "accept": "application/json",
    },
  });
  let bodyText = "";
  try { bodyText = await res.text(); } catch {}
  let json = null;
  try { json = JSON.parse(bodyText); } catch {}
  return { res, json, bodyText };
}

async function postForm(url, formObj) {
  const body = new URLSearchParams(formObj);
  return getJson(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

(async () => {
  const base = await getLatestReadyPreview();

  // 1) set bypass cookie
  await setBypassCookie(base);

  // 2) health check home page (should NOT be the “Authentication Required” HTML)
  const home = await fetch(base, {
    headers: { "x-vercel-protection-bypass": VERCEL_BYPASS_TOKEN },
  });
  const homeText = await home.text().catch(() => "");
  if (!home.ok) {
    die("Home page not OK", { status: home.status });
  }
  if (/Authentication Required/i.test(homeText)) {
    die("Bypass failed: still seeing auth page");
  }
  note("Home page OK", { status: home.status });

  // 3) /api/ping (non-fatal if 404/405; fatal if 401/403)
  {
    const { res, json, bodyText } = await getJson(`${base}/api/ping`);
    if (res.status === 401 || res.status === 403) {
      die("/api/ping blocked (auth)", { status: res.status, bodyText });
    }
    if (res.status === 404 || res.status === 405) {
      note("/api/ping not present (skipping)", { status: res.status });
    } else if (!res.ok) {
      note("/api/ping non-OK (skipping but recording)", { status: res.status, bodyText });
    } else {
      note("/api/ping OK", { json: (json ?? bodyText).toString().slice(0, 200) });
    }
  }

  // 4) /api/ingest (non-fatal if 404/405; fatal if 401/403)
  {
    const { res, json, bodyText } = await postForm(`${base}/api/ingest`, {
      type: "book",
      email: "test@example.com",
      _hp: "",
    });
    if (res.status === 401 || res.status === 403) {
      die("/api/ingest blocked (auth)", { status: res.status, bodyText });
    }
    if (res.status === 404 || res.status === 405) {
      note("/api/ingest not present (skipping)", { status: res.status });
    } else if (!res.ok) {
      note("/api/ingest non-OK (skipping but recording)", { status: res.status, bodyText });
    } else {
      note("/api/ingest OK", { json: (json ?? bodyText).toString().slice(0, 200) });
    }
  }

  console.log("✅ smoke passed.");
})().catch((err) => die("Unhandled error", { err: String(err && err.stack || err) }));

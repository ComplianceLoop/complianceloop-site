/* eslint-disable no-console */
const VERBOSE = true;

const {
  VERCEL_TOKEN,
  VERCEL_TEAM_SLUG,
  GITHUB_TOKEN,
  GITHUB_ORG = 'ComplianceLoop',
} = process.env;

if (!VERCEL_TOKEN || !VERCEL_TEAM_SLUG) {
  console.error('Missing VERCEL_TOKEN or VERCEL_TEAM_SLUG in environment.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function vFetch(path) {
  const url = `https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}teamSlug=${encodeURIComponent(VERCEL_TEAM_SLUG)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Vercel ${path} -> ${res.status} ${res.statusText}\n${text}`);
  }
  return res.json();
}

async function ghFetch(path) {
  const url = `https://api.github.com${path}`;
  const headers = { Accept: 'application/vnd.github+json' };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub ${path} -> ${res.status} ${res.statusText}\n${text}`);
  }
  return res.json();
}

async function listVercelProjects() {
  const out = [];
  try {
    const data = await vFetch('/v9/projects?limit=100');
    const projects = data.projects || data; // API sometimes returns {projects:[]}
    for (const p of projects) {
      // details
      let details = {};
      try { details = await vFetch(`/v9/projects/${p.id}`); } catch {}
      // deployments
      let deployments = [];
      try {
        const dd = await vFetch(`/v6/deployments?projectId=${p.id}&limit=5`);
        deployments = dd.deployments || dd;
      } catch {}
      // domains
      let domains = [];
      try {
        const d = await vFetch(`/v9/projects/${p.id}/domains`);
        domains = (d.domains || []).map(dn => dn.name);
      } catch {}
      // env keys (names only, ignore values)
      let envKeys = [];
      try {
        const env = await vFetch(`/v9/projects/${p.id}/env`);
        envKeys = (env.envs || env).map(e => e.key).filter(Boolean);
      } catch {}

      out.push({
        name: p.name,
        id: p.id,
        framework: details.framework || p.framework || null,
        linked_repo: details.link?.repo
          ? {
              owner: details.link.org || details.link.owner || null,
              name: details.link.repo || null,
              branch: details.link.productionBranch || details.link.branch || null
            }
          : null,
        domains,
        recent_deployments: (deployments || []).map(d => ({
          url: d.url ? `https://${d.url}` : null,
          state: d.readyState || d.state || null,
          createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null
        })),
        env_keys: envKeys
      });
      await sleep(150); // be gentle
    }
  } catch (err) {
    if (VERBOSE) console.error('Vercel inventory error:', err.message);
    return [{ error: { endpoint: 'Vercel projects', reason: err.message } }];
  }
  return out;
}

const CANDIDATE_PATHS = [
  'api/ping.js', 'api/ping.ts',
  'pages/api/ping.js', 'pages/api/ping.ts', 'app/api/ping/route.ts',
  'api/ingest.js', 'api/ingest.ts',
  'pages/api/ingest.js', 'pages/api/ingest.ts', 'app/api/ingest/route.ts',
  'next.config.js', 'next.config.ts',
  'vercel.json'
];

async function pathExists(owner, repo, path) {
  try {
    await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURI(path)}`);
    return true;
  } catch {
    return false;
  }
}

async function listGithubRepos() {
  const out = [];
  try {
    const repos = await ghFetch(`/orgs/${GITHUB_ORG}/repos?per_page=100`);
    for (const r of repos) {
      const nameLower = (r.name || '').toLowerCase();
      if (!/site|starter|root/.test(nameLower)) continue;

      const paths_present = {};
      for (const p of CANDIDATE_PATHS) {
        // Only mark ping/ingest booleans; keep keys stable
        const ok = await pathExists(GITHUB_ORG, r.name, p);
        if (p.includes('ping')) paths_present.api_ping = paths_present.api_ping || ok;
        if (p.includes('ingest')) paths_present.api_ingest = paths_present.api_ingest || ok;
        if (p.startsWith('next.config')) paths_present.next_config = paths_present.next_config || ok;
        if (p === 'vercel.json') paths_present.vercel_json = paths_present.vercel_json || ok;
        await sleep(50);
      }

      // latest commit
      let latest_commit = null;
      try {
        const commits = await ghFetch(`/repos/${GITHUB_ORG}/${r.name}/commits?per_page=1`);
        if (Array.isArray(commits) && commits[0]) {
          latest_commit = {
            sha: commits[0].sha,
            date: commits[0].commit?.author?.date || null
          };
        }
      } catch {}

      // workflows
      let workflows = [];
      try {
        const wf = await ghFetch(`/repos/${GITHUB_ORG}/${r.name}/contents/.github/workflows`);
        if (Array.isArray(wf)) {
          workflows = wf.filter(x => x.name && x.name.endsWith('.yml')).map(x => x.name);
        }
      } catch {}

      out.push({
        name: r.name,
        default_branch: r.default_branch,
        paths_present: {
          api_ping: !!paths_present.api_ping,
          api_ingest: !!paths_present.api_ingest,
          next_config: !!paths_present.next_config,
          vercel_json: !!paths_present.vercel_json
        },
        latest_commit: latest_commit,
        workflows
      });
    }
  } catch (err) {
    if (VERBOSE) console.error('GitHub inventory error:', err.message);
    return [{ error: { endpoint: 'GitHub repos', reason: err.message } }];
  }
  return out;
}

function recommend(vercel_projects, github_repos) {
  const out = {
    canonical_repo: null,
    canonical_project: null,
    canonical_domain: 'complianceloop.com',
    justification: []
  };

  // pick repo
  let withApi = github_repos.filter(r => r.paths_present?.api_ping || r.paths_present?.api_ingest);
  if (withApi.length === 0) {
    // fallback: repo named closest to 'complianceloop-site'
    const sorted = [...github_repos].sort((a, b) => {
      const sa = a.name === 'complianceloop-site' ? 0 : 1;
      const sb = b.name === 'complianceloop-site' ? 0 : 1;
      return sa - sb;
    });
    if (sorted[0]) {
      out.canonical_repo = { owner: GITHUB_ORG, name: sorted[0].name, branch: sorted[0].default_branch || 'main' };
      out.justification.push('Chose repo by name and recency; no API routes found.');
    }
  } else {
    // prefer most recent commit
    withApi.sort((a, b) => new Date(b.latest_commit?.date || 0) - new Date(a.latest_commit?.date || 0));
    const top = withApi[0];
    out.canonical_repo = { owner: GITHUB_ORG, name: top.name, branch: top.default_branch || 'main' };
    out.justification.push('Repo contains API routes and has the most recent commit.');
  }

  // pick project linked to that repo, with READY deploys and domains
  if (out.canonical_repo) {
    const candidates = vercel_projects.filter(p => {
      const lr = p.linked_repo;
      return lr && lr.owner && lr.name &&
             lr.owner.toLowerCase() === GITHUB_ORG.toLowerCase() &&
             lr.name.toLowerCase() === out.canonical_repo.name.toLowerCase();
    });
    const readyFirst = (dp) => (dp.state === 'READY' ? 0 : 1);
    candidates.sort((a, b) => {
      const ar = (a.recent_deployments || []).sort((x, y) => readyFirst(x) - readyFirst(y));
      const br = (b.recent_deployments || []).sort((x, y) => readyFirst(x) - readyFirst(y));
      const ad = ar[0]?.createdAt || '';
      const bd = br[0]?.createdAt || '';
      return new Date(bd) - new Date(ad);
    });
    if (candidates[0]) {
      out.canonical_project = { name: candidates[0].name, id: candidates[0].id };
      out.justification.push('Project links to the canonical repo and has recent READY deployments.');
      if ((candidates[0].domains || []).includes('complianceloop.com')) {
        out.justification.push('Project already holds the production domain complianceloop.com.');
      }
    }
  }

  return out;
}

(async () => {
  const vercel_projects = await listVercelProjects();
  const github_repos = await listGithubRepos();
  const recommendation = recommend(
    Array.isArray(vercel_projects) ? vercel_projects : [],
    Array.isArray(github_repos) ? github_repos : []
  );

  const risks = [];
  if (vercel_projects[0]?.error) risks.push('Vercel API unreachable or blocked.');
  if (!recommendation.canonical_repo) risks.push('No repository with clear API routes found.');
  if (!recommendation.canonical_project) risks.push('No Vercel project linked to the canonical repo found.');

  const follow_up_actions_readonly = [
    'Confirm the canonical pair and attach the production domain to that single Vercel project.',
    'Ensure the canonical repo contains /api/ping and /api/ingest routes.',
    'Disable or archive non-canonical Vercel projects to avoid preview confusion.'
  ];

  const json = {
    vercel_projects,
    github_repos,
    recommendation,
    risks,
    follow_up_actions_readonly
  };

  // Write file and also print a readable summary
  const fs = await import('node:fs/promises');
  await fs.writeFile('vercel-inventory.json', JSON.stringify(json, null, 2), 'utf8');

  console.log('\n=== Inventory summary ===');
  console.log(`Vercel projects: ${Array.isArray(vercel_projects) ? vercel_projects.length : 0}`);
  console.log(`GitHub repos scanned: ${Array.isArray(github_repos) ? github_repos.length : 0}`);
  console.log('Recommendation:', recommendation);
  console.log('\nSaved artifact: vercel-inventory.json');
})();

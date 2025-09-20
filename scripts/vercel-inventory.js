// scripts/vercel-inventory.js
// Robust, read-only inventory of GitHub (always) and Vercel (if allowed).
// Never fails the job: prints JSON and exits 0.

const fetch = global.fetch;

function asBool(x) { return !!x && String(x).toLowerCase() !== 'false'; }

function splitOwnerRepo(repoFull, ownerEnv) {
  if (repoFull && repoFull.includes('/')) {
    const [owner, repo] = repoFull.split('/');
    return { owner, repo };
  }
  return { owner: ownerEnv || '', repo: '' };
}

async function ghGet(url, token) {
  const res = await fetch(url, {
    headers: {
      'authorization': `Bearer ${token}`,
      'accept': 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28'
    }
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: res.ok, status: res.status, json, text, headers: res.headers };
}

async function listOrgRepos(owner, token) {
  const out = [];
  if (!owner) return out;
  let page = 1;
  while (true) {
    const url = `https://api.github.com/orgs/${owner}/repos?per_page=100&type=all&page=${page}`;
    const { ok, status, json } = await ghGet(url, token);
    if (!ok) break;
    if (!Array.isArray(json) || json.length === 0) break;
    out.push(...json.map(r => ({
      name: r.name,
      private: r.private,
      default_branch: r.default_branch,
      pushed_at: r.pushed_at,
      archived: r.archived
    })));
    if (json.length < 100) break;
    page += 1;
  }
  return out;
}

async function listWorkflows(owner, repo, token) {
  if (!owner || !repo) return [];
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows`;
  const { ok, json } = await ghGet(url, token);
  if (!ok || !json || !Array.isArray(json.workflows)) return [];
  return json.workflows.map(w => w.name);
}

async function getLatestCommit(owner, repo, branch, token) {
  if (!owner || !repo || !branch) return null;
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`;
  const { ok, json } = await ghGet(url, token);
  if (!ok || !json) return null;
  return {
    sha: json.sha || null,
    date: (json.commit && json.commit.author && json.commit.author.date) || null
  };
}

async function checkPaths(owner, repo, token) {
  // We can use the contents API to see if files/dirs exist
  async function exists(path) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const { ok, status } = await ghGet(url, token);
    if (ok) return true;
    // 404 means "not found" (expected), other statuses we just treat as not found
    return false;
  }
  return {
    api_ping: await exists('api/ping'),
    api_ingest: await exists('api/ingest'),
    next_config: await exists('next.config.js'),
    vercel_json: await exists('vercel.json')
  };
}

async function vercelProjects({ token, teamId, teamSlug }) {
  if (!token) {
    return [{ error: { reason: 'No VERCEL_TOKEN provided' } }];
  }
  try {
    const base = 'https://api.vercel.com/v9/projects';
    const teamParam = teamId ? `teamId=${encodeURIComponent(teamId)}` : (teamSlug ? `teamSlug=${encodeURIComponent(teamSlug)}` : '');
    const url = teamParam ? `${base}?${teamParam}&limit=100` : `${base}?limit=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    if (!res.ok) {
      return [{ error: { endpoint: url, status: res.status, text: text.slice(0, 300) } }];
    }
    if (!json || !Array.isArray(json.projects)) {
      return [{ error: { endpoint: url, status: 'bad-json' } }];
    }
    return json.projects.map(p => ({
      id: p.id,
      name: p.name,
      framework: p.framework || null,
      latestDeployment: p.latestDeployments && p.latestDeployments[0] ? {
        state: p.latestDeployments[0].state,
        createdAt: p.latestDeployments[0].createdAt
      } : null
    }));
  } catch (e) {
    return [{ error: { reason: 'blocked-or-network', message: String(e).slice(0, 300) } }];
  }
}

(async () => {
  const env = process.env;
  const repoFull = env.REPO_FULL || '';
  const ownerEnv = env.OWNER || '';
  const { owner, repo } = splitOwnerRepo(repoFull, ownerEnv);
  const ghToken = env.GH_TOKEN || env.GITHUB_TOKEN || '';
  const vercelToken = env.VERCEL_TOKEN || '';
  const vercelTeamId = env.VERCEL_TEAM_ID || '';
  const vercelTeamSlug = env.VERCEL_TEAM_SLUG || '';

  const result = {
    github_repos: [],
    vercel_projects: [],
    context: { owner, repo, repoFull },
    warnings: [],
  };

  if (!ghToken) {
    result.warnings.push('Missing GH_TOKEN/GITHUB_TOKEN; GitHub inventory may be incomplete.');
  }

  // GitHub inventory for the org
  try {
    const repos = await listOrgRepos(owner, ghToken);
    result.github_repos = repos;
  } catch (e) {
    result.warnings.push(`GitHub inventory failed: ${String(e).slice(0, 200)}`);
  }

  // If current repo is known, enrich it with paths/workflows/latest commit
  if (owner && repo) {
    try {
      const r = result.github_repos.find(r => r.name === repo) || { name: repo };
      r.paths_present = await checkPaths(owner, repo, ghToken);
      r.workflows = await listWorkflows(owner, repo, ghToken);
      const latest = await getLatestCommit(owner, repo, r.default_branch, ghToken);
      if (latest) r.latest_commit = latest;
      // ensure it’s present in the list
      if (!result.github_repos.find(x => x.name === repo)) {
        result.github_repos.unshift(r);
      }
    } catch (e) {
      result.warnings.push(`Repo enrichment failed: ${String(e).slice(0, 200)}`);
    }
  }

  // Vercel inventory (optional; never fail job)
  try {
    result.vercel_projects = await vercelProjects({
      token: vercelToken,
      teamId: vercelTeamId,
      teamSlug: vercelTeamSlug
    });
  } catch (e) {
    result.vercel_projects = [{ error: { reason: 'unexpected', message: String(e).slice(0, 300) } }];
  }

  // Print JSON so you can copy/paste from the run logs
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})();

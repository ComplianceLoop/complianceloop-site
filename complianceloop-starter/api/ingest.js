// complianceloop-starter/api/ingest.js
// Next.js Pages API — ESM default export (NOT CommonJS)
// - Accepts POST form submissions (x-www-form-urlencoded) from book.html via hidden iframe
// - Validates origin via ORIGIN_ALLOWLIST
// - If AIRTABLE_* present, writes to Airtable; else falls back to MAKE_WEBHOOK_*
// - Returns JSON and proper HTTP status codes

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk.toString()));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function parseForm(body) {
  const params = new URLSearchParams(body);
  const data = {};
  for (const [key, value] of params.entries()) {
    if (key.endsWith('[]')) {
      const k = key.slice(0, -2);
      data[k] = data[k] ? data[k].concat(value) : [value];
    } else {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        data[key] = Array.isArray(data[key]) ? data[key].concat(value) : [data[key], value];
      } else {
        data[key] = value;
      }
    }
  }
  return { data, params };
}

function originFromHeaders(req) {
  // Prefer Origin; fallback to Referer
  const origin = req.headers.origin || '';
  if (origin) return origin;
  const ref = req.headers.referer || '';
  try {
    if (ref) {
      const u = new URL(ref);
      return `${u.protocol}//${u.host}`;
    }
  } catch {}
  return '';
}

function allowedByList(requestOrigin, list) {
  if (!list || list.length === 0) return true;
  return list.some(pattern => {
    if (pattern.includes('*')) {
      const re = new RegExp(
        '^' +
          pattern
            .replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&')
            .replace(/\\\*/g, '.*') +
          '$'
      );
      return re.test(requestOrigin);
    }
    return pattern === requestOrigin;
  });
}

async function timeoutFetch(url, options = {}, ms = 5000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

export default async function handler(req, res) {
  // Only POST is allowed
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  // Origin allowlist
  const allow = (process.env.ORIGIN_ALLOWLIST || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const requestOrigin = originFromHeaders(req);
  if (!allowedByList(requestOrigin, allow)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'forbidden' }));
    return;
  }

  // Read & parse form body (x-www-form-urlencoded)
  const raw = await readBody(req);
  const { data, params } = parseForm(raw);

  // Honeypot
  if (data._hp) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, route: 'ignored' }));
    return;
  }

  const type = (data.type || 'book').toLowerCase();

  // Try Airtable first if creds are present
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE;

  if (apiKey && baseId && table) {
    try {
      const response = await timeoutFetch(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fields: data })
        }
      );
      if (response.ok) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, route: 'airtable' }));
        return;
      }
      // fall through to Make if Airtable fails
    } catch {
      // fall through
    }
  }

  // Make fallback
  const map = {
    book: process.env.MAKE_WEBHOOK_BOOK,
    provider: process.env.MAKE_WEBHOOK_PROVIDER,
    magic: process.env.MAKE_WEBHOOK_MAGIC,
    planner: process.env.MAKE_WEBHOOK_PLANNER,
  };
  const webhook = map[type] || map.book;

  if (webhook) {
    try {
      await timeoutFetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
    } catch {
      // ignore network errors, still return success (we're async fire-and-forget)
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, route: 'make' }));
    return;
  }

  // Nothing available
  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: 'no_destination' }));
}

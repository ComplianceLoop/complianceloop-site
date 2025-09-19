// complianceloop-starter/api/ingest.js
// Accepts form POSTs and forwards to Airtable or Make webhooks.
// Fixes wildcard origin matching (e.g. https://*.vercel.app).

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  // ---- Origin allow-list ----------------------------------------------------
  const allowEnv = process.env.ORIGIN_ALLOWLIST || '';
  const allowed = allowEnv.split(',').map(s => s.trim()).filter(Boolean);

  // Normalize to compare without trailing slash
  const norm = s => (s || '').replace(/\/$/, '');

  // Convert a pattern with * to a RegExp that actually matches subdomains
  const toWildcardRegex = (pattern) => {
    // Escape regex special chars EXCEPT the asterisk, then convert * -> .*
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
    return new RegExp(regexStr);
  };

  // Figure out the request's origin
  const originHeader = req.headers.origin || '';
  let requestOrigin = originHeader;
  if (!requestOrigin && req.headers.referer) {
    try {
      const url = new URL(req.headers.referer);
      requestOrigin = `${url.protocol}//${url.host}`;
    } catch (_e) {}
  }

  // Decide if this origin is allowed
  const isAllowed =
    allowed.length === 0 ||
    allowed.some((p) => {
      const pat = norm(p);
      const ori = norm(requestOrigin);
      if (pat.includes('*')) return toWildcardRegex(pat).test(ori);
      return pat === ori;
    });

  if (!isAllowed) {
    res.status(403).json({
      ok: false,
      error: 'forbidden',
      origin: requestOrigin,
      allowlist: allowed
    });
    return;
  }

  // ---- Read x-www-form-urlencoded body -------------------------------------
  const bodyText = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk.toString()));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  const params = new URLSearchParams(bodyText);
  const data = {};
  for (const [k, v] of params.entries()) {
    if (k.endsWith('[]')) {
      const key = k.slice(0, -2);
      data[key] = Array.isArray(data[key]) ? data[key].concat(v) : (data[key] ? [data[key], v] : [v]);
    } else if (k in data) {
      data[k] = Array.isArray(data[k]) ? data[k].concat(v) : [data[k], v];
    } else {
      data[k] = v;
    }
  }

  // Simple honeypot
  if (data._hp) {
    res.status(200).json({ ok: true, route: 'ignored' });
    return;
  }

  const type = data.type || 'book';

  // Small helper for timeouts on outbound fetch
  async function timeoutFetch(url, options = {}) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(url, { ...options, signal: ctrl.signal });
      return r;
    } finally {
      clearTimeout(id);
    }
  }

  // ---- If Airtable creds exist, try Airtable first --------------------------
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE;

  if (apiKey && baseId && tableName) {
    try {
      const r = await timeoutFetch(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fields: data })
        }
      );
      if (r.ok) {
        res.status(200).json({ ok: true, route: 'airtable' });
        return;
      }
    } catch (_e) {
      // fall through to Make
    }
  }

  // ---- Else, send to Make webhook (by type) ---------------------------------
  const webhookMap = {
    book: process.env.MAKE_WEBHOOK_BOOK,
    provider: process.env.MAKE_WEBHOOK_PROVIDER,
    magic: process.env.MAKE_WEBHOOK_MAGIC,
    planner: process.env.MAKE_WEBHOOK_PLANNER
  };
  const webhookUrl = webhookMap[type] || webhookMap.book;

  if (webhookUrl) {
    try {
      await timeoutFetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
    } catch (_e) {
      // ignore network errors to keep UX simple
    }
    res.status(200).json({ ok: true, route: 'make' });
    return;
  }

  res.status(500).json({ ok: false, error: 'no_route' });
}

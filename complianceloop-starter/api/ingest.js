// complianceloop-starter/api/ingest.js
// CommonJS export; used by pages/api/ingest.js

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  const allowEnv = process.env.ORIGIN_ALLOWLIST || '';
  const allowed = allowEnv.split(',').map(s => s.trim()).filter(Boolean);
  const originHeader = req.headers.origin || '';
  let requestOrigin = originHeader;
  if (!requestOrigin && req.headers.referer) {
    try {
      const url = new URL(req.headers.referer);
      requestOrigin = `${url.protocol}//${url.host}`;
    } catch (_) {
      requestOrigin = '';
    }
  }
  const isAllowed = allowed.length === 0 || allowed.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern
        .replace(/[-/\\^$+?.()|[\\]{}]/g, '\\$&')
        .replace(/\\*/g, '.*') + '$');
      return regex.test(requestOrigin);
    }
    return pattern === requestOrigin;
  });
  if (!isAllowed) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'forbidden' }));
    return;
  }

  const body = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
    req.on('error', err => reject(err));
  });

  const params = new URLSearchParams(body);
  const data = {};
  for (const [key, value] of params.entries()) {
    if (key.endsWith('[]')) {
      const k = key.slice(0, -2);
      data[k] = data[k] ? data[k].concat(value) : [value];
    } else if (Object.prototype.hasOwnProperty.call(data, key)) {
      data[key] = Array.isArray(data[key]) ? data[key].concat(value) : [data[key], value];
    } else {
      data[key] = value;
    }
  }

  // Honeypot
  if (data._hp) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, route: 'ignored' }));
    return;
  }

  async function timeoutFetch(url, options = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    try {
      const r = await fetch(url, { ...options, signal: controller.signal });
      return r;
    } finally {
      clearTimeout(id);
    }
  }

  // Airtable-first
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE;
  if (apiKey && baseId && tableName) {
    try {
      const response = await timeoutFetch(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
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
    } catch (_) { /* fall through to Make */ }
  }

  // Two Make fallbacks: 'book' and 'provider'
  const type = data.type === 'provider' ? 'provider' : 'book';
  const webhookMap = {
    book: process.env.MAKE_WEBHOOK_BOOK,
    provider: process.env.MAKE_WEBHOOK_PROVIDER
  };
  const webhookUrl = webhookMap[type] || webhookMap.book;

  if (webhookUrl) {
    try {
      await timeoutFetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
    } catch (_) { /* ignore */ }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, route: 'make' }));
    return;
  }

  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: 'invalid_type' }));
};

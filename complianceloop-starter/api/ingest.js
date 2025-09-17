// complianceloop-starter/api/ingest.js
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
      const u = new URL(req.headers.referer);
      requestOrigin = `${u.protocol}//${u.host}`;
    } catch (_) {}
  }
  const isAllowed =
    allowed.length === 0 ||
    allowed.some(pat => {
      if (pat.includes('*')) {
        const re = new RegExp('^' + pat.replace(/[-/\\^$+?.()|[\\]{}]/g, '\\$&').replace(/\\\*/g, '.*') + '$');
        return re.test(requestOrigin);
      }
      return pat === requestOrigin;
    });
  if (!isAllowed) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'forbidden' }));
    return;
  }

  const raw = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => (data += c.toString()));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
  const params = new URLSearchParams(raw);
  const data = {};
  for (const [k, v] of params.entries()) {
    if (k.endsWith('[]')) {
      const key = k.slice(0, -2);
      data[key] = data[key] ? data[key].concat(v) : [v];
    } else if (Object.prototype.hasOwnProperty.call(data, k)) {
      data[k] = Array.isArray(data[k]) ? data[k].concat(v) : [data[k], v];
    } else {
      data[k] = v;
    }
  }
  if (data._hp) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, route: 'ignored' }));
    return;
  }

  async function timeoutFetch(url, options = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    try { return await fetch(url, { ...options, signal: controller.signal }); }
    finally { clearTimeout(id); }
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE;
  if (apiKey && baseId && table) {
    try {
      const r = await timeoutFetch(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ fields: data })
        }
      );
      if (r.ok) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, route: 'airtable' }));
        return;
      }
    } catch (_) {}
  }

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
    } catch (_) {}
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, route: 'make' }));
    return;
  }

  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: 'invalid_type' }));
};

// API route for ingesting form submissions.
// This handler validates the origin against an allow list, parses form
// submissions (application/x-www-form-urlencoded) from the booking and
// provider intake forms, writes to Airtable when credentials are present,
// and falls back to Make webhooks by type when Airtable credentials are
// missing or the write fails. All outbound requests enforce a five second
// timeout.

export default async function handler(req, res) {
  // Only accept POST submissions
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  // Validate origin or referer against allow list
  const allowEnv = process.env.ORIGIN_ALLOWLIST || '';
  const allowed = allowEnv.split(',').map(s => s.trim()).filter(Boolean);
  const originHeader = req.headers.origin || '';
  // Derive origin from referer if origin header missing
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
      // Convert wildcard patterns to regex, escaping dots
      const regex = new RegExp('^' + pattern
        .replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&')
        .replace(/\*/g, '.*') + '$');
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

  // Read the raw body (expect x-www-form-urlencoded)
  const body = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
    req.on('error', err => reject(err));
  });
  const params = new URLSearchParams(body);
  // Convert URLSearchParams to plain object, collapsing [] keys into arrays
  const data = {};
  for (const [key, value] of params.entries()) {
    if (key.endsWith('[]')) {
      const k = key.slice(0, -2);
      data[k] = data[k] ? data[k].concat(value) : [value];
    } else {
      // Collect duplicate keys into arrays as well
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        data[key] = Array.isArray(data[key]) ? data[key].concat(value) : [data[key], value];
      } else {
        data[key] = value;
      }
    }
  }
  // Check honeypot
  if (data._hp) {
    // Bot submission - accept silently
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, route: 'ignored' }));
    return;
  }
  const type = data.type || '';

  // Generic fetch wrapper with timeout
  async function timeoutFetch(url, options = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  }

  // Attempt to write to Airtable if credentials present
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE;
  if (apiKey && baseId && tableName) {
    try {
      const record = { fields: data };
      const response = await timeoutFetch(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(record)
        }
      );
      if (response.ok) {
        // success
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, route: 'airtable' }));
        return;
      }
    } catch (err) {
      // Ignore errors and fall back to Make
    }
  }
  // Determine fallback webhook URL by type
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
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
    } catch (err) {
      // ignore
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, route: 'make' }));
    return;
  }
  // Unknown type or misconfiguration
  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: 'invalid_type' }));
}

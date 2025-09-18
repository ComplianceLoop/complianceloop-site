// complianceloop-starter/api/ingest.js
// Next.js API route to receive form submissions.
// - Checks ORIGIN_ALLOWLIST (comma-separated). Supports '*' wildcards.
// - Accepts application/x-www-form-urlencoded bodies.
// - Honeypot field: _hp (if present -> ignore).
// - Tries Airtable if creds exist; otherwise posts to Make.com webhook(s).

export default async function handler(req, res) {
  // 1) Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  // 2) Resolve the request origin (Origin header or Referer -> origin)
  let requestOrigin = req.headers.origin || '';
  if (!requestOrigin && req.headers.referer) {
    try {
      requestOrigin = new URL(req.headers.referer).origin;
    } catch (_) {
      requestOrigin = '';
    }
  }

  // 3) Allowlist with wildcards
  const allowEnv = process.env.ORIGIN_ALLOWLIST || '';
  const allowlist = allowEnv.split(',').map(s => s.trim()).filter(Boolean);

  const escapeForRegex = (s) =>
    s.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');

  // IMPORTANT: the '\\*' sequence must be matched as a literal backslash + asterisk in the regex,
  // which requires three backslashes in a JS regex literal: /\\\*/g
  const patternToRegex = (p) =>
    new RegExp('^' + escapeForRegex(p).replace(/\\\*/g, '.*') + '$');

  const isAllowed =
    allowlist.length === 0 ||
    allowlist.some(p =>
      p.includes('*') ? patternToRegex(p).test(requestOrigin) : p === requestOrigin
    );

  if (!isAllowed) {
    res.status(403).json({
      ok: false,
      error: 'forbidden',
      origin: requestOrigin,
      allowlist
    });
    return;
  }

  // 4) Read urlencoded body
  const rawBody = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  const params = new URLSearchParams(rawBody);

  // 5) Honeypot
  if (params.get('_hp')) {
    res.status(200).json({ ok: true, route: 'ignored' });
    return;
  }

  // 6) Determine type (used for routing to different webhooks)
  const type = params.get('type') || 'book';

  // 7) Try Airtable if configured; otherwise fall back to Make.com webhook(s)
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE;

  const timeoutFetch = async (url, options = {}) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    try {
      const r = await fetch(url, { ...options, signal: controller.signal });
      return r;
    } finally {
      clearTimeout(id);
    }
  };

  try {
    if (apiKey && baseId && tableName) {
      const fields = {};
      for (const [k, v] of params.entries()) {
        // Collapse multi-value keys ending with [] into arrays
        if (k.endsWith('[]')) {
          const key = k.slice(0, -2);
          fields[key] = fields[key] ? [...fields[key], v] : [v];
        } else if (fields[k] !== undefined) {
          fields[k] = Array.isArray(fields[k]) ? [...fields[k], v] : [fields[k], v];
        } else {
          fields[k] = v;
        }
      }

      const r = await timeoutFetch(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fields })
        }
      );

      if (r.ok) {
        res.status(200).json({ ok: true, route: 'airtable' });
        return;
      }
      // If Airtable fails, fall through to webhook
    }
  } catch (_) {
    // ignore and fall through
  }

  const webhookMap = {
    book: process.env.MAKE_WEBHOOK_BOOK,
    provider: process.env.MAKE_WEBHOOK_PROVIDER,
    magic: process.env.MAKE_WEBHOOK_MAGIC,
    planner: process.env.MAKE_WEBHOOK_PLANNER
  };

  const webhookUrl = webhookMap[type] || webhookMap.book;

  try {
    if (webhookUrl) {
      await timeoutFetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      res.status(200).json({ ok: true, route: 'make' });
      return;
    }
  } catch (_) {
    // ignore
  }

  res.status(200).json({ ok: true, route: 'none' });
}

// pages/api/ingest.js
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  try {
    // CORS: reflect allowed origin, handle OPTIONS
    const allowEnv = process.env.ORIGIN_ALLOWLIST || '';
    const allowlist = allowEnv.split(',').map(s => s.trim()).filter(Boolean);
    const origin = getOrigin(req);
    const isAllowed = !allowlist.length || allowlist.some(p => matchPattern(origin, p));

    if (isAllowed && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method !== 'POST') { res.status(200).json({ ok: true, method: req.method, note: 'ingest alive' }); return; }
    if (!isAllowed) { res.status(403).json({ ok: false, error: 'forbidden', origin, allowlist }); return; }

    const bodyStr = await readBody(req);
    const params = new URLSearchParams(bodyStr);
    if (params.get('_hp')) { res.status(200).json({ ok: true, route: 'ignored' }); return; }

    // outbound helpers
    const tFetch = (url, init={}, ms=5000) => {
      const ctl = new AbortController(); const id = setTimeout(() => ctl.abort(), ms);
      return fetch(url, { ...init, signal: ctl.signal }).finally(() => clearTimeout(id));
    };

    const type = params.get('type') || 'book';
    const webhookMap = {
      book: process.env.MAKE_WEBHOOK_BOOK,
      provider: process.env.MAKE_WEBHOOK_PROVIDER,
      magic: process.env.MAKE_WEBHOOK_MAGIC,
      planner: process.env.MAKE_WEBHOOK_PLANNER,
    };
    const webhookUrl = webhookMap[type] || webhookMap.book;

    if (webhookUrl) {
      try {
        await tFetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        }, 5000);
      } catch (e) { console.error('Make webhook error:', e); }
      res.status(200).json({ ok: true, route: 'make' });
      return;
    }

    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableName = process.env.AIRTABLE_TABLE;
    if (apiKey && baseId && tableName) {
      try {
        const fields = Object.fromEntries(params.entries());
        const r = await tFetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ fields }),
        }, 5000);
        if (!r.ok) console.error('Airtable non-OK:', r.status, await r.text());
      } catch (e) { console.error('Airtable error:', e); }
      res.status(200).json({ ok: true, route: 'airtable' });
      return;
    }

    res.status(200).json({ ok: true, route: 'noop' });
  } catch (e) {
    console.error('ingest caught error:', e);
    res.status(200).json({ ok: true, route: 'noop', debug: 'caught' });
  }
}

function getOrigin(req) {
  const o = req.headers.origin; if (o) return o;
  const ref = req.headers.referer; if (!ref) return '';
  try { const u = new URL(ref); return `${u.protocol}//${u.host}`; } catch { return ''; }
}
function matchPattern(origin, pattern) {
  try {
    const norm = pattern.includes('://') ? new URL(pattern).origin : pattern;
    if (norm.includes('*')) {
      const re = new RegExp('^' + norm.replace(/[-/\\^$+?.()|[\]{}]/g,'\\$&').replace(/\\\*/g,'.*') + '$');
      return re.test(origin);
    }
    return origin === norm;
  } catch { return origin === pattern; }
}
function readBody(req){return new Promise((res,rej)=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>res(d));req.on('error',rej)})}

// scripts/smoke.mjs
import { setTimeout as wait } from 'node:timers/promises';
const BASE = process.env.BASE_URL; // e.g. https://<preview>.vercel.app
if (!BASE) { console.error('Missing BASE_URL'); process.exit(1); }

async function j(url, init) {
  const r = await fetch(url, init);
  const txt = await r.text();
  try { return { status: r.status, json: JSON.parse(txt) }; }
  catch { return { status: r.status, text: txt }; }
}

async function main() {
  const steps = [];

  steps.push(['ping', async () => {
    const r = await j(`${BASE}/api/ping`);
    if (r.status !== 200 || !r.json?.pong) throw r;
  }]);

  steps.push(['ingest OPTIONS', async () => {
    const r = await fetch(`${BASE}/api/ingest`, { method: 'OPTIONS' });
    if (r.status !== 204) throw { status: r.status };
  }]);

  steps.push(['ingest POST (honeypot)', async () => {
    const r = await j(`${BASE}/api/ingest`, {
      method: 'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded'},
      body: '_hp=1&type=book&email=test%40example.com'
    });
    if (r.status !== 200 || r.json?.route !== 'ignored') throw r;
  }]);

  steps.push(['ingest POST (normal)', async () => {
    const r = await j(`${BASE}/api/ingest`, {
      method: 'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded'},
      body: 'type=book&email=test%40example.com'
    });
    if (r.status !== 200 || !r.json || !['make','airtable','noop'].includes(r.json.route)) throw r;
  }]);

  let ok = 0;
  for (const [name, fn] of steps) {
    try { await fn(); ok++; console.log(`✅ ${name}`); }
    catch (e) { console.error(`❌ ${name}`, e); process.exit(1); }
    await wait(100);
  }
  console.log(`All ${ok}/${steps.length} smoke checks passed.`);
}

main().catch(e => { console.error(e); process.exit(1); });

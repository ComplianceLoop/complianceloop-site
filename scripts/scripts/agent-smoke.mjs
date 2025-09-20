/* agent-smoke.mjs */
const {
  PREVIEW_URL,
  VERCEL_TOKEN,
  VERCEL_TEAM_ID,
  VERCEL_PROJECT_ID,
  VERCEL_BYPASS_TOKEN,
} = process.env;

const log = (...a) => console.log('[smoke]', ...a);
const fail = (msg, extra) => { console.error('\n[smoke:fail]', msg); if (extra) console.error(extra); process.exit(1); };

async function jsonOrText(res){ const t=await res.text(); try{ return JSON.parse(t);}catch{ return t; } }
function normalizeUrl(u){ if(!u) return ''; if(u.startsWith('http')) return u; return `https://${u}`; }

async function discoverLatestPreview(){
  if(!VERCEL_TOKEN || !VERCEL_PROJECT_ID){
    fail('Missing VERCEL_TOKEN or VERCEL_PROJECT_ID for preview discovery. Set PREVIEW_URL secret or provide inputs.preview_url.');
  }
  const qs=new URLSearchParams({ projectId: VERCEL_PROJECT_ID, state:'READY', limit:'1' });
  if(VERCEL_TEAM_ID) qs.set('teamId', VERCEL_TEAM_ID);
  const url=`https://api.vercel.com/v6/deployments?${qs.toString()}`;
  log('Discovering latest preview via:', url.replace(VERCEL_PROJECT_ID,'***'));
  const res=await fetch(url,{ headers:{ Authorization:`Bearer ${VERCEL_TOKEN}` }});
  if(!res.ok) fail(`Vercel API failed (${res.status})`, await jsonOrText(res));
  const data=await res.json();
  const dep=(data.deployments && data.deployments[0])||null;
  if(!dep || !dep.url) fail('No READY deployments found for this project.');
  const finalUrl=normalizeUrl(dep.url);
  log('Latest preview:', finalUrl);
  return finalUrl;
}

async function setBypassCookie(baseUrl){
  if(!VERCEL_BYPASS_TOKEN){ log('No VERCEL_BYPASS_TOKEN provided; skipping protection-bypass cookie.'); return; }
  const u=new URL(baseUrl); u.pathname='/'; u.search=`x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${encodeURIComponent(VERCEL_BYPASS_TOKEN)}`;
  const res=await fetch(u.toString(),{ redirect:'manual' });
  if(res.status>=400){ log('Bypass cookie attempt did not return 2xx/3xx; continuing anyway.', res.status); }
  else { log('Bypass cookie set (or already set).'); }
}

async function checkPing(baseUrl){
  const res=await fetch(new URL('/api/ping',baseUrl));
  const body=await jsonOrText(res);
  if(!res.ok) fail(`GET /api/ping failed with ${res.status}`, body);
  if(typeof body==='object' && body.pong===true){ log('GET /api/ping OK:', body); }
  else { fail('GET /api/ping did not return expected shape', body); }
}

async function probeIngest(baseUrl){
  const res=await fetch(new URL('/api/ingest', baseUrl),{
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body:new URLSearchParams({ type:'book', email:'test%40example.com', _hp:'' }),
    redirect:'manual',
  });
  const body=await jsonOrText(res);

  if(res.status===200 || res.status===204){ log('POST /api/ingest OK:', res.status); return; }
  if(res.status===401 || res.status===403){
    log('POST /api/ingest denied', { status:res.status, body });
    log('If this is a CORS/Origin allowlist issue, confirm ORIGIN_ALLOWLIST includes:', new URL(baseUrl).origin);
    log('If this is preview protection, ensure bypass cookie step succeeded and token is valid.');
    fail('Ingest blocked (401/403). See logs above for next actions.');
  }
  if(res.status===405){ fail('POST /api/ingest returned 405 (Method Not Allowed). Verify route supports POST in preview.', body); }
  if(res.status===504 || res.status===500){ fail('Server error from /api/ingest', { status:res.status, body }); }
  fail(`Unexpected /api/ingest status ${res.status}`, body);
}

(async ()=>{
  try{
    let base=(PREVIEW_URL && PREVIEW_URL.trim()) || '';
    if(!base){ log('PREVIEW_URL not provided; discovering latest READY deployment...'); base=await discoverLatestPreview(); }
    else { base=normalizeUrl(base); log('Using provided PREVIEW_URL:', base); }

    await setBypassCookie(base);
    await checkPing(base);
    await probeIngest(base);

    log('✅ Smoke tests passed.');
    process.exit(0);
  }catch(err){ fail('Unhandled error', err?.stack || err); }
})();

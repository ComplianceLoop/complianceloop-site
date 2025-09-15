import { parse } from 'querystring';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const origin = (req.headers.origin || '') + (req.headers.referer || '');
  if (!origin.toLowerCase().includes('complianceloop.com')) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  const body = await getBody(req);
  if (body._hp) {
    res.status(400).json({ error: 'spam' });
    return;
  }
  const payload = { ...body };
  delete payload._hp;
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_INTAKES_TABLE, MAKE_FORMS_WEBHOOK_URL } = process.env;
  try {
    if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID && AIRTABLE_INTAKES_TABLE) {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_INTAKES_TABLE}`;
      const fields = {
        type: payload.type || 'book',
        payload: JSON.stringify(payload),
        processed: false,
        result_notes: ''
      };
      const airtableRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AIRTABLE_API_KEY}`
        },
        body: JSON.stringify({ records: [{ fields }] })
      });
      if (!airtableRes.ok) throw new Error('Airtable error');
    } else if (MAKE_FORMS_WEBHOOK_URL) {
      const resp = await fetch(MAKE_FORMS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error('Webhook error');
    } else {
      res.status(500).json({ error: 'no storage configured' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'storage error' });
  }
}

function getBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          resolve(JSON.parse(data || '{}'));
        } catch {
          resolve({});
        }
      } else {
        resolve(parse(data));
      }
    });
  });
}

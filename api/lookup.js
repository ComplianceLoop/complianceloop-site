export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '');
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const origin = req.headers.origin || '';
  if (origin && !origin.toLowerCase().includes('complianceloop.com')) {
    res.status(403).json({ found: false });
    return;
  }
  const email = req.query.email;
  if (!email) {
    res.status(400).json({ error: 'email required' });
    return;
  }
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_CONTACTS_TABLE } = process.env;
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_CONTACTS_TABLE) {
    res.status(200).json({ found: false });
    return;
  }
  try {
    const filter = encodeURIComponent(`{email}='${email}'`);
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_CONTACTS_TABLE}?filterByFormula=${filter}&maxRecords=1`;
    const airtableRes = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });
    if (!airtableRes.ok) throw new Error('Airtable error');
    const data = await airtableRes.json();
    if (data.records && data.records.length) {
      const f = data.records[0].fields || {};
      res.status(200).json({
        found: true,
        contact: {
          full_name: f.full_name || '',
          phone: f.phone || '',
          primary_property: {
            address: f.address || '',
            city: f.city || ''
          }
        }
      });
    } else {
      res.status(200).json({ found: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ found: false });
  }
}

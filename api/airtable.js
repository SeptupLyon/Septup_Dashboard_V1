export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const AT_TOKEN = process.env.AT_TOKEN;
  const AT_BASE = process.env.AT_BASE;

  if (!AT_TOKEN || !AT_BASE) {
    return res.status(500).json({ error: 'Airtable credentials not configured' });
  }

  const { method, table, params, recordId, fields } = req.body;

  try {
    let url = 'https://api.airtable.com/v0/' + AT_BASE + '/' + encodeURIComponent(table);
    let fetchOptions = { headers: { 'Authorization': 'Bearer ' + AT_TOKEN } };

    if (method === 'GET') {
      if (params) url += '?' + params;
      const r = await fetch(url, fetchOptions);
      const data = await r.json();
      if (!r.ok) console.error('[airtable] GET', table, r.status, JSON.stringify(data));
      return res.json(data);
    }

    if (method === 'POST') {
      fetchOptions.method = 'POST';
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify({ fields });
      const r = await fetch(url, fetchOptions);
      const data = await r.json();
      if (!r.ok) console.error('[airtable] POST', table, r.status, JSON.stringify(data));
      return res.json(data);
    }

    if (method === 'PATCH') {
      url += '/' + recordId;
      fetchOptions.method = 'PATCH';
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify({ fields });
      const r = await fetch(url, fetchOptions);
      const data = await r.json();
      if (!r.ok) console.error('[airtable] PATCH', table, recordId, r.status, JSON.stringify(data));
      return res.json(data);
    }

    if (method === 'DELETE') {
      url += '/' + recordId;
      fetchOptions.method = 'DELETE';
      const r = await fetch(url, fetchOptions);
      const data = await r.json();
      if (!r.ok) console.error('[airtable] DELETE', table, recordId, r.status, JSON.stringify(data));
      return res.json(data);
    }

    return res.status(400).json({ error: 'Unknown method' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

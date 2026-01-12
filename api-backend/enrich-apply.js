const HUBSPOT_API_BASE = 'https://api.hubapi.com';

async function hubspotFetch(path, token, options = {}) {
  const resp = await fetch(`${HUBSPOT_API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await resp.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: resp.ok, status: resp.status, data, text };
}

async function filterExistingProperties(objectType, token, updates) {
  const entries = Object.entries(updates || {});
  const allowed = {};
  for (const [key, value] of entries) {
    const resp = await hubspotFetch(`/crm/v3/properties/${objectType}/${key}`, token);
    if (resp.ok) {
      allowed[key] = value;
    }
  }
  return allowed;
}

export default async function handler(req, res) {

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contactId, companyId, contactUpdates, companyUpdates, noteBody } = req.body || {};
  if (!contactId) return res.status(400).json({ error: 'Missing contactId' });

  const hubspotToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!hubspotToken) {
    return res.status(503).json({ error: 'Missing HubSpot private app token' });
  }

  try {
    const applied = {
      contact: null,
      company: null,
      note: null
    };

    const safeContactUpdates = await filterExistingProperties('contacts', hubspotToken, contactUpdates || {});
    if (Object.keys(safeContactUpdates).length > 0) {
      const resp = await hubspotFetch(`/crm/v3/objects/contacts/${contactId}`, hubspotToken, {
        method: 'PATCH',
        body: { properties: safeContactUpdates }
      });
      if (!resp.ok) {
        return res.status(resp.status).json({ error: 'Contact update failed', details: resp.text });
      }
      applied.contact = safeContactUpdates;
    }

    const safeCompanyUpdates = await filterExistingProperties('companies', hubspotToken, companyUpdates || {});
    if (companyId && Object.keys(safeCompanyUpdates).length > 0) {
      const resp = await hubspotFetch(`/crm/v3/objects/companies/${companyId}`, hubspotToken, {
        method: 'PATCH',
        body: { properties: safeCompanyUpdates }
      });
      if (!resp.ok) {
        return res.status(resp.status).json({ error: 'Company update failed', details: resp.text });
      }
      applied.company = safeCompanyUpdates;
    }

    if (noteBody) {
      const resp = await hubspotFetch('/engagements/v1/engagements', hubspotToken, {
        method: 'POST',
        body: {
          engagement: { active: true, type: 'NOTE' },
          associations: {
            contactIds: [Number(contactId)]
          },
          metadata: {
            body: noteBody
          }
        }
      });
      if (!resp.ok) {
        return res.status(resp.status).json({ error: 'Note creation failed', details: resp.text });
      }
      applied.note = true;
    }

    return res.status(200).json({ applied });
  } catch (error) {
    console.error('Apply error:', error);
    return res.status(500).json({ error: 'Apply failed' });
  }
}

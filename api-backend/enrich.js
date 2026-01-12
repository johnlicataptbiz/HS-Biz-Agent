const HUBSPOT_API_BASE = 'https://api.hubapi.com';

function buildSearchQuery({ contact, company }) {
  const contactName = [contact.firstname, contact.lastname].filter(Boolean).join(' ').trim();
  const companyName = company?.name || contact.company || '';
  const emailDomain = contact.email ? contact.email.split('@')[1] : '';
  return [companyName, contactName, emailDomain].filter(Boolean).join(' ');
}

function pickFirstLink(items, predicate) {
  if (!Array.isArray(items)) return null;
  const match = items.find((item) => predicate(item.link || ''));
  return match ? match.link : null;
}

function pickPhone(snippets = []) {
  const regex = /(\+?\d[\d\s\-\(\)]{7,}\d)/;
  for (const text of snippets) {
    const match = text.match(regex);
    if (match) return match[1];
  }
  return null;
}

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
  return { ok: resp.ok, status: resp.status, data };
}

export default async function handler(req, res) {

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contactId, portalId } = req.body || {};
  if (!contactId) return res.status(400).json({ error: 'Missing contactId' });

  const googleKey = process.env.GOOGLE_API_KEY;
  const googleCx = process.env.GOOGLE_CSE_ID;
  const hubspotToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

  if (!googleKey || !googleCx) {
    return res.status(503).json({ error: 'Missing Google Custom Search credentials' });
  }
  if (!hubspotToken) {
    return res.status(503).json({ error: 'Missing HubSpot private app token' });
  }

  try {
    const contactResp = await hubspotFetch(
      `/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,phone,jobtitle,company,website,linkedin,linkedinbio,linkedin_profile_url`,
      hubspotToken
    );
    if (!contactResp.ok) {
      return res.status(contactResp.status).json({ error: 'Failed to fetch contact' });
    }

    const contact = contactResp.data.properties || {};

    const assocResp = await hubspotFetch(
      `/crm/v4/objects/contacts/${contactId}/associations/companies?limit=1`,
      hubspotToken
    );
    const companyId = assocResp.ok && assocResp.data?.results?.[0]?.toObjectId
      ? String(assocResp.data.results[0].toObjectId)
      : null;

    let company = null;
    if (companyId) {
      const companyResp = await hubspotFetch(
        `/crm/v3/objects/companies/${companyId}?properties=name,domain,website,industry,numberofemployees,phone`,
        hubspotToken
      );
      company = companyResp.ok ? companyResp.data.properties || {} : null;
    }

    const query = buildSearchQuery({ contact, company });
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(googleKey)}&cx=${encodeURIComponent(googleCx)}&q=${encodeURIComponent(query)}`;
    const searchResp = await fetch(searchUrl);
    if (!searchResp.ok) {
      const text = await searchResp.text();
      return res.status(searchResp.status).json({ error: 'Search failed', details: text });
    }
    const searchData = await searchResp.json();

    const items = searchData.items || [];
    const snippets = items.map((item) => item.snippet || '').filter(Boolean);

    const websiteLink = pickFirstLink(items, (link) => {
      const lower = link.toLowerCase();
      return !lower.includes('linkedin.com') && !lower.includes('facebook.com') && !lower.includes('twitter.com');
    });

    const linkedinLink = pickFirstLink(items, (link) => link.toLowerCase().includes('linkedin.com'));
    const phoneGuess = pickPhone(snippets);

    const contactUpdates = {};
    if (!contact.jobtitle && contact.title) contactUpdates.jobtitle = contact.title;
    if (!contact.phone && phoneGuess) contactUpdates.phone = phoneGuess;
    if (!contact.website && websiteLink) contactUpdates.website = websiteLink;
    if (!contact.company && (company?.name || contact.company)) contactUpdates.company = company?.name || contact.company;

    const linkedinValue = linkedinLink || contact.linkedin || contact.linkedinbio || contact.linkedin_profile_url || null;
    if (linkedinValue && !contact.linkedin_profile_url) {
      contactUpdates.linkedin_profile_url = linkedinValue;
    }

    const companyUpdates = {};
    if (company) {
      if (!company.website && websiteLink) companyUpdates.website = websiteLink;
      if (!company.domain && websiteLink) {
        try {
          companyUpdates.domain = new URL(websiteLink).hostname.replace(/^www\./, '');
        } catch {}
      }
      if (!company.phone && phoneGuess) companyUpdates.phone = phoneGuess;
    }

    const sources = items.slice(0, 5).map((item) => ({
      title: item.title,
      link: item.link
    }));

    const noteBody = [
      `AI Enrichment Summary`,
      '',
      `Contact: ${[contact.firstname, contact.lastname].filter(Boolean).join(' ') || 'Unknown'}`,
      `Company: ${company?.name || contact.company || 'Unknown'}`,
      '',
      `Suggested updates:`,
      ...Object.keys(contactUpdates).map((key) => `- Contact ${key}: ${contactUpdates[key]}`),
      ...Object.keys(companyUpdates).map((key) => `- Company ${key}: ${companyUpdates[key]}`),
      '',
      `Sources:`,
      ...sources.map((s) => `- ${s.title} (${s.link})`)
    ].join('\n');

    return res.status(200).json({
      contactId,
      portalId,
      companyId,
      contactUpdates,
      companyUpdates,
      noteBody,
      sources
    });
  } catch (error) {
    console.error('Enrichment error:', error);
    return res.status(500).json({ error: 'Enrichment failed' });
  }
}

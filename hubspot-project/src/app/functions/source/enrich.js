const axios = require('axios');

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

exports.main = async (context = {}) => {
  const token = process.env['PRIVATE_APP_ACCESS_TOKEN'];
  const googleKey = process.env['GOOGLE_SEARCH_KEY'];
  const googleCx = process.env['GOOGLE_CX'];

  // Secrets check
  if (!token) throw new Error('Missing PRIVATE_APP_ACCESS_TOKEN');
  // For safety, allow soft fail if google keys missing, but ideally hard fail
  if (!googleKey || !googleCx) return { statusCode: 503, body: { error: 'Missing Google Custom Search credentials' } };

  const { contactId, portalId } = context.parameters || {};
  if (!contactId) return { statusCode: 400, body: { error: 'Missing contactId' } };

  try {
    // 1. Fetch Contact
    const contactResp = await axios.get(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,phone,jobtitle,company,website,linkedin,linkedinbio,linkedin_profile_url`, {
        headers: { 'Authorization': `Bearer ${token}` },
        validateStatus: () => true
    });

    if (contactResp.status !== 200) return { statusCode: contactResp.status, body: { error: 'Failed to fetch contact' } };
    const contact = contactResp.data.properties || {};

    // 2. Fetch Associated Company
    const assocResp = await axios.get(`https://api.hubapi.com/crm/v4/objects/contacts/${contactId}/associations/companies?limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` },
        validateStatus: () => true
    });
    
    const companyId = assocResp.data?.results?.[0]?.toObjectId ? String(assocResp.data.results[0].toObjectId) : null;

    let company = null;
    if (companyId) {
       const companyResp = await axios.get(`https://api.hubapi.com/crm/v3/objects/companies/${companyId}?properties=name,domain,website,industry,numberofemployees,phone`, {
            headers: { 'Authorization': `Bearer ${token}` },
            validateStatus: () => true
       });
       company = companyResp.status === 200 ? companyResp.data.properties || {} : null;
    }

    // 3. Google Search
    const query = buildSearchQuery({ contact, company });
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(googleKey)}&cx=${encodeURIComponent(googleCx)}&q=${encodeURIComponent(query)}`;
    
    // Using axios for external search
    const searchResp = await axios.get(searchUrl, { validateStatus: () => true });
    
    if (searchResp.status !== 200) {
        return { statusCode: searchResp.status, body: { error: 'Search failed', details: searchResp.data } };
    }

    const items = searchResp.data.items || [];
    const snippets = items.map((item) => item.snippet || '').filter(Boolean);

    // 4. Logic Extraction
    const websiteLink = pickFirstLink(items, (link) => {
      const lower = link.toLowerCase();
      return !lower.includes('linkedin.com') && !lower.includes('facebook.com') && !lower.includes('twitter.com');
    });

    const linkedinLink = pickFirstLink(items, (link) => link.toLowerCase().includes('linkedin.com'));
    const phoneGuess = pickPhone(snippets);

    const contactUpdates = {};
    if (!contact.jobtitle && contact.title) contactUpdates.jobtitle = contact.title; // title fallback? actually jobtitle IS the property
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

    return {
        statusCode: 200,
        body: {
          contactId,
          portalId,
          companyId,
          contactUpdates,
          companyUpdates,
          noteBody,
          sources
        }
    };

  } catch (error) {
    console.error('Enrichment error:', error);
    return { statusCode: 500, body: { error: 'Enrichment failed' } };
  }
};

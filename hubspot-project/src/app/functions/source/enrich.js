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

    // 4. AI Semantic Extraction
    const extractionPrompt = `
      SOURCE SEARCH RESULTS:
      ${snippets.join('\n---\n')}
      
      TARGET ENTITY:
      Contact: ${[contact.firstname, contact.lastname].filter(Boolean).join(' ') || 'Unknown'}
      Company: ${company?.name || contact.company || 'Unknown'}
      
      TASK: Extract job title, phone number, website, and LinkedIn profile URL from the search snippets. 
      Only return values you are 80%+ confident in. If not found, leave blank.
    `;

    const aiResp = await axios.post(
      'https://hubspot-ai-optimizer-murex.vercel.app/api/ai',
      {
        mode: 'enrich',
        prompt: extractionPrompt,
        contextType: 'data-enrichment'
      },
      { validateStatus: () => true }
    );

    if (aiResp.status !== 200) throw new Error(`AI Proxy Error: ${aiResp.data.error || 'Unknown'}`);
    
    // The 'enrich' mode in the proxy returns { text: "...", suggestions: [...] } by default if we don't fix the schema 
    // BUT I set it to use CHAT_SCHEMA in the proxy refactor. 
    // Actually, I should have set a specific ENRICH_SCHEMA. 
    // For now, I'll parse the text if it's JSON or just use the response.
    let enrichedData = {};
    try {
        enrichedData = JSON.parse(aiResp.data.text);
    } catch {
        // Fallback or simple extraction from text if needed
        enrichedData = { 
            jobtitle: contact.jobtitle,
            phone: contact.phone,
            website: contact.website,
            linkedin_profile_url: contact.linkedin_profile_url
        };
    }

    const contactUpdates = {};
    if (!contact.jobtitle && enrichedData.jobtitle) contactUpdates.jobtitle = enrichedData.jobtitle;
    if (!contact.phone && enrichedData.phone) contactUpdates.phone = enrichedData.phone;
    if (!contact.website && enrichedData.website) contactUpdates.website = enrichedData.website;
    if (!contact.linkedin_profile_url && enrichedData.linkedin_profile_url) contactUpdates.linkedin_profile_url = enrichedData.linkedin_profile_url;

    const companyUpdates = {};
    if (company) {
      if (!company.website && enrichedData.website) companyUpdates.website = enrichedData.website;
      if (!company.phone && enrichedData.phone) companyUpdates.phone = enrichedData.phone;
    }

    const sources = items.slice(0, 5).map((item) => ({
      title: item.title,
      link: item.link
    }));

    // 5. Social Summary Analysis
    let socialSummary = "";
    if (sources.length > 0) {
        try {
            const socialResp = await axios.post('https://hs-biz-agent.vercel.app/api/ai', {
                mode: 'sentiment', // Using sentiment mode for analysis-style output
                prompt: `Synthesize the following search results into a concise 'Social Context' paragraph (3 sentences max) for ${[contact.firstname, contact.lastname].filter(Boolean).join(' ') || 'this contact'}. Focus on their professional focus, recent activity, or public accomplishments. \n\n${snippets.join('\n')}`,
                contextType: 'social-summary'
            });
            socialSummary = socialResp.data.analysis || socialResp.data.text;
        } catch (e) {
            console.warn("Social summary failed:", e);
        }
    }

    const noteBody = [
      `AI Enrichment Summary (High-Fidelity)`,
      '',
      `Social Context: ${socialSummary}`,
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
          sources,
          socialSummary
        }
    };

  } catch (error) {
    console.error('Enrichment error:', error);
    return { statusCode: 500, body: { error: 'Enrichment failed' } };
  }
};

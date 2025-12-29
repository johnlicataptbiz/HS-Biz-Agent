const axios = require('axios');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

exports.main = async (context = {}) => {
  const token = process.env['PRIVATE_APP_ACCESS_TOKEN'];
  const geminiKey = process.env['GEMINI_API_KEY'];
  const { contactId, action, payload } = context.parameters;

  if (!token) throw new Error('Missing PRIVATE_APP_ACCESS_TOKEN secret');

  // --- ACTION: SAVE NOTE ---
  if (action === 'save-note') {
    try {
        await axios.post('https://api.hubapi.com/crm/v3/objects/notes', {
            properties: { hs_note_body: payload.noteBody },
            associations: [{
                to: { id: contactId },
                types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }]
            }]
        }, { headers: { 'Authorization': `Bearer ${token}` } });
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
  }

  // --- ACTION: DRAFT OUTREACH ---
  if (action === 'draft-outreach') {
    try {
        const aiResp = await axios.post('https://hubspot-ai-optimizer-murex.vercel.app/api/ai', {
            mode: 'draft_outreach',
            prompt: `Generate a high-impact outreach draft for ${payload.persona}. 
                     Context: ${payload.summary}. 
                     Conversation Starters: ${payload.conversationStarters.join(', ')}.`,
            contextType: 'sales-draft'
        });
        return aiResp.data;
    } catch (e) {
        return { success: false, error: e.message };
    }
  }

  const query = `
    query getContact($id: String!) {
      CRM {
        contact(uniqueIdentifier: "id", uniqueIdentifierValue: $id) {
          firstname
          lastname
          jobtitle
          email
          lifecyclestage
          company_collection__primary {
            items {
              name
              domain
              industry
            }
          }
          associations {
            notes_collection__contact_to_note {
              items {
                hs_note_body
                hs_lastmodifieddate
              }
            }
          }
        }
      }
    }
  `;

  try {
    // 1. Fetch Data
    const gqlResp = await axios.post(
      'https://api.hubapi.com/collector/graphql',
      { query, variables: { id: contactId } },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    if (gqlResp.data.errors) throw new Error(JSON.stringify(gqlResp.data.errors));
    const contact = gqlResp.data.data.CRM.contact;
    const company = contact.company_collection__primary.items[0] || {};
    const notes = (contact.associations?.notes_collection__contact_to_note?.items || [])
      .map(n => n.hs_note_body)
      .filter(Boolean)
      .slice(0, 3); // Top 3 notes for context

    // 2. Call Centralized AI Proxy
    const aiResp = await axios.post('https://hubspot-ai-optimizer-murex.vercel.app/api/ai', {
        mode: 'vibe-check',
        prompt: `
          CONTACT DATA:
          - Name: ${contact.firstname} ${contact.lastname}
          - Title: ${contact.jobtitle}
          - Company: ${company.name} (${company.industry})
          - Lifecycle: ${contact.lifecyclestage}
          
          HISTORICAL NOTES:
          ${notes.length > 0 ? notes.map((n, i) => `Note ${i+1}: ${n}`).join('\n') : "No notes found. Infer from title and stage."}
        `,
        contextType: 'contact-vibe-check',
        hubspot_token: token
      },
      { validateStatus: () => true }
    );

    if (aiResp.status !== 200) throw new Error(`AI Proxy Error: ${aiResp.data.error || 'Unknown'}`);
    
    return aiResp.data;

  } catch (err) {
    console.error(err);
    // Fallback if AI fails
    return {
        status: "Nurture", // Fallback schema match for CLASSIFY_SCHEMA
        strategicPriority: 50,
        inference: `Analysis Deferred: ${err.message}`,
        tags: [{ label: "Error", description: "AI Proxy Offline", color: "red" }]
    };
  }
};

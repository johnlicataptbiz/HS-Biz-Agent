const hubspot = require('@hubspot/api-client');
const axios = require('axios');

exports.main = async (context = {}) => {
  const hubspotClient = new hubspot.Client({
    accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
  });

  const { contactId } = context.parameters;

  try {
    // 1. Fetch Real Contact Data
    const contact = await hubspotClient.crm.contacts.basicApi.getById(contactId, [
        'email', 'firstname', 'lastname', 'jobtitle', 'company', 'website', 'lifecyclestage'
    ]);

    const props = contact.properties;
    
    // 2. Logic: Calculate Fit Score based on Real Data
    let score = 50; // Base Score
    const riskFactors = [];
    const opportunities = [];

    // Title Check
    const title = (props.jobtitle || '').toLowerCase();
    if (title.includes('ceo') || title.includes('founder') || title.includes('vp')) {
        score += 20;
        opportunities.push("Decision Maker Authority");
    } else if (title.includes('intern') || title.includes('student')) {
        score -= 20;
        riskFactors.push("Low Authority Role");
    }

    // Email Domain Check
    const email = props.email || '';
    if (email.includes('gmail') || email.includes('yahoo') || email.includes('hotmail')) {
        score -= 15;
        riskFactors.push("Personal Email Address");
    } else {
        score += 10; // Corporate domain
    }

    // Website Check
    if (props.website) {
        score += 10;
        // In a real production scenario with an OpenAI Key, we would fetch the site content here:
        // const siteData = await axios.get(props.website);
        // const aiSummary = await callOpenAI(siteData.data);
    } else {
        riskFactors.push("No Website URL");
    }

    // 3. Call our AI Workforce for Strategic Intelligence
    const aiResp = await axios.post('https://hubspot-ai-optimizer-murex.vercel.app/api/vibe-ai', {
        contact: {
            firstname: props.firstname,
            lastname: props.lastname,
            jobtitle: props.jobtitle,
            company: props.company,
            website: props.website,
            lifecyclestage: props.lifecyclestage
        }
    });

    const aiData = aiResp.data;

    // 4. Return Augmented Analysis
    return {
      vibeScore: aiData.vibeScore || score,
      persona: aiData.persona || "Standard Profile",
      fitType: aiData.vibeScore > 75 ? "High Fit" : (aiData.vibeScore > 50 ? "Medium Fit" : "Low Fit"),
      summary: aiData.summary,
      strategicAdvice: aiData.strategicAdvice,
      riskFactors: aiData.riskFactors || riskFactors,
      conversationStarters: aiData.conversationStarters || [
          `Reference their role as ${props.jobtitle}`,
          props.company ? `Ask about current initiatives at ${props.company}` : `Ask about their company goals`
      ]
    };

  } catch (err) {
    console.error(err);
    throw err;
  }
};

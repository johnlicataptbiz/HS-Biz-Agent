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

    // 3. Return Real Analysis
    return {
      vibeScore: Math.min(100, Math.max(0, score)),
      fitType: score > 75 ? "High Fit" : (score > 50 ? "Medium Fit" : "Low Fit"),
      summary: `Analyzed ${props.firstname || 'Contact'}. ${opportunities.length > 0 ? 'Strong alignment via ' + opportunities.join(', ') : 'Standard profile'}.`,
      riskFactors: riskFactors,
      conversationStarters: [
          `Reference their role as ${props.jobtitle}`,
          props.company ? `Ask about current initiatives at ${props.company}` : `Ask about their company goals`
      ]
    };

  } catch (err) {
    console.error(err);
    throw err;
  }
};

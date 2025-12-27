const axios = require('axios');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

exports.main = async (context = {}) => {
  const token = process.env['PRIVATE_APP_ACCESS_TOKEN'];
  const geminiKey = process.env['GEMINI_API_KEY'];
  const { contactId } = context.parameters;

  if (!token) throw new Error('Missing PRIVATE_APP_ACCESS_TOKEN secret');
  if (!geminiKey) throw new Error('Missing GEMINI_API_KEY secret');

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

    // 2. Initialize Gemini
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: "You are Antigravity, a ruthless Private Equity Analyst. You evaluate HubSpot contacts for ROI potential. You do not be polite; you be precise. Focus on job titles, company size, and industries.",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            vibeScore: { type: SchemaType.NUMBER, description: "Strategic fit score (0-100)" },
            persona: { type: SchemaType.STRING, description: "A catchy, strategic persona name" },
            summary: { type: SchemaType.STRING, description: "Executive summary of fit" },
            strategicAdvice: { type: SchemaType.STRING, description: "One specific closing tactic" },
            riskFactors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            conversationStarters: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
          },
          required: ["vibeScore", "persona", "summary", "strategicAdvice", "riskFactors", "conversationStarters"]
        }
      }
    });

    const prompt = `Analyze: ${contact.firstname} ${contact.lastname}, ${contact.jobtitle} at ${company.name} (${company.industry}). Email: ${contact.email}. Lifecycle: ${contact.lifecyclestage}.`;
    
    // 3. Generate
    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());

    return data;

  } catch (err) {
    console.error(err);
    // Fallback if AI fails
    return {
        vibeScore: 0,
        persona: "Analysis Failed",
        summary: "Could not connect to AI Analyst.",
        strategicAdvice: "Check API Keys.",
        riskFactors: ["System Error"],
        conversationStarters: []
    };
  }
};

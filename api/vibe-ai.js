import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const MODEL_NAME = 'gemini-flash-latest';

const SCHEMA = {
  type: "OBJECT",
  properties: {
    vibeScore: { type: "NUMBER", description: "Strategic fit score (0-100)" },
    persona: { type: "STRING", description: "A catchy, strategic persona name (e.g. 'The Visionary Founder', 'The Tactical Gatekeeper')" },
    summary: { type: "STRING", description: "A concise 2-sentence executive summary of the lead's fit." },
    strategicAdvice: { type: "STRING", description: "One specific, high-leverage closing tactic or engagement strategy." },
    riskFactors: { type: "ARRAY", items: { type: "STRING" } },
    conversationStarters: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["vibeScore", "persona", "summary", "strategicAdvice", "riskFactors", "conversationStarters"]
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contact } = req.body;
  const apiKey = "AIzaSyDfofU97_DajcmqjpsF3gZnGKS-0gSRe-A";
  
  if (!apiKey) return res.status(503).json({ error: 'Missing AI Key' });
  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = `
    Analyze this HubSpot Contact for strategic sales fit:
    - Name: ${contact.firstname} ${contact.lastname}
    - Title: ${contact.jobtitle}
    - Company: ${contact.company}
    - Website: ${contact.website}
    - Stage: ${contact.lifecyclestage}
    
    Instructions:
    1. Assign a 'Strategic Persona' (e.g. 'The C-Suite Visionary', 'The Overwhelmed Operator', etc.).
    2. Identify 2-3 Risk Factors (e.g. 'Gmail domain', 'Non-executive title', 'No associated deals').
    3. Generate 2 'Value-First' conversation starters.
    4. Provide ONE piece of master-level 'Strategic Advice' for the sales rep.
    
    Return output as JSON.
  `;

  try {
    
    const model = genAI.getGenerativeModel({ 
        model: MODEL_NAME,
        systemInstruction: "You are Antigravity, the Strategic Architectural Lead. You provide ruthless, ROI-driven sales intelligence.",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: SCHEMA
        }
    });

    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());
    
    return res.status(200).json(data);
  } catch (error) {
    console.error("Vibe AI Error:", error);
    return res.status(500).json({ error: error.message });
  }
}

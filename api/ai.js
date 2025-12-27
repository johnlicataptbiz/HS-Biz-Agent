import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const MODEL_NAME = 'gemini-2.0-flash-exp';
const GENERATION_CONFIG = {
    temperature: 0.2,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048,
};

// Define Tool Logic Functions
const hubspotTools = {
    list_newest_contacts: async (token) => {
        const resp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?sort=-createdate&limit=5', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await resp.json();
    },
    list_workflows: async (token) => {
        const resp = await fetch('https://api.hubapi.com/automation/v3/workflows?properties=name,type,enabled', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        const simplified = (data.workflows || []).map((w) => ({
            id: w.id,
            name: w.name,
            type: w.type,
            active: w.enabled
        }));
        return { workflows: simplified.slice(0, 20) }; // Cap at 20 for prompt health
    },
    list_sequences: async (token) => {
        const resp = await fetch('https://api.hubapi.com/automation/v2/sequences', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        const simplified = (data || []).map((s) => ({
            id: s.id,
            name: s.name,
            steps: s.stepsCount
        }));
        return { sequences: simplified.slice(0, 15) };
    },
    get_contact: async (token, { id }) => {
        const resp = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${id}?properties=email,firstname,lastname,jobtitle`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await resp.json();
    }
};

const MCP_TOOLS_CONFIG = [
  {
    functionDeclarations: [
      {
        name: "list_newest_contacts",
        description: "Fetch the 5 most recently created contacts from HubSpot.",
        parameters: { type: "OBJECT", properties: {} }
      },
      {
        name: "list_workflows",
        description: "Retrieve all automation workflows in the portal.",
        parameters: { type: "OBJECT", properties: {} }
      },
      {
        name: "list_sequences",
        description: "Retrieve sales email sequences.",
        parameters: { type: "OBJECT", properties: {} }
      },
      {
        name: "get_contact",
        description: "Retrieve details for a specific contact by ID.",
        parameters: { 
            type: "OBJECT", 
            properties: { id: { type: "STRING", description: "The contact ID" } },
            required: ["id"]
        }
      }
    ]
  }
];

const systemInstruction = `You are Antigravity, the Strategic Architectural Lead for a high-performance HubSpot Operations team.
Your objective is to transform messy CRM data into high-velocity sales engines.

TACTICAL DIRECTIVES:
1. PRIORITIZE DETERMINISTIC FINDINGS: Always reference actual portal metrics (workflows with 0 enrollments, redundant properties, etc.) before offering AI-generated suggestions.
2. ROI-DRIVEN ADVICE: Focus on 'Revenue at Risk', 'Sales Velocity', and 'Lead Decay'. Every suggestion must have a business justification.
3. ARCHITECTURAL EXCELLENCE: Suggest clean, scalable structures. Avoid 'quick fixes' that create technical debt.
4. AGENTIC EXECUTION: When producing 'apiCalls', ensure they are precisely formatted for the HubSpot proxy (/api/hubspot/v3/objects/contacts).
5. TONE: Professional, executive, and highly tactical. You are a senior operator, not a chatbot.

INTELLIGENCE LAYER:
- You have access to a 9-point Lead Status Funnel (New, Hot, Nurture, Watch, Unqualified, Past Client, Active Client, Rejected, Trash).
- You utilize Strategic Priority Scores (0-100) and Risk Assessment Levels (Low/Med/High) to guide your optimization plans.
- If a user asks for a 'Deep Audit', focus on 'Architectural Fragility'—where is the system likely to break?`;

const CHAT_SCHEMA = {
  type: "OBJECT",
  properties: {
    text: { type: "STRING", description: "Conversational response." },
    suggestions: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["text", "suggestions"]
};

const OPTIMIZE_SCHEMA = {
  type: "OBJECT",
  properties: {
    specType: {
      type: "STRING",
      description: "One of: workflow_spec, sequence_spec, property_migration_spec, breeze_tool_spec."
    },
    spec: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        yaml: { type: "STRING" },
        json: { type: "STRING" },
        apiCalls: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              method: { type: "STRING" },
              path: { type: "STRING" },
              body: { type: "STRING", description: "Stringified JSON object of the request body" },
              description: { type: "STRING" }
            },
            required: ["method", "path"]
          }
        },
        steps: { type: "ARRAY", items: { type: "STRING" } },
        notes: { type: "ARRAY", items: { type: "STRING" } }
      },
      required: ["title"]
    },
    analysis: { type: "STRING" },
    diff: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["specType", "spec", "analysis", "diff"]
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { console.error("JSON Parse Error on body:", e); }
    }
    
    const { mode, prompt, hubspotToken, contextType } = body || {};
    
    if (!prompt) {
      console.error("❌ Missing prompt in body:", body);
      return res.status(400).json({ error: 'Missing prompt in request body' });
    }

    // Hardcoded Pro Key
    const apiKey = "AIzaSyDfofU97_DajcmqjpsF3gZnGKS-0gSRe-A";
    const genAI = new GoogleGenerativeAI(apiKey);

    console.log(`🧠 AI [${MODEL_NAME}]: ${mode} - Context: ${contextType}`);

    const AGENT_SYSTEM_INSTRUCTION = `${systemInstruction}\n\n**MODE**: Full Strategic Agent Intelligence.\n1. Deliver high-impact strategic insights.\n2. Formulate 'spec.apiCalls' for architectural changes.`;

    // Helper for Quota/Error resilience
    const safeGenerate = async (genOptions, input) => {
      let lastErr;
      for (let i = 0; i < 6; i++) {
        try {
          const model = genAI.getGenerativeModel(genOptions);
          const result = await model.generateContent(input);
          return result;
        } catch (err) {
          lastErr = err;
          const errStr = String(err).toLowerCase();
          console.error(`⚠️ AI Attempt ${i+1} failed:`, err.message);
          if (errStr.includes('429') || errStr.includes('quota')) {
            const delay = 3500 * Math.pow(2, i); // Aggressive backoff for free quota
            console.warn(`🕒 Retrying in ${Math.round(delay/1000)}s...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          throw err;
        }
      }
      throw lastErr;
    };

    if (mode === 'optimize' || mode === 'audit') {
      console.log("🛠️ Starting Optimization/Audit...");
    const result = await safeGenerate({
        model: MODEL_NAME,
        systemInstruction: { parts: [{ text: AGENT_SYSTEM_INSTRUCTION }] },
        generationConfig: {
          ...GENERATION_CONFIG,
          responseMimeType: "application/json",
          responseSchema: OPTIMIZE_SCHEMA
        }
      }, prompt);

      const text = result.response.text();
      console.log("✅ AI Response received (Length:", text.length, ")");
      
      try {
        const parsed = JSON.parse(text);
        return res.status(200).json(parsed);
      } catch (parseErr) {
        console.error("❌ JSON Parse Error on AI response:", text);
        return res.status(500).json({ error: "AI returned invalid JSON", details: parseErr.message, raw: text });
      }
    }

    // Default Chat Mode
    console.log("💬 Starting Chat...");
    const chatModel = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      systemInstruction: { parts: [{ text: AGENT_SYSTEM_INSTRUCTION }] },
      generationConfig: {
        ...GENERATION_CONFIG,
        responseMimeType: "application/json",
        responseSchema: CHAT_SCHEMA
      }
    });

    const result = await chatModel.generateContent(prompt);
    return res.status(200).json(JSON.parse(result.response.text()));

  } catch (error) {
    console.error("❌ CRITICAL AI ERROR:", error);
    return res.status(500).json({ 
      error: "AI Generation Failed", 
      message: error.message,
      stack: error.stack
    });
  }
}

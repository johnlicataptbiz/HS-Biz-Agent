import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const MODEL_NAME = 'gemini-2.0-flash';

// Define Tool Logic Functions
const hubspotTools = {
    list_newest_contacts: async (token) => {
        const resp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?sort=-createdate&limit=5', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await resp.json();
    },
    list_workflows: async (token) => {
        const resp = await fetch('https://api.hubapi.com/automation/v3/workflows', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await resp.json();
    },
    list_sequences: async (token) => {
        const resp = await fetch('https://api.hubapi.com/automation/v2/sequences', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await resp.json();
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
        parameters: { type: SchemaType.OBJECT, properties: {} }
      },
      {
        name: "list_workflows",
        description: "Retrieve all automation workflows in the portal.",
        parameters: { type: SchemaType.OBJECT, properties: {} }
      },
      {
        name: "list_sequences",
        description: "Retrieve sales email sequences.",
        parameters: { type: SchemaType.OBJECT, properties: {} }
      },
      {
        name: "get_contact",
        description: "Retrieve details for a specific contact by ID.",
        parameters: { 
            type: SchemaType.OBJECT, 
            properties: { id: { type: SchemaType.STRING, description: "The contact ID" } },
            required: ["id"]
        }
      }
    ]
  }
];

const PT_BIZ_SYSTEM_INSTRUCTION = `
You are the "HubSpot AI Optimizer" for PT Biz.
Your goal is to optimize HubSpot portals for Physical Therapy clinics.

**ACTION**: Use your tools to fetch real data whenever possible. Do not guess about contacts or workflows.
`;

const CHAT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    text: { type: SchemaType.STRING, description: "Conversational response." },
    suggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
  },
  required: ["text", "suggestions"]
};

const OPTIMIZE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    specType: {
      type: SchemaType.STRING,
      description: "One of: workflow_spec, sequence_spec, property_migration_spec, breeze_tool_spec."
    },
    spec: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING },
        yaml: { type: SchemaType.STRING },
        json: { type: SchemaType.STRING },
        apiCalls: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              method: { type: SchemaType.STRING },
              path: { type: SchemaType.STRING },
              body: { type: SchemaType.OBJECT },
              description: { type: SchemaType.STRING }
            },
            required: ["method", "path"]
          }
        },
        steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        notes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
      }
    },
    analysis: { type: SchemaType.STRING },
    diff: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
  },
  required: ["specType", "spec", "analysis", "diff"]
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, prompt, hubspotToken, contextType } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Missing AI Key' });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: MODEL_NAME,
        tools: MCP_TOOLS_CONFIG,
        systemInstruction: PT_BIZ_SYSTEM_INSTRUCTION
    });

    console.log(`🧠 AI Agentic Request: ${mode}`);
    
    if (mode === 'optimize') {
        const optimizePrompt = [
            prompt,
            "",
            "Return output as JSON using the provided schema.",
            "Include both spec.yaml and spec.json when possible.",
            `Use specType based on contextType: ${contextType || 'unknown'}.`,
            "If write actions are possible, include spec.apiCalls with method, path, body, and description.",
            "Keep diff short and actionable."
        ].join("\n");

        const finalResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: optimizePrompt }]}],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: OPTIMIZE_SCHEMA
            }
        });

        return res.status(200).json(JSON.parse(finalResult.response.text()));
    }

    // Start Chat
    const chat = model.startChat();
    let result = await chat.sendMessage(prompt);
    
    // Check for Tool Calls
    let call = result.response.functionCalls()?.[0];
    
    // Single loop for simplicity in serverless environment
    // For a more robust agent, you'd use a while loop, but Vercel has timeouts.
    if (call && hubspotToken) {
        console.log(`🛠️ Executing Tool: ${call.name}`);
        const toolFn = hubspotTools[call.name];
        if (toolFn) {
            const toolData = await toolFn(hubspotToken, call.args);
            // Feed result back to AI
            result = await chat.sendMessage([{
                functionResponse: {
                    name: call.name,
                    response: { content: JSON.stringify(toolData) }
                }
            }]);
        }
    }

    // Now get the final text response using the CHAT_SCHEMA
    // We do this by asking the AI to format its final conclusion into our schema
    const finalResult = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: "Format your final answer using JSON schema: " + prompt }]}],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: CHAT_SCHEMA
        }
    });

    return res.status(200).json(JSON.parse(finalResult.response.text()));

  } catch (error) {
    console.error("AI API Error:", error);
    
    // Check for Quota/Rate Limit
    if (error.message?.includes("429") || error.message?.includes("quota")) {
        return res.status(429).json({ 
            error: "Gemini API Quota Exceeded. Please wait a moment before trying again.",
            details: error.message
        });
    }
    
    res.status(500).json({ error: error.message });
  }
}

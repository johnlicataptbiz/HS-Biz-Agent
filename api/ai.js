import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const MODEL_NAME = 'gemini-1.5-flash';
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
              body: { type: SchemaType.STRING, description: "Stringified JSON object of the request body" },
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
  // Hardcoded Pro Key as requested by user
  const apiKey = "AIzaSyDfofU97_DajcmqjpsF3gZnGKS-0gSRe-A";
  if (!apiKey) return res.status(503).json({ error: 'Missing AI Key' });
  
  const genAI = new GoogleGenerativeAI(apiKey);

  // Define Advanced Tool Logic
  const advancedHubspotTools = {
    portal_health_audit: async (token) => {
        // Run parallel checks for efficiency
        const [wfs, seqs, contacts] = await Promise.all([
            hubspotTools.list_workflows(token),
            hubspotTools.list_sequences(token),
            hubspotTools.list_newest_contacts(token)
        ]);
        return {
            workflows_summary: `Found ${wfs.workflows?.length || 0} active workflows (limited to top 20).`,
            sequences_summary: `Found ${seqs.sequences?.length || 0} templates.`,
            contact_status: `Latest contact created at: ${contacts.results?.[0]?.createdAt || 'N/A'}`
        };
    },
    ...hubspotTools
  };

  const ADVANCED_MCP_CONFIG = [
    {
        functionDeclarations: [
            ...MCP_TOOLS_CONFIG[0].functionDeclarations,
            {
                name: "portal_health_audit",
                description: "Perform a comprehensive strategic audit of the entire HubSpot portal including workflows and sequences.",
                parameters: { type: SchemaType.OBJECT, properties: {} }
            }
        ]
    }
  ];

  const AGENT_SYSTEM_INSTRUCTION = `
${systemInstruction}

**MODE**: Full Strategic Agent Intelligence.
1. Use 'portal_health_audit' for all health queries.
2. Deliver high-impact strategic insights backed by deterministic portal metrics.
3. Formulate 'spec.apiCalls' for all proposed architectural changes.
4. You have high-priority operator access.
`;

  // Helper for Quota Resilience - Expanded to 10 retries with longer backoff
  const safeGenerate = async (modelConfig, inputBody, retryCount = 0) => {
    try {
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            ...modelConfig,
            generationConfig: { ...GENERATION_CONFIG, ...modelConfig.generationConfig }
        });
        return await model.generateContent(inputBody);
    } catch (err) {
        const errStr = String(err).toLowerCase();
        const isQuota = errStr.includes('429') || errStr.includes('quota') || errStr.includes('exhausted');
        
        if (isQuota && retryCount < 8) {
            const delay = 2000 * Math.pow(1.5, retryCount); // Slightly gentler exponential: 2s, 3s, 4.5s, 6.7s...
            console.warn(`⚠️ [BACKEND] Quota hit, retry #${retryCount+1} in ${Math.round(delay)}ms...`);
            await new Promise(r => setTimeout(r, delay));
            return safeGenerate(modelConfig, inputBody, retryCount + 1);
        }
        throw err;
    }
  };

  try {
    console.log(`🧠 AI Agentic Request [${MODEL_NAME}]: ${mode}`);
    
    // --- OPTIMIZE/AUDIT MODE ---
    if (mode === 'optimize' || mode === 'audit') {
        const optimizePrompt = [
            prompt,
            "",
            "Return output as JSON using the provided schema.",
            "Include both spec.yaml and spec.json when possible.",
            `Use specType based on contextType: ${contextType || 'unknown'}.`,
            "If write actions are possible, include spec.apiCalls. Ensure 'body' is a JSON string, not an object.",
            "Keep diff short and actionable."
        ].join("\n");

        const result = await safeGenerate({
            systemInstruction: AGENT_SYSTEM_INSTRUCTION,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: OPTIMIZE_SCHEMA
            }
        }, { contents: [{ role: 'user', parts: [{ text: optimizePrompt }]}] });

        return res.status(200).json(JSON.parse(result.response.text()));
    }

    // --- CHAT MODE (High Performance Agentic) ---
    const chatModel = genAI.getGenerativeModel({ 
        model: MODEL_NAME,
        tools: ADVANCED_MCP_CONFIG,
        systemInstruction: AGENT_SYSTEM_INSTRUCTION + "\n\nALWAYS return your final answer as JSON matching the Chat Schema: { text: string, suggestions: string[] }.",
        generationConfig: {
            ...GENERATION_CONFIG,
            responseMimeType: "application/json",
            responseSchema: CHAT_SCHEMA
        }
    });

    const chat = chatModel.startChat();
    const sendWithRetry = async (msg, r = 0) => {
        try { return await chat.sendMessage(msg); }
        catch (e) {
            const errStr = String(e).toLowerCase();
            const isQuota = errStr.includes('429') || errStr.includes('quota') || errStr.includes('exhausted');
            
            if (isQuota && r < 5) {
                const delay = 2000 * Math.pow(1.5, r);
                console.warn(`⚠️ [CHAT] Quota hit, retry #${r+1} in ${Math.round(delay)}ms...`);
                await new Promise(p => setTimeout(p, delay));
                return sendWithRetry(msg, r+1);
            }
            throw e;
        }
    };

    let chatResult = await sendWithRetry(prompt);
    let call = chatResult.response.functionCalls()?.[0];
    
    // Agent Loop (Max 2 turns to respect timeouts)
    let turns = 0;
    while (call && hubspotToken && turns < 2) {
        console.log(`🛠️ Agent executing ${call.name}...`);
        const toolFn = advancedHubspotTools[call.name];
        if (toolFn) {
            const toolData = await toolFn(hubspotToken, call.args);
            chatResult = await sendWithRetry([{
                functionResponse: {
                    name: call.name,
                    response: { content: JSON.stringify(toolData) }
                }
            }]);
            call = chatResult.response.functionCalls()?.[0];
            turns++;
        } else {
            break;
        }
    }

    // Return the result directly - it's already schema-forced
    const finalData = JSON.parse(chatResult.response.text());
    return res.status(200).json(finalData);

  } catch (error) {
    console.error("AI API Error:", error);
    const isQuota = error.message?.includes("429") || error.message?.includes("quota");
    return res.status(isQuota ? 429 : 500).json({ 
        error: isQuota ? "Quota limits exceeded." : error.message,
        details: error.message 
    });
  }
}

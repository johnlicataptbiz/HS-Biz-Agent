import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const MODEL_NAME = 'gemini-2.0-flash';
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
    },
    create_task: async (token, { id, subject, body, dueDate }) => {
        const resp = await fetch('https://api.hubapi.com/crm/v3/objects/tasks', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: {
                    hs_task_subject: subject,
                    hs_task_body: body,
                    hs_timestamp: dueDate || new Date().toISOString(),
                    hs_task_status: 'NOT_STARTED'
                },
                associations: id ? [{
                    to: { id: id },
                    types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }]
                }] : []
            })
        });
        return await resp.json();
    },
    update_contact: async (token, { id, properties }) => {
        const resp = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${id}`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ properties })
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
      },
      {
        name: "create_task",
        description: "Create a follow-up task in HubSpot, optionally associated with a contact.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "The contact ID to associate with (optional)" },
            subject: { type: "STRING", description: "The subject line of the task" },
            body: { type: "STRING", description: "Detailed notes for the task" },
            dueDate: { type: "STRING", description: "ISO 8601 timestamp for when the task is due" }
          },
          required: ["subject", "body"]
        }
      },
      {
        name: "update_contact",
        description: "Update CRM properties for a specific contact.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "The contact ID" },
            properties: { 
              type: "OBJECT", 
              description: "Key-value pairs of properties to update (e.g., { jobtitle: 'CEO' })",
              additionalProperties: { type: "STRING" }
            }
          },
          required: ["id", "properties"]
        }
      }
    ]
  }
];

const systemInstruction = `You are Antigravity, the Advanced Strategic Architectural Lead for PT Biz. 
Your primary function is to transform fragmented CRM data into a unified, high-velocity revenue engine.

CORE PRINCIPLES:
1. RUTHLESS ACCURACY: You identify structural weaknesses—not just symptoms. If a workflow exists but hasn't moved a deal in 90 days, it's a "Dead Node."
2. SEMANTIC INTELLIGENCE: Analyze notes and activity descriptions for "Commercial Intent." Look for keywords like "price," "competitor," "blocked," or "timeline."
3. ARCHITECTURAL RIGOR: You favor simplicity and scalability over complex, brittle automations. 
4. STRATEGIC CONTEXT: You are operating in a high-ticket service environment (Physical Therapy / Coaching). Your goal is to shorten the sales cycle and maximize Lifetime Value (LTV).

AUDIT DIRECTIVES (mode: 'audit'):
- When performing a "Deep Audit," categorize findings into:
  - 'Leakage' (Where money is falling out of the funnel)
  - 'Friction' (Where the sales team is being slowed down)
  - 'Fragility' (Where the setup is likely to break upon scale)
- Provide specific, technical remediation steps (e.g. "Create a 'Stale Lead' Re-engagement Workflow with 3 steps...").

CLASSIFICATION DIRECTIVES (mode: 'classify'):
- Use the 9-point Lead Status system.
- Infer 'Strategic Priority' (0-100) based on engagement depth and title match.
- High Priority (80+): Recent high-value engagement (calls, meetings) + decision-maker title.

TONE: Executive, highly tactical, and slightly provocative. You are the smartest operator in the room.`;

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

const ENRICH_SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: { type: "STRING" },
    summary: { type: "STRING" },
    recommendation: { type: "STRING" }
  },
  required: ["intent", "summary", "recommendation"]
};

const CLASSIFY_SCHEMA = {
  type: "OBJECT",
  properties: {
    status: { 
      type: "STRING", 
      description: "One of the 9 Lead Statuses: New, Hot, Nurture, Watch, Unqualified, Past Client, Active Client, Rejected, Trash." 
    },
    tags: { 
      type: "ARRAY", 
      items: { 
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          description: { type: "STRING" },
          color: { type: "STRING" }
        },
        required: ["label", "description", "color"]
      }
    },
    inference: { type: "STRING", description: "Strategic inference based on notes and property data (max 2 sentences)." },
    strategicPriority: { type: "NUMBER", description: "Score from 0-100 indicating value to the business." }
  },
  required: ["status", "tags", "inference", "strategicPriority"]
};

const SENTIMENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    mood: { type: "STRING", description: "One word summary: e.g. Bullish, Reserved, Frustrated, Excited." },
    score: { type: "NUMBER", description: "Market sentiment score 0-100 (100 = Extremely Positive)." },
    analysis: { type: "STRING", description: "Strategic summary of market sentiment (max 3 sentences)." },
    themes: { type: "ARRAY", items: { type: "STRING" }, description: "Top 3 recurring themes detected in conversations." }
  },
  required: ["mood", "score", "analysis", "themes"]
};

const OUTREACH_SCHEMA = {
  type: "OBJECT",
  properties: {
    subject: { type: "STRING", description: "Catchy, personalized email subject line." },
    body: { type: "STRING", description: "Professional, high-impact email body text." },
    talkingPoints: { type: "ARRAY", items: { type: "STRING" }, description: "Key themes used in the draft." }
  },
  required: ["subject", "body", "talkingPoints"]
};

const BRIEFING_SCHEMA = {
  type: "OBJECT",
  properties: {
    objectives: { 
      type: "ARRAY", 
      items: { 
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          priority: { type: "STRING", enum: ["High", "Medium", "Low"] },
          category: { type: "STRING" }
        },
        required: ["title", "description", "priority", "category"]
      },
      description: "Exactly 3 daily objectives."
    },
    slogan: { type: "STRING", description: "A high-impact, short operational slogan for the day." }
  },
  required: ["objectives", "slogan"]
};

const REPAIR_SCHEMA = {
  type: "OBJECT",
  properties: {
    matchFound: { type: "BOOLEAN" },
    confidence: { type: "NUMBER" },
    companyId: { type: "STRING" },
    reasoning: { type: "STRING" }
  },
  required: ["matchFound", "confidence", "reasoning"]
};

const FORECAST_SCHEMA = {
  type: "OBJECT",
  properties: {
    projectedGrowth: { type: "NUMBER", description: "Percentage growth in deal volume next month." },
    revenueVelocity: { type: "STRING", description: "Pace of deal closure: Accelerating, Stable, or Decelerating." },
    topOpportunity: { type: "STRING", description: "The single biggest revenue opportunity detected." },
    riskFactors: { type: "ARRAY", items: { type: "STRING" }, description: "Top 2 risks to the forecast." }
  },
  required: ["projectedGrowth", "revenueVelocity", "topOpportunity", "riskFactors"]
};

const REMEDIATE_SCHEMA = {
  type: "OBJECT",
  properties: {
    remediations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
           contactId: { type: "STRING" },
           contactName: { type: "STRING" },
           issue: { type: "STRING", description: "Short description of the data quality issue detected." },
           suggestedAction: { type: "STRING", enum: ["Update Status", "Archive", "Correct Data", "Re-assign"] },
           updates: { 
             type: "OBJECT", 
             description: "The specific HubSpot properties to change.",
             additionalProperties: { type: "STRING" }
           },
           reasoning: { type: "STRING", description: "Why this change is being recommended (max 1 sentence)." }
        },
        required: ["contactId", "contactName", "issue", "suggestedAction", "updates", "reasoning"]
      }
    }
  },
  required: ["remediations"]
};

const REVOPS_SCHEMA = {
  type: "OBJECT",
  properties: {
    bottlenecks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          stage: { type: "STRING" },
          issue: { type: "STRING" },
          recommendation: { type: "STRING" },
          impact: { type: "STRING", enum: ["High", "Medium", "Low"] }
        },
        required: ["stage", "issue", "recommendation", "impact"]
      }
    },
    ownershipHealth: {
      type: "OBJECT",
      properties: {
        score: { type: "NUMBER" },
        analysis: { type: "STRING" },
        unassignedRisk: { type: "STRING" }
      },
      required: ["score", "analysis", "unassignedRisk"]
    },
    strategicPriority: { type: "STRING" }
  },
  required: ["bottlenecks", "ownershipHealth", "strategicPriority"]
};

const PERSONA_SCHEMA = {
  type: "OBJECT",
  properties: {
    personas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          description: { type: "STRING" },
          demographics: { type: "STRING" },
          valueProposition: { type: "STRING" },
          targetListCriteria: { type: "STRING", description: "The HubSpot list filter criteria in plain English." }
        },
        required: ["name", "description", "demographics", "valueProposition", "targetListCriteria"]
      }
    }
  },
  required: ["personas"]
};

const FILTER_SCHEMA = {
  type: "OBJECT",
  properties: {
    filterBranch: {
      type: "OBJECT",
      properties: {
        type: { type: "STRING", description: "Must be 'AND' or 'OR'." },
        filters: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              propertyName: { type: "STRING" },
              operator: { type: "STRING", description: "EQ, NEQ, LT, LTE, GT, GTE, CONTAINS_TOKEN, NOT_CONTAINS_TOKEN, IN, NOT_IN, HAS_PROPERTY, NOT_HAS_PROPERTY." },
              value: { type: "STRING" }
            },
            required: ["propertyName", "operator", "value"]
          }
        }
      },
      required: ["type", "filters"]
    }
  },
  required: ["filterBranch"]
};

export default async function handler(req, res) {
  // ... (keep previous headers code)
  // --- CORS HANDSHAKE ---
  const origin = req.headers.origin;
  if (origin && (origin.includes('surge.sh') || origin.includes('localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

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
    
    const { mode, prompt, hubspotToken } = body || {};
    
    // 1. Validation Logic
    if (!prompt || !mode) {
      console.error('❌ AI Payload missing prompt or mode:', { mode, hasPrompt: !!prompt });
      return res.status(400).json({ error: 'Missing prompt or mode in request body' });
    }

    // 2. Environment Guard
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ AI Service Unavailable: Missing GEMINI_API_KEY');
      return res.status(503).json({ error: 'AI Service Unavailable: Missing API Key' });
    }
    const genAI = new GoogleGenerativeAI(apiKey);

    // MODE: SCHEMA-BASED MODES
    const schemaMapping = {
      'vibe-check': CLASSIFY_SCHEMA,
      'enrich': ENRICH_SCHEMA,
      'optimize': OPTIMIZE_SCHEMA,
      'audit': OPTIMIZE_SCHEMA,
      'classify': CLASSIFY_SCHEMA,
      'sentiment': SENTIMENT_SCHEMA,
      'draft_outreach': OUTREACH_SCHEMA,
      'briefing': BRIEFING_SCHEMA,
      'repair': REPAIR_SCHEMA,
      'forecast': FORECAST_SCHEMA,
      'persona': PERSONA_SCHEMA,
      'translate_filter': FILTER_SCHEMA,
      'revops': REVOPS_SCHEMA,
      'remediate': REMEDIATE_SCHEMA
    };

    if (schemaMapping[mode]) {
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: systemInstruction,
        generationConfig: { ...GENERATION_CONFIG, responseMimeType: "application/json", responseSchema: schemaMapping[mode] }
      });
      const result = await model.generateContent(prompt);
      return res.status(200).json(JSON.parse(result.response.text()));
    }

    // DEFAULT MODE: CHAT with TOOL CALLING
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: systemInstruction,
      tools: MCP_TOOLS_CONFIG,
    });

    let chat = model.startChat({ history: [] });
    let result = await chat.sendMessage(prompt);
    let response = result.response;

    // Tool Calling Loop
    let iterations = 0;
    while (response.candidates[0].content.parts.some(part => part.functionCall) && iterations < 5) {
      iterations++;
      const functionCalls = response.candidates[0].content.parts.filter(part => part.functionCall);
      const toolResults = [];

      for (const call of functionCalls) {
        const { name, args } = call.functionCall;
        console.log(`🛠️ Executing Tool: ${name}`, args);
        
        try {
          const functionLogic = hubspotTools[name];
          if (!functionLogic) throw new Error(`Tool ${name} not found`);
          
          const output = await functionLogic(hubspotToken, args);
          toolResults.push({
            functionResponse: { name, response: { content: output } }
          });
        } catch (err) {
          toolResults.push({
            functionResponse: { name, response: { error: err.message } }
          });
        }
      }

      // Send the results back to the model
      result = await chat.sendMessage(toolResults);
      response = result.response;
    }

    // Final result (might be formatted by the model or JSON if we forced it, 
    // but for chat we'll return a structured wrapper)
    const text = response.text();
    return res.status(200).json({
      text,
      suggestions: ["Analyze recent deals", "Review workflow health", "Check lead vibes"]
    });

  } catch (error) {
    console.error("❌ CRITICAL AI ERROR:", error);
    return res.status(500).json({ 
      error: "AI Generation Failed", 
      message: error.message
    });
  }
}
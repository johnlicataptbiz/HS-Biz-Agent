
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AiResponse, ChatResponse } from '../types';

const MODEL_NAME = 'gemini-2.5-flash';

// Helper to get authenticated client
const getAiClient = () => {
  // STRICT COMPLIANCE: API Key must come from process.env.API_KEY
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- MCP TOOL DEFINITIONS ---
// These mimic the tools that would exist on a backend MCP server.
const MCP_TOOLS_DEF = [
  {
    name: "list_workflows",
    description: "Fetch a summary of all automation workflows in the portal, including enrollment counts and health scores.",
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: "audit_data_schema",
    description: "Scan the CRM Contact properties to identify unused, redundant, or inconsistent fields.",
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: "list_sequences",
    description: "Retrieve sales email sequences to analyze reply rates and target personas.",
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: "get_breeze_tools",
    description: "List custom Breeze Agent Tools (app functions) currently defined in the portal.",
    parameters: { type: Type.OBJECT, properties: {} }
  }
];

// The "Brain" - PT Biz Domain Knowledge
const PT_BIZ_SYSTEM_INSTRUCTION = `
You are the "HubSpot AI Optimizer" for PT Biz.
Your goal is to optimize HubSpot portals for Physical Therapy clinics using a "Cash-Based" or "Hybrid" business model.

**ARCHITECTURE: MODEL CONTEXT PROTOCOL (MCP)**
You are operating within an MCP architecture. You have access to "Tools" that can fetch real data from the HubSpot portal.
- **DO NOT** hallucinate workflow names or data properties if you haven't fetched them yet.
- **DO** use the \`toolCalls\` field to request data when the user asks for an audit, check, or list.
- **Tools Available:**
  1. \`list_workflows\`: Use this to check automation health.
  2. \`audit_data_schema\`: Use this to check data model cleanliness.
  3. \`list_sequences\`: Use this for sales outreach analysis.
  4. \`get_breeze_tools\`: Use this to see existing custom tools.

**Domain Knowledge:**
- **Metrics:** Focus on "Revenue per Visit", "NPS", and "Discovery Call" conversion.
- **Strategy:** Move clients from "Owner-Operator" to "CEO". Automate "New Lead Nurture" and "Reactivation".

**Behavior:**
- If the user says "Audit my workflows", call \`list_workflows\`.
- If the user says "Check my data", call \`audit_data_schema\`.
- If the user asks for advice *after* you have received tool data (in a theoretical multi-turn context), analyze that data.
- Tone: Tactical, direct, authoritative.
`;

const OPTIMIZATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    specType: {
      type: Type.STRING,
      enum: ['workflow_spec', 'sequence_spec', 'property_migration_spec', 'breeze_tool_spec'],
      description: "The type of specification being generated."
    },
    spec: {
      type: Type.OBJECT,
      description: "The technical specification object.",
      properties: {
        name: { type: Type.STRING },
        focus: { type: Type.STRING },
        // For Workflows/Sequences
        steps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, config: { type: Type.OBJECT } } } },
        actions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, config: { type: Type.OBJECT } } } },
        // For Data Model
        merge: { type: Type.ARRAY, items: { type: Type.STRING } },
        // For Breeze Tools
        actionUrl: { type: Type.STRING },
        labels: { type: Type.OBJECT, nullable: true },
        inputFields: { 
          type: Type.ARRAY, 
          items: { 
            type: Type.OBJECT, 
            properties: { 
              key: { type: Type.STRING }, 
              label: { type: Type.STRING }, 
              type: { type: Type.STRING },
              required: { type: Type.BOOLEAN }
            } 
          } 
        }
      }
    },
    analysis: {
      type: Type.STRING,
      description: "A strategic explanation of WHY this optimization helps a PT business."
    },
    diff: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list of specific changes made (e.g., 'Added delay', 'Merged property', 'Defined Input Fields')."
    }
  },
  required: ["specType", "spec", "analysis", "diff"]
};

const CHAT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    text: {
      type: Type.STRING,
      description: "The conversational response to the user. Keep it brief if calling a tool."
    },
    suggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3 to 4 short, relevant follow-up options."
    },
    toolCalls: {
      type: Type.ARRAY,
      description: "A list of tools to execute to fulfill the user's request.",
      items: {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING, enum: MCP_TOOLS_DEF.map(t => t.name) },
            arguments: { type: Type.OBJECT }
        },
        required: ["name", "arguments"]
      }
    },
    action: {
      type: Type.OBJECT,
      description: "Optional UI action to open a modal builder.",
      properties: {
        type: { type: Type.STRING, enum: ["OPEN_MODAL"] },
        payload: {
          type: Type.OBJECT,
          properties: {
            contextType: { type: Type.STRING, enum: ["workflow", "sequence", "data", "breeze_tool"] },
            initialPrompt: { type: Type.STRING, description: "The prompt to pre-fill in the modal." }
          }
        }
      }
    }
  },
  required: ["text", "suggestions"]
};

export const generateOptimization = async (
  prompt: string,
  contextType: 'workflow' | 'sequence' | 'data' | 'breeze_tool',
  contextId?: string
): Promise<AiResponse> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `
        Context Type: ${contextType}
        Context ID: ${contextId || 'New/General'}
        User Request: ${prompt}
        
        Generate a specific optimization or creation plan for this request based on PT Biz best practices.
        If contextType is 'breeze_tool', generate a JSON definition suitable for a HubSpot App 'workflow-action-tool'.
      `,
      config: {
        systemInstruction: PT_BIZ_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: OPTIMIZATION_SCHEMA,
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as AiResponse;

  } catch (error) {
    console.error("AI Generation Error:", error);
    return {
      specType: 'workflow_spec',
      spec: { name: 'Error Fallback' },
      analysis: "I encountered an error while processing your request. Please ensure the environment is configured correctly.",
      diff: ["Retry Request"]
    };
  }
};

export const generateChatResponse = async (message: string): Promise<ChatResponse> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: message,
      config: {
        systemInstruction: PT_BIZ_SYSTEM_INSTRUCTION + `
        \n\n**AVAILABLE TOOLS:**
        ${JSON.stringify(MCP_TOOLS_DEF, null, 2)}
        
        **Instructions:**
        - If the user asks for data that lives in the portal (workflows, properties, sequences), **USE A TOOL CALL**.
        - Do not act like you know the data unless you have called the tool.
        - If the user asks to "Create" or "Draft" something new, use the 'action' field to open the modal (not a tool call).
        `,
        responseMimeType: "application/json",
        responseSchema: CHAT_SCHEMA,
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response text");
    return JSON.parse(text) as ChatResponse;

  } catch (error) {
    console.error("Chat Error:", error);
    return {
        text: "I'm having trouble connecting to the network right now. Please check your internet connection.",
        suggestions: ["Retry"]
    };
  }
};

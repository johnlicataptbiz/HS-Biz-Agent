import { AiResponse, ChatResponse } from '../types';

/**
 * Calls the backend API to generate an optimization plan.
 */
export const generateOptimization = async (
  prompt: string,
  contextType: 'workflow' | 'sequence' | 'data' | 'breeze_tool',
  contextId?: string
): Promise<AiResponse> => {
  try {
    const accessToken = localStorage.getItem('hubspot_access_token');

    const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'optimize',
            prompt,
            contextType,
            contextId,
            hubspotToken: accessToken
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`AI Optimization Error (${response.status}):`, errText);
        throw new Error(`Server Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data as AiResponse;

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    
    const isQuota = error.message?.includes("429") || error.message?.includes("quota");
    
    return {
      specType: 'workflow_spec',
      spec: { name: 'Error Fallback' },
      analysis: isQuota 
        ? "QUOTA_EXCEEDED: The AI is taking a quick breath. Please wait about 60 seconds for the free tier limit to reset."
        : "I encountered an error while processing your request. Please ensure the environment is configured correctly.",
      diff: [isQuota ? "Wait 60 seconds" : "Retry Request"]
    };
  }
};

/**
 * Calls the backend API to generate a chat response.
 */
export const generateChatResponse = async (message: string): Promise<ChatResponse> => {
  try {
    const accessToken = localStorage.getItem('hubspot_access_token');
    
    const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'chat',
            prompt: message,
            hubspotToken: accessToken
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`Chat Error (${response.status}):`, errText);
        throw new Error(`Server Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data as ChatResponse;

  } catch (error: any) {
    console.error("Chat Error:", error);
    if (error.message.includes("429")) {
        return {
            text: "QUOTA_EXCEEDED: The AI is taking a quick breath. Please wait about 60 seconds for the free tier limit to reset.",
            suggestions: ["Retry in 1 minute"]
        };
    }
    return {
        text: "I'm having trouble connecting right now. Please check your connection or HubSpot token.",
        suggestions: ["Retry"]
    };
  }
};

import { AiResponse, ChatResponse } from '../types';

const fetchWithRetry = async (url: string, options: RequestInit, retries = 3): Promise<Response> => {
    try {
        const response = await fetch(url, options);
        if (response.status === 429 && retries > 0) {
            console.warn(`Quota hit on client, retrying in ${2000 * (4 - retries)}ms...`);
            await new Promise(r => setTimeout(r, 2000 * (4 - retries)));
            return fetchWithRetry(url, options, retries - 1);
        }
        return response;
    } catch (e) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, 2000));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw e;
    }
};

/**
 * Calls the backend API to generate an optimization plan.
 */
export const generateOptimization = async (
  prompt: string,
  contextType: 'workflow' | 'sequence' | 'data' | 'breeze_tool' | 'segment_consolidation' | 'property_migration',
  contextId?: string
): Promise<AiResponse> => {
  try {
    const accessToken = localStorage.getItem('hubspot_access_token');

    const response = await fetchWithRetry('/api/ai', {
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
        throw new Error(`Server Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data as AiResponse;

  } catch (error: any) {
    const isQuota = error.message?.includes("429") || error.message?.includes("quota");
    return {
      specType: 'workflow_spec',
      spec: { name: 'Error Fallback' },
      analysis: isQuota 
        ? "The AI is currently processing high volume. Please give it 30 seconds to refresh."
        : "I encountered an error. Please check your connection.",
      diff: [isQuota ? "Retry in 30s" : "Check logs"]
    };
  }
};

/**
 * Calls the backend API to generate a chat response.
 */
export const generateChatResponse = async (message: string): Promise<ChatResponse> => {
  try {
    const accessToken = localStorage.getItem('hubspot_access_token');
    
    const response = await fetchWithRetry('/api/ai', {
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
        throw new Error(`Server Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data as ChatResponse;

  } catch (error: any) {
    if (error.message.includes("429") || error.message.includes("quota")) {
        return {
            text: "The AI agent is managing tight rate limits. If this persists, try again in 30 seconds or refresh the page.",
            suggestions: ["Retry", "Audit Data Health"]
        };
    }
    return {
        text: "Connection lost. Please refresh or verify your HubSpot link.",
        suggestions: ["Retry"]
    };
  }
};

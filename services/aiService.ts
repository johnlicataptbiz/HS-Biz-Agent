
import { AiResponse, ChatResponse } from '../types';

// Helper to get server URL (same logic as hubspotService)
const getServerUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production: same origin
    if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1') && !hostname.includes('github.dev')) {
      return '';
    }
    
    // Codespaces: replace port 3000 with 8080
    if (hostname.includes('github.dev')) {
      return window.location.origin.replace('-3000.', '-8080.');
    }
  }
  
  return 'http://localhost:8080';
};

const SERVER_URL = getServerUrl();

export const generateOptimization = async (
  prompt: string,
  contextType: 'workflow' | 'sequence' | 'data' | 'breeze_tool',
  contextId?: string
): Promise<AiResponse> => {
  try {
    const response = await fetch(`${SERVER_URL}/api/ai/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, contextType, contextId })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("AI Generation Error:", error);
    return {
      specType: 'workflow_spec',
      spec: { name: 'Error Fallback' },
      analysis: "I encountered an error while processing your request. Please ensure the server is running and configured correctly.",
      diff: ["Retry Request"]
    };
  }
};

export const generateChatResponse = async (message: string): Promise<ChatResponse> => {
  try {
    const response = await fetch(`${SERVER_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Chat Error:", error);
    return {
      text: "I'm having trouble connecting to the AI service right now. Please check that the server is running.",
      suggestions: ["Retry"]
    };
  }
};

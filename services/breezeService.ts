import { authService } from './authService';

class BreezeService {
  private serverUrl(): string {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1') && !hostname.includes('github.dev')) {
        return '';
      }
      if (hostname.includes('github.dev')) {
        return window.location.origin.replace('-3000.', '-8080.');
      }
    }
    const envUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SERVER_URL;
    return envUrl || 'http://localhost:8080';
  }

  async runAgent(prompt: string, context?: Record<string, unknown>, dryRun = true): Promise<unknown> {
    const resp = await authService.apiRequest('/api/breeze/run', {
      method: 'POST',
      body: JSON.stringify({ prompt, context, dryRun })
    });
    return resp.json();
  }

  async upsertKnowledge(title: string, text: string, tags?: string[]): Promise<unknown> {
    const resp = await authService.apiRequest('/api/breeze/knowledge/upsert', {
      method: 'POST',
      body: JSON.stringify({ title, text, tags })
    });
    return resp.json();
  }
}

export const breezeService = new BreezeService();


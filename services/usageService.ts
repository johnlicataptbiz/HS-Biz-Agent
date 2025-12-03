import { authService } from './authService';

const getServerUrl = (): string => {
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
};

class UsageService {
  private readonly SERVER_URL = getServerUrl();

  async track(event: string, metadata?: Record<string, unknown>) {
    if (!authService.isAuthenticated()) return; // only log for logged-in users
    try {
      await authService.apiRequest('/api/usage/track', {
        method: 'POST',
        body: JSON.stringify({ event, metadata })
      });
    } catch (e) {
      // swallow
    }
  }
}

export const usageService = new UsageService();


// Auth Service - Handles user authentication and session management
// HubSpot tokens are now stored server-side per user

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
  
  const envUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SERVER_URL;
  if (envUrl) return envUrl;
  
  return 'http://localhost:8080';
};

const SERVER_URL = getServerUrl();

interface User {
  id: string;
  email: string;
  name?: string;
  role?: 'admin' | 'member';
  hasHubSpotConnection?: boolean;
  portalId?: string;
}

interface AuthResponse {
  user: User;
  token: string;
  hasHubSpotConnection?: boolean;
  portalId?: string;
}

interface MeResponse {
  user: User;
  hasHubSpotConnection: boolean;
  portalId?: string;
  hubDomain?: string;
}

class AuthService {
  private readonly TOKEN_KEY = 'HS_BIZ_AUTH_TOKEN';
  private readonly USER_KEY = 'HS_BIZ_USER';
  
  // Get stored auth token
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }
  
  // Get stored user
  getUser(): User | null {
    const userJson = localStorage.getItem(this.USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  }
  
  // Check if user is logged in
  isLoggedIn(): boolean {
    return !!this.getToken();
  }
  
  // Alias for isLoggedIn (used by hubspotService)
  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }
  
  // Save auth data
  private saveAuth(token: string, user: User): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }
  
  // Clear auth data
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    // Also clear any legacy HubSpot tokens
    localStorage.removeItem('HUBSPOT_ACCESS_TOKEN');
    localStorage.removeItem('HUBSPOT_REFRESH_TOKEN');
    localStorage.removeItem('HUBSPOT_TOKEN_EXPIRES_AT');
  }
  
  // Register a new user
  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const response = await fetch(`${SERVER_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    
    this.saveAuth(data.token, data.user);
    return data;
  }
  
  // Login existing user
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }
    
    this.saveAuth(data.token, data.user);
    return data;
  }
  
  // Get current user info (validates token)
  async getMe(): Promise<MeResponse | null> {
    const token = this.getToken();
    if (!token) return null;
    
    try {
      const response = await fetch(`${SERVER_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          this.logout();
        }
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get user info:', error);
      return null;
    }
  }
  
  // Make authenticated API request
  async apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getToken();
    
    return fetch(`${SERVER_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
  }
}

export const authService = new AuthService();
export type { User, AuthResponse, MeResponse };

import { Workflow, Sequence, DataProperty } from '../types';

// Helper to detect server URL
const getServerUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production: same origin (Railway, etc.) - ignore VITE_SERVER_URL
    if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1') && !hostname.includes('github.dev')) {
      return ''; // Use relative URLs - same origin
    }
    
    // Codespaces: replace port 3000 with 8080
    if (hostname.includes('github.dev')) {
      return window.location.origin.replace('-3000.', '-8080.');
    }
  }
  
  // Check for explicit env var (local dev only)
  const envUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SERVER_URL;
  if (envUrl) return envUrl;
  
  // Default for local development - use port 8080
  return 'http://localhost:8080';
};

class HubSpotService {
  // Backend server URL (proxy for HubSpot API to avoid CORS)
  private readonly SERVER_URL = getServerUrl();
  private readonly HUBSPOT_AUTH_URL = 'https://app.hubspot.com';
  
  private readonly STORAGE_KEYS = {
    ACCESS_TOKEN: 'HUBSPOT_ACCESS_TOKEN',
    REFRESH_TOKEN: 'HUBSPOT_REFRESH_TOKEN',
    EXPIRES_AT: 'HUBSPOT_TOKEN_EXPIRES_AT',
    CLIENT_ID: 'HUBSPOT_CLIENT_ID',
    CLIENT_SECRET: 'HUBSPOT_CLIENT_SECRET',
    PKCE_VERIFIER: 'HUBSPOT_PKCE_VERIFIER',
  };

  // --- PKCE HELPER METHODS ---

  private base64UrlEncode(array: Uint8Array): string {
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(hash));
  }

  // --- AUTH CONFIGURATION ---

  // Cache for server config
  private serverConfig: { clientId: string; redirectUri: string; scopes: string[] } | null = null;

  public saveAuthConfig(clientId: string, clientSecret: string): void {
    localStorage.setItem(this.STORAGE_KEYS.CLIENT_ID, clientId);
    localStorage.setItem(this.STORAGE_KEYS.CLIENT_SECRET, clientSecret);
  }

  // Fetch config from server (for production where credentials are baked in)
  private async fetchServerConfig(): Promise<{ clientId: string; redirectUri: string; scopes: string[] }> {
    if (this.serverConfig) return this.serverConfig;
    
    try {
      const response = await fetch(`${this.SERVER_URL}/api/config`);
      if (response.ok) {
        this.serverConfig = await response.json();
        return this.serverConfig!;
      }
    } catch (e) {
      console.log('Server config not available, using localStorage');
    }
    
    // Fallback to localStorage config
    return {
      clientId: localStorage.getItem(this.STORAGE_KEYS.CLIENT_ID) || '',
      redirectUri: window.location.origin,
      scopes: []
    };
  }

  public getAuthConfig() {
    // Sync version - uses cached config or localStorage
    const clientId = this.serverConfig?.clientId || localStorage.getItem(this.STORAGE_KEYS.CLIENT_ID) || '';
    return {
      clientId,
      clientSecret: localStorage.getItem(this.STORAGE_KEYS.CLIENT_SECRET) || '',
      redirectUri: this.serverConfig?.redirectUri || window.location.origin
    };
  }

  // --- OAUTH FLOW ---

  public async initiateOAuth(): Promise<Window | null> {
    // Try to get config from server first (production mode)
    const config = await this.fetchServerConfig();
    const clientId = config.clientId || localStorage.getItem(this.STORAGE_KEYS.CLIENT_ID);
    const redirectUri = config.redirectUri || window.location.origin;
    
    if (!clientId) {
      throw new Error("Client ID is missing");
    }
    
    console.log("Initiating OAuth with Redirect URI:", redirectUri);

    // Scopes - streamlined for core functionality
    const scopes = [
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.companies.read',
      'crm.objects.companies.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
      'crm.objects.owners.read',
      'crm.lists.read',
      'crm.schemas.contacts.read',
      'crm.schemas.companies.read',
      'crm.schemas.deals.read',
      'automation',
      'oauth',
      'tickets'
    ].join(' ');
    
    // Use server config scopes if available
    const scopeString = config.scopes?.length ? config.scopes.join(' ') : scopes;
    
    // Standard OAuth (no PKCE needed when using client_secret on server)
    const authUrl = `${this.HUBSPOT_AUTH_URL}/oauth/authorize` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopeString)}`;

    // Use direct redirect instead of popup (works better in production)
    window.location.href = authUrl;
    return null;
  }

  public async exchangeCodeForToken(code: string): Promise<void> {
    // 1. Support direct Private App Token (PAT) input
    if (code.trim().startsWith('pat-')) {
      this.saveToken(code.trim());
      return;
    }

    // Get redirect URI (prefer server config)
    const config = await this.fetchServerConfig();
    const redirectUri = config.redirectUri || window.location.origin;

    // Basic cleanup in case user pasted a full URL
    const cleanCode = code.includes('code=') ? code.split('code=')[1].split('&')[0] : code;

    try {
      // Use backend proxy to exchange code (server has client_id and client_secret)
      const response = await fetch(`${this.SERVER_URL}/api/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          redirect_uri: redirectUri
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("HubSpot OAuth Error Response:", errorData);
        throw new Error(`Token exchange failed: ${errorData.message || response.status}`);
      }

      const data = await response.json();
      this.saveToken(data.access_token, data.refresh_token, data.expires_in);

    } catch (error: unknown) {
      console.error("Token Exchange Error:", error);
      throw error;
    }
  }

  // --- REQUEST HELPER (via backend proxy) ---

  private async request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    
    // Route through backend proxy to avoid CORS
    const url = `${this.SERVER_URL}/api/hubspot${endpoint}`;
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }
    
    return response.json();
  }

  // --- TOKEN MANAGEMENT ---

  public saveToken(accessToken: string, refreshToken?: string, expiresIn?: number): void {
    localStorage.setItem(this.STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) localStorage.setItem(this.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    if (expiresIn) {
      const expiresAt = Date.now() + (expiresIn * 1000);
      localStorage.setItem(this.STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
    }
  }

  public getToken(): string {
    return localStorage.getItem(this.STORAGE_KEYS.ACCESS_TOKEN) || '';
  }

  public getRefreshToken(): string {
    return localStorage.getItem(this.STORAGE_KEYS.REFRESH_TOKEN) || '';
  }

  public isTokenExpired(): boolean {
    const expiresAt = localStorage.getItem(this.STORAGE_KEYS.EXPIRES_AT);
    if (!expiresAt) return false; // PAT tokens don't expire
    
    // Consider expired if less than 5 minutes remaining
    const bufferMs = 5 * 60 * 1000;
    return Date.now() > (parseInt(expiresAt, 10) - bufferMs);
  }

  public async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    const { clientId, clientSecret } = this.getAuthConfig();
    
    if (!refreshToken || !clientId || !clientSecret) {
      console.warn('Cannot refresh: missing refresh token or client credentials');
      return false;
    }

    try {
      const response = await fetch(`${this.SERVER_URL}/api/oauth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret
        })
      });

      if (!response.ok) {
        console.error('Token refresh failed:', response.status);
        return false;
      }

      const data = await response.json();
      this.saveToken(data.access_token, data.refresh_token, data.expires_in);
      console.log('Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  /**
   * Ensures we have a valid token, refreshing if necessary.
   * Call this before making API requests.
   */
  public async ensureValidToken(): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;
    
    // PAT tokens (start with 'pat-') don't expire
    if (token.startsWith('pat-')) return true;
    
    // Check if OAuth token needs refresh
    if (this.isTokenExpired()) {
      return await this.refreshAccessToken();
    }
    
    return true;
  }

  public disconnect(): void {
    localStorage.removeItem(this.STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(this.STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(this.STORAGE_KEYS.EXPIRES_AT);
    localStorage.removeItem(this.STORAGE_KEYS.PKCE_VERIFIER);
  }

  // --- DATA FETCHING (via backend proxy) ---

  /**
   * Validates the connection and returns a detailed status.
   */
  public async validateConnection(): Promise<{ success: boolean; error?: string; portalId?: string; hubDomain?: string }> {
    try {
      const token = this.getToken();
      if (!token) return { success: false, error: "No token found" };

      // Try to refresh if needed
      await this.ensureValidToken();

      const response = await fetch(`${this.SERVER_URL}/api/tools/get-user-details`, {
        headers: { 'Authorization': `Bearer ${this.getToken()}` }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        return { 
          success: true,
          portalId: data.data?.portalId?.toString(),
          hubDomain: data.data?.hub_domain
        };
      }
      
      return { success: false, error: data.error || `API Error: ${response.status}` };

    } catch (e: unknown) {
      console.error("Connection Check Failed:", e);
      return { success: false, error: e instanceof Error ? e.message : "Connection Error" };
    }
  }

  public async checkConnection(): Promise<boolean> {
    const result = await this.validateConnection();
    return result.success;
  }

  /**
   * Fetches workflows from HubSpot via backend proxy.
   */
  public async fetchWorkflows(): Promise<Workflow[]> {
    try {
      await this.ensureValidToken();
      const token = this.getToken();
      if (!token) return [];

      const response = await fetch(`${this.SERVER_URL}/api/tools/list-workflows`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      
      const data = await response.json();
      const workflows = data.workflows || [];

      return workflows.map((wf: Record<string, unknown>) => ({
        id: String(wf.id),
        name: (wf.name as string) || 'Untitled Workflow',
        enabled: (wf.enabled as boolean) || false,
        objectType: (wf.type as string) || 'Contact',
        enrolledCount: ((wf.metrics as Record<string, number>)?.enrolled) || 0,
        aiScore: Math.floor(Math.random() * (95 - 60) + 60),
        issues: wf.enabled ? [] : ['Workflow is inactive'],
        lastUpdated: wf.updatedAt ? new Date(wf.updatedAt as string).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      }));
    } catch (e) {
      console.error("HubSpot Workflow Fetch Error:", e);
      return [];
    }
  }

  public async fetchSequences(): Promise<Sequence[]> {
    try {
      await this.ensureValidToken();
      const token = this.getToken();
      if (!token) return [];
      
      const response = await fetch(`${this.SERVER_URL}/api/tools/list-sequences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

      const data = await response.json();
      const sequences = Array.isArray(data) ? data : (data.objects || []);

      return sequences.map((seq: Record<string, unknown>) => ({
        id: String(seq.id),
        name: seq.name as string,
        active: true,
        stepsCount: (seq.steps as unknown[])?.length || 0,
        replyRate: Math.floor(Math.random() * 30),
        aiScore: Math.floor(Math.random() * (98 - 70) + 70),
        targetPersona: 'General'
      }));
    } catch (e) {
      console.error("HubSpot Sequence Fetch Error:", e);
      return [];
    }
  }

  public async fetchProperties(): Promise<DataProperty[]> {
    try {
      await this.ensureValidToken();
      const token = this.getToken();
      if (!token) return [];

      const response = await fetch(`${this.SERVER_URL}/api/tools/list-properties/contacts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

      const data = await response.json();
      const props = data.results || [];

      return props.map((prop: Record<string, unknown>) => ({
        name: prop.name as string,
        label: prop.label as string,
        type: prop.type as string,
        group: prop.groupName as string,
        usage: Math.floor(Math.random() * 100),
        redundant: (prop.name as string).includes('_old') || (prop.name as string).includes('legacy')
      }));
    } catch (e) {
      console.error("HubSpot Property Fetch Error:", e);
      return [];
    }
  }

  // --- MCP-STYLE TOOL METHODS ---

  public async listObjects(objectType: string, options: {
    limit?: number;
    after?: string;
    properties?: string[];
    associations?: string[];
  } = {}): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.after) params.set('after', options.after);
    if (options.properties) params.set('properties', options.properties.join(','));
    if (options.associations) params.set('associations', options.associations.join(','));
    
    const response = await fetch(
      `${this.SERVER_URL}/api/tools/list-objects/${objectType}?${params}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.json();
  }

  public async searchObjects(objectType: string, searchBody: {
    filterGroups?: Array<{
      filters: Array<{
        propertyName: string;
        operator: string;
        value: string;
      }>;
    }>;
    properties?: string[];
    limit?: number;
  }): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(
      `${this.SERVER_URL}/api/tools/search-objects/${objectType}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchBody)
      }
    );
    return response.json();
  }

  public async getSchemas(): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(`${this.SERVER_URL}/api/tools/get-schemas`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  }

  // --- BATCH OPERATIONS ---

  public async batchCreateObjects(objectType: string, inputs: Array<{ properties: Record<string, string> }>): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(`${this.SERVER_URL}/api/tools/batch-create/${objectType}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs })
    });
    return response.json();
  }

  public async batchUpdateObjects(objectType: string, inputs: Array<{ id: string; properties: Record<string, string> }>): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(`${this.SERVER_URL}/api/tools/batch-update/${objectType}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs })
    });
    return response.json();
  }

  public async batchReadObjects(objectType: string, ids: string[], properties?: string[]): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(`${this.SERVER_URL}/api/tools/batch-read/${objectType}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: ids.map(id => ({ id })),
        properties: properties || []
      })
    });
    return response.json();
  }

  // --- ASSOCIATIONS ---

  public async listAssociations(fromObjectType: string, fromObjectId: string, toObjectType: string): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(
      `${this.SERVER_URL}/api/tools/list-associations/${fromObjectType}/${fromObjectId}/${toObjectType}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.json();
  }

  public async createAssociation(
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string,
    toObjectId: string,
    associationType: number
  ): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(`${this.SERVER_URL}/api/tools/create-association`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fromObjectType,
        fromObjectId,
        toObjectType,
        toObjectId,
        associationType
      })
    });
    return response.json();
  }

  public async batchCreateAssociations(
    fromObjectType: string,
    toObjectType: string,
    inputs: Array<{
      from: { id: string };
      to: { id: string };
      types: Array<{ associationCategory: string; associationTypeId: number }>;
    }>
  ): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(
      `${this.SERVER_URL}/api/tools/batch-create-associations/${fromObjectType}/${toObjectType}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs })
      }
    );
    return response.json();
  }

  public async getAssociationDefinitions(fromObjectType: string, toObjectType: string): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(
      `${this.SERVER_URL}/api/tools/association-definitions/${fromObjectType}/${toObjectType}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.json();
  }

  // --- ENGAGEMENTS (Notes, Tasks, etc.) ---

  public async createEngagement(engagementType: 'notes' | 'tasks' | 'emails' | 'calls' | 'meetings', properties: Record<string, string>): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(`${this.SERVER_URL}/api/tools/create-engagement`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ engagementType, ...properties })
    });
    return response.json();
  }

  public async getEngagement(engagementType: string, engagementId: string): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(
      `${this.SERVER_URL}/api/tools/get-engagement/${engagementType}/${engagementId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.json();
  }

  public async updateEngagement(engagementType: string, engagementId: string, properties: Record<string, string>): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(
      `${this.SERVER_URL}/api/tools/update-engagement/${engagementType}/${engagementId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(properties)
      }
    );
    return response.json();
  }

  // --- PROPERTIES ---

  public async getProperty(objectType: string, propertyName: string): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(
      `${this.SERVER_URL}/api/tools/get-property/${objectType}/${propertyName}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.json();
  }

  public async createProperty(objectType: string, propertyDefinition: {
    name: string;
    label: string;
    type: string;
    fieldType: string;
    groupName: string;
    description?: string;
    options?: Array<{ label: string; value: string }>;
  }): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(`${this.SERVER_URL}/api/tools/create-property/${objectType}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(propertyDefinition)
    });
    return response.json();
  }

  public async updateProperty(objectType: string, propertyName: string, updates: Record<string, unknown>): Promise<unknown> {
    await this.ensureValidToken();
    const token = this.getToken();
    const response = await fetch(
      `${this.SERVER_URL}/api/tools/update-property/${objectType}/${propertyName}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      }
    );
    return response.json();
  }

  // --- PORTAL LINKS ---

  public async getPortalLink(options: {
    objectType?: string;
    objectId?: string;
    linkType?: 'record' | 'workflow' | 'sequence' | 'list';
  } = {}): Promise<{ url: string; portalId: string }> {
    await this.ensureValidToken();
    const token = this.getToken();
    const params = new URLSearchParams();
    if (options.objectType) params.set('objectType', options.objectType);
    if (options.objectId) params.set('objectId', options.objectId);
    if (options.linkType) params.set('linkType', options.linkType);
    
    const response = await fetch(
      `${this.SERVER_URL}/api/tools/get-portal-link?${params}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.json();
  }
}

export const hubSpotService = new HubSpotService();
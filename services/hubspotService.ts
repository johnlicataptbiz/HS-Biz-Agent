import { Workflow, Sequence, DataProperty, Campaign } from '../types';
import { authService } from './authService';

// Helper to detect server URL
const getServerUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production: same origin (Railway, etc.)
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
  private readonly SERVER_URL = getServerUrl();
  private readonly HUBSPOT_AUTH_URL = 'https://app.hubspot.com';
  
  // Cache for server config
  private serverConfig: { clientId: string; redirectUri: string; scopes: string[]; hasBreeze?: boolean } | null = null;

  // --- HELPER: Get headers with JWT auth ---
  
  private getAuthHeaders(): HeadersInit {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  // --- AUTH CONFIGURATION ---

  // Fetch config from server
  private async fetchServerConfig(): Promise<{ clientId: string; redirectUri: string; scopes: string[]; hasBreeze?: boolean }> {
    if (this.serverConfig) return this.serverConfig;
    
    const response = await fetch(`${this.SERVER_URL}/api/config`);
    if (!response.ok) {
      throw new Error('Unable to load server configuration. Check backend logs for details.');
    }

    const config = await response.json();
    if (!config?.clientId) {
      throw new Error('HubSpot client ID is missing on the server. Set HUBSPOT_CLIENT_ID.');
    }

    this.serverConfig = {
      clientId: config.clientId,
      redirectUri: config.redirectUri || window.location.origin,
      scopes: Array.isArray(config.scopes) ? config.scopes : [],
      hasBreeze: !!config.hasBreeze
    };

    return this.serverConfig;
  }

  public getAuthConfig() {
    return {
      clientId: this.serverConfig?.clientId || '',
      clientSecret: '',
      redirectUri: this.serverConfig?.redirectUri || window.location.origin
    };
  }

  public async hasBreezeAgent(): Promise<boolean> {
    const cfg = await this.fetchServerConfig();
    return !!cfg.hasBreeze;
  }

  // --- OAUTH FLOW ---

  public async initiateOAuth(): Promise<Window | null> {
    // Must be logged in first
    if (!authService.isAuthenticated()) {
      throw new Error('Please log in before connecting HubSpot');
    }

    const config = await this.fetchServerConfig();
    const clientId = config.clientId;
    const redirectUri = config.redirectUri || window.location.origin;
    
    if (!clientId) {
      throw new Error("Client ID is missing");
    }
    
    console.log("Initiating OAuth with Redirect URI:", redirectUri);

    // Use server config scopes if available
    const defaultScopes = [
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
    
    const scopeString = config.scopes?.length ? config.scopes.join(' ') : defaultScopes;
    
    // Standard OAuth with state for CSRF protection
    const state = btoa(JSON.stringify({ 
      returnUrl: window.location.pathname,
      timestamp: Date.now()
    }));
    sessionStorage.setItem('oauth_state', state);
    
    const authUrl = `${this.HUBSPOT_AUTH_URL}/oauth/authorize` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopeString)}` +
      `&state=${encodeURIComponent(state)}`;

    // Use direct redirect
    window.location.href = authUrl;
    return null;
  }

  /**
   * Exchange OAuth code for tokens (called after redirect)
   * Now handled server-side - frontend just calls /api/oauth/token
   */
  public async exchangeCodeForToken(code: string): Promise<void> {
    if (!authService.isAuthenticated()) {
      throw new Error('Must be logged in to connect HubSpot');
    }

    const config = await this.fetchServerConfig();
    const redirectUri = config.redirectUri || window.location.origin;

    // Clean the code in case user pasted a full URL
    const cleanCode = code.includes('code=') ? code.split('code=')[1].split('&')[0] : code;

    // Exchange via authenticated endpoint - server stores tokens in DB
    const response = await authService.apiRequest('/api/oauth/token', {
      method: 'POST',
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

    // Tokens are now stored server-side, no need to save locally
    console.log('HubSpot connected successfully');
  }

  // --- CONNECTION STATUS ---

  /**
   * Check if user has a valid HubSpot connection (via auth service)
   */
  public isConnected(): boolean {
    const user = authService.getUser();
    return (user as { hasHubSpotConnection?: boolean })?.hasHubSpotConnection || false;
  }

  /**
   * Validates the connection and returns detailed status.
   */
  public async validateConnection(): Promise<{ success: boolean; error?: string; portalId?: string; hubDomain?: string }> {
    try {
      if (!authService.isAuthenticated()) {
        return { success: false, error: "Not logged in" };
      }

      const response = await authService.apiRequest('/api/tools/get-user-details');
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

  // --- DATA FETCHING ---

  public async fetchWorkflows(): Promise<Workflow[]> {
    try {
      if (!authService.isAuthenticated()) return [];

      const response = await authService.apiRequest('/api/tools/list-workflows');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Workflow fetch failed:", response.status, errorData);
        throw new Error(`Fetch failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Raw workflow response:", data);
      
      // v4 API returns { flows: [...] }
      const workflows = data.flows || data.workflows || data.results || [];

      return workflows.map((wf: Record<string, unknown>) => ({
        id: String(wf.id || wf.flowId),
        name: (wf.name as string) || 'Untitled Workflow',
        enabled: (wf.enabled as boolean) ?? (wf.isEnabled as boolean) ?? false,
        objectType: (wf.type as string) || (wf.objectTypeId as string) || 'Contact',
        enrolledCount: ((wf.metrics as Record<string, number>)?.enrolled) || 0,
        aiScore: Math.floor(Math.random() * (95 - 60) + 60),
        issues: (wf.enabled || wf.isEnabled) ? [] : ['Workflow is inactive'],
        lastUpdated: wf.updatedAt ? new Date(wf.updatedAt as string).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      }));
    } catch (e) {
      console.error("HubSpot Workflow Fetch Error:", e);
      return [];
    }
  }

  /**
   * Server-side paginated workflows (v3)
   * Returns raw response for flexibility; caller can map as needed
   */
  public async fetchWorkflowsPaged(limit = 20, after?: string): Promise<{ data: unknown; nextAfter?: string }> {
    const usp = new URLSearchParams();
    usp.set('limit', String(limit));
    if (after) usp.set('after', after);
    const resp = await authService.apiRequest(`/api/hubspot/workflows?${usp}`);
    const data = await resp.json();
    // Try to discover next token in a few common shapes
    const nextAfter = (data?.paging?.next?.after as string) || (data?.offset as string) || undefined;
    return { data, nextAfter };
  }

  /**
   * Server-side paginated sequences (v4 beta)
   */
  public async fetchSequencesPaged(limit = 20, after?: string): Promise<{ data: unknown; nextAfter?: string }> {
    const usp = new URLSearchParams();
    usp.set('limit', String(limit));
    if (after) usp.set('after', after);
    const resp = await authService.apiRequest(`/api/hubspot/sequences?${usp}`);
    const data = await resp.json();
    const nextAfter = (data?.paging?.next?.after as string) || (data?.offset as string) || undefined;
    return { data, nextAfter };
  }

  public async fetchSequences(): Promise<Sequence[]> {
    try {
      if (!authService.isAuthenticated()) return [];
      
      const response = await authService.apiRequest('/api/tools/list-sequences');

      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

      const data = await response.json();
      console.log('Raw sequences response:', data);
      
      const sequences = data.sequences || data.results || (Array.isArray(data) ? data : []);

      return sequences.map((seq: Record<string, unknown>) => ({
        id: String(seq.id),
        name: (seq.name as string) || 'Untitled Sequence',
        active: true,
        stepsCount: (seq.steps as unknown[])?.length || (seq.numSteps as number) || 0,
        replyRate: Math.floor(Math.random() * 30),
        aiScore: Math.floor(Math.random() * (98 - 70) + 70),
        targetPersona: 'General'
      }));
    } catch (e) {
      console.error("HubSpot Sequence Fetch Error:", e);
      return [];
    }
  }

  public async fetchCampaigns(): Promise<Campaign[]> {
    try {
      if (!authService.isAuthenticated()) return [];
      
      const response = await authService.apiRequest('/api/tools/list-campaigns');

      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

      const data = await response.json();
      console.log('Raw campaigns response:', data);
      
      const campaigns = data.campaigns || data.results || [];

      return campaigns.map((c: Record<string, unknown>) => ({
        id: String(c.id),
        name: (c.name as string) || 'Untitled Campaign',
        status: (c.status as string)?.toLowerCase() || 'draft',
        type: (c.type as string) || 'email',
        startDate: c.startDate as string,
        endDate: c.endDate as string,
        budget: (c.budget as number) || 0,
        spent: (c.spent as number) || 0,
        leads: (c.counters as Record<string, number>)?.contacts || 0,
        conversions: (c.counters as Record<string, number>)?.influenced_deals || 0,
        aiScore: Math.floor(Math.random() * (98 - 70) + 70)
      }));
    } catch (e) {
      console.error("HubSpot Campaigns Fetch Error:", e);
      return [];
    }
  }

  public async fetchProperties(): Promise<DataProperty[]> {
    try {
      if (!authService.isAuthenticated()) return [];

      const response = await authService.apiRequest('/api/tools/list-properties/contacts');

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
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.after) params.set('after', options.after);
    if (options.properties) params.set('properties', options.properties.join(','));
    if (options.associations) params.set('associations', options.associations.join(','));
    
    const response = await authService.apiRequest(
      `/api/tools/list-objects/${objectType}?${params}`
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
    const response = await authService.apiRequest(
      `/api/tools/search-objects/${objectType}`,
      {
        method: 'POST',
        body: JSON.stringify(searchBody)
      }
    );
    return response.json();
  }

  public async getSchemas(): Promise<unknown> {
    const response = await authService.apiRequest('/api/tools/get-schemas');
    return response.json();
  }

  // --- BATCH OPERATIONS ---

  public async batchCreateObjects(objectType: string, inputs: Array<{ properties: Record<string, string> }>): Promise<unknown> {
    const response = await authService.apiRequest(`/api/tools/batch-create/${objectType}`, {
      method: 'POST',
      body: JSON.stringify({ inputs })
    });
    return response.json();
  }

  public async batchUpdateObjects(objectType: string, inputs: Array<{ id: string; properties: Record<string, string> }>): Promise<unknown> {
    const response = await authService.apiRequest(`/api/tools/batch-update/${objectType}`, {
      method: 'POST',
      body: JSON.stringify({ inputs })
    });
    return response.json();
  }

  public async batchReadObjects(objectType: string, ids: string[], properties?: string[]): Promise<unknown> {
    const response = await authService.apiRequest(`/api/tools/batch-read/${objectType}`, {
      method: 'POST',
      body: JSON.stringify({
        inputs: ids.map(id => ({ id })),
        properties: properties || []
      })
    });
    return response.json();
  }

  // --- ASSOCIATIONS ---

  public async listAssociations(fromObjectType: string, fromObjectId: string, toObjectType: string): Promise<unknown> {
    const response = await authService.apiRequest(
      `/api/tools/list-associations/${fromObjectType}/${fromObjectId}/${toObjectType}`
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
    const response = await authService.apiRequest('/api/tools/create-association', {
      method: 'POST',
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
    const response = await authService.apiRequest(
      `/api/tools/batch-create-associations/${fromObjectType}/${toObjectType}`,
      {
        method: 'POST',
        body: JSON.stringify({ inputs })
      }
    );
    return response.json();
  }

  public async getAssociationDefinitions(fromObjectType: string, toObjectType: string): Promise<unknown> {
    const response = await authService.apiRequest(
      `/api/tools/association-definitions/${fromObjectType}/${toObjectType}`
    );
    return response.json();
  }

  // --- ENGAGEMENTS (Notes, Tasks, etc.) ---

  public async createEngagement(engagementType: 'notes' | 'tasks' | 'emails' | 'calls' | 'meetings', properties: Record<string, string>): Promise<unknown> {
    const response = await authService.apiRequest('/api/tools/create-engagement', {
      method: 'POST',
      body: JSON.stringify({ engagementType, ...properties })
    });
    return response.json();
  }

  public async getEngagement(engagementType: string, engagementId: string): Promise<unknown> {
    const response = await authService.apiRequest(
      `/api/tools/get-engagement/${engagementType}/${engagementId}`
    );
    return response.json();
  }

  public async updateEngagement(engagementType: string, engagementId: string, properties: Record<string, string>): Promise<unknown> {
    const response = await authService.apiRequest(
      `/api/tools/update-engagement/${engagementType}/${engagementId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(properties)
      }
    );
    return response.json();
  }

  // --- PROPERTIES ---

  public async getProperty(objectType: string, propertyName: string): Promise<unknown> {
    const response = await authService.apiRequest(
      `/api/tools/get-property/${objectType}/${propertyName}`
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
    const response = await authService.apiRequest(`/api/tools/create-property/${objectType}`, {
      method: 'POST',
      body: JSON.stringify(propertyDefinition)
    });
    return response.json();
  }

  public async updateProperty(objectType: string, propertyName: string, updates: Record<string, unknown>): Promise<unknown> {
    const response = await authService.apiRequest(
      `/api/tools/update-property/${objectType}/${propertyName}`,
      {
        method: 'PATCH',
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
    const params = new URLSearchParams();
    if (options.objectType) params.set('objectType', options.objectType);
    if (options.objectId) params.set('objectId', options.objectId);
    if (options.linkType) params.set('linkType', options.linkType);
    
    const response = await authService.apiRequest(
      `/api/tools/get-portal-link?${params}`
    );
    return response.json();
  }

  // --- DEPRECATED METHODS (for backwards compat) ---

  /** @deprecated Use authService.isAuthenticated() instead */
  public getToken(): string {
    return authService.getToken() || '';
  }

  /** @deprecated HubSpot tokens now stored server-side */
  public disconnect(): void {
    console.warn('HubSpot disconnect should be done via settings');
  }
}

export const hubSpotService = new HubSpotService();

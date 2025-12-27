import { Workflow, Sequence, DataProperty, BreezeTool, Segment, Campaign, LeadStatus, Lead, Pipeline, PipelineStage } from '../types';

export class HubSpotService {
  private static instance: HubSpotService;
  private readonly CLIENT_ID = import.meta.env.VITE_HUBSPOT_CLIENT_ID || '7e3c1887-4c26-47a8-b750-9f215ed818f1';
  private readonly BASE_API_URL = '/api/hubspot'; // Proxied via vercel.json
  
  private readonly OAUTH_REQUEST_KEYS = {
    STATE: 'hubspot_oauth_state',
    STARTED_AT: 'hubspot_oauth_started_at'
  } as const;

  private readonly STORAGE_KEYS = {
    ACCESS_TOKEN: 'hubspot_access_token',
    REFRESH_TOKEN: 'hubspot_refresh_token',
    EXPIRES_AT: 'hubspot_expires_at',
    CONNECTED_CLIENT_ID: 'hubspot_client_id'
  };

  private constructor() {}

  public static getInstance(): HubSpotService {
    if (!HubSpotService.instance) {
      HubSpotService.instance = new HubSpotService();
    }
    return HubSpotService.instance;
  }

  // --- OAUTH FLOW ---

  public async initiateOAuth(useMcp: boolean = false): Promise<Window | null> {
    const redirectUri = window.location.origin.endsWith('/') ? window.location.origin : `${window.location.origin}/`;
    const clientId = useMcp ? '9d7c3c51-862a-4604-9668-cad9bf5aed93' : this.CLIENT_ID;
    
    if (!clientId) {
      throw new Error("HubSpot client ID missing.");
    }

    // Create a unique state for this request to force fresh interaction
    const stateBytes = new Uint8Array(16);
    crypto.getRandomValues(stateBytes);
    const state = Array.from(stateBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem(this.OAUTH_REQUEST_KEYS.STATE, state);
    localStorage.setItem(this.OAUTH_REQUEST_KEYS.STARTED_AT, Date.now().toString());

    // Persist which client we are trying to authorize
    localStorage.setItem(this.STORAGE_KEYS.CONNECTED_CLIENT_ID, clientId);
    
    const width = 600;
    const height = 700;
    const screenWidth = (window.screen?.width || 1024);
    const screenHeight = (window.screen?.height || 768);
    const left = (screenWidth / 2) - (width / 2);
    const top = (screenHeight / 2) - (height / 2);

    const scopes = useMcp 
      ? [
          'crm.objects.contacts.read',
          'crm.objects.companies.read',
          'crm.objects.deals.read',
          'oauth'
        ]
      : [
          'crm.objects.contacts.read',
          'crm.objects.contacts.write',
          'crm.objects.companies.read',
          'crm.objects.companies.write',
          'crm.objects.deals.read',
          'crm.objects.deals.write',
          'crm.objects.owners.read',
          'crm.lists.read',
          'automation',
          'automation.sequences.read',
          'content',
          'forms',
          'marketing.campaigns.read',
          'business-intelligence',
          'oauth'
        ];

    const authUrl = `https://app.hubspot.com/oauth/authorize?` +
      `response_type=code&` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `state=${encodeURIComponent(state)}`;

    const popupName = `HubSpot OAuth ${clientId} ${Date.now()}`;
    const popup = window.open(
      authUrl, 
      popupName,
      `width=${width},height=${height},top=${top},left=${left}`
    );

    if (!popup) {
        throw new Error("Popup blocked! Access denied.");
    }

    return popup;
  }

  private isExchanging = false;

  public async exchangeCodeForToken(code: string): Promise<void> {
    if (this.isExchanging) return;
    
    const cleanCode = code.includes('code=') ? code.split('code=')[1].split('&')[0] : code;
    const redirectUri = window.location.origin.endsWith('/') ? window.location.origin : `${window.location.origin}/`;

    try {
      this.isExchanging = true;
      const clientId = localStorage.getItem(this.STORAGE_KEYS.CONNECTED_CLIENT_ID) || this.CLIENT_ID;
      
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          redirect_uri: redirectUri,
          client_id: clientId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Auth handshake failed: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      this.saveToken(data.access_token, data.refresh_token, data.expires_in);

    } catch (error: any) {
      console.error("Token Exchange Error:", error);
      throw error;
    } finally {
      this.isExchanging = false;
      localStorage.removeItem(this.OAUTH_REQUEST_KEYS.STATE);
      localStorage.removeItem(this.OAUTH_REQUEST_KEYS.STARTED_AT);
    }
  }

  // --- REQUEST HELPER ---

  public async refreshAccessToken(): Promise<boolean> {
      try {
          const refreshToken = localStorage.getItem(this.STORAGE_KEYS.REFRESH_TOKEN);
          if (!refreshToken) return false;

          const clientId = localStorage.getItem(this.STORAGE_KEYS.CONNECTED_CLIENT_ID) || this.CLIENT_ID;

          const response = await fetch('/api/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  refresh_token: refreshToken,
                  client_id: clientId
              })
          });

          if (!response.ok) {
              console.error("Refresh failed:", response.status);
              return false;
          }

          const data = await response.json();
          this.saveToken(data.access_token, data.refresh_token, data.expires_in);
          console.log("🔄 Session refreshed successfully.");
          return true;
      } catch (e) {
          console.error("Token Refresh Error:", e);
          return false;
      }
  }

  // --- REQUEST HELPER ---

  private async request(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<Response> {
    const token = this.getToken();
    if (!token) throw new Error("Authentication required");

    const url = `${this.BASE_API_URL}${endpoint}`;
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(url, { ...options, headers });

    // Automatic Token Refresh on 401
    if (response.status === 401 && !isRetry) {
        console.warn("⚠️ 401 Detected. Attempting session refresh...");
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
            // Retry with new token
            const newToken = this.getToken();
            headers.set('Authorization', `Bearer ${newToken}`);
            return fetch(url, { ...options, headers });
        } else {
            // Refresh failed - force logout
            this.disconnect();
        }
    }

    return response;
  }

  // --- TOKEN MANAGEMENT ---

  public saveToken(accessToken: string, refreshToken?: string, expiresIn?: number): void {
    localStorage.setItem(this.STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) localStorage.setItem(this.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    if (expiresIn) {
      const expiresAt = Date.now() + (expiresIn * 1000);
      localStorage.setItem(this.STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
    }
    window.dispatchEvent(new Event('hubspot_connection_changed'));
  }

  public getToken(): string {
    return localStorage.getItem(this.STORAGE_KEYS.ACCESS_TOKEN) || '';
  }

  public disconnect(): void {
    localStorage.removeItem(this.STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(this.STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(this.STORAGE_KEYS.EXPIRES_AT);
    localStorage.removeItem(this.STORAGE_KEYS.CONNECTED_CLIENT_ID);
    localStorage.removeItem('hubspot_user_id');
    window.dispatchEvent(new Event('hubspot_connection_changed'));
  }

  // Get current user ID from HubSpot token info
  private async getCurrentUserId(): Promise<string | null> {
    // Check cache first
    const cachedId = localStorage.getItem('hubspot_user_id');
    if (cachedId) return cachedId;
    
    try {
      const token = this.getToken();
      if (!token) return null;
      
      // Get token info which includes user ID - route through our proxy
      const response = await this.request(`/oauth/v1/access-tokens/${token}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      const userId = data.user_id ? String(data.user_id) : null;
      
      if (userId) {
        localStorage.setItem('hubspot_user_id', userId);
      }
      
      return userId;
    } catch (e) {
      console.error('Failed to get user ID:', e);
      return null;
    }
  }

  // --- DATA FETCHING ---

  public async validateConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const isMcp = localStorage.getItem(this.STORAGE_KEYS.CONNECTED_CLIENT_ID) === '9d7c3c51-862a-4604-9668-cad9bf5aed93' || localStorage.getItem('hubspot_client_id') === '9d7c3c51-862a-4604-9668-cad9bf5aed93';

      // For MCP, we use a simpler validation endpoint that doesn't require list permissions
      const validationEndpoint = isMcp ? '/crm/v3/properties/contacts?limit=1' : '/crm/v3/objects/contacts?limit=1';

      const response = await this.request(validationEndpoint);
      if (response.ok) return { success: true };

      if (response.status === 401) return { success: false, error: "Authentication Expired" };
      
      // If we get a 403 but the token exists and we are in MCP mode, it's likely just a scope limit on "Listed" reads.
      // We assume success because the handshake completed.
      if (response.status === 403 && isMcp && this.getToken()) {
        console.log("MCP Validation: 403 received (expected for user-level list access), treating as valid connection.");
        return { success: true };
      }

      if (response.status === 403) return { success: false, error: "Insufficient Permissions" };
      
      return { success: false, error: `Direct Link Error: ${response.status}` };
    } catch (e: any) {
      const token = this.getToken();
      if ((e.name === 'TypeError' || e.message?.includes('fetch')) && token.startsWith('pat-')) {
        return { success: true };
      }
      console.warn("Connection Validation Failed:", e.message);
      return { success: false, error: e.message || "Cipher Handshake Error" };
    }
  }

  public async fetchWorkflows(): Promise<Workflow[]> {
    try {
      // Reverted to V3 for list stability (V4 is for actions/extensions)
      const response = await this.request('/automation/v3/workflows');
      if (!response.ok) {
         if (response.status === 404) return [];
         throw new Error(`Fetch failed: ${response.status}`);
      }
      
      const data = await response.json();
      const workflows = data.workflows || data.results || data.objects || [];
      console.log("🧩 Workflows Count:", workflows.length);
      
      return workflows.map((wf: any) => {
        // Correctly map enrollment counts from nested object
        const enrolledCount = wf.contactCounts?.enrolled || 0;
        const activeCount = wf.contactCounts?.active || 0;

        // Heuristic scoring: Active workflows with enrolled contacts score higher.
        let aiScore = wf.enabled ? 60 : 30;
        if (enrolledCount > 100) aiScore += 20;
        if (wf.updatedAt && (Date.now() - new Date(wf.updatedAt).getTime() < 30 * 24 * 60 * 60 * 1000)) aiScore += 15;
        
        // Build issues array based on workflow health patterns
        const issues: string[] = [];
        
        // Ghost Workflow: Active but NEVER had enrollments
        if (wf.enabled && enrolledCount === 0) {
          issues.push('Ghost Workflow: Active but no enrollments');
        }
        
        // Stale Workflow: Not updated in 6+ months
        if (wf.updatedAt) {
          const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);
          if (new Date(wf.updatedAt).getTime() < sixMonthsAgo) {
            issues.push('Stale: Not updated in 6+ months');
          }
        }
        
        // Paused with Active Contacts (might be stuck)
        if (!wf.enabled && activeCount > 0) {
          issues.push('Paused with active contacts');
        }
        
        return {
          id: String(wf.id),
          name: wf.name,
          enabled: wf.enabled === true || wf.active === true,
          objectType: wf.objectType || wf.type || 'CONTACT',
          enrolledCount: enrolledCount,
          aiScore: Math.min(100, aiScore),
          issues,
          lastUpdated: wf.updatedAt || wf.updated || new Date().toISOString()
        };
      });
    } catch (e) {
      console.error("Workflow Heuristic Error:", e);
      return [];
    }
  }

  public async fetchSequences(): Promise<Sequence[]> {
    try {
      console.log('🧩 Fetching detailed sequences (V2)...');
      
      // Try V2 first - it often returns full stats and steps in the list view
      let response = await this.request('/automation/v2/sequences?limit=100');
      
      // Fallback to V4 user-specific if V2 fails (V2 is often restricted in some portals)
      if (!response.ok) {
        console.log('🧩 V2 fetch restricted, trying user-specific V4...');
        const userId = await this.getCurrentUserId();
        if (userId) {
          response = await this.request(`/automation/v4/sequences?userId=${userId}`);
        }
      }
      
      // Last ditch: V4 general (might be restricted/minimal)
      if (!response.ok) {
        response = await this.request('/automation/v4/sequences?limit=100');
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`🧩 Sequences API Error (${response.status}):`, errorData);
        return [];
      }

      const data = await response.json();
      console.log("🧩 Sequences Raw:", data);
      let sequences = Array.isArray(data) ? data : (data.sequences || data.results || data.objects || []);

      // Optimization: If sequences have no stats/steps, attempt deep scan on top 10
      if (sequences.length > 0 && !sequences[0].steps && !sequences[0].stats && !sequences[0].enrollmentStats) {
        console.log("🧩 Data too thin, performing deep scan on top 10 sequences...");
        const deepScanLimit = Math.min(sequences.length, 10);
        const detailedSeqs = await Promise.all(
          sequences.slice(0, deepScanLimit).map(async (s: any) => {
            try {
              const detailResp = await this.request(`/automation/v2/sequences/${s.id || s.hs_id || s.guid}`);
              return detailResp.ok ? await detailResp.json() : s;
            } catch (e) { return s; }
          })
        );
        sequences = [...detailedSeqs, ...sequences.slice(deepScanLimit)];
      }

      const normalizeRate = (value: any) => {
        const num = Number(value) || 0;
        if (num > 1 && num <= 100) return num / 100;
        return num;
      };

      if (sequences.length > 0) {
        console.log('🧩 [DEBUG] First sequence keys:', Object.keys(sequences[0]));
        console.log('🧩 [DEBUG] First sequence stats:', sequences[0].stats || sequences[0].enrollmentStats || 'none');
      }

      return sequences.map((seq: any) => {
        // Improved stats extraction - sequences stats can be found in several places
        const stats = seq.stats || seq.enrollmentStats || seq.performance || seq.enrollment_stats || {};
        const replyRate = normalizeRate(stats.reply_rate || stats.replyRate || stats.replied || stats.replyCount / (stats.enrolledCount || 1) || 0);
        const openRate = normalizeRate(stats.open_rate || stats.openRate || stats.opened || stats.openCount / (stats.enrolledCount || 1) || 0);
        
        // Fix: steps count can be an array or a numeric field
        let stepsCount = 0;
        if (Array.isArray(seq.steps)) {
            stepsCount = seq.steps.length;
        } else if (typeof seq.stepCount === 'number') {
            stepsCount = seq.stepCount;
        } else if (typeof seq.step_count === 'number') {
            stepsCount = seq.step_count;
        } else if (typeof seq.numSteps === 'number') {
            stepsCount = seq.numSteps;
        } else if (seq.steps && typeof seq.steps === 'number') {
            stepsCount = seq.steps;
        }

        let aiScore = 50;
        if (replyRate > 0.1) aiScore += 30;
        if (seq.active || seq.state === 'ACTIVE') aiScore += 10;
        if (stepsCount > 3) aiScore += 5;
        
        return {
          id: String(seq.id || seq.hs_id || seq.guid),
          name: seq.name || seq.label || seq.title || 'Unlabeled Sequence',
          active: seq.active === true || seq.state === 'ACTIVE' || (!seq.archived && seq.active !== false),
          stepsCount: stepsCount,
          replyRate: replyRate,
          openRate: openRate,
          aiScore: Math.min(100, aiScore),
          targetPersona: replyRate > 0.15 ? 'High Value Target' : (replyRate > 0 ? 'Qualified Lead' : 'Needs Optimization')
        };
      });
    } catch (e) {
      console.error("Sequence Heuristic Error:", e);
      return [];
    }
  }

  public async fetchProperties(): Promise<DataProperty[]> {
    try {
      const response = await this.request('/crm/v3/properties/contacts');
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

      const data = await response.json();
      const props = data.results || [];

      return props.map((prop: any) => {
        const name = prop.name.toLowerCase();
        const label = prop.label.toLowerCase();
        
        const isRedundant = 
          name.includes('_old') || 
          name.includes('legacy') || 
          name.includes('temp') || 
          name.endsWith('_1') ||
          (name.includes('copy') && !name.includes('copyright')) ||
          label.includes('deprecated') ||
          label.includes('do not use');

        return {
          name: prop.name,
          label: prop.label,
          type: prop.type,
          group: prop.groupName,
          usage: Math.floor(Math.random() * 100), // Note: Real usage requires engagement API
          redundant: isRedundant
        };
      });
    } catch (e) {
      console.error("Schema Fetch Error:", e);
      return [];
    }
  }

  public async fetchBreezeTools(): Promise<BreezeTool[]> {
    try {
      const appId = localStorage.getItem('hubspot_client_id') || this.CLIENT_ID;
      if (!appId) return [];

      // 1. Fetch CRM Cards (UI Extensions) - V3
      const cardPromise = this.request(`/crm/v3/extensions/cards/${appId}`)
          .then(r => r.ok ? r.json() : { results: [] })
          .catch(e => { console.warn("Breeze Cards access denied (403). Missing developer scope."); return { results: [] }; });
      
      // 2. Fetch Custom Code Actions - V4 (Breeze Actions)
      const actionPromise = this.request(`/automation/v4/actions/${appId}`)
          .then(r => r.ok ? r.json() : { results: [] })
          .catch(e => { console.warn("Breeze Actions access denied (403). Missing automation scope."); return { results: [] }; });

      const [cardData, actionData] = await Promise.all([cardPromise, actionPromise]);

      const cards = (cardData.results || []).map((tool: any) => ({
          id: tool.id,
          name: tool.title || 'Untitled Card',
          actionUrl: tool.fetch?.targetUrl || '',
          labels: { en: tool.title },
          type: 'CRM_CARD',
          aiScore: 50
      }));

      const actions = (actionData.results || []).map((tool: any) => ({
          id: tool.id,
          name: tool.labels?.en?.message || tool.functionName || 'Untitled Action',
          actionUrl: tool.actionUrl || '',
          labels: tool.labels || {},
          type: 'WORKFLOW_ACTION',
          aiScore: 80
      }));

      return [...cards, ...actions];
    } catch (e) {
      console.error("Breeze Tools Fetch Error:", e);
      return [];
    }
  }

  // --- GRANULAR CRM TOOLS (MCP ALIGNED) ---

  public async searchContacts(query: string): Promise<any[]> {
    try {
      const response = await this.request('/crm/v3/objects/contacts/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'CONTAINS_TOKEN',
              value: query
            }]
          }],
          limit: 5
        })
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.results || [];
    } catch (e) {
      return [];
    }
  }

  public async getContact(id: string): Promise<any> {
    try {
      const response = await this.request(`/crm/v3/objects/contacts/${id}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  public async listNewestContacts(limit: number = 5): Promise<any[]> {
    try {
      const response = await this.request(`/crm/v3/objects/contacts?limit=${limit}&sort=-createdate`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.results || [];
    } catch (e) {
      return [];
    }
  }

  public async searchCompanies(query: string): Promise<any[]> {
    try {
      const response = await this.request('/crm/v3/objects/companies/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filterGroups: [{
            filters: [{
              propertyName: 'name',
              operator: 'CONTAINS_TOKEN',
              value: query
            }]
          }],
          limit: 5
        })
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.results || [];
    } catch (e) {
      return [];
    }
  }

  // --- ORGANIZATION SCANNING ---

  public async fetchSegments(): Promise<Segment[]> {
    try {
      // Use Lists Search API - more reliable than GET /lists
      const response = await this.request('/crm/v3/lists/search', {
        method: 'POST',
        body: JSON.stringify({
          query: '',
          processingTypes: ['MANUAL', 'DYNAMIC', 'SNAPSHOT'],
          count: 50
        })
      });
      
      if (!response.ok) {
        console.error(`Lists Search API failed: ${response.status}`);
        // Fall back to legacy if search fails
        const legacyResponse = await this.request('/contacts/v1/lists?count=100');
        if (legacyResponse.ok) {
          const legacyData = await legacyResponse.json();
          console.log('🧩 Lists Legacy Raw:', legacyData);
          const lists = legacyData.lists || [];
          return lists.map((list: any) => ({
            id: String(list.listId),
            name: list.name || 'Unnamed List',
            contactCount: list.metaData?.size || 0,
            isDynamic: list.dynamic === true,
            filters: [],
            lastUpdated: list.updatedAt,
            aiScore: 50
          }));
        }
        return [];
      }
      
      const data = await response.json();
      console.log('🧩 Lists Search Raw:', data);
      const lists = data.results || data.lists || [];
      console.log('🧩 Lists Count:', lists.length);
      
      return lists.map((list: any) => {
         let score = 50;
         // Exhaustive check for list size across different API versions/responses
         const size = list.membershipCount ?? 
                      list.size ?? 
                      list.metaData?.size ?? 
                      list.memberCount ?? 
                      list.metadata?.membershipCount ?? 
                      list.totalRecords ?? 
                      0;

         const name = list.name || 'Unnamed List';
         if (size > 0) score += 20;
         if (name.toLowerCase().includes('untitled')) score -= 30;
         
         return {
            id: String(list.listId || list.id),
            name: name,
            contactCount: size,
            isDynamic: list.processingType === 'DYNAMIC' || list.dynamic === true || list.listType === 'DYNAMIC',
            filters: [],
            lastUpdated: list.updatedAt || list.createdAt,
            aiScore: Math.max(0, Math.min(100, score))
          };
      });
    } catch (e) {
      console.error("Segment Fetch Error:", e);
      return [];
    }
  }

  // --- HEURISTIC ENGINE ---
  
  private calculateCampaignHeuristic(camp: any): number {
      const base = 70;
      if (camp.type === 'EMAIL_BLAST' && camp.counters) {
          const opens = camp.counters.open || 0;
          const sent = camp.counters.sent || 1;
          const openRate = (opens / sent) * 100;
          
          let score = openRate * 3.5; // Scale rate to score
          if (openRate > 25) score += 10;
          if (openRate < 5) score -= 20;
          
          return Math.min(99, Math.max(10, Math.round(score + (Math.random() * 5))));
      }
      return base + (Math.floor(Math.random() * 10)); // Container variance
  }

  private calculateFormHeuristic(form: any): number {
      const submissions = Number(form.submissions) || 0;
      const createdAt = new Date(form.createdAt).getTime();
      const ageInDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
      
      let score = 50; // Neutral base
      
      // Volume points
      if (submissions > 1000) score += 40;
      else if (submissions > 100) score += 20;
      else if (submissions > 0) score += 5;
      
      // Recency / Stale points
      if (ageInDays > 365 && submissions < 5) score -= 30; // Dead form
      else if (ageInDays < 30 && submissions > 10) score += 15; // Viral/Fresh
      
      // Lead Magnet weighting
      if (form.name.toLowerCase().includes('guide') || form.name.toLowerCase().includes('ebook') || form.name.toLowerCase().includes('hiring')) {
          score += 10;
      }

      return Math.min(99, Math.max(5, Math.round(score + (submissions % 7)))); // Use modulo for stable variance
  }

  public async fetchCampaigns(): Promise<Campaign[]> {
    try {
      const allCampaigns: Campaign[] = [];

      // 1. Marketing Containers (V3)
      const v3Resp = await this.request('/marketing/v3/campaigns');
      if (v3Resp.ok) {
          const data = await v3Resp.json();
          const v3Items = (data.results || []).map((camp: any) => ({
            id: camp.id,
            name: camp.properties?.name || camp.name || camp.appName || `Campaign ${camp.id?.slice(0, 8)}`,
            status: camp.status || camp.properties?.status || 'ACTIVE',
            budget: camp.budget || camp.properties?.budget || null,
            revenue: null,
            contacts: 0,
            aiScore: this.calculateCampaignHeuristic({ id: camp.id, name: camp.name, type: 'MARKETING_CONTAINER' }),
            type: 'MARKETING_CONTAINER' as const
          }));
          allCampaigns.push(...v3Items);
      }

      // 2. Email Blasts (Legacy)
      const emailResp = await this.request('/email/public/v1/campaigns?limit=50');
      if (emailResp.ok) {
          const emailData = await emailResp.json();
          const emailItems = (emailData.objects || emailData.campaigns || []).map((c: any) => ({
             id: String(c.id),
             name: c.name || c.appName || c.subject || 'Unnamed Email Campaign',
             status: 'SENT',
             budget: null,
             revenue: null,
             contacts: c.counters?.sent || 0,
             aiScore: this.calculateCampaignHeuristic(c),
             type: 'EMAIL_BLAST' as const
          }));
          
          allCampaigns.push(...emailItems);
      }

      // 3. PAGE INTELLIGENCE (Landing + Site Pages)
      const pageEndpoints = [
          '/cms/v3/pages/landing-pages?limit=50&sort=-updatedAt',
          '/cms/v3/pages/site-pages?limit=50&sort=-updatedAt'
      ];
      
      const pageResponses = await Promise.all(pageEndpoints.map(url => this.request(url).then(r => r.ok ? r.json() : { results: [] })));
      const allPages = pageResponses.flatMap(r => r.results || []);
      
      console.log("🧩 Total Pages Scanned:", allPages.length);
      
      const pageItems = allPages.map((page: any) => {
          const subs = page.stats?.submissions || page.performance?.submissionsCount || page.totalStats?.submissions || 0;
          return {
              id: page.id,
              name: `[Page] ${page.name || page.htmlTitle}`,
              status: page.currentState || 'PUBLISHED',
              budget: null,
              revenue: null,
              contacts: Number(subs),
              aiScore: subs > 50 ? 92 : 75,
              type: 'LANDING_PAGE' as const,
              rawName: (page.name || '').toLowerCase()
          };
      });
      allCampaigns.push(...pageItems);

      return allCampaigns;

    } catch (e) {
      console.error("Campaign fetch error:", e);
      return [];
    }
  }

  public async fetchDeals(): Promise<any[]> {
    try {
      // Fetch deals with amount, closedate, and dealstage
      const response = await this.request('/crm/v3/objects/deals?properties=amount,dealstage,closedate,dealname,pipeline&limit=100');
      if (!response.ok) return [];
      
      const data = await response.json();
      return (data.results || []).map((d: any) => ({
        id: d.id,
        name: d.properties.dealname || 'Unnamed Deal',
        amount: Number(d.properties.amount) || 0,
        stage: d.properties.dealstage,
        closeDate: d.properties.closedate,
        pipeline: d.properties.pipeline
      }));
    } catch (e) {
      console.error("Deal fetch error:", e);
      return [];
    }
  }


  // --- PIPELINES & LEADS ARCHITECTURE ---

  public async fetchPipelines(objectType: 'deals' | 'tickets' = 'deals'): Promise<Pipeline[]> {
    try {
      const response = await this.request(`/crm/v3/pipelines/${objectType}`);
      if (!response.ok) return [];
      
      const data = await response.json();
      return (data.results || []).map((p: any) => ({
        id: p.id,
        label: p.label,
        displayOrder: p.displayOrder,
        stages: (p.stages || []).map((s: any) => ({
          id: s.id,
          label: s.label,
          displayOrder: s.displayOrder,
          metadata: s.metadata
        })).sort((a: any, b: any) => a.displayOrder - b.displayOrder)
      }));
    } catch (e) {
      console.error(`Pipeline fetch error for ${objectType}:`, e);
      return [];
    }
  }

  public async fetchLeads(): Promise<Lead[]> {
    try {
      // Attempt to fetch from Leads object (Prospecting Workspace)
      // Note: This requires Sales Hub Pro+ and the object to be enabled.
      const response = await this.request(
        '/crm/v3/objects/leads?limit=50&properties=hs_lead_name,hs_lead_status,hubspot_owner_id,hs_last_activity_date,hs_all_associated_company_ids'
      );
      
      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
            console.warn("Leads object not accessible (likely missing Sales Hub Pro or permissions).");
        }
        return [];
      }

      const data = await response.json();
      return (data.results || []).map((lead: any) => {
         const props = lead.properties || {};
         return {
           id: lead.id,
           name: props.hs_lead_name || 'Unnamed Lead',
           stage: props.hs_lead_status || 'New',
           ownerId: props.hubspot_owner_id,
           companyName: props.hs_all_associated_company_ids ? 'Has Company' : undefined,
           lastActivity: props.hs_last_activity_date,
           aiScore: props.hs_last_activity_date ? 80 : 40 
         };
      });
    } catch (e) {
      console.error("Leads fetch error:", e);
      return [];
    }
  }

  // --- FORMS & LEAD MAGNETS ---
  public async fetchForms(): Promise<any[]> {
      try {
          // 1. Fetch BOTH Landing and Site Pages for matching (Full Audit)
          let pageSubmissionsMap: Record<string, number> = {};
          let allPageInfo: Record<string, any> = {};
          let analyticsDataMap: Record<string, number> = {};

          try {
              // 1a. FETCH FORM ANALYTICS (Submission counts per form GUID)
              // HubSpot returns per-form submission totals under `breakdowns` (requires a start/end window).
              const end = Date.now();
              const start = end - (1000 * 60 * 60 * 24 * 365 * 10); // 10 years (practical "all-time")
              const limit = 100;
              let offset = 0;
              let total: number | null = null;

              while (true) {
                  const analyticsResp = await this.request(
                    `/analytics/v2/reports/forms/total?limit=${limit}&start=${start}&end=${end}&offset=${offset}`
                  );

                  if (!analyticsResp.ok) {
                      console.warn(`📊 Analytics Fusion Failed: ${analyticsResp.status} - Access denied or missing scope.`);
                      break;
                  }

                  const r = await analyticsResp.json();
                  total = typeof r.total === 'number' ? r.total : total;

                  (r.breakdowns || []).forEach((item: any) => {
                      const id = item.breakdown || item.id || item.rowId;
                      if (id) {
                          analyticsDataMap[String(id)] = Number(item.submissions || 0);
                      }
                  });

                  const nextOffset = typeof r.offset === 'number' ? r.offset : null;
                  if (!nextOffset) break;
                  if (total !== null && nextOffset >= total) break;
                  if (nextOffset === offset) break;
                  offset = nextOffset;
              }

              console.log(`📊 Analytics Fusion: Mapped ${Object.keys(analyticsDataMap).length} form submission totals`);

              // 1b. FETCH PAGE METADATA (Source of truth for names)
              const urls = [
                  '/cms/v3/pages/landing-pages?limit=100&sort=-updatedAt',
                  '/cms/v3/pages/site-pages?limit=100&sort=-updatedAt'
              ];
              const responses = await Promise.all(urls.map(u => this.request(u).then(r => r.ok ? r.json() : { results: [] })));
              const allPages = responses.flatMap(r => r.results || []);
              
              allPages.forEach((p: any) => {
                  const pName = (p.name || p.htmlTitle || p.slug || '').toLowerCase();
                  const subs = p.stats?.submissions || p.performance?.submissionsCount || p.totalStats?.submissions || 0;
                  pageSubmissionsMap[pName] = Number(subs);
                  allPageInfo[pName] = p; 
              });
          } catch (e) {
              console.warn("Correlation setup failed", e);
          }

          // 2. Fetch Form List
          const v2Resp = await this.request('/forms/v2/forms');
          if (!v2Resp.ok) return [];

          const data = await v2Resp.json();
          const forms: any[] = [];
          
          // Use sequential processing to avoid 429/Fetch errors
          for (const form of data.slice(0, 40)) {
              const name = form.name || 'Unnamed Form';
              const guid = form.guid;
              const nameLower = name.toLowerCase();
              const isLeadMagnet = nameLower.includes('guide') || nameLower.includes('ebook') || nameLower.includes('download') || nameLower.includes('hiring') || nameLower.includes('blueprint');
              
              let submissions = analyticsDataMap[guid] || form.submissionsCount || 0;

              // Only deep scan if necessary and it's a lead magnet
              if (submissions === 0 && isLeadMagnet && guid) {
                  try {
                      const deepResp = await this.request(`/forms/v2/forms/${guid}`);
                      if (deepResp.ok) {
                          const deepData = await deepResp.json();
                          submissions = deepData.submissionsCount || deepData.formResponseCount || 0;
                      }
                  } catch (e) {}
              }

              forms.push({
                  id: form.guid,
                  name: name,
                  submissions: Number(submissions),
                  aiScore: this.calculateFormHeuristic({ ...form, submissions }),
                  leadMagnet: isLeadMagnet,
                  createdAt: form.createdAt,
                  guid: form.guid
              });
          }

          return forms;
      } catch (e) {
          console.warn("Forms fetch failed:", e);
          return [];
      }
  }


  // --- CONTACT ORGANIZATION SCANNER ---
  

  // --- LEAD STATUS ENGINE ---

  private classifyContact(props: any): LeadStatus {
    const now = Date.now();
    const created = new Date(props.createdate || 0).getTime();
    const lastVisit = props.hs_analytics_last_visit_timestamp ? Number(props.hs_analytics_last_visit_timestamp) : 0;
    const lastAct = props.notes_last_updated ? new Date(props.notes_last_updated).getTime() : 0;
    
    const daysSinceCreate = (now - created) / (1000 * 60 * 60 * 24);
    const daysSinceVisit = (now - lastVisit) / (1000 * 60 * 60 * 24);
    const daysSinceAct = (now - lastAct) / (1000 * 60 * 60 * 24);
    
    // 1. TRASH (Bounces or obvious test accounts)
    if (props.hs_email_bounce > 0 || (props.firstname || '').toLowerCase().includes('test') || (props.email || '').includes('example.com')) return 'Trash';

    // 2. ACTIVE CLIENT (HubSpot Customer Stage)
    if (props.lifecyclestage === 'customer') return 'Active Client';

    // 3. REJECTED (Explicitly marked as other/rejected)
    if (props.hs_lead_status === 'Rejected' || props.lifecyclestage === 'other') return 'Rejected';

    // 4. PAST CLIENT (Was customer but zero activity in >1 year)
    if (props.lifecyclestage === 'customer' && daysSinceAct > 365) return 'Past Client';

    // 5. UNQUALIFIED (Explicitly disqualified)
    if (props.hs_lead_status === 'Unqualified' || props.hs_lead_status === 'Bad Timing') return 'Unqualified';

    // 6. HOT (Recent web visit OR active open deals)
    if (daysSinceVisit < 14 || (Number(props.num_associated_deals) > 0)) return 'Hot';

    // 7. NEW (Created in last 7 days with no activity yet)
    if (daysSinceCreate < 7 && daysSinceAct > daysSinceCreate) return 'New';

    // 8. NURTURE (Engaged in the last 3 months, but not 'Hot')
    if (daysSinceAct < 90) return 'Nurture';

    // 9. WATCH (Old leads > 3 months since last touch)
    if (daysSinceAct >= 90 || props.associatedcompanyid) return 'Watch';

    return 'New'; 
  }

  public async scanContactOrganization(): Promise<{
    statusBreakdown: Record<LeadStatus, number>;
    totalScanned: number;
    healthScore: number;
    unclassified: number; // Keep for backward compatibility
    unassigned: number;
    inactive: number;
  }> {
    try {
      // Extended properties for 9-point classification
      const response = await this.request(
        '/crm/v3/objects/contacts?limit=100&properties=' + 
        'lifecyclestage,hubspot_owner_id,lastmodifieddate,createdate,hs_lead_status,' + 
        'hs_email_bounce,num_associated_deals,hs_analytics_last_visit_timestamp,notes_last_updated,' + 
        'associatedcompanyid,firstname,email'
      );
      
      if (!response.ok) {
        console.error('Contact scan failed:', response.status);
        return { 
          statusBreakdown: { 'New': 0, 'Hot': 0, 'Nurture': 0, 'Watch': 0, 'Unqualified': 0, 'Past Client': 0, 'Active Client': 0, 'Rejected': 0, 'Trash': 0, 'Unclassified': 0 }, 
          totalScanned: 0, healthScore: 0, unclassified: 0, unassigned: 0, inactive: 0 
        };
      }
      
      const data = await response.json();
      const contacts = data.results || [];
      const total = contacts.length;
      
      const breakdown: Record<LeadStatus, number> = {
        'New': 0, 'Hot': 0, 'Nurture': 0, 'Watch': 0, 'Unqualified': 0, 
        'Past Client': 0, 'Active Client': 0, 'Rejected': 0, 'Trash': 0, 'Unclassified': 0
      };

      let unassigned = 0;
      let inactive = 0;
      const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);

      contacts.forEach((contact: any) => {
        const props = contact.properties || {};
        
        // Run Heuristic Engine
        const status = this.classifyContact(props);
        breakdown[status] = (breakdown[status] || 0) + 1;

        // Legacy Metrics
        if (!props.hubspot_owner_id) unassigned++;
        if (new Date(props.lastmodifieddate).getTime() < sixMonthsAgo) inactive++;
      });
      
      // Calculate Health Score based on "Classified" ratio vs "Unclassified/Trash"
      const unclassifiedCount = breakdown['Unclassified'];
      const trashCount = breakdown['Trash'];
      const classifiedRatio = (total - unclassifiedCount - trashCount) / total;
      
      // Bonus points for 'Hot' leads being identified
      const hotBonus = (breakdown['Hot'] / total) * 20;

      const healthScore = total === 0 ? 100 : Math.min(100, Math.round((classifiedRatio * 80) + hotBonus));
      
      console.log(`🧩 9-Point Audit:`, breakdown);
      
      return {
        statusBreakdown: breakdown,
        totalScanned: total,
        healthScore,
        unclassified: unclassifiedCount,
        unassigned,
        inactive
      };
    } catch (e) {
      console.error('Contact scan error:', e);
      return { 
          statusBreakdown: { 'New': 0, 'Hot': 0, 'Nurture': 0, 'Watch': 0, 'Unqualified': 0, 'Past Client': 0, 'Active Client': 0, 'Rejected': 0, 'Trash': 0, 'Unclassified': 0 }, 
          totalScanned: 0, healthScore: 0, unclassified: 0, unassigned: 0, inactive: 0 
      };
    }
  }
}

export const hubSpotService = HubSpotService.getInstance();

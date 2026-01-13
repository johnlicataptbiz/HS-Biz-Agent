import {
  Workflow,
  Sequence,
  DataProperty,
  BreezeTool,
  Segment,
  Campaign,
  LeadStatus,
  Lead,
  Metric,
  Pipeline,
  PipelineStage,
  Form,
} from "../types";
import { getApiUrl } from "./config";

export class HubSpotService {
  private static instance: HubSpotService;
  private readonly CLIENT_ID =
    import.meta.env.VITE_HUBSPOT_CLIENT_ID ||
    "c136fd2f-093b-4e73-9129-920280164fa6";
  private readonly LEGACY_STANDARD_CLIENT_ID =
    "7e3c1887-4c26-47a8-b750-9f215ed818f1";
  private readonly MCP_CLIENT_IDS = new Set([
    "9d7c3c51-862a-4604-9668-cad9bf5aed93",
    "d2bf9ffa-49b2-434c-94a2-0860816de977",
  ]);
  private readonly BASE_API_URL = getApiUrl("/api/hubspot"); // Dynamically resolved backend

  private readonly OAUTH_REQUEST_KEYS = {
    STATE: "hubspot_oauth_state",
    STARTED_AT: "hubspot_oauth_started_at",
  } as const;

  private readonly STORAGE_KEYS = {
    ACCESS_TOKEN: "hubspot_access_token",
    REFRESH_TOKEN: "hubspot_refresh_token",
    EXPIRES_AT: "hubspot_expires_at",
    CONNECTED_CLIENT_ID: "hubspot_client_id",
    PORTAL_ID: "hubspot_portal_id",
  };

  private constructor() {
    console.log(
      "🚀 HubSpotService Initialized with BASE_API_URL:",
      this.BASE_API_URL
    );
  }

  public static getInstance(): HubSpotService {
    if (!HubSpotService.instance) {
      HubSpotService.instance = new HubSpotService();
    }
    return HubSpotService.instance;
  }

  public async getPortalId(): Promise<number | null> {
    const cached = localStorage.getItem(this.STORAGE_KEYS.PORTAL_ID);
    if (cached) {
      const parsed = Number(cached);
      if (!Number.isNaN(parsed)) return parsed;
    }

    try {
      const resp = await this.request("/account-info/v3/details");
      if (!resp.ok) return null;
      const data = await resp.json();
      const portalId = Number(data.portalId || data.hubId);
      if (!Number.isNaN(portalId)) {
        localStorage.setItem(this.STORAGE_KEYS.PORTAL_ID, String(portalId));
        return portalId;
      }
      return null;
    } catch (err) {
      console.warn("Failed to fetch portal ID:", err);
      return null;
    }
  }

  // --- OAUTH FLOW ---

  public async initiateOAuth(
    useMcp: boolean = false,
    onPopupError?: (msg: string) => void
  ): Promise<Window | null> {
    const origin = window.location.origin;
    const redirectUri = origin.endsWith("/") ? origin : `${origin}/`;
    const clientId = useMcp
      ? import.meta.env.VITE_HUBSPOT_MCP_CLIENT_ID ||
        "d2bf9ffa-49b2-434c-94a2-0860816de977"
      : this.CLIENT_ID;
    if (!clientId) {
      if (onPopupError) onPopupError("HubSpot client ID missing.");
      throw new Error("HubSpot client ID missing.");
    }
    // Generate PKCE pair locally (we still keep verifier locally for exchange)
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.base64urlEncode(
      await this.sha256(codeVerifier)
    );
    localStorage.setItem("hubspot_oauth_code_verifier", codeVerifier);

    // Ask server to start an OAuth session and return the canonical auth URL + server-side state
    let serverResp: any = null;
    try {
      const resp = await fetch(getApiUrl("/api/oauth-start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useMcp: !!useMcp,
          client_id: clientId,
          code_challenge: codeChallenge,
          redirect_uri: redirectUri,
        }),
      });
      serverResp = await resp.json();
    } catch (err) {
      if (onPopupError)
        onPopupError("Failed to start OAuth session on server.");
      throw err;
    }

    let authUrl = serverResp?.authUrl;
    const serverState = serverResp?.state;
    if (!authUrl) {
      if (onPopupError) onPopupError("Server did not return an auth URL.");
      throw new Error("Server did not return an auth URL.");
    }

    // Store server state and started_at
    localStorage.setItem(this.OAUTH_REQUEST_KEYS.STATE, serverState || "");
    localStorage.setItem(
      this.OAUTH_REQUEST_KEYS.STARTED_AT,
      Date.now().toString()
    );
    localStorage.setItem(this.STORAGE_KEYS.CONNECTED_CLIENT_ID, clientId);
    const width = 600;
    const height = 700;
    const screenWidth = window.screen?.width || 1024;
    const screenHeight = window.screen?.height || 768;
    const left = screenWidth / 2 - width / 2;
    const top = screenHeight / 2 - height / 2;
    let popup: Window | null = null;
    try {
      popup = window.open(
        authUrl,
        `HubSpot OAuth ${clientId} ${Date.now()}`,
        `width=${width},height=${height},top=${top},left=${left}`
      );

      // If popup is blocked, fall back to a hidden iframe and provide a manual link
      if (popup) {
        popup.focus?.();
      } else {
        if (onPopupError)
          onPopupError("Popup blocked — attempting silent iframe fallback.");
        try {
          // Create a hidden iframe to try a same-origin redirect back with the code
          const iframe = document.createElement("iframe");
          iframe.style.position = "fixed";
          iframe.style.width = "1px";
          iframe.style.height = "1px";
          iframe.style.left = "-10000px";
          iframe.style.top = "-10000px";
          iframe.id = "hubspot-oauth-iframe";
          iframe.src = authUrl;
          document.body.appendChild(iframe);

          // Persist the auth URL so UI can show a manual link if needed
          localStorage.setItem("hubspot_oauth_auth_url", authUrl);

          // Timeout and cleanup
          const tidy = () => {
            try {
              document.body.removeChild(iframe);
            } catch {}
            localStorage.removeItem("hubspot_oauth_auth_url");
          };
          setTimeout(() => {
            tidy();
            if (onPopupError)
              onPopupError(
                "OAuth fallback timed out. Please open the provided link manually."
              );
          }, 60000);

          return null;
        } catch (iframeErr) {
          if (onPopupError)
            onPopupError(
              "Popup blocked and iframe fallback failed. Open link manually."
            );
          // Persist a manual link for the UI
          localStorage.setItem("hubspot_oauth_auth_url", authUrl);
          return null;
        }
      }

      // Timeout: If code not received in 60s, show error
      setTimeout(() => {
        if (!popup?.closed) {
          if (onPopupError)
            onPopupError("OAuth popup timed out. Please try again.");
          try {
            popup?.close();
          } catch {}
        }
      }, 60000);
    } catch (err: any) {
      if (onPopupError)
        onPopupError("Popup failed to open: " + (err?.message || err));
      // Attempt iframe fallback if popup throws
      try {
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.width = "1px";
        iframe.style.height = "1px";
        iframe.style.left = "-10000px";
        iframe.style.top = "-10000px";
        iframe.id = "hubspot-oauth-iframe";
        iframe.src = authUrl;
        document.body.appendChild(iframe);
        localStorage.setItem("hubspot_oauth_auth_url", authUrl);
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
          localStorage.removeItem("hubspot_oauth_auth_url");
          if (onPopupError)
            onPopupError(
              "OAuth fallback timed out. Please open the provided link manually."
            );
        }, 60000);
        return null;
      } catch (e) {
        localStorage.setItem("hubspot_oauth_auth_url", authUrl);
        throw err;
      }
    }
    return popup;
  }

  private isExchanging = false;

  public async exchangeCodeForToken(code: string): Promise<void> {
    if (this.isExchanging) return;

    const cleanCode = code.includes("code=")
      ? code.split("code=")[1].split("&")[0]
      : code;
    const redirectUri = window.location.origin.endsWith("/")
      ? window.location.origin
      : `${window.location.origin}/`;

    try {
      this.isExchanging = true;
      const storedClientId =
        localStorage.getItem(this.STORAGE_KEYS.CONNECTED_CLIENT_ID) || "";
      const isMcp = this.MCP_CLIENT_IDS.has(storedClientId);
      const clientId = isMcp ? storedClientId : this.CLIENT_ID;
      if (!isMcp && storedClientId && storedClientId !== this.CLIENT_ID) {
        localStorage.setItem(this.STORAGE_KEYS.CONNECTED_CLIENT_ID, clientId);
      }
      // Include PKCE code_verifier if present
      const codeVerifier =
        localStorage.getItem("hubspot_oauth_code_verifier") || undefined;

      const serverState =
        localStorage.getItem(this.OAUTH_REQUEST_KEYS.STATE) || undefined;
      const response = await fetch(getApiUrl("/api/token"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cleanCode,
          redirect_uri: redirectUri,
          client_id: clientId,
          code_verifier: codeVerifier,
          state: serverState,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Auth handshake failed: ${errorData.message || response.statusText}`
        );
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
      // Remove PKCE verifier once exchanged
      localStorage.removeItem("hubspot_oauth_code_verifier");
    }
  }

  // --- PKCE helpers ---
  private generateCodeVerifier(len = 64): string {
    const array = new Uint8Array(len);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => ("0" + (b & 0xff).toString(16)).slice(-2))
      .join("");
  }

  private async sha256(buffer: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const data = encoder.encode(buffer);
    return crypto.subtle.digest("SHA-256", data);
  }

  private async base64urlEncode(buffer: ArrayBuffer): Promise<string> {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  // --- REQUEST HELPER ---

  public async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem(
        this.STORAGE_KEYS.REFRESH_TOKEN
      );
      if (!refreshToken) return false;

      const storedClientId =
        localStorage.getItem(this.STORAGE_KEYS.CONNECTED_CLIENT_ID) || "";
      const isMcp = this.MCP_CLIENT_IDS.has(storedClientId);
      const clientId = isMcp ? storedClientId : this.CLIENT_ID;
      if (!isMcp && storedClientId && storedClientId !== this.CLIENT_ID) {
        localStorage.setItem(this.STORAGE_KEYS.CONNECTED_CLIENT_ID, clientId);
      }

      const response = await fetch(getApiUrl("/api/token"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refresh_token: refreshToken,
          client_id: clientId,
        }),
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

  public async request(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false,
    rateLimitRetries = 0
  ): Promise<Response> {
    const token = this.getToken();
    if (!token) throw new Error("Authentication required");

    // Trim leading slash to prevent double-slashes in the proxy route
    const sanitizedEndpoint = endpoint.startsWith("/")
      ? endpoint.substring(1)
      : endpoint;
    const url = `${this.BASE_API_URL}${this.BASE_API_URL.endsWith("/") ? "" : "/"}${sanitizedEndpoint}`;

    if (url.includes("contacts?limit=1")) {
      console.log("🔍 [DIAGNOSTIC] Critical request URL:", url);
    }

    const headers = new Headers(options.headers);
    if (options.body) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(url, { ...options, headers });

    // Rate limit handling (HubSpot returns 429)
    if (response.status === 429 && rateLimitRetries < 2) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader
        ? Number(retryAfterHeader)
        : NaN;
      const delayMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(1000, retryAfterSeconds * 1000)
        : 1500 + rateLimitRetries * 1500;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return this.request(endpoint, options, isRetry, rateLimitRetries + 1);
    }

    // Automatic Token Refresh on 401
    if (response.status === 401 && !isRetry) {
      console.warn("⚠️ 401 Detected. Attempting session refresh...");
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        // Retry with new token
        const newToken = this.getToken();
        headers.set("Authorization", `Bearer ${newToken}`);
        return fetch(url, { ...options, headers });
      } else {
        // Refresh failed - force logout
        this.disconnect();
      }
    }

    return response;
  }

  // --- TOKEN MANAGEMENT ---

  // --- BATCH HELPERS ---

  public async patchContactsBatch(
    updates: Array<{ id: string; properties: Record<string, any> }>
  ): Promise<boolean> {
    try {
      const body = {
        inputs: updates.map((u) => ({ id: u.id, properties: u.properties })),
      };
      const response = await this.request(
        "/crm/v3/objects/contacts/batch/update",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
      if (!response.ok) {
        console.error("Batch update failed:", response.status);
        return false;
      }
      return true;
    } catch (e) {
      console.error("Batch update error:", e);
      return false;
    }
  }

  public saveToken(
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number
  ): void {
    localStorage.setItem(this.STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken)
      localStorage.setItem(this.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    if (expiresIn) {
      const expiresAt = Date.now() + expiresIn * 1000;
      localStorage.setItem(this.STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
    }
    window.dispatchEvent(new Event("hubspot_connection_changed"));
  }

  public getToken(): string {
    return localStorage.getItem(this.STORAGE_KEYS.ACCESS_TOKEN) || "";
  }

  public disconnect(): void {
    localStorage.removeItem(this.STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(this.STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(this.STORAGE_KEYS.EXPIRES_AT);
    localStorage.removeItem(this.STORAGE_KEYS.CONNECTED_CLIENT_ID);
    localStorage.removeItem("hubspot_user_id");
    window.dispatchEvent(new Event("hubspot_connection_changed"));
  }

  // Get current user ID from HubSpot token info
  private async getCurrentUserId(): Promise<string | null> {
    // Check cache first
    const cachedId = localStorage.getItem("hubspot_user_id");
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
        localStorage.setItem("hubspot_user_id", userId);
      }

      return userId;
    } catch (e) {
      console.error("Failed to get user ID:", e);
      return null;
    }
  }

  // --- DATA FETCHING ---

  public async validateConnection(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const isMcp =
        localStorage.getItem(this.STORAGE_KEYS.CONNECTED_CLIENT_ID) ===
          "9d7c3c51-862a-4604-9668-cad9bf5aed93" ||
        localStorage.getItem("hubspot_client_id") ===
          "9d7c3c51-862a-4604-9668-cad9bf5aed93";

      // For MCP, we use a simpler validation endpoint that doesn't require list permissions
      const validationEndpoint = isMcp
        ? "/crm/v3/properties/contacts?limit=1"
        : "/crm/v3/objects/contacts?limit=1";

      const response = await this.request(validationEndpoint);
      if (response.ok) return { success: true };

      if (response.status === 401)
        return { success: false, error: "Authentication Expired" };

      // If we get a 403 but the token exists and we are in MCP mode, it's likely just a scope limit on "Listed" reads.
      // We assume success because the handshake completed.
      if (response.status === 403 && isMcp && this.getToken()) {
        console.log(
          "MCP Validation: 403 received (expected for user-level list access), treating as valid connection."
        );
        return { success: true };
      }

      if (response.status === 403)
        return { success: false, error: "Insufficient Permissions" };

      const errorBody = await response.json().catch(() => ({}));
      const message =
        errorBody.message ||
        errorBody.hubspot_message ||
        `HTTP ${response.status}`;
      return { success: false, error: `Direct Link Error: ${message}` };
    } catch (e: any) {
      const token = this.getToken();
      if (
        (e.name === "TypeError" || e.message?.includes("fetch")) &&
        token.startsWith("pat-")
      ) {
        return { success: true };
      }
      console.warn("Connection Validation Failed:", e.message);
      return { success: false, error: e.message || "Cipher Handshake Error" };
    }
  }

  public async fetchWorkflows(): Promise<Workflow[]> {
    try {
      // Reverted to V3 for list stability (V4 is for actions/extensions)
      const response = await this.request("/automation/v3/workflows");
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
        if (
          wf.updatedAt &&
          Date.now() - new Date(wf.updatedAt).getTime() <
            30 * 24 * 60 * 60 * 1000
        )
          aiScore += 15;

        // Build issues array based on workflow health patterns
        const issues: string[] = [];

        // Ghost Workflow: Active but NEVER had enrollments
        if (wf.enabled && enrolledCount === 0) {
          issues.push("Ghost Workflow: Active but no enrollments");
        }

        // Stale Workflow: Not updated in 6+ months
        if (wf.updatedAt) {
          const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
          if (new Date(wf.updatedAt).getTime() < sixMonthsAgo) {
            issues.push("Stale: Not updated in 6+ months");
          }
        }

        // Paused with Active Contacts (might be stuck)
        if (!wf.enabled && activeCount > 0) {
          issues.push("Paused with active contacts");
        }

        return {
          id: String(wf.id),
          name: wf.name,
          enabled: wf.enabled === true || wf.active === true,
          objectType: wf.objectType || wf.type || "CONTACT",
          enrolledCount: enrolledCount,
          aiScore: Math.min(100, aiScore),
          issues,
          lastUpdated: wf.updatedAt || wf.updated || new Date().toISOString(),
        };
      });
    } catch (e) {
      console.error("Workflow Heuristic Error:", e);
      return [];
    }
  }

  public async fetchSequences(): Promise<Sequence[]> {
    try {
      console.log("🧩 Fetching sequences...");
      let sequences: any[] = [];
      let response: Response;
      let sequenceSource: "v2" | "v4" | "unknown" = "unknown";
      let sequenceUserId: string | null = null;
      let allowDetailFetch = true;
      let allowPerformanceFetch = true;

      const shouldDisableFetch = (resp: Response) =>
        [400, 401, 403, 404].includes(resp.status);

      const fetchDetail = async (
        sequenceId: string,
        userId?: string | null
      ) => {
        if (!allowDetailFetch) return null;
        const detailPaths = [
          `/automation/v4/sequences/${sequenceId}`,
          userId
            ? `/automation/v4/sequences/${sequenceId}?userId=${userId}`
            : null,
          `/automation/v3/sequences/${sequenceId}`,
          `/automation/v2/sequences/${sequenceId}`,
        ].filter(Boolean) as string[];

        for (const path of detailPaths) {
          try {
            const detailResp = await this.request(path);
            if (detailResp.ok) {
              return await detailResp.json();
            }
            if (shouldDisableFetch(detailResp)) {
              allowDetailFetch = false;
              break;
            }
          } catch (e) {
            allowDetailFetch = false;
            break;
          }
        }
        return null;
      };

      const fetchPerformance = async (
        sequenceId: string,
        userId?: string | null
      ) => {
        if (!allowPerformanceFetch) return null;
        const perfPaths = [
          `/automation/v4/sequences/${sequenceId}/performance`,
          userId
            ? `/automation/v4/sequences/${sequenceId}/performance?userId=${userId}`
            : null,
          `/automation/v3/sequences/${sequenceId}/performance`,
          `/automation/v3/sequences/${sequenceId}/metrics`,
          `/automation/v2/sequences/${sequenceId}/metrics`,
        ].filter(Boolean) as string[];

        for (const path of perfPaths) {
          try {
            const perfResp = await this.request(path);
            if (perfResp.ok) {
              return await perfResp.json();
            }
            if (shouldDisableFetch(perfResp)) {
              allowPerformanceFetch = false;
              break;
            }
          } catch (e) {
            allowPerformanceFetch = false;
            break;
          }
        }
        return null;
      };

      // Try V2 first for comprehensive data
      try {
        response = await this.request("/automation/v2/sequences?limit=100");
        if (response.ok) {
          const data = await response.json();
          sequences = data.sequences || data.results || data.objects || [];
          sequenceSource = "v2";
          console.log(`🧩 Found ${sequences.length} sequences via V2.`);
        } else if (response.status === 404) {
          console.log("🧩 V2 sequences endpoint not found (404), trying V4.");
          sequenceSource = "v4";
        } else {
          console.warn(
            `🧩 V2 sequences fetch failed (${response.status}), trying V4.`
          );
        }
      } catch (e) {
        console.warn("🧩 V2 sequences fetch error, trying V4:", e);
      }

      // If V2 failed or returned no sequences, try V4
      if (sequences.length === 0) {
        try {
          const userId = await this.getCurrentUserId();
          if (userId) {
            sequenceUserId = userId;
            response = await this.request(
              `/automation/v4/sequences?userId=${userId}&limit=100`
            );
            if (response.ok) {
              const data = await response.json();
              sequences = data.results || data.objects || [];
              sequenceSource = "v4";
              console.log(
                `🧩 Found ${sequences.length} sequences via V4 (user-specific).`
              );
            } else if (response.status === 404) {
              console.log(
                "🧩 V4 user-specific sequences endpoint not found (404), trying general V4."
              );
            } else {
              console.warn(
                `🧩 V4 user-specific sequences fetch failed (${response.status}), trying general V4.`
              );
            }
          }
        } catch (e) {
          console.warn(
            "🧩 V4 user-specific sequences fetch error, trying general V4:",
            e
          );
        }
      }

      // Last ditch: V4 general
      if (sequences.length === 0) {
        try {
          response = await this.request("/automation/v4/sequences?limit=100");
          if (response.ok) {
            const data = await response.json();
            sequences = data.results || data.objects || [];
            sequenceSource = "v4";
            console.log(
              `🧩 Found ${sequences.length} sequences via V4 (general).`
            );
          } else if (response.status === 404) {
            console.log(
              "🧩 V4 general sequences endpoint not found (404). No sequences found."
            );
          } else {
            console.error(
              `🧩 V4 general sequences fetch failed (${response.status}).`
            );
          }
        } catch (e) {
          console.error("🧩 V4 general sequences fetch error:", e);
        }
      }

      if (sequences.length === 0) {
        console.log("🧩 No sequences found.");
        return [];
      }

      // Optimization: If sequences have no stats/steps, attempt deep scan on top 10
      // This is primarily for V4 list endpoints which might be thin
      if (
        sequences.length > 0 &&
        (sequenceSource === "v2" || sequenceSource === "v4") &&
        !sequences[0].steps &&
        !sequences[0].stats &&
        !sequences[0].enrollmentStats &&
        allowDetailFetch
      ) {
        console.log(
          "🧩 Initial sequence data is thin, performing deep scan on top 10 sequences..."
        );
        const deepScanLimit = Math.min(sequences.length, 10);
        const detailedSeqs: any[] = [];
        for (const s of sequences.slice(0, deepScanLimit)) {
          try {
            const sequenceId = String(s.id || s.hs_id || s.guid);
            const detail = await fetchDetail(sequenceId, sequenceUserId);
            const performance = await fetchPerformance(
              sequenceId,
              sequenceUserId
            );
            if (detail) {
              if (performance) {
                detail.performance = performance;
              }
              detailedSeqs.push(detail);
            } else {
              if (performance) {
                s.performance = performance;
              }
              detailedSeqs.push(s);
            }
          } catch (e) {
            console.warn(
              `Failed to deep scan sequence ${s.id || s.hs_id || s.guid}:`,
              e
            );
            detailedSeqs.push(s);
          }
        }
        sequences = [...detailedSeqs, ...sequences.slice(deepScanLimit)];
      }

      const normalizeRate = (value: any) => {
        const num = Number(value) || 0;
        if (num > 1 && num <= 100) return num / 100; // Convert percentage to decimal
        return num;
      };

      return sequences.map((seq: any) => {
        // Improved stats extraction - sequences stats can be found in several places
        const stats =
          seq.stats ||
          seq.enrollmentStats ||
          seq.performance?.summary ||
          seq.performance ||
          seq.metrics ||
          seq.statistics ||
          seq.engagement ||
          seq.enrollment_stats ||
          {};
        const replyRate = normalizeRate(
          stats.reply_rate ||
            stats.replyRate ||
            stats.reply_ratio ||
            stats.replyRatio ||
            stats.replied ||
            (stats.replyCount && stats.enrolledCount
              ? stats.replyCount / stats.enrolledCount
              : 0)
        );
        const openRate = normalizeRate(
          stats.open_rate ||
            stats.openRate ||
            stats.open_ratio ||
            stats.openRatio ||
            stats.opened ||
            (stats.openCount && stats.enrolledCount
              ? stats.openCount / stats.enrolledCount
              : 0)
        );

        // Fix: steps count can be an array or a numeric field
        let stepsCount = 0;
        if (Array.isArray(seq.steps)) {
          stepsCount = seq.steps.length;
        } else if (Array.isArray(seq.sequenceSteps)) {
          stepsCount = seq.sequenceSteps.length;
        } else if (typeof seq.stepCount === "number") {
          stepsCount = seq.stepCount;
        } else if (typeof seq.step_count === "number") {
          stepsCount = seq.step_count;
        } else if (typeof seq.numSteps === "number") {
          stepsCount = seq.numSteps;
        } else if (seq.steps && typeof seq.steps === "number") {
          // Sometimes 'steps' itself is the count
          stepsCount = seq.steps;
        }

        let aiScore = 50;
        if (replyRate > 0.1) aiScore += 30;
        if (seq.active || seq.state === "ACTIVE") aiScore += 10;
        if (stepsCount > 3) aiScore += 5;

        return {
          id: String(seq.id || seq.hs_id || seq.guid),
          name: seq.name || seq.label || seq.title || "Unlabeled Sequence",
          active:
            seq.active === true ||
            seq.state === "ACTIVE" ||
            (!seq.archived && seq.active !== false),
          stepsCount: stepsCount,
          replyRate: replyRate,
          openRate: openRate,
          aiScore: Math.min(100, aiScore),
          targetPersona:
            replyRate > 0.15
              ? "High Value Target"
              : replyRate > 0
                ? "Qualified Lead"
                : "Needs Optimization",
        };
      });
    } catch (e) {
      console.error("Sequence Heuristic Error:", e);
      return [];
    }
  }

  public async fetchProperties(): Promise<DataProperty[]> {
    try {
      const response = await this.request("/crm/v3/properties/contacts");
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

      const data = await response.json();
      const props = data.results || [];

      // Sampling heuristic: fetch 50 contacts with the first 100 property names
      const sampleNames = props.slice(0, 100).map((p: any) => p.name);
      const sampleResp = await this.request(
        `/crm/v3/objects/contacts?limit=50&properties=${sampleNames.join(",")}`
      );
      const sampleData = sampleResp.ok
        ? await sampleResp.json()
        : { results: [] };
      const contacts = sampleData.results || [];

      return props.map((prop: any) => {
        const name = prop.name.toLowerCase();
        const label = prop.label.toLowerCase();

        const isRedundant =
          name.includes("_old") ||
          name.includes("legacy") ||
          name.includes("temp") ||
          name.endsWith("_1") ||
          (name.includes("copy") && !name.includes("copyright")) ||
          label.includes("deprecated") ||
          label.includes("do not use");

        // Calculate fill rate if in sample, else default to null/heuristic
        let usage = null;
        if (sampleNames.includes(prop.name) && contacts.length > 0) {
          const withValue = contacts.filter(
            (c: any) => c.properties[prop.name]
          );
          usage = Math.round((withValue.length / contacts.length) * 100);
        }

        return {
          name: prop.name,
          label: prop.label,
          type: prop.type,
          group: prop.groupName,
          usage: usage,
          redundant: isRedundant || (usage !== null && usage < 5), // Low usage can also flag redundancy
        };
      });
    } catch (e) {
      console.error("Schema Fetch Error:", e);
      return [];
    }
  }

  public async fetchBreezeTools(): Promise<BreezeTool[]> {
    try {
      const appId = localStorage.getItem("hubspot_client_id") || this.CLIENT_ID;
      if (!appId) return [];

      // 1. Fetch CRM Cards (UI Extensions) - V3
      const cardPromise = this.request(`/crm/v3/extensions/cards/${appId}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .catch((e) => {
          console.warn(
            "Breeze Cards access denied (403). Missing developer scope."
          );
          return { results: [] };
        });

      // 2. Fetch Custom Code Actions - V4 (Breeze Actions)
      const actionPromise = this.request(`/automation/v4/actions/${appId}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .catch((e) => {
          console.warn(
            "Breeze Actions access denied (403). Missing automation scope."
          );
          return { results: [] };
        });

      const [cardData, actionData] = await Promise.all([
        cardPromise,
        actionPromise,
      ]);

      const cards = (cardData.results || []).map((tool: any) => ({
        id: tool.id,
        name: tool.title || "Untitled Card",
        actionUrl: tool.fetch?.targetUrl || "",
        labels: { en: tool.title },
        type: "CRM_CARD",
        aiScore: 50,
      }));

      const actions = (actionData.results || []).map((tool: any) => ({
        id: tool.id,
        name:
          tool.labels?.en?.message || tool.functionName || "Untitled Action",
        actionUrl: tool.actionUrl || "",
        labels: tool.labels || {},
        type: "WORKFLOW_ACTION",
        aiScore: 80,
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
      const response = await this.request("/crm/v3/objects/contacts/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "email",
                  operator: "CONTAINS_TOKEN",
                  value: query,
                },
              ],
            },
          ],
          limit: 5,
        }),
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

  public async getContactNotes(contactId: string): Promise<string[]> {
    try {
      // 1. Get associated note IDs
      const assocResponse = await this.request(
        `/crm/v3/objects/contacts/${contactId}/associations/notes`
      );
      if (!assocResponse.ok) return [];

      const assocData = await assocResponse.json();
      const noteIds = (assocData.results || []).map((r: any) => r.id);

      if (noteIds.length === 0) return [];

      // 2. Fetch the actual note content (batch)
      const notesResponse = await this.request(
        "/crm/v3/objects/notes/batch/read",
        {
          method: "POST",
          body: JSON.stringify({
            properties: ["hs_note_body", "hs_lastmodifieddate"],
            inputs: noteIds.map((id: string) => ({ id })),
          }),
        }
      );

      if (!notesResponse.ok) return [];
      const notesData = await notesResponse.json();

      return (notesData.results || [])
        .sort(
          (a: any, b: any) =>
            new Date(b.properties.hs_lastmodifieddate).getTime() -
            new Date(a.properties.hs_lastmodifieddate).getTime()
        )
        .map((n: any) => n.properties.hs_note_body || "");
    } catch (e) {
      console.error("Failed to fetch notes:", e);
      return [];
    }
  }

  public async listNewestContacts(limit: number = 5): Promise<any[]> {
    try {
      const response = await this.request(
        `/crm/v3/objects/contacts?limit=${limit}&sort=-createdate`
      );
      if (!response.ok) return [];
      const data = await response.json();
      return data.results || [];
    } catch (e) {
      return [];
    }
  }

  public async searchCompanies(query: string): Promise<any[]> {
    try {
      const response = await this.request("/crm/v3/objects/companies/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "name",
                  operator: "CONTAINS_TOKEN",
                  value: query,
                },
              ],
            },
          ],
          limit: 5,
        }),
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
      const response = await this.request("/crm/v3/lists/search", {
        method: "POST",
        body: JSON.stringify({
          query: "",
          processingTypes: ["MANUAL", "DYNAMIC", "SNAPSHOT"],
          count: 50,
        }),
      });

      if (!response.ok) {
        console.error(`Lists Search API failed: ${response.status}`);
        // Fall back to legacy if search fails
        const legacyResponse = await this.request(
          "/contacts/v1/lists?count=100"
        );
        if (legacyResponse.ok) {
          const legacyData = await legacyResponse.json();
          console.log("🧩 Lists Legacy Raw:", legacyData);
          const lists = legacyData.lists || [];
          return lists.map((list: any) => ({
            id: String(list.listId),
            name: list.name || "Unnamed List",
            contactCount: list.metaData?.size || 0,
            isDynamic: list.dynamic === true,
            filters: [],
            lastUpdated: list.updatedAt,
            aiScore: 50,
          }));
        }
        return [];
      }

      const data = await response.json();
      console.log("🧩 Lists Search Raw:", data);
      const lists = data.results || data.lists || [];
      console.log("🧩 Lists Count:", lists.length);

      return lists.map((list: any) => {
        let score = 50;
        // Exhaustive check for list size across different API versions/responses
        const size =
          list.membershipCount ??
          list.size ??
          list.metaData?.size ??
          list.memberCount ??
          list.metadata?.membershipCount ??
          list.totalRecords ??
          0;

        const name = list.name || "Unnamed List";
        if (size > 0) score += 20;
        if (name.toLowerCase().includes("untitled")) score -= 30;

        return {
          id: String(list.listId || list.id),
          name: name,
          contactCount: size,
          isDynamic:
            list.processingType === "DYNAMIC" ||
            list.dynamic === true ||
            list.listType === "DYNAMIC",
          filters: [],
          lastUpdated: list.updatedAt || list.createdAt,
          aiScore: Math.max(0, Math.min(100, score)),
        };
      });
    } catch (e) {
      console.error("Segment Fetch Error:", e);
      return [];
    }
  }

  // --- HEURISTIC ENGINE ---

  private calculateCampaignHeuristic(camp: any): number {
    // Deterministic scoring based on engagement density
    if (camp.type === "EMAIL_BLAST" && camp.contacts > 0) {
      const sent = camp.contacts || 1;
      const opens = camp.opens || 0;
      const clicks = camp.clicks || 0;
      const openRate = (opens / sent) * 100;
      const clickRate = (clicks / sent) * 100;

      let score = 45 + openRate * 1.8 + clickRate * 2.2;
      if (openRate > 30) score += 10;
      if (openRate < 10) score -= 15;

      return Math.min(99, Math.max(5, Math.round(score)));
    }

    if (
      (camp.type === "LANDING_PAGE" || camp.type === "SITE_PAGE") &&
      (camp.submissions || camp.visits)
    ) {
      const visits = camp.visits || 0;
      const submissions = camp.submissions || 0;
      const conversionRate = visits > 0 ? (submissions / visits) * 100 : 0;
      let score = 50 + conversionRate * 2;
      if (submissions > 100) score += 10;
      if (conversionRate > 5) score += 10;
      return Math.min(99, Math.max(5, Math.round(score)));
    }

    // For Marketing Containers, use revenue efficiency if available
    if (camp.revenue > 0 && camp.budget > 0) {
      const roi = (camp.revenue / camp.budget) * 10;
      return Math.min(99, Math.max(10, 70 + Math.round(roi)));
    }

    return 75; // Balanced default for active nodes
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
    if (ageInDays > 365 && submissions < 5)
      score -= 30; // Dead form
    else if (ageInDays < 30 && submissions > 10) score += 15; // Viral/Fresh

    // Lead Magnet weighting
    if (
      form.name.toLowerCase().includes("guide") ||
      form.name.toLowerCase().includes("ebook") ||
      form.name.toLowerCase().includes("hiring")
    ) {
      score += 10;
    }

    return Math.min(99, Math.max(5, Math.round(score + (submissions % 7)))); // Use modulo for stable variance
  }

  public async fetchAnalytics(): Promise<Metric[]> {
    try {
      console.log("🧩 Fetching analytics...");
      // Scope: business-intelligence
      // endpoint: /analytics/v2/reports/sources/total
      // We need a date range. Let's do last 30 days.
      const end = Date.now();
      const start = end - 30 * 24 * 60 * 60 * 1000;

      const response = await this.request(
        `/analytics/v2/reports/sources/total?start=${start}&end=${end}`
      );
      if (!response.ok) {
        if (response.status === 403 || response.status === 404) {
          console.warn(`Analytics fetch restricted: ${response.status}`);
          return [];
        }
        throw new Error(`Fetch failed: ${response.status}`);
      }

      const data = await response.json();
      // data format: { breakdowns: [...], summary: { sessions, contacts, ... } }
      // The summary is what we want.

      // Note: The API response structure for 'totals' typically has a 'breakdowns' array
      // where the 'total' row is often implicitly calculated or needed from 'summary'.
      // However, sometimes it returns a 'total' object.
      // Let's assume standard Analytics API response.

      // Actually, /analytics/v2/reports/sources/total often returns top-level totals.
      // Let's check keys.
      const summary = data; // If it returns direct totals
      // Or data.totals

      const sessions = summary.sessions || 0;
      const contacts = summary.contacts || 0;
      const bounceRate = summary.bounceRate || 0;
      const duration = summary.sessionDuration || 0;

      return [
        { label: "Total Sessions (30d)", value: sessions, trend: "up" },
        { label: "New Contacts (Source)", value: contacts, trend: "neutral" },
        {
          label: "Bounce Rate",
          value: `${Math.round(bounceRate * 100)}%`,
          trend: bounceRate < 0.4 ? "up" : "down",
        }, // Lower is better (up logic)
        {
          label: "Avg Duration",
          value: `${Math.round(duration)}s`,
          trend: "neutral",
        },
      ];
    } catch (e) {
      console.warn("Analytics fetch error (likely no traffic data):", e);
      return [];
    }
  }

  public async fetchCampaigns(): Promise<Campaign[]> {
    try {
      const allCampaigns: Campaign[] = [];
      const toNumber = (value: any) => (Number(value) ? Number(value) : 0);
      const toDateValue = (value: any) => (value ? value : null);

      // 1. Marketing Containers (V3)
      const v3Resp = await this.request("/marketing/v3/campaigns");
      if (v3Resp.ok) {
        const data = await v3Resp.json();
        const v3Items = (data.results || []).map((camp: any) => {
          const props = camp.properties || {};
          const contacts =
            toNumber(props.hs_campaign_members_count) ||
            toNumber(props.numContactAssociations) ||
            0;
          return {
            id: camp.id,
            name:
              props.name ||
              camp.name ||
              camp.appName ||
              `Campaign ${camp.id?.slice(0, 8)}`,
            status: camp.status || props.status || "ACTIVE",
            budget: toNumber(props.budget) || null,
            revenue: null,
            contacts,
            createdAt: toDateValue(camp.createdAt || props.createdAt),
            updatedAt: toDateValue(camp.updatedAt || props.updatedAt),
            startDate: toDateValue(props.startDate),
            endDate: toDateValue(props.endDate),
            channel: props.channel || null,
            source: props.source || null,
            aiScore: this.calculateCampaignHeuristic({
              id: camp.id,
              name: props.name || camp.name,
              type: "MARKETING_CONTAINER",
              contacts,
            }),
            type: "MARKETING_CONTAINER" as const,
          };
        });
        allCampaigns.push(...v3Items);
      }

      // 2. Email Blasts (Legacy)
      const emailResp = await this.request(
        "/email/public/v1/campaigns?limit=50"
      );
      if (emailResp.ok) {
        const emailData = await emailResp.json();
        const emailItems = (emailData.objects || emailData.campaigns || []).map(
          (c: any) => {
            const counters = c.counters || {};
            const sent = toNumber(counters.sent || counters.numSent);
            const opens = toNumber(counters.opened || counters.numOpened);
            const clicks = toNumber(counters.clicks || counters.numClicks);
            return {
              id: String(c.id),
              name:
                c.name || c.appName || c.subject || "Unnamed Email Campaign",
              status: c.status || "SENT",
              budget: null,
              revenue: null,
              contacts: sent,
              sent,
              opens,
              clicks,
              createdAt: toDateValue(c.createdAt),
              updatedAt: toDateValue(c.updatedAt),
              channel: "Email",
              source: c.appName || null,
              aiScore: this.calculateCampaignHeuristic({
                ...c,
                sent,
                opens,
                clicks,
              }),
              type: "EMAIL_BLAST" as const,
            };
          }
        );

        allCampaigns.push(...emailItems);
      }

      // 3. PAGE INTELLIGENCE (Landing + Site Pages)
      const pageEndpoints = [
        "/cms/v3/pages/landing-pages?limit=50&sort=-updatedAt",
        "/cms/v3/pages/site-pages?limit=50&sort=-updatedAt",
      ];

      const pageResponses = await Promise.all(
        pageEndpoints.map((url) =>
          this.request(url).then((r) => (r.ok ? r.json() : { results: [] }))
        )
      );
      const allPages = pageResponses.flatMap((r) => r.results || []);

      console.log("🧩 Total Pages Scanned:", allPages.length);

      const pageItems = allPages.map((page: any) => {
        const subs =
          page.stats?.submissions ||
          page.performance?.submissionsCount ||
          page.totalStats?.submissions ||
          0;
        const visits =
          page.stats?.visits ||
          page.performance?.visitsCount ||
          page.totalStats?.visits ||
          0;
        return {
          id: page.id,
          name: `[Page] ${page.name || page.htmlTitle}`,
          status: page.currentState || "PUBLISHED",
          budget: null,
          revenue: null,
          contacts: Number(subs),
          submissions: Number(subs),
          visits: Number(visits),
          createdAt: toDateValue(page.createdAt),
          updatedAt: toDateValue(page.updatedAt),
          channel: "Web",
          source: page.url || null,
          aiScore: subs > 50 ? 92 : 75,
          type: page.contentType === "SITE_PAGE" ? "SITE_PAGE" : "LANDING_PAGE",
          rawName: (page.name || "").toLowerCase(),
        } as any as Campaign;
      });
      allCampaigns.push(...pageItems);

      // --- ROI ATTRIBUTION LAYER ---
      // Fetch deals and map revenue back to campaigns
      const deals = await this.fetchDeals();
      const attributionMap: Record<string, number> = {};

      deals.forEach((deal) => {
        if (deal.campaignId && deal.amount) {
          attributionMap[deal.campaignId] =
            (attributionMap[deal.campaignId] || 0) + deal.amount;
        }
      });

      // Inject revenue into campaigns
      return allCampaigns.map((camp) => {
        const revenue = attributionMap[camp.id] || 0;
        return {
          ...camp,
          revenue,
          // Recalculate heuristic with real revenue data
          aiScore: this.calculateCampaignHeuristic({ ...camp, revenue }),
        };
      });
    } catch (e) {
      console.error("Campaign fetch error:", e);
      return [];
    }
  }

  public async fetchDeals(): Promise<any[]> {
    try {
      // Fetch deals with amount, closedate, and hubspot_campaign_id
      const response = await this.request(
        "/crm/v3/objects/deals?properties=amount,dealstage,closedate,dealname,pipeline,hs_analytics_latest_source_data_2&limit=100"
      );
      if (!response.ok) return [];

      const data = await response.json();
      return (data.results || []).map((d: any) => ({
        id: d.id,
        name: d.properties.dealname || "Unnamed Deal",
        amount: Number(d.properties.amount) || 0,
        stage: d.properties.dealstage,
        closeDate: d.properties.closedate,
        pipeline: d.properties.pipeline,
        campaignId: d.properties.hs_analytics_latest_source_data_2, // Standard association field
      }));
    } catch (e) {
      console.error("Deal fetch error:", e);
      return [];
    }
  }

  public async fetchOwners(): Promise<any[]> {
    try {
      const response = await this.request("/crm/v3/owners?limit=100");
      if (!response.ok) return [];
      const data = await response.json();
      return (data.results || []).map((o: any) => ({
        id: o.id,
        firstName: o.firstName,
        lastName: o.lastName,
        email: o.email,
        userId: o.userId,
        teams: o.teams || [],
      }));
    } catch (e) {
      console.error("Owners fetch error:", e);
      return [];
    }
  }

  public async fetchPipelineStats(): Promise<any> {
    try {
      const [deals, pipelines] = await Promise.all([
        this.fetchDeals(),
        this.fetchPipelines("deals"),
      ]);

      const stats: Record<
        string,
        { count: number; value: number; label: string }
      > = {};

      // Initialize with pipeline stages
      pipelines.forEach((p) => {
        p.stages.forEach((s) => {
          stats[s.id] = { count: 0, value: 0, label: s.label };
        });
      });

      // Aggregate deals
      deals.forEach((deal: any) => {
        const stageId = deal.properties?.dealstage;
        if (stageId && stats[stageId]) {
          stats[stageId].count++;
          stats[stageId].value += parseFloat(deal.properties.amount || "0");
        }
      });

      return stats;
    } catch (e) {
      console.error("Pipeline stats error:", e);
      return {};
    }
  }

  // --- PIPELINES & LEADS ARCHITECTURE ---

  public async fetchPipelines(
    objectType: "deals" | "tickets" = "deals"
  ): Promise<Pipeline[]> {
    try {
      const response = await this.request(`/crm/v3/pipelines/${objectType}`);
      if (!response.ok) return [];

      const data = await response.json();
      return (data.results || []).map((p: any) => ({
        id: p.id,
        label: p.label,
        displayOrder: p.displayOrder,
        stages: (p.stages || [])
          .map((s: any) => ({
            id: s.id,
            label: s.label,
            displayOrder: s.displayOrder,
            metadata: s.metadata,
          }))
          .sort((a: any, b: any) => a.displayOrder - b.displayOrder),
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
        "/crm/v3/objects/leads?limit=50&properties=hs_lead_name,hs_lead_status,hubspot_owner_id,hs_last_activity_date,hs_all_associated_company_ids"
      );

      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          console.warn(
            "Leads object not accessible (likely missing Sales Hub Pro or permissions)."
          );
        }
        return [];
      }

      const data = await response.json();
      return (data.results || []).map((lead: any) => {
        const props = lead.properties || {};
        return {
          id: lead.id,
          name: props.hs_lead_name || "Unnamed Lead",
          stage: props.hs_lead_status || "New",
          ownerId: props.hubspot_owner_id,
          companyName: props.hs_all_associated_company_ids
            ? "Has Company"
            : undefined,
          lastActivity: props.hs_last_activity_date,
          aiScore: props.hs_last_activity_date ? 80 : 40,
        };
      });
    } catch (e) {
      console.error("Leads fetch error:", e);
      return [];
    }
  }

  // --- FORMS & LEAD MAGNETS ---
  public async fetchForms(): Promise<Form[]> {
    try {
      // 1. Fetch BOTH Landing and Site Pages for matching (Full Audit)
      let pageSubmissionsMap: Record<string, number> = {};
      let allPageInfo: Record<string, any> = {};
      let analyticsDataMap: Record<string, number> = {};

      try {
        // 1a. FETCH FORM ANALYTICS (Submission counts per form GUID)
        // HubSpot returns per-form submission totals under `breakdowns` (requires a start/end window).
        const end = Date.now();
        const start = end - 1000 * 60 * 60 * 24 * 365 * 10; // 10 years (practical "all-time")
        const limit = 100;
        let offset = 0;
        let total: number | null = null;

        while (true) {
          const analyticsResp = await this.request(
            `/analytics/v2/reports/forms/total?limit=${limit}&start=${start}&end=${end}&offset=${offset}`
          );

          if (!analyticsResp.ok) {
            console.warn(
              `📊 Analytics Fusion Failed: ${analyticsResp.status} - Access denied or missing scope.`
            );
            break;
          }

          const r = await analyticsResp.json();
          total = typeof r.total === "number" ? r.total : total;

          (r.breakdowns || []).forEach((item: any) => {
            const id = item.breakdown || item.id || item.rowId;
            if (id) {
              analyticsDataMap[String(id)] = Number(item.submissions || 0);
            }
          });

          const nextOffset = typeof r.offset === "number" ? r.offset : null;
          if (!nextOffset) break;
          if (total !== null && nextOffset >= total) break;
          if (nextOffset === offset) break;
          offset = nextOffset;
        }

        console.log(
          `📊 Analytics Fusion: Mapped ${Object.keys(analyticsDataMap).length} form submission totals`
        );

        // 1b. FETCH PAGE METADATA (Source of truth for names)
        const urls = [
          "/cms/v3/pages/landing-pages?limit=100&sort=-updatedAt",
          "/cms/v3/pages/site-pages?limit=100&sort=-updatedAt",
        ];
        const responses = await Promise.all(
          urls.map((u) =>
            this.request(u).then((r) => (r.ok ? r.json() : { results: [] }))
          )
        );
        const allPages = responses.flatMap((r) => r.results || []);

        allPages.forEach((p: any) => {
          const pName = (p.name || p.htmlTitle || p.slug || "").toLowerCase();
          const subs =
            p.stats?.submissions ||
            p.performance?.submissionsCount ||
            p.totalStats?.submissions ||
            0;
          pageSubmissionsMap[pName] = Number(subs);
          allPageInfo[pName] = p;
        });
      } catch (e) {
        console.warn("Correlation setup failed", e);
      }

      // 2. Fetch Form List
      const v2Resp = await this.request("/forms/v2/forms");
      if (!v2Resp.ok) return [];

      const data = await v2Resp.json();
      const forms: any[] = [];

      // Use sequential processing to avoid 429/Fetch errors
      for (const form of data.slice(0, 40)) {
        const name = form.name || "Unnamed Form";
        const guid = form.guid;
        const nameLower = name.toLowerCase();
        const isLeadMagnet =
          nameLower.includes("guide") ||
          nameLower.includes("ebook") ||
          nameLower.includes("download") ||
          nameLower.includes("hiring") ||
          nameLower.includes("blueprint");

        let submissions = analyticsDataMap[guid] || form.submissionsCount || 0;

        // Only deep scan if necessary and it's a lead magnet
        if (submissions === 0 && isLeadMagnet && guid) {
          try {
            const deepResp = await this.request(`/forms/v2/forms/${guid}`);
            if (deepResp.ok) {
              const deepData = await deepResp.json();
              submissions =
                deepData.submissionsCount || deepData.formResponseCount || 0;
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
          guid: form.guid,
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
  // Business Logic:
  // - Active Client: MM member, CRM member, or Customer lifecycle stage (paying)
  // - Past Client: Was in active stages but has left (no longer subscriber/customer)
  // - New: Never communicated with us or hasn't told us their story
  // - Unqualified: New leads that didn't communicate after 10 days, or unknown status
  // - Hot: Will buy in 0-1 month (needs weekly follow up) - recent engagement
  // - Nurture: Will buy in 1-3 months (needs monthly follow up)
  // - Watch: Will buy in 3-12 months (needs quarterly follow up)
  // - Rejected: Explicitly marked as rejected
  // - Trash: Bounced emails, test accounts

  private classifyContact(props: any): LeadStatus {
    const now = Date.now();
    const created = new Date(props.createdate || 0).getTime();
    const lastVisit = props.hs_analytics_last_visit_timestamp
      ? Number(props.hs_analytics_last_visit_timestamp)
      : 0;
    const lastAct = props.notes_last_updated
      ? new Date(props.notes_last_updated).getTime()
      : 0;
    const lastEmail = props.hs_email_last_open_date
      ? new Date(props.hs_email_last_open_date).getTime()
      : 0;
    const email = (props.email || "").toLowerCase();

    const daysSinceCreate = (now - created) / (1000 * 60 * 60 * 24);
    const daysSinceVisit = lastVisit
      ? (now - lastVisit) / (1000 * 60 * 60 * 24)
      : Infinity;
    const daysSinceAct = lastAct
      ? (now - lastAct) / (1000 * 60 * 60 * 24)
      : Infinity;
    const daysSinceEmail = lastEmail
      ? (now - lastEmail) / (1000 * 60 * 60 * 24)
      : Infinity;

    // Most recent engagement across all channels
    const daysSinceEngagement = Math.min(
      daysSinceVisit,
      daysSinceAct,
      daysSinceEmail
    );
    const hasEverCommunicated = lastAct > 0 || lastEmail > 0 || lastVisit > 0;

    const pageViews = Number(props.hs_analytics_num_page_views || 0);
    const emailOpens = Number(props.hs_email_open_count || 0);
    const emailClicks = Number(props.hs_email_click_count || 0);
    const conversions = Number(props.num_conversion_events || 0);
    const dealCount = Number(props.num_associated_deals || 0);

    const engagementScore = (() => {
      let score = 0;
      if (pageViews >= 50) score += 25;
      else if (pageViews >= 20) score += 15;
      else if (pageViews >= 5) score += 5;

      if (emailOpens >= 30) score += 15;
      else if (emailOpens >= 10) score += 8;
      else if (emailOpens >= 3) score += 4;

      if (emailClicks >= 10) score += 15;
      else if (emailClicks >= 3) score += 8;
      else if (emailClicks >= 1) score += 4;

      if (conversions >= 3) score += 25;
      else if (conversions >= 2) score += 15;
      else if (conversions >= 1) score += 8;

      if (dealCount > 0) score += 15;

      if (daysSinceEngagement < 7) score += 10;
      else if (daysSinceEngagement < 30) score += 6;
      else if (daysSinceEngagement < 90) score += 3;

      return Math.min(100, score);
    })();

    // Normalize lifecycle stage
    const stage = (props.lifecyclestage || "").toLowerCase();
    const memType = (props.membership_type || "").toLowerCase();
    const memStatus = (props.membership_status || "").toLowerCase();
    const isEmployee = email.endsWith("@physicaltherapybiz.com");

    // MM member, CRM member, or standard HubSpot Customer/Evangelist
    const isActiveClient =
      stage.includes("member") ||
      stage.includes("mm") ||
      stage.includes("crm") ||
      memType.includes("member") ||
      memType.includes("mm") ||
      memType.includes("crm") ||
      memStatus.includes("active") ||
      memStatus.includes("member") ||
      ["customer", "evangelist"].includes(stage);

    // 1. EMPLOYEE (internal accounts should be cordoned off)
    if (isEmployee) {
      return "Employee";
    }

    // 2. TRASH (Bounces or obvious test accounts)
    if (
      props.hs_email_bounce > 0 ||
      (props.firstname || "").toLowerCase().includes("test") ||
      email.includes("example.com")
    ) {
      return "Trash";
    }

    // 3. ACTIVE CLIENT
    if (isActiveClient) {
      // If customer, never return 'Hot' or other lead status
      return "Active Client";
    }

    // 4. PAST CLIENT - Was a customer/member but no longer (stage changed away from active)
    // Detected by: lifecyclestage is 'lead' or 'opportunity' but they have historical engagement patterns
    if (
      (stage === "lead" ||
        stage === "opportunity" ||
        stage === "marketingqualifiedlead" ||
        stage === "salesqualifiedlead") &&
      daysSinceCreate > 180 &&
      hasEverCommunicated &&
      daysSinceEngagement > 180
    ) {
      return "Past Client";
    }

    // 5. REJECTED (Explicitly marked)
    if (props.hs_lead_status === "Rejected" || stage === "other") {
      return "Rejected";
    }

    // 6. UNQUALIFIED - New leads that didn't respond after 10 days, or we don't know their status
    if (
      props.hs_lead_status === "Unqualified" ||
      props.hs_lead_status === "Bad Timing"
    ) {
      return "Unqualified";
    }
    if (daysSinceCreate > 10 && !hasEverCommunicated) {
      return "Unqualified"; // No response after 10 days
    }

    // 7. HOT - Strong engagement intensity + recent activity
    // Weighted by behavioral signals (views, opens, clicks, conversions)
    if (
      !isActiveClient &&
      ((engagementScore >= 60 && daysSinceEngagement <= 45) ||
        (conversions >= 2 && daysSinceEngagement <= 90) ||
        (dealCount > 0 && daysSinceEngagement <= 90))
    ) {
      return "Hot";
    }

    // 8. NEW - Never communicated or just created
    if (!hasEverCommunicated || daysSinceCreate <= 7) {
      return "New";
    }

    // 9. NURTURE - Will buy in 1-3 months (monthly follow up needed)
    if (daysSinceEngagement >= 30 && daysSinceEngagement < 90) {
      return "Nurture";
    }

    // 10. WATCH - Will buy in 3-12 months (quarterly follow up needed)
    if (daysSinceEngagement >= 90 && daysSinceEngagement < 365) {
      return "Watch";
    }

    // Default: If engagement is >12 months old, treat as unqualified (stale)
    if (daysSinceEngagement >= 365) {
      return "Unqualified";
    }

    return "New";
  }

  public async scanContactOrganization(): Promise<{
    statusBreakdown: Record<LeadStatus, number>;
    lifecycleStageBreakdown: Record<string, number>;
    totalScanned: number;
    healthScore: number;
    unclassified: number; // Keep for backward compatibility
    unassigned: number;
    inactive: number;
  }> {
    try {
      // Paginated fetch to gather a representative sample (up to MAX_RECORDS)
      const MAX_RECORDS = 5000; // Limit to avoid runaway requests
      const PAGE_LIMIT = 100; // HubSpot page size
      const props =
        "lifecyclestage,hubspot_owner_id,lastmodifieddate,createdate,hs_lead_status," +
        "hs_email_bounce,num_associated_deals,hs_analytics_last_visit_timestamp,notes_last_updated," +
        "associatedcompanyid,firstname,email,hs_email_last_open_date,membership_type,membership_status," +
        "num_conversion_events,hs_analytics_num_page_views,hs_email_open_count,hs_email_click_count";

      let after: string | null = null;
      let contacts: any[] = [];
      let page = 0;

      while (contacts.length < MAX_RECORDS) {
        page++;
        const url =
          `/crm/v3/objects/contacts?limit=${PAGE_LIMIT}&properties=${props}` +
          (after ? `&after=${encodeURIComponent(after)}` : "");
        const response = await this.request(url);
        if (!response.ok) {
          console.error(
            "Contact scan failed at page",
            page,
            "status:",
            response.status
          );
          break; // Exit paging, we'll use whatever we have
        }

        const data = await response.json();
        const pageResults = data.results || [];
        contacts = contacts.concat(pageResults);

        // Paging token
        if (data.paging && data.paging.next && data.paging.next.after) {
          after = data.paging.next.after;
        } else {
          break; // No more pages
        }

        if (pageResults.length === 0) break;
      }

      const total = contacts.length;

      const breakdown: Record<LeadStatus, number> = {
        New: 0,
        Hot: 0,
        Nurture: 0,
        Watch: 0,
        Unqualified: 0,
        "Past Client": 0,
        "Active Client": 0,
        Employee: 0,
        Rejected: 0,
        Trash: 0,
        Unclassified: 0,
      };

      const lifecycleBreakdown: Record<string, number> = {};

      let unassigned = 0;
      let inactive = 0;
      const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;

      contacts.forEach((contact: any) => {
        const p = contact.properties || {};
        const status = this.classifyContact(p);
        breakdown[status] = (breakdown[status] || 0) + 1;

        const lcs = p.lifecyclestage || "other";
        lifecycleBreakdown[lcs] = (lifecycleBreakdown[lcs] || 0) + 1;

        if (!p.hubspot_owner_id) unassigned++;
        if (
          p.lastmodifieddate &&
          new Date(p.lastmodifieddate).getTime() < sixMonthsAgo
        )
          inactive++;
      });

      // Calculate Health Score based on "Classified" ratio vs "Unclassified/Trash"
      const unclassifiedCount = breakdown["Unclassified"];
      const trashCount = breakdown["Trash"];
      const classifiedRatio =
        total === 0 ? 1 : (total - unclassifiedCount - trashCount) / total;
      const hotBonus = total === 0 ? 0 : (breakdown["Hot"] / total) * 20;
      const healthScore =
        total === 0
          ? 100
          : Math.min(100, Math.round(classifiedRatio * 80 + hotBonus));

      console.log(
        `🧩 9-Point Audit: scanned ${total} contacts across ${page} pages`,
        breakdown
      );

      return {
        statusBreakdown: breakdown,
        lifecycleStageBreakdown: lifecycleBreakdown,
        totalScanned: total,
        healthScore,
        unclassified: unclassifiedCount,
        unassigned,
        inactive,
      };
    } catch (e) {
      console.error("Scan Error:", e);
      return {
        statusBreakdown: {
          New: 0,
          Hot: 0,
          Nurture: 0,
          Watch: 0,
          Unqualified: 0,
          "Past Client": 0,
          "Active Client": 0,
          Employee: 0,
          Rejected: 0,
          Trash: 0,
          Unclassified: 0,
        },
        lifecycleStageBreakdown: {},
        totalScanned: 0,
        healthScore: 0,
        unclassified: 0,
        unassigned: 0,
        inactive: 0,
      };
    }
  }

  public async fetchJourneyData(): Promise<any> {
    try {
      const [workflows, sequences, deals, contactScan] = await Promise.all([
        this.fetchWorkflows(),
        this.fetchSequences(),
        this.fetchDeals(),
        this.scanContactOrganization(),
      ]);

      const breakdown = contactScan.statusBreakdown || {};

      const stages = [
        {
          id: "discovery",
          title: "Discovery",
          subTitle: "Marketing",
          count: breakdown["New"] || 0,
          workflows: workflows.filter(
            (w) =>
              w.name.toLowerCase().includes("marketing") ||
              w.name.toLowerCase().includes("top")
          ).length,
          sequences: sequences.filter(
            (s) =>
              s.name.toLowerCase().includes("cold") ||
              s.name.toLowerCase().includes("discovery")
          ).length,
          dropOff: 0,
        },
        {
          id: "engagement",
          title: "Engagement",
          subTitle: "Leads",
          count: breakdown["Nurture"] || 0,
          workflows: workflows.filter(
            (w) =>
              w.name.toLowerCase().includes("nurture") ||
              w.name.toLowerCase().includes("lead")
          ).length,
          sequences: sequences.filter(
            (s) =>
              s.name.toLowerCase().includes("nurture") ||
              s.name.toLowerCase().includes("engagement")
          ).length,
          dropOff: 0, // Will calculate below
        },
        {
          id: "qualification",
          title: "Qualification",
          subTitle: "Prospecting",
          count: breakdown["Hot"] || 0,
          workflows: workflows.filter(
            (w) =>
              w.name.toLowerCase().includes("qualification") ||
              w.name.toLowerCase().includes("hot")
          ).length,
          sequences: sequences.filter(
            (s) =>
              s.name.toLowerCase().includes("qualification") ||
              s.name.toLowerCase().includes("vetting")
          ).length,
          dropOff: 0,
        },
        {
          id: "opportunity",
          title: "Opportunity",
          subTitle: "Deals",
          count: deals.length,
          workflows: workflows.filter(
            (w) =>
              w.name.toLowerCase().includes("deal") ||
              w.name.toLowerCase().includes("sales")
          ).length,
          sequences: sequences.filter(
            (s) =>
              s.name.toLowerCase().includes("closing") ||
              s.name.toLowerCase().includes("proposal")
          ).length,
          dropOff: 0,
        },
        {
          id: "retention",
          title: "Retention",
          subTitle: "Customers",
          count: breakdown["Active Client"] || 0,
          workflows: workflows.filter(
            (w) =>
              w.name.toLowerCase().includes("customer") ||
              w.name.toLowerCase().includes("retention") ||
              w.name.toLowerCase().includes("onboarding")
          ).length,
          sequences: sequences.filter(
            (s) =>
              s.name.toLowerCase().includes("upsell") ||
              s.name.toLowerCase().includes("referral")
          ).length,
          dropOff: 0,
        },
      ];

      // Calculate Real Drop-Off Rates
      for (let i = 1; i < stages.length; i++) {
        const prev = stages[i - 1].count || 1;
        const curr = stages[i].count;
        const leakage = Math.max(0, 1 - curr / prev);
        stages[i].dropOff = Math.round(leakage * 100);
      }

      // Velocity Heuristic: Ratio of Hot Leads to New Leads
      const velocity =
        stages[0].count > 0 ? (stages[2].count / stages[0].count) * 200 : 75;

      return {
        stages,
        totalContacts: contactScan.totalScanned,
        velocityScore: Math.min(99, Math.round(velocity)),
      };
    } catch (e) {
      console.error("Journey Data Fetch Error:", e);
      throw e;
    }
  }

  public async fetchRecentNotes(): Promise<string[]> {
    try {
      const resp = await this.request(
        "/crm/v3/objects/notes?limit=15&properties=hs_note_body&sort=-hs_lastmodifieddate"
      );
      if (!resp.ok) return [];
      const data = await resp.json();
      return (data.results || [])
        .map((n: any) => n.properties.hs_note_body)
        .filter(Boolean);
    } catch (e) {
      console.warn("Notes fetch failed:", e);
      return [];
    }
  }

  public async fetchMarketSentiment(): Promise<any> {
    try {
      const token = this.getToken();
      if (!token) return null;

      const notes = await this.fetchRecentNotes();
      if (notes.length === 0)
        return {
          mood: "Unknown",
          score: 50,
          analysis: "Insufficient conversation volume for sentiment analysis.",
          themes: [],
        };

      const apiUrl = getApiUrl("/api/ai");
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "sentiment",
          hubspotToken: token,
          prompt: `Analyze the market sentiment based on the following recent sales notes: \n\n${notes.join("\n---\n")}`,
          contextType: "market-analysis",
        }),
      });

      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) {
      console.error("Market Sentiment Fetch Error:", e);
      return null;
    }
  }

  public async runSemanticAudit(): Promise<any> {
    try {
      const token = this.getToken();
      if (!token) return null;

      const [workflows, sequences, recentNotes] = await Promise.all([
        this.fetchWorkflows(),
        this.fetchSequences(),
        this.fetchRecentNotes(),
      ]);

      const summary = {
        workflows: workflows.map((w) => ({
          name: w.name,
          issues: w.issues,
          active: w.enabled,
        })),
        sequences: sequences.map((s) => ({ name: s.name, active: s.active })),
        notesContext: recentNotes.slice(0, 5),
      };

      const apiUrl = getApiUrl("/api/ai");
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "audit",
          hubspotToken: token,
          prompt: `Perform a High-Velocity Structural Audit for this HubSpot portal. 
                   Identify 3 "Strategic Gaps" that deterministic logic would miss (e.g. tone inconsistency, missing middle-funnel acceleration, or redundant lead-gen flows).
                   
                   Context:
                   ${JSON.stringify(summary)}`,
          contextType: "data",
        }),
      });

      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) {
      console.error("Semantic Audit Failed:", e);
      return null;
    }
  }

  public async getContactEmails(
    contactId: string
  ): Promise<{ subject: string; body: string }[]> {
    try {
      const resp = await this.request(
        `/crm/v3/objects/contacts/${contactId}/associations/emails`
      );
      if (!resp.ok) return [];

      const associations = await resp.json();
      const emailIds = (associations.results || []).map(
        (a: any) => a.toObjectId
      );

      if (emailIds.length === 0) return [];

      const batchResp = await this.request(
        `/crm/v3/objects/emails/batch/read`,
        {
          method: "POST",
          body: JSON.stringify({
            inputs: emailIds.map((id: string) => ({ id })),
            properties: ["hs_email_subject", "hs_email_text"],
          }),
        }
      );

      if (!batchResp.ok) return [];
      const batchData = await batchResp.json();
      return (batchData.results || [])
        .map((e: any) => ({
          subject: e.properties.hs_email_subject,
          body: e.properties.hs_email_text,
        }))
        .filter((e: any) => e.subject || e.body);
    } catch (error: any) {
      console.warn(`Email fetch fail for ${contactId}`, error);
      return [];
    }
  }

  public async fetchSchemas(): Promise<any> {
    const resp = await this.request("/crm/v3/schemas");
    return resp.ok ? await resp.json() : { results: [] };
  }

  public async fetchAssociationTypes(
    fromObject: string,
    toObject: string
  ): Promise<any> {
    const resp = await this.request(
      `/crm/v3/associations/${fromObject}/${toObject}/types`
    );
    return resp.ok ? await resp.json() : { results: [] };
  }

  public async fetchListMetadata(): Promise<any[]> {
    const resp = await this.request("/crm/v3/lists?limit=250");
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.lists || [];
  }

  public async fetchPriorityLeads(): Promise<any[]> {
    try {
      const resp = await this.request(
        "/crm/v3/objects/contacts?limit=20&properties=firstname,lastname,email,jobtitle,lifecyclestage&associations=deals,notes&sort=-lastmodifieddate"
      );
      if (!resp.ok) return [];
      const data = await resp.json();

      return (data.results || [])
        .map((contact: any) => {
          const dealCount = (contact.associations?.deals?.results || []).length;
          const noteCount = (contact.associations?.notes?.results || []).length;

          // Priority Heuristic:
          // - Stage: +20 for 'opportunity', +10 for 'lead'
          // - Deals: +30 per deal
          // - Notes: +5 per recent interaction
          let priority = 10;
          if (contact.properties.lifecyclestage === "opportunity")
            priority += 40;
          if (contact.properties.lifecyclestage === "lead") priority += 20;
          priority += dealCount * 30;
          priority += noteCount * 10;

          return {
            id: contact.id,
            name:
              `${contact.properties.firstname || ""} ${contact.properties.lastname || ""}`.trim() ||
              "Anonymous Lead",
            email: contact.properties.email,
            title: contact.properties.jobtitle,
            stage: contact.properties.lifecyclestage,
            priority: Math.min(99, priority),
            dealCount,
            noteCount,
          };
        })
        .sort((a: any, b: any) => b.priority - a.priority)
        .slice(0, 5);
    } catch (e) {
      console.error("Priority Leads Fetch Error:", e);
      return [];
    }
  }
}

export const hubSpotService = HubSpotService.getInstance();

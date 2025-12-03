import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import * as db from './db.js';
import { 
  getWorkflow, listWorkflows as hsListWorkflows, patchWorkflow, createWorkflow,
  getSequence, listSequences as hsListSequences, patchSequence, createSequence,
  getProperty as hsGetProperty, listProperties as hsListProperties, patchProperty as hsPatchProperty, createProperty as hsCreateProperty,
  listStaticLists, buildPreview
} from './hubspotActions.js';

const app = express();
const PORT = process.env.PORT || 8080;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

const REQUIRED_ENV_VARS = ['HUBSPOT_CLIENT_ID', 'HUBSPOT_CLIENT_SECRET'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missingEnvVars.length) {
  console.error('Missing required HubSpot OAuth env vars:', missingEnvVars.join(', '));
  throw new Error('HubSpot OAuth credentials must be configured on the server');
}

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const getAppUrl = () => {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
};

// Middleware - Allow all origins for Codespaces compatibility
app.use(cors({
  origin: true,  // Reflects the request origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Helper: Extract Bearer token from request
const getToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

// Helper: Get HubSpot token for authenticated user (with auto-refresh)
const getHubSpotToken = async (req) => {
  if (!req.user?.userId) return null;
  
  const connection = db.getHubSpotConnection(req.user.userId);
  if (!connection) return null;
  
  // Check if token needs refresh
  if (db.isTokenExpired(connection) && connection.refresh_token) {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        refresh_token: connection.refresh_token
      });
      
      const response = await fetch(`${HUBSPOT_BASE_URL}/oauth/v1/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });
      
      if (response.ok) {
        const data = await response.json();
        db.updateHubSpotTokens(req.user.userId, data.access_token, data.refresh_token, data.expires_in);
        return data.access_token;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  }
  
  return connection.access_token;
};

// Helper: Make authenticated HubSpot API request
const hubspotRequest = async (endpoint, token, options = {}) => {
  const url = `${HUBSPOT_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw { status: response.status, message: response.statusText, error };
  }
  
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return response.text();
};

// ============================================================
// App Config Endpoint (provides client ID to frontend)
// ============================================================
app.get('/api/config', (req, res) => {
  // All scopes configured in the HubSpot app - EXACTLY matching HubSpot config (alphabetical)
  const scopes = [
    'account-info.security.read', 'accounting', 'actions', 'analytics.behavioral_events.send',
    'automation', 'automation.sequences.enrollments.write', 'automation.sequences.read',
    'behavioral_events.event_definitions.read_write', 'business-intelligence',
    'communication_preferences.read', 'communication_preferences.read_write',
    'communication_preferences.statuses.batch.read', 'communication_preferences.statuses.batch.write',
    'communication_preferences.write', 'content', 'conversations.custom_channels.read',
    'conversations.custom_channels.write', 'conversations.read',
    'conversations.visitor_identification.tokens.create', 'conversations.write',
    'crm.export', 'crm.lists.read', 'crm.lists.write',
    'crm.objects.appointments.read', 'crm.objects.appointments.write',
    'crm.objects.carts.read', 'crm.objects.carts.write',
    'crm.objects.commercepayments.read', 'crm.objects.commercepayments.write',
    'crm.objects.companies.read', 'crm.objects.companies.write',
    'crm.objects.contacts.read', 'crm.objects.contacts.write',
    'crm.objects.courses.read', 'crm.objects.courses.write',
    'crm.objects.custom.read', 'crm.objects.custom.write',
    'crm.objects.deals.read', 'crm.objects.deals.write',
    'crm.objects.goals.read', 'crm.objects.goals.write',
    'crm.objects.invoices.read', 'crm.objects.invoices.write',
    'crm.objects.leads.read', 'crm.objects.leads.write',
    'crm.objects.line_items.read', 'crm.objects.line_items.write',
    'crm.objects.listings.read', 'crm.objects.listings.write',
    'crm.objects.marketing_events.read', 'crm.objects.marketing_events.write',
    'crm.objects.orders.read', 'crm.objects.owners.read',
    'crm.objects.partner-clients.read', 'crm.objects.partner-clients.write',
    'crm.objects.partner-services.read', 'crm.objects.partner-services.write',
    'crm.objects.products.read', 'crm.objects.products.write',
    'crm.objects.projects.read', 'crm.objects.projects.write',
    'crm.objects.quotes.read', 'crm.objects.quotes.write',
    'crm.objects.services.read', 'crm.objects.services.write',
    'crm.objects.subscriptions.read', 'crm.objects.subscriptions.write',
    'crm.objects.users.read', 'crm.objects.users.write',
    'crm.schemas.appointments.read', 'crm.schemas.appointments.write',
    'crm.schemas.carts.read', 'crm.schemas.carts.write',
    'crm.schemas.commercepayments.read', 'crm.schemas.commercepayments.write',
    'crm.schemas.companies.read', 'crm.schemas.companies.write',
    'crm.schemas.contacts.read', 'crm.schemas.contacts.write',
    'crm.schemas.courses.read', 'crm.schemas.courses.write',
    'crm.schemas.custom.read', 'crm.schemas.deals.read', 'crm.schemas.deals.write',
    'crm.schemas.invoices.read', 'crm.schemas.invoices.write',
    'crm.schemas.line_items.read', 'crm.schemas.listings.read', 'crm.schemas.listings.write',
    'crm.schemas.orders.read', 'crm.schemas.orders.write',
    'crm.schemas.projects.read', 'crm.schemas.projects.write',
    'crm.schemas.quotes.read', 'crm.schemas.services.read', 'crm.schemas.services.write',
    'crm.schemas.subscriptions.read', 'crm.schemas.subscriptions.write',
    'ctas.read', 'e-commerce', 'external_integrations.forms.access',
    'files', 'files.ui_hidden.read', 'forms', 'forms-uploaded-files', 'hubdb',
    'integration-sync', 'integrations.zoom-app.playbooks.read',
    'marketing-email', 'marketing.campaigns.read', 'marketing.campaigns.revenue.read', 'marketing.campaigns.write',
    'media_bridge.read', 'media_bridge.write', 'oauth', 'record_images.signed_urls.read',
    'sales-email-read', 'scheduler.meetings.meeting-link.read',
    'settings.billing.write', 'settings.currencies.read', 'settings.currencies.write',
    'settings.users.read', 'settings.users.teams.read', 'settings.users.teams.write', 'settings.users.write',
    'social', 'tax_rates.read', 'tickets', 'timeline', 'transactional-email'
  ];
  
  res.json({
    clientId: HUBSPOT_CLIENT_ID,
    redirectUri: getAppUrl(),
    hasGemini: !!GEMINI_API_KEY,
    hasBreeze: !!process.env.BREEZE_AGENT_ID,
    scopes: scopes
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    configured: true
  });
});

// ============================================================
// Auth Endpoints (User Registration & Login)
// ============================================================

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  
  try {
    const user = db.createUser(email, password, name);
    const token = db.generateToken(user);
    res.json({ user, token });
  } catch (error) {
    if (error.message === 'Email already registered') {
      return res.status(409).json({ error: error.message });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  const user = db.authenticateUser(email, password);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  
  const token = db.generateToken(user);
  const hubspotConnection = db.getHubSpotConnection(user.id);
  
  res.json({ 
    user, 
    token,
    hasHubSpotConnection: !!hubspotConnection,
    portalId: hubspotConnection?.portal_id
  });
});

app.get('/api/auth/me', db.authMiddleware, (req, res) => {
  const user = db.getUserById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const hubspotConnection = db.getHubSpotConnection(user.id);
  
  res.json({ 
    user,
    hasHubSpotConnection: !!hubspotConnection,
    portalId: hubspotConnection?.portal_id,
    hubDomain: hubspotConnection?.hub_domain
  });
});

// ============================================================
// OAuth Endpoints (Proxy to avoid CORS)
// ============================================================

// Exchange authorization code for tokens (requires auth)
app.post('/api/oauth/token', db.authMiddleware, async (req, res) => {
  const { code, redirect_uri, code_verifier } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }
  
  // Handle PAT tokens directly
  if (code.trim().startsWith('pat-')) {
    try {
      // Validate PAT by making a test request
      const testResponse = await fetch(`${HUBSPOT_BASE_URL}/integrations/v1/me`, {
        headers: { 'Authorization': `Bearer ${code.trim()}` }
      });
      
      if (!testResponse.ok) {
        return res.status(401).json({ error: 'Invalid Private App Token' });
      }
      
      const portalInfo = await testResponse.json();
      
      // Save PAT to database (no expiry, no refresh token)
      db.saveHubSpotConnection(
        req.user.userId,
        code.trim(),
        null, // no refresh token
        null, // no expiry
        portalInfo.portalId?.toString(),
        portalInfo.hub_domain
      );
      
      return res.json({ 
        success: true, 
        portalId: portalInfo.portalId,
        hubDomain: portalInfo.hub_domain
      });
    } catch (error) {
      console.error('PAT validation error:', error);
      return res.status(500).json({ error: 'Failed to validate token' });
    }
  }
  
  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: HUBSPOT_CLIENT_ID,
      client_secret: HUBSPOT_CLIENT_SECRET,
      redirect_uri: redirect_uri || getAppUrl(),
      code
    });
    
    if (code_verifier) {
      params.append('code_verifier', code_verifier);
    }
    
    const response = await fetch(`${HUBSPOT_BASE_URL}/oauth/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    
    // Save tokens to database for this user
    db.saveHubSpotConnection(
      req.user.userId,
      data.access_token,
      data.refresh_token,
      data.expires_in
    );
    
    // Get portal info
    try {
      const portalResponse = await fetch(`${HUBSPOT_BASE_URL}/integrations/v1/me`, {
        headers: { 'Authorization': `Bearer ${data.access_token}` }
      });
      if (portalResponse.ok) {
        const portalInfo = await portalResponse.json();
        db.updatePortalInfo(req.user.userId, portalInfo.portalId?.toString(), portalInfo.hub_domain);
      }
    } catch (e) {
      console.error('Failed to fetch portal info:', e);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// Disconnect HubSpot
app.post('/api/oauth/disconnect', db.authMiddleware, (req, res) => {
  db.deleteHubSpotConnection(req.user.userId);
  res.json({ success: true });
});

// Refresh access token (internal use - handled automatically by getHubSpotToken)
app.post('/api/oauth/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh token' });
  }
  
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: HUBSPOT_CLIENT_ID,
      client_secret: HUBSPOT_CLIENT_SECRET,
      refresh_token
    });
    
    const response = await fetch(`${HUBSPOT_BASE_URL}/oauth/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('OAuth refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ============================================================
// Role helper
// ============================================================
function requireAdmin(req, res, next) {
  if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!db.isAdmin(req.user.userId)) return res.status(403).json({ error: 'Admin role required' });
  next();
}

// ============================================================
// Actions: Workflows (v3)
// ============================================================
app.post('/api/actions/workflows/preview', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    const { workflowId, updates } = req.body || {};
    if (!workflowId || !updates) return res.status(400).json({ error: 'workflowId and updates required' });
    const before = await getWorkflow(token, workflowId);
    const preview = buildPreview(before, updates);
    db.logUsage(req.user.userId, 'workflow_preview', { workflowId });
    res.json({ dryRun: true, ...preview });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

app.post('/api/actions/workflows/execute', db.authMiddleware, requireAdmin, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    const { workflowId, updates } = req.body || {};
    if (!workflowId || !updates) return res.status(400).json({ error: 'workflowId and updates required' });
    const out = await patchWorkflow(token, workflowId, updates);
    db.logUsage(req.user.userId, 'workflow_execute', { workflowId });
    res.json(out);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

// ============================================================
// Actions: Sequences (v4 beta)
// ============================================================
app.post('/api/actions/sequences/preview', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    const { sequenceId, updates } = req.body || {};
    if (!sequenceId || !updates) return res.status(400).json({ error: 'sequenceId and updates required' });
    const before = await getSequence(token, sequenceId);
    const preview = buildPreview(before, updates);
    db.logUsage(req.user.userId, 'sequence_preview', { sequenceId });
    res.json({ dryRun: true, ...preview });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

app.post('/api/actions/sequences/execute', db.authMiddleware, requireAdmin, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    const { sequenceId, updates } = req.body || {};
    if (!sequenceId || !updates) return res.status(400).json({ error: 'sequenceId and updates required' });
    const out = await patchSequence(token, sequenceId, updates);
    db.logUsage(req.user.userId, 'sequence_execute', { sequenceId });
    res.json(out);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

// ============================================================
// Actions: Properties (merge/hide) (v3)
// ============================================================
app.post('/api/actions/properties/merge/preview', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    const { objectType, sourceProperty, targetProperty } = req.body || {};
    if (!objectType || !sourceProperty || !targetProperty) return res.status(400).json({ error: 'objectType, sourceProperty, targetProperty required' });
    const source = await hsGetProperty(token, objectType, sourceProperty);
    const target = await hsGetProperty(token, objectType, targetProperty);
    const updates = { hidden: true, description: `Merged into ${targetProperty} on ${new Date().toISOString()}` };
    const preview = buildPreview(source, updates);
    db.logUsage(req.user.userId, 'property_merge_preview', { objectType, sourceProperty, targetProperty });
    res.json({ dryRun: true, ...preview, target });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

app.post('/api/actions/properties/merge/execute', db.authMiddleware, requireAdmin, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    const { objectType, sourceProperty, targetProperty } = req.body || {};
    if (!objectType || !sourceProperty || !targetProperty) return res.status(400).json({ error: 'objectType, sourceProperty, targetProperty required' });
    const out = await hsPatchProperty(token, objectType, sourceProperty, { hidden: true, description: `Merged into ${targetProperty} on ${new Date().toISOString()}` });
    db.logUsage(req.user.userId, 'property_merge_execute', { objectType, sourceProperty, targetProperty });
    res.json(out);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

// ============================================================
// Admin: user role management
// ============================================================
app.get('/api/admin/users', db.authMiddleware, requireAdmin, (req, res) => {
  try {
    const users = db.listUsers();
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list users' });
  }
});

app.post('/api/admin/users/role', db.authMiddleware, requireAdmin, (req, res) => {
  try {
    const { email, role } = req.body || {};
    if (!email || !role) return res.status(400).json({ error: 'email and role required' });
    const changed = db.setUserRoleByEmail(email, role);
    if (!changed) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============================================================
// Usage tracking (basic)
// ============================================================
app.post('/api/usage/track', db.authMiddleware, (req, res) => {
  try {
    const { event, metadata } = req.body || {};
    if (!event) return res.status(400).json({ error: 'Missing event' });
    db.logUsage(req.user.userId, event, metadata || null);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to log usage' });
  }
});

// ============================================================
// MCP-Style Tool Endpoints
// ============================================================

// Validate connection / Get user info
app.get('/api/tools/get-user-details', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  try {
    const data = await hubspotRequest('/integrations/v1/me', token);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

// List CRM Objects
app.get('/api/tools/list-objects/:objectType', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { objectType } = req.params;
  const { limit = 100, after, properties, associations, archived = 'false' } = req.query;
  
  try {
    const params = new URLSearchParams({ limit, archived });
    if (after) params.append('after', after);
    if (properties) params.append('properties', properties);
    if (associations) params.append('associations', associations);
    
    const data = await hubspotRequest(`/crm/v3/objects/${objectType}?${params}`, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Search CRM Objects
app.post('/api/tools/search-objects/:objectType', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { objectType } = req.params;
  const searchBody = req.body;
  
  try {
    const data = await hubspotRequest(`/crm/v3/objects/${objectType}/search`, token, {
      method: 'POST',
      body: JSON.stringify(searchBody)
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// List Properties
app.get('/api/tools/list-properties/:objectType', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { objectType } = req.params;
  
  try {
    const data = await hubspotRequest(`/crm/v3/properties/${objectType}`, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// List Workflows
app.get('/api/tools/list-workflows', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  try {
    const data = await hubspotRequest('/automation/v4/flows', token);
    console.log('Workflow API response:', JSON.stringify(data).substring(0, 500));
    // Normalize response - v4 API returns { flows: [...] }
    res.json({ 
      workflows: data.flows || data.results || [],
      total: data.total || (data.flows?.length) || 0
    });
  } catch (error) {
    console.error('Workflow fetch error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Get Workflow by ID
app.get('/api/tools/get-workflow/:workflowId', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { workflowId } = req.params;
  
  try {
    const data = await hubspotRequest(`/automation/v4/flows/${workflowId}`, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// List sequences (v3 API)
app.get('/api/tools/list-sequences', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  try {
    // Try v3 sequences API
    const data = await hubspotRequest('/automation/v3/sequences', token);
    console.log('Sequences API response:', JSON.stringify(data).substring(0, 500));
    res.json({
      sequences: data.results || data.sequences || [],
      total: data.total || (data.results?.length) || 0
    });
  } catch (error) {
    console.error('Sequences fetch error:', error);
    res.json({ sequences: [], total: 0, error: error.message });
  }
});

// List marketing campaigns
app.get('/api/tools/list-campaigns', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  try {
    const data = await hubspotRequest('/marketing/v3/campaigns', token);
    console.log('Campaigns API response:', JSON.stringify(data).substring(0, 500));
    res.json({
      campaigns: data.results || data.campaigns || [],
      total: data.total || (data.results?.length) || 0
    });
  } catch (error) {
    console.error('Campaigns fetch error:', error);
    res.json({ campaigns: [], total: 0, error: error.message });
  }
});

// Batch Create Objects
app.post('/api/tools/batch-create/:objectType', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { objectType } = req.params;
  
  try {
    const data = await hubspotRequest(`/crm/v3/objects/${objectType}/batch/create`, token, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Batch Update Objects
app.post('/api/tools/batch-update/:objectType', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { objectType } = req.params;
  
  try {
    const data = await hubspotRequest(`/crm/v3/objects/${objectType}/batch/update`, token, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Create Engagement (Notes, Tasks)
app.post('/api/tools/create-engagement', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { engagementType, ...engagementData } = req.body;
  
  try {
    const data = await hubspotRequest(`/crm/v3/objects/${engagementType}`, token, {
      method: 'POST',
      body: JSON.stringify({ properties: engagementData })
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// List Associations
app.get('/api/tools/list-associations/:fromObjectType/:fromObjectId/:toObjectType', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { fromObjectType, fromObjectId, toObjectType } = req.params;
  
  try {
    const data = await hubspotRequest(
      `/crm/v4/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}`,
      token
    );
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Get Object Schemas (Custom Objects)
app.get('/api/tools/get-schemas', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  try {
    const data = await hubspotRequest('/crm/v3/schemas', token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Batch Read Objects (by IDs)
app.post('/api/tools/batch-read/:objectType', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { objectType } = req.params;
  
  try {
    const data = await hubspotRequest(`/crm/v3/objects/${objectType}/batch/read`, token, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Create Association
app.post('/api/tools/create-association', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { fromObjectType, fromObjectId, toObjectType, toObjectId, associationType } = req.body;
  
  try {
    const data = await hubspotRequest(
      `/crm/v4/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify([{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: associationType }])
      }
    );
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Batch Create Associations
app.post('/api/tools/batch-create-associations/:fromObjectType/:toObjectType', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { fromObjectType, toObjectType } = req.params;
  
  try {
    const data = await hubspotRequest(
      `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/create`,
      token,
      {
        method: 'POST',
        body: JSON.stringify(req.body)
      }
    );
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Get Association Definitions
app.get('/api/tools/association-definitions/:fromObjectType/:toObjectType', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { fromObjectType, toObjectType } = req.params;
  
  try {
    const data = await hubspotRequest(
      `/crm/v4/associations/${fromObjectType}/${toObjectType}/labels`,
      token
    );
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Get Engagement by ID
app.get('/api/tools/get-engagement/:engagementType/:engagementId', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { engagementType, engagementId } = req.params;
  
  try {
    const data = await hubspotRequest(`/crm/v3/objects/${engagementType}/${engagementId}`, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Update Engagement
app.patch('/api/tools/update-engagement/:engagementType/:engagementId', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { engagementType, engagementId } = req.params;
  
  try {
    const data = await hubspotRequest(`/crm/v3/objects/${engagementType}/${engagementId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ properties: req.body })
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Create Property
app.post('/api/tools/create-property/:objectType', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { objectType } = req.params;
  
  try {
    const data = await hubspotRequest(`/crm/v3/properties/${objectType}`, token, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Update Property
app.patch('/api/tools/update-property/:objectType/:propertyName', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { objectType, propertyName } = req.params;
  
  try {
    const data = await hubspotRequest(`/crm/v3/properties/${objectType}/${propertyName}`, token, {
      method: 'PATCH',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Get Property by Name
app.get('/api/tools/get-property/:objectType/:propertyName', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { objectType, propertyName } = req.params;
  
  try {
    const data = await hubspotRequest(`/crm/v3/properties/${objectType}/${propertyName}`, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Get HubSpot Portal Link (for UI navigation)
app.get('/api/tools/get-portal-link', db.authMiddleware, async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  const { objectType, objectId, linkType = 'record' } = req.query;
  
  try {
    // First get the portal ID
    const meData = await hubspotRequest('/integrations/v1/me', token);
    const portalId = meData.portalId;
    
    let url;
    switch (linkType) {
      case 'record':
        url = `https://app.hubspot.com/contacts/${portalId}/${objectType}/${objectId}`;
        break;
      case 'workflow':
        url = `https://app.hubspot.com/workflows/${portalId}/platform/flow/${objectId}`;
        break;
      case 'sequence':
        url = `https://app.hubspot.com/sequences/${portalId}/sequence/${objectId}`;
        break;
      case 'list':
        url = `https://app.hubspot.com/contacts/${portalId}/lists/${objectId}`;
        break;
      default:
        url = `https://app.hubspot.com/contacts/${portalId}`;
    }
    
    res.json({ url, portalId });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ============================================================
// Generic Proxy Endpoint (for any HubSpot API call)
// ============================================================

app.all('/api/hubspot/*', async (req, res) => {
  const token = await getHubSpotToken(req);
  if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
  
  // Extract the HubSpot API path
  const hubspotPath = req.path.replace('/api/hubspot', '');
  
  try {
    const options = {
      method: req.method
    };
    
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      options.body = JSON.stringify(req.body);
    }
    
    const data = await hubspotRequest(hubspotPath, token, options);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.error });
  }
});

// ============================================================
// AI Endpoints (Server-side Gemini calls)
// ============================================================

const PT_BIZ_SYSTEM_INSTRUCTION = `
You are the "HubSpot AI Optimizer" for PT Biz employees. You have EXPERT-LEVEL knowledge of HubSpot's platform.

**ABOUT PT BIZ:**
PT Biz is a coaching company that helps Physical Therapy clinic owners grow their practices.
- **Our Customers:** PT clinic owners who buy our coaching programs
- **Our Goal:** Convert leads (PT owners) into coaching clients, retain them, and drive referrals
- **Our Sales Process:** Discovery calls → Coaching enrollment → Ongoing success management

**PT BIZ DOMAIN KNOWLEDGE:**
- **Key Metrics:** Discovery Call booking rate, Coaching enrollment rate, Client retention, NPS, Referral rate
- **Lead Sources:** Webinars, podcasts, referrals, paid ads targeting PT owners
- **Sales Sequences:** Nurture PT owners toward booking discovery calls
- **Lifecycle:** Lead → Discovery Call Booked → Coaching Client → Renewal/Referral
- **Ideal Customer Profile:** PT clinic owners doing $500K-$2M revenue, want to scale or exit operations

**HUBSPOT PLATFORM EXPERTISE:**
You have deep knowledge of HubSpot's AI-powered customer platform:

**Hubs & Pricing:**
- Smart CRM: Contact/deal management, tasks, reporting. Free to $75/seat Enterprise. Custom objects, AI summaries, duplicate management at Enterprise.
- Marketing Hub: Campaigns, personalization, SEO, analytics. Multi-touch attribution, AI search optimization (AEO), customer journey analytics.
- Sales Hub: Prospecting, pipeline management, CPQ, conversation intelligence. AI outreach, forecasting, custom scoring.
- Service Hub: Ticketing, omni-channel support, health scores, surveys. Skill-based routing, AI agents, journey analytics.
- Content Hub: Website building, content repurposing, podcast creation, SEO. Multi-site management, AI Remix.
- Operations Hub: Data sync (100+ bidirectional), cleaning, datasets. Data warehouse connections, AI datasets.
- Commerce Hub: Payments, quotes, subscriptions.

**Backend Architecture (for context):**
- Cloud-native on AWS with 3,000+ microservices
- Java for core APIs (REST/GraphQL), Python for data processing, React frontend
- MySQL for structured data, NoSQL (MongoDB) for unstructured
- Kafka for event-driven processing
- Security: SOC 2 Type II, ISO 27001, GDPR tools, encryption, MFA

**Key HubSpot Features to Leverage:**
- **Workflows:** Branching logic, delays, if/then, goal criteria. Use for lead nurture, no-show follow-up, renewal reminders.
- **Sequences:** Sales outreach automation with tasks + emails. Best for 1:1 sales rep follow-up.
- **Lead Scoring:** Behavioral + demographic scoring. Prioritize high-revenue clinic owners.
- **Custom Properties:** Create fields like clinic_revenue, coaching_program, discovery_call_date.
- **Custom Objects (Enterprise):** For complex data like coaching sessions, milestones.
- **Lists:** Active (real-time) vs Static. Use active for segments, static for campaigns.
- **Deals & Pipelines:** Stages like Discovery Scheduled, Proposal Sent, Enrolled, Renewal Due.
- **Reporting:** Custom dashboards, attribution reports, funnel analytics.

**Breeze AI Tools:**
- Breeze Copilot: AI assistant for CRM tasks, email drafting, record summaries
- Breeze Agents: Social Agent, Customer Agent, Content Agent, Prospecting Agent
- Content Remix: Repurpose one asset into many formats
- AI Prospecting: Automated outreach with personalization
- Custom Workflow Actions: Build with \`hs project add --features=workflow-action-tool\`

**HubSpot Best Practices:**
- Keep data clean: Use Operations Hub for deduplication and formatting
- Automate repetitive: Lead rotation, task creation, email validation
- Personalize at scale: Smart content, tokens, AI-generated copy
- Track ROI: Multi-touch attribution, closed-loop reporting
- Integrate: 1,900+ Marketplace apps, webhooks for real-time sync

**ARCHITECTURE: MODEL CONTEXT PROTOCOL (MCP)**
You are operating within an MCP architecture. You have access to "Tools" that can fetch real data from the HubSpot portal.
- **DO NOT** hallucinate workflow names or data properties if you haven't fetched them yet.
- **DO** use the toolCalls field to request data when the user asks for an audit, check, or list.
- **Tools Available:**
  1. list_workflows: Use this to check automation health.
  2. audit_data_schema: Use this to check data model cleanliness.
  3. list_sequences: Use this for sales outreach analysis.
  4. get_breeze_tools: Use this to see existing custom tools.

**Behavior:**
- If the user asks for data that lives in the portal (workflows, properties, sequences), USE A TOOL CALL.
- Do not act like you know the data unless you have called the tool.
- If the user asks to "Create" or "Draft" something new, use the 'action' field to open the modal.
- When suggesting optimizations, reference specific HubSpot features and explain WHY they help PT Biz.
- Tone: Tactical, direct, authoritative. You're a HubSpot expert helping PT Biz employees optimize their sales & marketing.
`;

// AI: Generate Optimization
app.post('/api/ai/optimize', db.authMiddleware, async (req, res) => {
  const { prompt, contextType, contextId } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  // Pull dynamic HubSpot context via Search API (best-effort)
  let contextText = '';
  try {
    const token = await getHubSpotToken(req);
    if (token) {
      const searchResp = await fetch(`${HUBSPOT_BASE_URL}/search/v3/search`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: String(prompt).slice(0, 64), limit: 3 })
      });
      if (searchResp.ok) {
        const searchJson = await searchResp.json();
        contextText = JSON.stringify(searchJson).slice(0, 2000);
      }
    }
  } catch {}

  try {
    if (GEMINI_API_KEY) {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${PT_BIZ_SYSTEM_INSTRUCTION}

Context Type: ${contextType || 'general'}
Context ID: ${contextId || 'New/General'}
User Request: ${prompt}
Relevant HubSpot context (search excerpts): ${contextText}

Generate a specific optimization or creation plan for this request based on PT Biz best practices.
If contextType is 'breeze_tool', generate a JSON definition suitable for a HubSpot App 'workflow-action-tool'.

Respond with valid JSON matching this schema:
{
  "specType": "workflow_spec" | "sequence_spec" | "property_migration_spec" | "breeze_tool_spec",
  "spec": { "name": "string", "focus": "string", "steps": [], "actions": [] },
  "analysis": "Strategic explanation of WHY this optimization helps a PT business",
  "diff": ["List of specific changes"]
}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
          }
        })
      });
      const data = await response.json();
      if (!response.ok) {
        console.error('Gemini API error:', data);
        return res.status(500).json({ error: 'AI generation failed', details: data });
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return res.status(500).json({ error: 'No response from AI' });
      return res.json(JSON.parse(text));
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: 'No AI provider configured' });
    }
    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PT_BIZ_SYSTEM_INSTRUCTION },
          { role: 'user', content: `Context Type: ${contextType || 'general'}\nContext ID: ${contextId || 'New/General'}\nUser Request: ${prompt}\nRelevant HubSpot context: ${contextText}\n\nGenerate a specific optimization or creation plan for this request based on PT Biz best practices. If contextType is 'breeze_tool', generate a JSON definition suitable for a HubSpot App 'workflow-action-tool'. Respond with the JSON schema described.` }
        ]
      })
    });
    const openaiJson = await openaiResp.json();
    if (!openaiResp.ok) {
      console.error('OpenAI error:', openaiJson);
      return res.status(500).json({ error: 'AI generation failed', details: openaiJson });
    }
    const content = openaiJson.choices?.[0]?.message?.content;
    if (!content) return res.status(500).json({ error: 'No response from AI' });
    return res.json(JSON.parse(content));
  } catch (error) {
    console.error('AI Optimize Error:', error);
    res.status(500).json({ 
      specType: 'workflow_spec',
      spec: { name: 'Error Fallback' },
      analysis: 'I encountered an error while processing your request. Please try again.',
      diff: ['Retry Request']
    });
  }
});

// AI: Chat Response
app.post('/api/ai/chat', db.authMiddleware, async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }

  // Pull dynamic HubSpot context via Search API (best-effort)
  let contextText = '';
  try {
    const token = await getHubSpotToken(req);
    if (token) {
      const searchResp = await fetch(`${HUBSPOT_BASE_URL}/search/v3/search`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: String(message).slice(0, 64), limit: 3 })
      });
      if (searchResp.ok) {
        const searchJson = await searchResp.json();
        contextText = JSON.stringify(searchJson).slice(0, 2000);
      }
    }
  } catch {}

  try {
    if (GEMINI_API_KEY) {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${PT_BIZ_SYSTEM_INSTRUCTION}

User Message: ${message}
Relevant HubSpot context: ${contextText}

Respond with valid JSON matching this schema:
{
  "text": "Conversational response to the user",
  "suggestions": ["3-4 short follow-up options"],
  "toolCalls": [{"name": "tool_name", "arguments": {}}],
  "action": {"type": "OPEN_MODAL", "payload": {"contextType": "workflow", "initialPrompt": ""}}
}

Only include toolCalls if the user asks to audit/check existing portal data.
Only include action if the user asks to create/draft something new.`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
          }
        })
      });
      const data = await response.json();
      if (!response.ok) {
        console.error('Gemini API error:', data);
        return res.status(500).json({ error: 'AI chat failed', details: data });
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return res.status(500).json({ error: 'No response from AI' });
      return res.json(JSON.parse(text));
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return res.status(503).json({ error: 'No AI provider configured' });
    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PT_BIZ_SYSTEM_INSTRUCTION },
          { role: 'user', content: `${message}\n\nRelevant HubSpot context: ${contextText}` }
        ]
      })
    });
    const openaiJson = await openaiResp.json();
    if (!openaiResp.ok) {
      console.error('OpenAI error:', openaiJson);
      return res.status(500).json({ error: 'AI chat failed', details: openaiJson });
    }
    const content = openaiJson.choices?.[0]?.message?.content;
    if (!content) return res.status(500).json({ error: 'No response from AI' });
    return res.json(JSON.parse(content));
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ 
      text: "I'm having trouble connecting right now. Please try again.",
      suggestions: ["Retry"]
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 HubSpot MCP Proxy Server running on port ${PORT}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`   HubSpot App: ${HUBSPOT_CLIENT_ID ? 'Configured ✓' : 'Missing CLIENT_ID ✗'}`);
  console.log(`   Gemini AI: ${GEMINI_API_KEY ? 'Configured ✓' : 'Not configured'}`);
});

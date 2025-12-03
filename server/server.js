import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import * as db from './db.js';
import { 
  getWorkflow, patchWorkflow, getSequence, patchSequence,
  getProperty as hsGetProperty, patchProperty as hsPatchProperty, buildPreview,
  listWorkflows as hsListWorkflows, listSequences as hsListSequences
} from './hubspotActions.js';

console.log('=== PRODUCTION SERVER STARTUP ===');
console.log('Node version:', process.version);
console.log('CWD:', process.cwd());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  return process.env.APP_URL || 'http://localhost:8080';
};

// Check if dist folder exists (production static files)
const distPath = path.join(__dirname, '../dist');
const distExists = fs.existsSync(distPath);
console.log(`Static files path: ${distPath} (exists: ${distExists})`);

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Request logging (production)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Serve static files from the built frontend
if (distExists) {
  console.log('Serving static files from:', distPath);
  app.use(express.static(distPath));
}

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

app.get('/api/auth/me', db.authMiddleware, (req, res) => {
  const user = db.getUserById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const hubspotConnection = db.getHubSpotConnection(user.id);
  
  res.json({
    user,
    hasHubSpotConnection: !!hubspotConnection,
    portalId: hubspotConnection?.portal_id
  });
});

// ============================================================
// OAuth Endpoints (HubSpot Token Exchange)
// ============================================================

app.post('/api/oauth/token', db.authMiddleware, async (req, res) => {
  const { code, redirect_uri } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }
  
  // Handle PAT token input
  if (code.startsWith('pat-')) {
    try {
      // Verify the PAT by calling HubSpot API
      const testResponse = await fetch(`${HUBSPOT_BASE_URL}/account-info/v3/details`, {
        headers: { 'Authorization': `Bearer ${code}` }
      });
      
      if (!testResponse.ok) {
        return res.status(401).json({ error: 'Invalid Private App Token' });
      }
      
      const accountInfo = await testResponse.json();
      
      // Save PAT to database (no refresh token, no expiry)
      db.saveHubSpotConnection(req.user.userId, code, null, null, accountInfo.portalId);
      
      return res.json({ 
        success: true, 
        portalId: accountInfo.portalId 
      });
    } catch (error) {
      console.error('PAT validation error:', error);
      return res.status(500).json({ error: 'Failed to validate token' });
    }
  }
  
  // OAuth code exchange
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: HUBSPOT_CLIENT_ID,
    client_secret: HUBSPOT_CLIENT_SECRET,
    redirect_uri: redirect_uri || getAppUrl(),
    code: code
  });

  try {
    const tokenResponse = await fetch(`${HUBSPOT_BASE_URL}/oauth/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('HubSpot token error:', errorData);
      return res.status(tokenResponse.status).json({ 
        error: 'Token exchange failed',
        message: errorData.message || errorData.error_description 
      });
    }

    const data = await tokenResponse.json();
    
    // Get portal ID
    const accountResponse = await fetch(`${HUBSPOT_BASE_URL}/account-info/v3/details`, {
      headers: { 'Authorization': `Bearer ${data.access_token}` }
    });
    
    let portalId = null;
    if (accountResponse.ok) {
      const accountInfo = await accountResponse.json();
      portalId = accountInfo.portalId;
    }
    
    // Save tokens to database
    db.saveHubSpotConnection(
      req.user.userId,
      data.access_token,
      data.refresh_token,
      data.expires_in,
      portalId
    );
    
    res.json({ 
      success: true,
      portalId
    });
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

app.post('/api/oauth/refresh', db.authMiddleware, async (req, res) => {
  const { refresh_token } = req.body;
  
  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh token' });
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: HUBSPOT_CLIENT_ID,
    client_secret: HUBSPOT_CLIENT_SECRET,
    refresh_token
  });

  try {
    const response = await fetch(`${HUBSPOT_BASE_URL}/oauth/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ 
        error: 'Token refresh failed',
        message: errorData.message 
      });
    }

    const data = await response.json();
    
    // Update tokens in database
    db.updateHubSpotTokens(
      req.user.userId,
      data.access_token,
      data.refresh_token,
      data.expires_in
    );
    
    res.json({ 
      success: true
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ============================================================
// MCP Tool Endpoints (Protected - require auth)
// ============================================================

// Get User Details (validates connection)
app.get('/api/tools/get-user-details', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) {
      return res.status(401).json({ success: false, error: 'No HubSpot connection' });
    }
    
    const data = await hubspotRequest('/account-info/v3/details', token);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

// List Objects (contacts, companies, deals, etc.)
app.get('/api/tools/list-objects/:objectType', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { objectType } = req.params;
    const { limit = 100, after, properties, associations } = req.query;
    
    let endpoint = `/crm/v3/objects/${objectType}?limit=${limit}`;
    if (after) endpoint += `&after=${after}`;
    if (properties) endpoint += `&properties=${properties}`;
    if (associations) endpoint += `&associations=${associations}`;
    
    const data = await hubspotRequest(endpoint, token);
    res.json(data);
  } catch (error) {
    console.error('List objects error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Search Objects
app.post('/api/tools/search-objects/:objectType', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { objectType } = req.params;
    const data = await hubspotRequest(`/crm/v3/objects/${objectType}/search`, token, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    console.error('Search objects error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Batch Create
app.post('/api/tools/batch-create/:objectType', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { objectType } = req.params;
    const data = await hubspotRequest(`/crm/v3/objects/${objectType}/batch/create`, token, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    console.error('Batch create error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Batch Update
app.post('/api/tools/batch-update/:objectType', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { objectType } = req.params;
    const data = await hubspotRequest(`/crm/v3/objects/${objectType}/batch/update`, token, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    console.error('Batch update error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Batch Read
app.post('/api/tools/batch-read/:objectType', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { objectType } = req.params;
    const data = await hubspotRequest(`/crm/v3/objects/${objectType}/batch/read`, token, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    console.error('Batch read error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// List Properties
app.get('/api/tools/list-properties/:objectType', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { objectType } = req.params;
    const data = await hubspotRequest(`/crm/v3/properties/${objectType}`, token);
    res.json(data);
  } catch (error) {
    console.error('List properties error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Get Property
app.get('/api/tools/get-property/:objectType/:propertyName', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { objectType, propertyName } = req.params;
    const data = await hubspotRequest(`/crm/v3/properties/${objectType}/${propertyName}`, token);
    res.json(data);
  } catch (error) {
    console.error('Get property error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Create Property
app.post('/api/tools/create-property/:objectType', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { objectType } = req.params;
    const data = await hubspotRequest(`/crm/v3/properties/${objectType}`, token, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    console.error('Create property error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Update Property
app.patch('/api/tools/update-property/:objectType/:propertyName', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { objectType, propertyName } = req.params;
    const data = await hubspotRequest(`/crm/v3/properties/${objectType}/${propertyName}`, token, {
      method: 'PATCH',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    console.error('Update property error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Get Schemas
app.get('/api/tools/get-schemas', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const data = await hubspotRequest('/crm/v3/schemas', token);
    res.json(data);
  } catch (error) {
    console.error('Get schemas error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// List Associations
app.get('/api/tools/list-associations/:fromType/:id/:toType', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { fromType, id, toType } = req.params;
    const data = await hubspotRequest(`/crm/v4/objects/${fromType}/${id}/associations/${toType}`, token);
    res.json(data);
  } catch (error) {
    console.error('List associations error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Create Association
app.post('/api/tools/create-association', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { fromObjectType, fromObjectId, toObjectType, toObjectId, associationType } = req.body;
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
    console.error('Create association error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Batch Create Associations
app.post('/api/tools/batch-create-associations/:fromType/:toType', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { fromType, toType } = req.params;
    const data = await hubspotRequest(`/crm/v4/associations/${fromType}/${toType}/batch/create`, token, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    console.error('Batch create associations error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Get Association Definitions
app.get('/api/tools/association-definitions/:fromType/:toType', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { fromType, toType } = req.params;
    const data = await hubspotRequest(`/crm/v4/associations/${fromType}/${toType}/labels`, token);
    res.json(data);
  } catch (error) {
    console.error('Get association definitions error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Create Engagement
app.post('/api/tools/create-engagement', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { engagementType, ...properties } = req.body;
    const data = await hubspotRequest(`/crm/v3/objects/${engagementType}`, token, {
      method: 'POST',
      body: JSON.stringify({ properties })
    });
    res.json(data);
  } catch (error) {
    console.error('Create engagement error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Get Engagement
app.get('/api/tools/get-engagement/:engagementType/:engagementId', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { engagementType, engagementId } = req.params;
    const data = await hubspotRequest(`/crm/v3/objects/${engagementType}/${engagementId}`, token);
    res.json(data);
  } catch (error) {
    console.error('Get engagement error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Update Engagement
app.patch('/api/tools/update-engagement/:engagementType/:engagementId', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { engagementType, engagementId } = req.params;
    const data = await hubspotRequest(`/crm/v3/objects/${engagementType}/${engagementId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ properties: req.body })
    });
    res.json(data);
  } catch (error) {
    console.error('Update engagement error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// List Workflows (v4 API)
app.get('/api/tools/list-workflows', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const data = await hubspotRequest('/automation/v4/flows', token);
    res.json(data);
  } catch (error) {
    console.error('List workflows error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// List Sequences
app.get('/api/tools/list-sequences', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const data = await hubspotRequest('/automation/v3/sequences', token);
    res.json({ sequences: data.results || [] });
  } catch (error) {
    console.error('List sequences error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// List Campaigns
app.get('/api/tools/list-campaigns', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const data = await hubspotRequest('/marketing/v3/campaigns', token);
    res.json({ campaigns: data.results || [] });
  } catch (error) {
    console.error('List campaigns error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Get Portal Link
app.get('/api/tools/get-portal-link', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    
    const { objectType, objectId, linkType } = req.query;
    
    // Get portal ID
    const accountInfo = await hubspotRequest('/account-info/v3/details', token);
    const portalId = accountInfo.portalId;
    
    let url = `https://app.hubspot.com`;
    
    if (linkType === 'workflow' && objectId) {
      url = `${url}/workflows/${portalId}/platform/flow/${objectId}/edit`;
    } else if (linkType === 'sequence' && objectId) {
      url = `${url}/sequences/${portalId}/${objectId}`;
    } else if (linkType === 'list' && objectId) {
      url = `${url}/lists/${portalId}/${objectId}`;
    } else if (objectType && objectId) {
      url = `${url}/contacts/${portalId}/${objectType}/${objectId}`;
    } else {
      url = `${url}/home/${portalId}`;
    }
    
    res.json({ url, portalId: String(portalId) });
  } catch (error) {
    console.error('Get portal link error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ============================================================
// AI Endpoints
// ============================================================

const PT_BIZ_SYSTEM_INSTRUCTION = `You are an AI assistant for PT Biz, a coaching company that helps Physical Therapy clinic owners grow their practices.

CONTEXT:
- Users are PT clinic owners or their marketing teams using HubSpot CRM
- Main focus: lead generation, discovery call bookings, coaching enrollment, client retention
- Contacts in HubSpot = PT clinic owners (prospects or coaching clients)
- Lifecycle: Lead → Discovery Call → Coaching Client → Renewal/Referral

KEY METRICS TO OPTIMIZE:
- Discovery Call booking rate
- Show rate for booked calls
- Enrollment rate (call → paid coaching)
- Client retention and NPS
- Referral generation

RESPONSE STYLE:
- Be conversational but concise
- Focus on actionable HubSpot recommendations
- Reference PT clinic/coaching context when relevant
- Suggest specific workflow/sequence improvements

AVAILABLE TOOLS (use when user asks to audit/check):
- list_workflows: Get all automation workflows
- audit_data_schema: Check contact/company properties
- list_sequences: Get sales sequences
- get_breeze_tools: List custom workflow actions`;

// AI: Optimize Content
app.post('/api/ai/optimize', db.authMiddleware, async (req, res) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  const { content, context } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Missing content to optimize' });
  }

  try {
    if (GEMINI_API_KEY) {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${PT_BIZ_SYSTEM_INSTRUCTION}

Context: ${context || 'HubSpot automation'}
Content to optimize: ${content}

Provide specific optimization suggestions for this ${context || 'content'}.
Format as actionable bullet points.`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      });
      const data = await response.json();
      if (!response.ok) {
        console.error('Gemini API error:', data);
        return res.status(500).json({ error: 'AI optimization failed', details: data });
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return res.status(500).json({ error: 'No response from AI' });
      return res.json({ suggestions: text });
    }

    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: 'No AI provider configured' });
    }
    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: PT_BIZ_SYSTEM_INSTRUCTION },
          { role: 'user', content: `Context: ${context || 'HubSpot automation'}\nContent to optimize: ${content}\n\nProvide specific optimization suggestions for this ${context || 'content'}. Format as actionable bullet points.` }
        ]
      })
    });
    const openaiJson = await openaiResp.json();
    if (!openaiResp.ok) {
      console.error('OpenAI error:', openaiJson);
      return res.status(500).json({ error: 'AI optimization failed', details: openaiJson });
    }
    const text = openaiJson.choices?.[0]?.message?.content;
    return res.json({ suggestions: text || '' });
  } catch (error) {
    console.error('AI Optimization Error:', error);
    res.status(500).json({ error: 'AI optimization failed' });
  }
});

// AI: Chat Response
app.post('/api/ai/chat', db.authMiddleware, async (req, res) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }

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

    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: 'No AI provider configured' });
    }
    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PT_BIZ_SYSTEM_INSTRUCTION },
          { role: 'user', content: message }
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

// Recommendations (normalize AI output for production server)
app.post('/api/recommendations', db.authMiddleware, async (req, res) => {
  try {
    const { prompt, limit = 20, offset = 0 } = req.body || {};
    const base = process.env.APP_URL || req.headers['x-forwarded-proto'] ? `${req.headers['x-forwarded-proto']}://${req.headers.host}` : `http://localhost:${PORT}`;
    const aiResp = await fetch(`${base}/api/ai/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.authorization || '' },
      body: JSON.stringify({ prompt: prompt || 'Generate top 20 actionable HubSpot portal optimizations for PT Biz.' })
    });
    const data = await aiResp.json();
    if (!aiResp.ok) return res.status(aiResp.status).json(data);
    const diffs = Array.isArray(data?.diff) ? data.diff : [];
    const sl = Number(limit) || 20;
    const so = Number(offset) || 0;
    const window = diffs.slice(so, so + sl);
    const items = window.map((d, i) => {
      const rank = so + i;
      return { id: 'rec_' + rank, title: String(d).slice(0, 80), impact: rank < 5 ? 'High' : rank < 12 ? 'Med' : 'Low', category: rank % 2 === 0 ? 'Automation' : 'Data', details: String(d) };
    });
    const hasMore = so + sl < diffs.length;
    res.json({ items, nextOffset: hasMore ? so + sl : undefined });
  } catch (e) {
    res.status(500).json({ items: [] });
  }
});

// ============================================================
// SPA Fallback (production only)
// ============================================================
if (distExists) {
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ============================================================
// Role helper
// ============================================================
function requireAdmin(req, res, next) {
  if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!db.isAdmin(req.user.userId)) return res.status(403).json({ error: 'Admin role required' });
  next();
}

// ============================================================
// Actions (subset used in production server)
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

// ============================================================
// HubSpot paginated list proxies (workflows v3, sequences v4)
// ============================================================
app.get('/api/hubspot/workflows', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    const { limit = 20, after } = req.query;
    const data = await hsListWorkflows(token, { limit, after });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

app.get('/api/hubspot/sequences', db.authMiddleware, async (req, res) => {
  try {
    const token = await getHubSpotToken(req);
    if (!token) return res.status(401).json({ error: 'No HubSpot connection' });
    const { limit = 20, after } = req.query;
    const data = await hsListSequences(token, { limit, after });
    res.json(data);
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

// Start server
app.listen(PORT, () => {
  console.log(`�� HubSpot MCP Proxy Server (Production) running on port ${PORT}`);
  console.log(`   App URL: ${getAppUrl()}`);
  console.log(`   HubSpot App: ${HUBSPOT_CLIENT_ID ? 'Configured ✓' : 'Missing CLIENT_ID ✗'}`);
  console.log(`   Gemini AI: ${GEMINI_API_KEY ? 'Configured ✓' : 'Not configured'}`);
  console.log(`   Static Files: ${distExists ? 'Serving from dist/ ✓' : 'Not found (dev mode?)'}`);
});

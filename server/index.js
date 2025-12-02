import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 8080;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

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
    clientId: process.env.HUBSPOT_CLIENT_ID,
    redirectUri: process.env.APP_URL || 'http://localhost:3000',
    hasGemini: !!process.env.GEMINI_API_KEY,
    scopes: scopes
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// OAuth Endpoints (Proxy to avoid CORS)
// ============================================================

// Exchange authorization code for tokens
app.post('/api/oauth/token', async (req, res) => {
  const { code, client_id, client_secret, redirect_uri, code_verifier } = req.body;
  
  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id,
      client_secret,
      redirect_uri,
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
    
    res.json(data);
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// Refresh access token
app.post('/api/oauth/refresh', async (req, res) => {
  const { refresh_token, client_id, client_secret } = req.body;
  
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id,
      client_secret,
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
// MCP-Style Tool Endpoints
// ============================================================

// Validate connection / Get user info
app.get('/api/tools/get-user-details', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const data = await hubspotRequest('/integrations/v1/me', token);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

// List CRM Objects
app.get('/api/tools/list-objects/:objectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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
app.post('/api/tools/search-objects/:objectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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
app.get('/api/tools/list-properties/:objectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  const { objectType } = req.params;
  
  try {
    const data = await hubspotRequest(`/crm/v3/properties/${objectType}`, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// List Workflows
app.get('/api/tools/list-workflows', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const data = await hubspotRequest('/automation/v3/workflows', token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Get Workflow by ID
app.get('/api/tools/get-workflow/:workflowId', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  const { workflowId } = req.params;
  
  try {
    const data = await hubspotRequest(`/automation/v3/workflows/${workflowId}`, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// List Sequences
app.get('/api/tools/list-sequences', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const data = await hubspotRequest('/automation/v1/sequences', token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Batch Create Objects
app.post('/api/tools/batch-create/:objectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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
app.post('/api/tools/batch-update/:objectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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
app.post('/api/tools/create-engagement', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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
app.get('/api/tools/list-associations/:fromObjectType/:fromObjectId/:toObjectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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
app.get('/api/tools/get-schemas', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const data = await hubspotRequest('/crm/v3/schemas', token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Batch Read Objects (by IDs)
app.post('/api/tools/batch-read/:objectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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
app.post('/api/tools/create-association', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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
app.post('/api/tools/batch-create-associations/:fromObjectType/:toObjectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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
app.get('/api/tools/association-definitions/:fromObjectType/:toObjectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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
app.get('/api/tools/get-engagement/:engagementType/:engagementId', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  const { engagementType, engagementId } = req.params;
  
  try {
    const data = await hubspotRequest(`/crm/v3/objects/${engagementType}/${engagementId}`, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Update Engagement
app.patch('/api/tools/update-engagement/:engagementType/:engagementId', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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
app.post('/api/tools/create-property/:objectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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
app.patch('/api/tools/update-property/:objectType/:propertyName', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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
app.get('/api/tools/get-property/:objectType/:propertyName', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  const { objectType, propertyName } = req.params;
  
  try {
    const data = await hubspotRequest(`/crm/v3/properties/${objectType}/${propertyName}`, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Get HubSpot Portal Link (for UI navigation)
app.get('/api/tools/get-portal-link', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 HubSpot MCP Proxy Server running on port ${PORT}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Get app URL for redirects
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
  return process.env.APP_URL || 'http://localhost:3000';
};

// HubSpot App credentials (set in Railway environment variables)
const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Check if dist folder exists
const distPath = path.join(__dirname, '../dist');
const distExists = fs.existsSync(distPath);

// Log startup info
console.log('Starting server...');
console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  - PORT: ${PORT}`);
console.log(`  - __dirname: ${__dirname}`);
console.log(`  - distPath: ${distPath}`);
console.log(`  - distExists: ${distExists}`);

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Serve static files from the built frontend (if exists)
if (distExists) {
  console.log('Serving static files from:', distPath);
  app.use(express.static(distPath));
} else {
  console.log('WARNING: dist folder not found, frontend will not be served');
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

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
  res.json({
    clientId: HUBSPOT_CLIENT_ID,
    redirectUri: getAppUrl(),
    hasGemini: !!GEMINI_API_KEY,
    scopes: [
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
    ]
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    distAvailable: distExists
  });
});

// ============================================================
// OAuth Endpoints
// ============================================================

// Exchange authorization code for tokens
app.post('/api/oauth/token', async (req, res) => {
  const { code, redirect_uri } = req.body;
  
  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: HUBSPOT_CLIENT_ID,
      client_secret: HUBSPOT_CLIENT_SECRET,
      redirect_uri: redirect_uri || getAppUrl(),
      code
    });
    
    const response = await fetch(`${HUBSPOT_BASE_URL}/oauth/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('OAuth error:', data);
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
  const { refresh_token } = req.body;
  
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
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ============================================================
// Health Check
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    configured: !!(HUBSPOT_CLIENT_ID && HUBSPOT_CLIENT_SECRET)
  });
});

// ============================================================
// HubSpot API Proxy
// ============================================================
app.all('/api/hubspot/*', async (req, res) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }
  
  const hubspotPath = req.path.replace('/api/hubspot', '');
  
  try {
    const options = {
      method: req.method,
    };
    
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      options.body = JSON.stringify(req.body);
    }
    
    const data = await hubspotRequest(hubspotPath, token, options);
    res.json(data);
  } catch (error) {
    console.error(`HubSpot API error for ${hubspotPath}:`, error);
    res.status(error.status || 500).json(error.error || { error: 'HubSpot API request failed' });
  }
});

// ============================================================
// MCP-Style Tool Endpoints
// ============================================================

// Validate connection / Get user details
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

// List workflows
app.get('/api/tools/list-workflows', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const data = await hubspotRequest('/automation/v4/flows', token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.error || { error: 'Failed to list workflows' });
  }
});

// Get workflow details
app.get('/api/tools/get-workflow/:id', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const data = await hubspotRequest(`/automation/v4/flows/${req.params.id}`, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.error || { error: 'Failed to get workflow' });
  }
});

// List objects (contacts, companies, deals, etc.)
app.get('/api/tools/list-objects/:objectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  const { objectType } = req.params;
  const { limit = 10, after, properties } = req.query;
  
  try {
    let endpoint = `/crm/v3/objects/${objectType}?limit=${limit}`;
    if (after) endpoint += `&after=${after}`;
    if (properties) endpoint += `&properties=${properties}`;
    
    const data = await hubspotRequest(endpoint, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.error || { error: `Failed to list ${objectType}` });
  }
});

// Search objects
app.post('/api/tools/search-objects/:objectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  const { objectType } = req.params;
  
  try {
    const data = await hubspotRequest(`/crm/v3/objects/${objectType}/search`, token, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.error || { error: `Failed to search ${objectType}` });
  }
});

// List properties
app.get('/api/tools/list-properties/:objectType', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const data = await hubspotRequest(`/crm/v3/properties/${req.params.objectType}`, token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.error || { error: 'Failed to list properties' });
  }
});

// Get schemas
app.get('/api/tools/get-schemas', async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const data = await hubspotRequest('/crm/v3/schemas', token);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json(error.error || { error: 'Failed to get schemas' });
  }
});

// ============================================================
// Catch-all: Serve React app for client-side routing
// ============================================================
app.get('*', (req, res) => {
  // Skip API routes that weren't matched
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  const indexPath = path.join(__dirname, '../dist/index.html');
  
  // Check if the file exists before trying to serve it
  if (!fs.existsSync(indexPath)) {
    console.error('index.html not found at:', indexPath);
    return res.status(500).json({ 
      error: 'Application not built',
      path: indexPath,
      distExists: fs.existsSync(path.join(__dirname, '../dist'))
    });
  }
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Error loading app');
    }
  });
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Start server - bind to 0.0.0.0 for container environments
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`🚀 HubSpot AI Optimizer running on ${HOST}:${PORT}`);
  console.log(`   App URL: ${getAppUrl()}`);
  console.log(`   HubSpot App: ${HUBSPOT_CLIENT_ID ? 'Configured ✓' : 'Missing CLIENT_ID ✗'}`);
  console.log(`   Gemini AI: ${GEMINI_API_KEY ? 'Configured ✓' : 'Not configured'}`);
  
  // Check if dist folder exists
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    console.log('   Static files: Found ✓');
  } else {
    console.log('   Static files: Missing ✗ - dist folder not found at', distPath);
  }
});

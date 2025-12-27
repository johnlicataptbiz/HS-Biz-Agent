import express from 'express';
import cors from 'cors';
import token from './api/token.js';
import ai from './api/ai.js';
import proxy from './api/proxy.js';
import remediate from './api/remediate.js';
import cleanup from './api/cleanup.js';
import vibeAi from './api/vibe-ai.js';

const app = express();

// Enable CORS for all origins (specifically Surge)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['X-CSRF-Token', 'X-Requested-With', 'Accept', 'Accept-Version', 'Content-Length', 'Content-MD5', 'Content-Type', 'Date', 'X-Api-Version', 'Authorization']
}));

app.use(express.json());

// Adapt Vercel-style handlers to Express
const wrap = (handler) => async (req, res) => {
  try {
    // Vercel handlers use res.status().json() which Express also supports.
    // However, some Vercel features like req.query might be slightly different.
    await handler(req, res);
  } catch (err) {
    console.error('Handler Error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve Circle Embed (Tour 33)
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.get('/embeds/tour-33', (req, res) => {
  res.sendFile(join(__dirname, 'embeds/tour-33.html'));
});

app.all('/api/token', wrap(token));
app.all('/api/ai', wrap(ai));
app.all('/api/remediate', wrap(remediate));
app.all('/api/cleanup', wrap(cleanup));
app.all('/api/vibe-ai', wrap(vibeAi));

// Native Express Proxy Handler (Bypassing wrapper for full control)
app.all(/^\/api\/hubspot\/(.*)/, async (req, res) => {
  try {
    const path = req.params[0] || req.url.replace('/api/hubspot/', '').split('?')[0];
    
    // Inject path into query for the shared handler logic
    req.query.path = path;
    
    // Call proxy handler directly
    await proxy(req, res);
  } catch (err) {
    console.error('Proxy Route Error:', err);
    res.status(500).json({ error: 'Proxy Route Failed', details: err.message });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Railway Failover Server live on port ${port}`);
});

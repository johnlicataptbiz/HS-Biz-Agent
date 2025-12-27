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
  origin: (origin, callback) => {
    if (!origin || origin.includes('surge.sh') || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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

app.all('/api/token', wrap(token));
app.all('/api/ai', wrap(ai));
app.all('/api/remediate', wrap(remediate));
app.all('/api/cleanup', wrap(cleanup));
app.all('/api/vibe-ai', wrap(vibeAi));

// Proxy handler needs special path mapping
app.all('/api/hubspot/*', async (req, res) => {
  // Map /api/hubspot/contacts -> path=contacts
  const path = req.params[0] || req.url.replace('/api/hubspot/', '').split('?')[0];
  req.query.path = path;
  await proxy(req, res);
});

const port = process.env.PORT || 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Railway Failover Server live on port ${port}`);
});

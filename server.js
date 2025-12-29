import express from 'express';
import cors from 'cors';
import token from './api/token.js';
import ai from './api/ai.js';
import proxy from './api/proxy.js';
import remediate from './api/remediate.js';
import cleanup from './api/cleanup.js';
import vibeAi from './api/vibe-ai.js';
import contacts from './api/contacts.js';
import aggregates from './api/aggregates.js';
import { initDb, getSyncProgress } from './services/backend/dataService.js';
import { startBackgroundSync } from './services/backend/syncService.js';

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

// Contacts API (from local database)
app.all('/api/contacts', wrap(contacts));
app.all('/api/contacts/aggregates', wrap(aggregates));

// CRM Mirror & Sync Endpoints
app.post('/api/sync/start', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
    const token = authHeader.replace('Bearer ', '');
    const result = await startBackgroundSync(token);
    res.json(result);
});

app.get('/api/sync/status', async (req, res) => {
    try {
        const progress = await getSyncProgress();
        res.json(progress);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Reset endpoint to clear stuck sync
app.post('/api/sync/reset', async (req, res) => {
    try {
        const { updateSyncStatus } = await import('./services/backend/dataService.js');
        await updateSyncStatus('idle');
        res.json({ message: 'Sync status reset to idle' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Sample leads endpoint for analysis
app.get('/api/sync/sample', async (req, res) => {
    try {
        const { pool } = await import('./services/backend/dataService.js');
        const result = await pool.query('SELECT * FROM contacts ORDER BY last_modified DESC LIMIT 5');
        res.json({ leads: result.rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Trigger batch health score calculation
app.post('/api/contacts/process-scores', async (req, res) => {
    try {
        const { pool, updateContactHealthScore } = await import('./services/backend/dataService.js');
        const { calculateHealthScore } = await import('./services/backend/healthScoreService.js');
        
        // Return 202 accepted and process in background
        res.status(202).json({ message: 'Score processing started in background' });

        (async () => {
            console.log('🚀 Starting batch health score processing...');
            let processed = 0;
            let hasMore = true;
            let lastId = null;

            while (hasMore) {
                const query = lastId 
                    ? 'SELECT id, raw_data FROM contacts WHERE id > $1 ORDER BY id LIMIT 500'
                    : 'SELECT id, raw_data FROM contacts ORDER BY id LIMIT 500';
                const params = lastId ? [lastId] : [];
                
                const result = await pool.query(query, params);
                if (result.rows.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const row of result.rows) {
                    const { score } = calculateHealthScore(row.raw_data);
                    await updateContactHealthScore(row.id, score, row.raw_data);
                    processed++;
                    lastId = row.id;
                }
                
                console.log(`📊 Processed ${processed} contact scores...`);
                // Tiny sleep to avoid pegging CPU/DB
                await new Promise(r => setTimeout(r, 100));
            }
            console.log('✅ Batch health score processing completed!');
        })();

    } catch (e) {
        console.error('Score processing error:', e);
        if (!res.headersSent) res.status(500).json({ error: e.message });
    }
});

// Native Express Proxy Handler (Bypassing wrapper for full control)
app.all(/^\/api\/hubspot\/(.*)/, async (req, res) => {
  try {
    // Extract path from URL - everything after /api/hubspot/
    const fullUrl = req.url.replace('/api/hubspot/', '');
    const [pathPart] = fullUrl.split('?');
    
    console.log('🔍 Proxy route:', {
      originalUrl: req.url,
      extractedPath: pathPart,
      existingQuery: req.query
    });
    
    // Inject path into query for the shared handler logic
    req.query.path = pathPart;
    
    // Call proxy handler directly
    await proxy(req, res);
  } catch (err) {
    console.error('Proxy Route Error:', err);
    res.status(500).json({ error: 'Proxy Route Failed', details: err.message });
  }
});

// Serve Static Frontend (Vite Build)
// MUST come after API routes to avoid intercepting API calls
app.use(express.static(join(__dirname, 'dist')));

// SPA Catch-all Handler
// Redirects all non-API requests to index.html so React Router can handle them
app.get('/{0,}', (req, res) => {
  // Don't intercept API calls (redundant given order, but safe)
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not Found' });
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 3001;
app.listen(port, '0.0.0.0', async () => {
  console.log(`🚀 Railway Failover Server live on port ${port}`);
  await initDb();
});

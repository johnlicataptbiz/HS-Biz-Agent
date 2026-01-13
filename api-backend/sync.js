import { startBackgroundSync } from '../services/backend/syncService.js';
import { getSyncProgress } from '../services/backend/dataService.js';

export default async function handler(req, res) {
    // CORS
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET /api/sync -> Status
    if (req.method === 'GET') {
        try {
            const progress = await getSyncProgress();
            return res.status(200).json(progress);
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    // POST /api/sync -> Start
    if (req.method === 'POST') {
        const authHeader = req.headers.authorization || '';
        const authToken = authHeader.replace(/^Bearer\s+/i, '').trim();
        const badAuthToken =
          !authToken || authToken === 'undefined' || authToken === 'null';
        const bodyToken = req.body?.hubspotToken || req.body?.token || '';
        const envToken =
          process.env.PRIVATE_APP_ACCESS_TOKEN ||
          process.env.HUBSPOT_ACCESS_TOKEN ||
          '';
        const token = !badAuthToken ? authToken : bodyToken || envToken;

        if (!token) {
          return res.status(401).json({
            error:
              'Missing HubSpot token. Provide Authorization header or set PRIVATE_APP_ACCESS_TOKEN.',
          });
        }

        try {
            const result = await startBackgroundSync(token);
            return res.status(200).json(result);
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

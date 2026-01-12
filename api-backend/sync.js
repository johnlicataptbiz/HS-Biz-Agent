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
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
        
        const token = authHeader.replace('Bearer ', '');
        try {
            const result = await startBackgroundSync(token);
            return res.status(200).json(result);
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

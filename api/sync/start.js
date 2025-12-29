import { startBackgroundSync } from './syncService.js';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
    
    const token = authHeader.replace('Bearer ', '');
    try {
        const result = await startBackgroundSync(token);
        res.status(200).json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

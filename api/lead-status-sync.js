import { leadStatusService } from '../services/leadStatusService';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { dryRun = true, maxRecords = 5000 } = req.body || {};

  try {
    const result = await leadStatusService.syncAllContacts({ dryRun, maxRecords });
    return res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('Lead Status Sync Failed:', err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
}

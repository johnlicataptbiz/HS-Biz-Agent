export default async function handler(req, res) {
  // --- CORS HANDSHAKE ---
  const origin = req.headers.origin;
  if (origin && (origin.includes('surge.sh') || origin.includes('localhost') || origin.includes('vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { pool } = await import('../services/backend/dataService.js');

  try {
    // 1. Get unique lifecycle stages
    const lifecycleResult = await pool.query(`
      SELECT lifecyclestage, COUNT(*) as count 
      FROM contacts 
      GROUP BY lifecyclestage 
      ORDER BY count DESC
    `);

    // 2. Get unique lead statuses
    const leadStatusResult = await pool.query(`
      SELECT raw_data->'properties'->>'hs_lead_status' as lead_status, COUNT(*) as count 
      FROM contacts 
      GROUP BY 1 
      ORDER BY count DESC
    `);

    // 3. Get unique sources
    const sourceResult = await pool.query(`
      SELECT raw_data->'properties'->>'hs_analytics_source' as source, COUNT(*) as count 
      FROM contacts 
      GROUP BY 1 
      ORDER BY count DESC
    `);

    return res.status(200).json({
      lifecycle_stages: lifecycleResult.rows,
      lead_statuses: leadStatusResult.rows,
      sources: sourceResult.rows
    });

  } catch (error) {
    console.error('Aggregate Discovery Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

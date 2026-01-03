import { pool } from '../services/backend/dataService.js';

/**
 * /api/win-loss - Win/Loss Laboratory
 * 
 * Comparative analysis of Closed Won vs Closed Lost deals.
 * Key Metrics:
 * - Sales Cycle Length (Time to Close)
 * - Average Deal Size
 * - Lead Source Effectiveness (Win Rate by Source)
 */
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const client = await pool.connect();
        try {
            // 1. Overall Cohort Comparison
            const cohortQuery = `
                SELECT 
                    CASE 
                        WHEN dealstage IN ('closedwon', 'closed won', '9567249') OR dealstage ILIKE '%won%' THEN 'won'
                        WHEN dealstage IN ('closedlost', 'closed lost', 'closedlost') OR dealstage ILIKE '%lost%' THEN 'lost'
                        ELSE 'open' 
                    END as status,
                    COUNT(*) as count,
                    SUM(COALESCE(amount, 0)) as total_value,
                    ROUND(AVG(COALESCE(amount, 0))) as avg_deal_size,
                    ROUND(AVG(
                        EXTRACT(EPOCH FROM (closedate - created_at))/86400
                    )) as avg_days_to_close
                FROM deals
                WHERE closedate IS NOT NULL 
                  AND (dealstage ILIKE '%won%' OR dealstage ILIKE '%lost%' OR dealstage IN ('closedwon', 'closedlost'))
                GROUP BY 1
            `;

            // 2. Win Rate by Lead Source
            const sourceQuery = `
                SELECT 
                    COALESCE(lead_source, 'Unknown') as source,
                    COUNT(*) as total_deals,
                    COUNT(CASE WHEN dealstage ILIKE '%won%' OR dealstage IN ('closedwon', 'closed won', '9567249') THEN 1 END) as won_count,
                    COUNT(CASE WHEN dealstage ILIKE '%lost%' OR dealstage IN ('closedlost', 'closed lost') THEN 1 END) as lost_count,
                    ROUND(SUM(CASE WHEN dealstage ILIKE '%won%' OR dealstage IN ('closedwon', 'closed won', '9567249') THEN amount ELSE 0 END)) as won_revenue
                FROM deals
                WHERE dealstage ILIKE '%won%' OR dealstage ILIKE '%lost%' OR dealstage IN ('closedwon', 'closedlost')
                GROUP BY 1
                HAVING COUNT(*) > 0
                ORDER BY won_count DESC
                LIMIT 15
            `;

            // 3. Win Rate by Deal Type
             const typeQuery = `
                SELECT 
                    COALESCE(deal_type, 'Other') as type,
                    COUNT(*) as total_deals,
                    COUNT(CASE WHEN dealstage ILIKE '%won%' OR dealstage IN ('closedwon', 'closed won') THEN 1 END) as won_count,
                    COUNT(CASE WHEN dealstage ILIKE '%lost%' OR dealstage IN ('closedlost', 'closed lost') THEN 1 END) as lost_count
                FROM deals
                WHERE dealstage ILIKE '%won%' OR dealstage ILIKE '%lost%' OR dealstage IN ('closedwon', 'closedlost')
                GROUP BY 1
                ORDER BY won_count DESC
            `;

            const [cohorts, sources, types] = await Promise.all([
                client.query(cohortQuery),
                client.query(sourceQuery),
                client.query(typeQuery)
            ]);

            // Calculate formatted Win Rates for client
            const sourceAnalysis = sources.rows.map(s => ({
                ...s,
                winRate: s.total_deals > 0 ? ((s.won_count / s.total_deals) * 100).toFixed(1) : 0
            }));

            return res.status(200).json({
                success: true,
                cohorts: cohorts.rows.reduce((acc, row) => ({ ...acc, [row.status]: row }), {}),
                sources: sourceAnalysis,
                types: types.rows
            });

        } finally {
            client.release();
        }
    } catch (e) {
        console.error('Win/Loss API Error:', e);
        return res.status(500).json({ error: e.message });
    }
}

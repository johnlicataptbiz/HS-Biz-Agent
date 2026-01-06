import { pool } from '../services/backend/dataService.js';
import { filterLeadMagnets } from './utils/leadMagnets.js';

/**
 * /api/assets - Asset Intelligence (Lead Magnet Analytics)
 * 
 * Aggregates performance metrics for each unique entry point (form, landing page, or page title).
 * Metrics:
 * - Volume: Total contacts who entered via this form
 * - Quality: Average Health Score of those contacts
 * - Value: Total Closed Won Revenue attributed to this form
 * - Efficiency: Conversion Rate (Contacts -> Customers)
 */
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const client = await pool.connect();
        try {
            // Aggregation Query
            // We look at first conversion event name, landing pages, then page titles as entry points.
            
            const query = `
                WITH form_stats AS (
                    SELECT 
                        COALESCE(
                            NULLIF(raw_data->'properties'->>'hs_analytics_first_conversion_event_name', ''),
                            NULLIF(raw_data->'properties'->>'hs_analytics_source_data_2', ''),
                            NULLIF(raw_data->'properties'->>'hs_analytics_source_data_1', ''),
                            'Direct / Unknown'
                        ) as form_name,
                        COUNT(*) as total_contacts,
                        AVG(COALESCE(health_score, 0)) as avg_health_score,
                        COUNT(CASE WHEN lifecyclestage = 'customer' THEN 1 END) as customer_count
                    FROM contacts
                    GROUP BY 1
                ),
                revenue_stats AS (
                    SELECT
                        COALESCE(
                            NULLIF(d.first_form, ''),
                            NULLIF(c.raw_data->'properties'->>'hs_analytics_first_conversion_event_name', ''),
                            NULLIF(c.raw_data->'properties'->>'hs_analytics_source_data_2', ''),
                            NULLIF(c.raw_data->'properties'->>'hs_analytics_source_data_1', ''),
                            'Direct / Unknown'
                        ) as form_name,
                        SUM(amount) as total_revenue,
                        COUNT(*) as deal_count
                    FROM deals d
                    LEFT JOIN contacts c ON d.contact_id = c.id
                    WHERE dealstage IN ('closedwon', 'closed won', '9567249') OR dealstage ILIKE '%won%'
                    GROUP BY 1
                )
                SELECT 
                    f.form_name,
                    f.total_contacts,
                    ROUND(f.avg_health_score, 1) as avg_health_score,
                    f.customer_count,
                    COALESCE(r.total_revenue, 0) as total_revenue,
                    COALESCE(r.deal_count, 0) as closed_deals
                FROM form_stats f
                LEFT JOIN revenue_stats r ON f.form_name = r.form_name
                WHERE f.form_name IS NOT NULL AND f.form_name != 'Direct / Unknown'
                ORDER BY f.total_contacts DESC
                LIMIT 50;
            `;

            const result = await client.query(query);
            const filteredAssets = filterLeadMagnets(
                result.rows,
                (row) => row.form_name
            );
            
            return res.status(200).json({
                success: true,
                assets: filteredAssets
            });

        } finally {
            client.release();
        }
    } catch (e) {
        console.error('Asset Intelligence API Error:', e);
        return res.status(500).json({ error: e.message });
    }
}

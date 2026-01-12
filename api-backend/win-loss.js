import { pool } from '../services/backend/dataService.js';
import { buildDealStageFilters, dealStageFilters } from './utils/dealStage.js';
import { filterLeadMagnets } from './utils/leadMagnets.js';

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

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const client = await pool.connect();
        try {
            const querySafely = async (label, query) => {
                try {
                    const result = await client.query(query);
                    return { result, error: null };
                } catch (error) {
                    console.error(`Win/Loss query failed: ${label}`, error);
                    return { result: { rows: [] }, error: error.message };
                }
            };

            // 1. Overall Cohort Comparison
            const cohortQuery = `
                SELECT 
                    CASE 
                        WHEN ${dealStageFilters.wonFilter} THEN 'won'
                        WHEN ${dealStageFilters.lostFilter} THEN 'lost'
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
                  AND ${dealStageFilters.closedFilter}
                GROUP BY 1
            `;

            // 2. Win Rate by Entry Source (Form, Landing Page, Page Title, or Lead Source)
            const dealFilters = buildDealStageFilters({
                dealstage: "d.dealstage",
                rawData: "d.raw_data",
            });

            const sourceQuery = `
                SELECT 
                    CASE
                        WHEN jsonb_typeof(to_jsonb(c.raw_data)) = 'object'
                          AND NULLIF(to_jsonb(c.raw_data)->'properties'->>'hs_analytics_first_conversion_event_name', '') IS NOT NULL THEN
                            'Form: ' || to_jsonb(c.raw_data)->'properties'->>'hs_analytics_first_conversion_event_name'
                        WHEN jsonb_typeof(to_jsonb(c.raw_data)) = 'object'
                          AND NULLIF(to_jsonb(c.raw_data)->'properties'->>'hs_analytics_source_data_2', '') IS NOT NULL THEN
                            'Landing: ' || to_jsonb(c.raw_data)->'properties'->>'hs_analytics_source_data_2'
                        WHEN jsonb_typeof(to_jsonb(c.raw_data)) = 'object'
                          AND NULLIF(to_jsonb(c.raw_data)->'properties'->>'hs_analytics_source_data_1', '') IS NOT NULL THEN
                            'Page: ' || to_jsonb(c.raw_data)->'properties'->>'hs_analytics_source_data_1'
                        ELSE 'Source: ' || COALESCE(
                          d.lead_source,
                          CASE
                            WHEN jsonb_typeof(to_jsonb(c.raw_data)) = 'object'
                              THEN to_jsonb(c.raw_data)->'properties'->>'hs_analytics_source'
                            ELSE NULL
                          END,
                          'Unknown'
                        )
                    END as source,
                    COUNT(*) as total_deals,
                    COUNT(CASE WHEN ${dealStageFilters.wonFilter} THEN 1 END) as won_count,
                    COUNT(CASE WHEN ${dealStageFilters.lostFilter} THEN 1 END) as lost_count,
                    ROUND(SUM(CASE WHEN ${dealStageFilters.wonFilter} THEN amount ELSE 0 END)) as won_revenue
                FROM deals d
                LEFT JOIN contacts c ON d.contact_id = c.id
                WHERE ${dealFilters.closedFilter}
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
                    COUNT(CASE WHEN ${dealStageFilters.wonFilter} THEN 1 END) as won_count,
                    COUNT(CASE WHEN ${dealStageFilters.lostFilter} THEN 1 END) as lost_count
                FROM deals
                WHERE ${dealStageFilters.closedFilter}
                GROUP BY 1
                ORDER BY won_count DESC
            `;

            const [cohorts, sources, types] = await Promise.all([
                querySafely('cohortQuery', cohortQuery),
                querySafely('sourceQuery', sourceQuery),
                querySafely('typeQuery', typeQuery)
            ]);

            // Calculate formatted Win Rates for client
            const sourceAnalysis = sources.result.rows.map(s => {
                const total = parseInt(s.total_deals) || 0;
                const won = parseInt(s.won_count) || 0;
                const lost = parseInt(s.lost_count) || 0;
                return {
                    ...s,
                    winRate: total > 0 ? ((won / total) * 100).toFixed(1) : 0,
                    lossRate: total > 0 ? ((lost / total) * 100).toFixed(1) : 0
                };
            });

            const filteredSources = filterLeadMagnets(sourceAnalysis, (row) => {
                return row.source.replace(/^(Form|Landing|Page|Source):\\s*/i, '');
            });

            return res.status(200).json({
                success: true,
                cohorts: cohorts.result.rows.reduce((acc, row) => ({ ...acc, [row.status]: row }), {}),
                sources: filteredSources,
                types: types.result.rows,
                warnings: [
                    cohorts.error && 'cohorts',
                    sources.error && 'sources',
                    types.error && 'types'
                ].filter(Boolean)
            });

        } finally {
            client.release();
        }
    } catch (e) {
        console.error('Win/Loss API Error:', e);
        return res.status(500).json({ error: e.message });
    }
}

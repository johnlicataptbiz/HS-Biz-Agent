import { pool } from '../services/backend/dataService.js';
import { dealStageFilters } from './utils/dealStage.js';

/**
 * /api/velocity - Pipeline Velocity & Forecast
 * 
 * Formula: Pipeline Velocity = (Num Opportunities * Avg Deal Value * Win Rate) / Length of Sales Cycle
 * Returns:
 * - Velocity Score ($ revenue per day)
 * - Component Metrics (Win Rate, Avg Cycle, Avg Value)
 * - Deal Aging Buckets (Distribution of open deals by age)
 */
export default async function handler(req, res) {

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const client = await pool.connect();
        try {
            // 1. Historical Performance (Win Rate & Cycle Length)
            // Based on 'closedwon' and 'closedlost' deals
            const historicalQuery = `
                SELECT 
                    COUNT(*) as closed_total,
                    COUNT(CASE WHEN ${dealStageFilters.wonFilter} THEN 1 END) as closed_won,
                    COUNT(CASE WHEN ${dealStageFilters.lostFilter} THEN 1 END) as closed_lost,
                    AVG(CASE WHEN ${dealStageFilters.wonFilter} 
                        THEN EXTRACT(EPOCH FROM (closedate - created_at))/86400 ELSE NULL END
                    ) as avg_sales_cycle_days
                FROM deals
                WHERE ${dealStageFilters.closedFilter}
            `;

            // 2. Current Pipeline State (Open Deals)
            const pipelineQuery = `
                SELECT 
                    COUNT(*) as open_opps,
                    AVG(COALESCE(amount, 0)) as avg_deal_value,
                    SUM(COALESCE(amount, 0)) as total_pipeline_value
                FROM deals
                WHERE ${dealStageFilters.openFilter}
            `;

            // 3. Deal Aging Analysis (Buckets)
            // We use created_at as a proxy for entered pipeline if specific stage history isn't available
            const agingQuery = `
                WITH age_calc AS (
                    SELECT 
                        id,
                        EXTRACT(EPOCH FROM (NOW() - created_at))/86400 as age_days,
                        amount
                    FROM deals
                    WHERE ${dealStageFilters.openFilter}
                )
                SELECT 
                    CASE 
                        WHEN age_days <= 30 THEN '0-30 Days'
                        WHEN age_days <= 60 THEN '31-60 Days'
                        WHEN age_days <= 90 THEN '61-90 Days'
                        ELSE '90+ Days'
                    END as age_bucket,
                    COUNT(*) as count,
                    SUM(COALESCE(amount, 0)) as value
                FROM age_calc
                GROUP BY 1
                ORDER BY min(age_days)
            `;

            const [histResult, pipeResult, ageResult] = await Promise.all([
                client.query(historicalQuery),
                client.query(pipelineQuery),
                client.query(agingQuery)
            ]);

            const hist = histResult.rows[0];
            const pipe = pipeResult.rows[0];

            // Calculate Metrics
            const winRate = parseInt(hist.closed_total) > 0 ? (parseInt(hist.closed_won) / parseInt(hist.closed_total)) : 0;
            const avgCycle = parseFloat(hist.avg_sales_cycle_days) || 0;
            const openOpps = parseInt(pipe.open_opps) || 0;
            const avgValue = parseFloat(pipe.avg_deal_value) || 0;

            // Velocity Formula: (Opps * Value * WinRate) / Cycle
            // Result is "Revenue per Day"
            let velocity = 0;
            if (avgCycle > 0) {
                velocity = (openOpps * avgValue * winRate) / avgCycle;
            }

            return res.status(200).json({
                success: true,
                velocity: {
                    revenuePerDay: velocity,
                    revenuePerMonth: velocity * 30
                },
                components: {
                    winRate: (winRate * 100).toFixed(1),
                    avgCycleDays: avgCycle.toFixed(1),
                    openOpportunities: openOpps,
                    avgDealValue: avgValue,
                    totalPipeline: parseFloat(pipe.total_pipeline_value) || 0,
                    closedWon: parseInt(hist.closed_won) || 0,
                    closedLost: parseInt(hist.closed_lost) || 0,
                    closedTotal: parseInt(hist.closed_total) || 0
                },
                aging: ageResult.rows.map(row => ({
                    bucket: row.age_bucket,
                    count: parseInt(row.count),
                    value: parseFloat(row.value) || 0
                }))
            });

        } finally {
            client.release();
        }
    } catch (e) {
        console.error('Velocity API Error:', e);
        return res.status(500).json({ error: e.message });
    }
}

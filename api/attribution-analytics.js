import { pool } from '../services/backend/dataService.js';

/**
 * /api/attribution-analytics - Customer Journey Attribution
 * 
 * Tracks: Lead Source → Form → Deal Type → Revenue
 * Segments by: Mastermind vs Clinical Rainmaker vs Other
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const client = await pool.connect();
    
    try {
      // 1. REVENUE BY DEAL TYPE
      const revenueByTypeQuery = `
        SELECT 
          COALESCE(deal_type, 'Other') as deal_type,
          COUNT(*) as count,
          SUM(COALESCE(amount, 0)) as total_revenue,
          ROUND(AVG(COALESCE(amount, 0))) as avg_deal_size
        FROM deals
        WHERE dealstage IN ('closedwon', 'closed won', '9567249', 'closedwon_')
           OR dealstage ILIKE '%won%'
        GROUP BY deal_type
        ORDER BY total_revenue DESC
      `;

      // 2. REVENUE BY LEAD SOURCE (joining deals with contacts)
      const revenueBySourceQuery = `
        SELECT 
          COALESCE(d.lead_source, c.raw_data->'properties'->>'hs_analytics_source', 'Unknown') as source,
          COUNT(d.id) as deals_count,
          SUM(COALESCE(d.amount, 0)) as total_revenue
        FROM deals d
        LEFT JOIN contacts c ON d.contact_id = c.id
        WHERE d.dealstage IN ('closedwon', 'closed won', '9567249')
           OR d.dealstage ILIKE '%won%'
        GROUP BY source
        ORDER BY total_revenue DESC
        LIMIT 10
      `;

      // 3. REVENUE BY FORM/LEAD MAGNET
      const revenueByFormQuery = `
        SELECT 
          COALESCE(d.first_form, c.raw_data->'properties'->>'hs_analytics_first_conversion_event_name', 'Direct/Unknown') as form_name,
          COUNT(d.id) as deals_count,
          SUM(COALESCE(d.amount, 0)) as total_revenue,
          d.deal_type
        FROM deals d
        LEFT JOIN contacts c ON d.contact_id = c.id
        WHERE d.dealstage IN ('closedwon', 'closed won', '9567249')
           OR d.dealstage ILIKE '%won%'
        GROUP BY form_name, d.deal_type
        ORDER BY total_revenue DESC
        LIMIT 15
      `;

      // 4. CONVERSION FUNNEL BY STAGE
      const funnelQuery = `
        SELECT 
          COALESCE(dealstage, 'unknown') as stage,
          COUNT(*) as count,
          SUM(COALESCE(amount, 0)) as pipeline_value
        FROM deals
        GROUP BY dealstage
        ORDER BY count DESC
      `;

      // 5. TOP PERFORMING PATHS (Source → Form → Deal Type)
      const pathsQuery = `
        SELECT 
          COALESCE(d.lead_source, c.raw_data->'properties'->>'hs_analytics_source', 'Unknown') as source,
          COALESCE(d.first_form, c.raw_data->'properties'->>'hs_analytics_first_conversion_event_name', 'Direct') as form,
          d.deal_type,
          COUNT(*) as conversions,
          SUM(COALESCE(d.amount, 0)) as revenue
        FROM deals d
        LEFT JOIN contacts c ON d.contact_id = c.id
        WHERE d.dealstage IN ('closedwon', 'closed won', '9567249')
           OR d.dealstage ILIKE '%won%'
        GROUP BY source, form, d.deal_type
        ORDER BY revenue DESC
        LIMIT 10
      `;

      // 6. SUMMARY METRICS
      const summaryQuery = `
        SELECT 
          COUNT(*) as total_deals,
          COUNT(CASE WHEN dealstage IN ('closedwon', 'closed won', '9567249') OR dealstage ILIKE '%won%' THEN 1 END) as closed_won,
          SUM(CASE WHEN dealstage IN ('closedwon', 'closed won', '9567249') OR dealstage ILIKE '%won%' THEN COALESCE(amount, 0) ELSE 0 END) as closed_revenue,
          SUM(CASE WHEN NOT (dealstage IN ('closedwon', 'closed won', 'closedlost', 'closed lost') OR dealstage ILIKE '%won%' OR dealstage ILIKE '%lost%') THEN COALESCE(amount, 0) ELSE 0 END) as pipeline_value
        FROM deals
      `;

      // Execute all queries
      const [
        revenueByTypeResult,
        revenueBySourceResult,
        revenueByFormResult,
        funnelResult,
        pathsResult,
        summaryResult
      ] = await Promise.all([
        client.query(revenueByTypeQuery),
        client.query(revenueBySourceQuery),
        client.query(revenueByFormQuery),
        client.query(funnelQuery),
        client.query(pathsQuery),
        client.query(summaryQuery)
      ]);

      // Transform results
      const revenueByType = revenueByTypeResult.rows.map(row => ({
        type: row.deal_type,
        count: parseInt(row.count),
        revenue: parseFloat(row.total_revenue) || 0,
        avgDealSize: parseFloat(row.avg_deal_size) || 0
      }));

      const revenueBySource = revenueBySourceResult.rows.map(row => ({
        source: row.source,
        deals: parseInt(row.deals_count),
        revenue: parseFloat(row.total_revenue) || 0
      }));

      const revenueByForm = revenueByFormResult.rows.map(row => ({
        form: row.form_name,
        dealType: row.deal_type,
        deals: parseInt(row.deals_count),
        revenue: parseFloat(row.total_revenue) || 0
      }));

      const funnel = funnelResult.rows.map(row => ({
        stage: row.stage,
        count: parseInt(row.count),
        value: parseFloat(row.pipeline_value) || 0
      }));

      const topPaths = pathsResult.rows.map(row => ({
        source: row.source,
        form: row.form,
        dealType: row.deal_type,
        conversions: parseInt(row.conversions),
        revenue: parseFloat(row.revenue) || 0
      }));

      const summary = summaryResult.rows[0];

      return res.status(200).json({
        success: true,
        attribution: {
          summary: {
            totalDeals: parseInt(summary.total_deals) || 0,
            closedWon: parseInt(summary.closed_won) || 0,
            closedRevenue: parseFloat(summary.closed_revenue) || 0,
            pipelineValue: parseFloat(summary.pipeline_value) || 0
          },
          revenueByType,
          revenueBySource,
          revenueByForm,
          funnel,
          topPaths
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Attribution analytics error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch attribution analytics',
      message: error.message 
    });
  }
}

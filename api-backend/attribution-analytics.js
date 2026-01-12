import { pool } from '../services/backend/dataService.js';
import { buildDealStageFilters, dealStageFilters } from './utils/dealStage.js';
import { filterLeadMagnets } from './utils/leadMagnets.js';

/**
 * /api/attribution-analytics - Customer Journey Attribution
 * 
 * Tracks: Lead Source → Landing Page → Form → Page Title → Deal Type → Revenue
 * Segments by: Mastermind vs Clinical Rainmaker vs Other
 */
export default async function handler(req, res) {

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const client = await pool.connect();
    
    try {
      // 1. REVENUE BY DEAL TYPE
      const revenueByTypeQuery = `
        SELECT 
          CASE
            WHEN COALESCE(deal_type, '') ILIKE '%mastermind%' OR COALESCE(dealname, '') ILIKE '%mastermind%' THEN 'Mastermind'
            WHEN COALESCE(deal_type, '') ILIKE '%rainmaker%' OR COALESCE(deal_type, '') ILIKE '%clinical%'
              OR COALESCE(dealname, '') ILIKE '%rainmaker%' OR COALESCE(dealname, '') ILIKE '%clinical%'
              THEN 'Clinical Rainmaker'
            ELSE 'Clinical Rainmaker'
          END as deal_type,
          COUNT(*) as count,
          SUM(COALESCE(amount, 0)) as total_revenue,
          ROUND(AVG(COALESCE(amount, 0))) as avg_deal_size
        FROM deals
        WHERE ${dealStageFilters.wonFilter}
        GROUP BY 1
        ORDER BY total_revenue DESC
      `;

      const dealFilters = buildDealStageFilters({
        dealstage: "d.dealstage",
        rawData: "d.raw_data",
      });

      // 2. REVENUE BY LEAD SOURCE (joining deals with contacts)
      const revenueBySourceQuery = `
        SELECT 
          COALESCE(d.lead_source, c.raw_data->'properties'->>'hs_analytics_source', 'Unknown') as source,
          COUNT(d.id) as deals_count,
          SUM(COALESCE(d.amount, 0)) as total_revenue
        FROM deals d
        LEFT JOIN contacts c ON d.contact_id = c.id
        WHERE ${dealFilters.wonFilter}
        GROUP BY source
        ORDER BY total_revenue DESC
        LIMIT 10
      `;

      // 3. REVENUE BY FORM SUBMISSION
      const revenueByFormQuery = `
        SELECT 
          COALESCE(
            NULLIF(c.raw_data->'properties'->>'hs_analytics_first_conversion_event_name', ''),
            NULLIF(c.raw_data->'properties'->>'hs_analytics_last_conversion_event_name', ''),
            NULLIF(d.first_form, ''),
            NULLIF(d.raw_data->>'hs_analytics_first_conversion_event_name', ''),
            NULLIF(d.raw_data->>'hs_analytics_last_conversion_event_name', ''),
            NULLIF(d.raw_data->>'hs_analytics_source_data_2', ''),
            NULLIF(c.raw_data->'properties'->>'hs_analytics_source_data_2', ''),
            'Direct/Unknown'
          ) as form_name,
          COUNT(d.id) as deals_count,
          SUM(COALESCE(d.amount, 0)) as total_revenue,
          d.deal_type
        FROM deals d
        LEFT JOIN contacts c ON d.contact_id = c.id
        WHERE ${dealFilters.wonFilter}
        GROUP BY form_name, d.deal_type
        ORDER BY total_revenue DESC
        LIMIT 15
      `;

      // 4. REVENUE BY LANDING PAGE
      const revenueByLandingPageQuery = `
        SELECT 
          COALESCE(NULLIF(c.raw_data->'properties'->>'hs_analytics_source_data_2', ''), 'Direct/Unknown') as landing_page,
          COUNT(d.id) as deals_count,
          SUM(COALESCE(d.amount, 0)) as total_revenue
        FROM deals d
        LEFT JOIN contacts c ON d.contact_id = c.id
        WHERE ${dealFilters.wonFilter}
        GROUP BY landing_page
        ORDER BY total_revenue DESC
        LIMIT 15
      `;

      // 5. REVENUE BY PAGE TITLE
      const revenueByPageTitleQuery = `
        SELECT 
          COALESCE(NULLIF(c.raw_data->'properties'->>'hs_analytics_source_data_1', ''), 'Unknown') as page_title,
          COUNT(d.id) as deals_count,
          SUM(COALESCE(d.amount, 0)) as total_revenue
        FROM deals d
        LEFT JOIN contacts c ON d.contact_id = c.id
        WHERE ${dealFilters.wonFilter}
        GROUP BY page_title
        ORDER BY total_revenue DESC
        LIMIT 15
      `;

      // 6. CONVERSION FUNNEL BY STAGE
      const funnelQuery = `
        SELECT 
          COALESCE(dealstage, 'unknown') as stage,
          COUNT(*) as count,
          SUM(COALESCE(amount, 0)) as pipeline_value
        FROM deals
        GROUP BY dealstage
        ORDER BY count DESC
      `;

      // 7. TOP PERFORMING PATHS (Source → Form → Deal Type)
      const pathsQuery = `
        SELECT 
          COALESCE(d.lead_source, c.raw_data->'properties'->>'hs_analytics_source', 'Unknown') as source,
          COALESCE(
            NULLIF(c.raw_data->'properties'->>'hs_analytics_first_conversion_event_name', ''),
            NULLIF(c.raw_data->'properties'->>'hs_analytics_last_conversion_event_name', ''),
            NULLIF(d.first_form, ''),
            NULLIF(d.raw_data->>'hs_analytics_first_conversion_event_name', ''),
            NULLIF(d.raw_data->>'hs_analytics_last_conversion_event_name', ''),
            NULLIF(d.raw_data->>'hs_analytics_source_data_2', ''),
            NULLIF(c.raw_data->'properties'->>'hs_analytics_source_data_2', ''),
            'Direct'
          ) as form,
          CASE
            WHEN COALESCE(d.deal_type, '') ILIKE '%mastermind%' OR COALESCE(d.dealname, '') ILIKE '%mastermind%' THEN 'Mastermind'
            WHEN COALESCE(d.deal_type, '') ILIKE '%rainmaker%' OR COALESCE(d.deal_type, '') ILIKE '%clinical%'
              OR COALESCE(d.dealname, '') ILIKE '%rainmaker%' OR COALESCE(d.dealname, '') ILIKE '%clinical%'
              THEN 'Clinical Rainmaker'
            ELSE 'Clinical Rainmaker'
          END as deal_type,
          COUNT(*) as conversions,
          SUM(COALESCE(d.amount, 0)) as revenue
        FROM deals d
        LEFT JOIN contacts c ON d.contact_id = c.id
        WHERE ${dealFilters.wonFilter}
        GROUP BY 1, 2, 3
        ORDER BY revenue DESC
        LIMIT 10
      `;

      // 8. SUMMARY METRICS
      const summaryQuery = `
        SELECT 
          COUNT(*) as total_deals,
          COUNT(CASE WHEN ${dealStageFilters.wonFilter} THEN 1 END) as closed_won,
          COUNT(CASE WHEN ${dealStageFilters.lostFilter} THEN 1 END) as closed_lost,
          SUM(CASE WHEN ${dealStageFilters.wonFilter} THEN COALESCE(amount, 0) ELSE 0 END) as closed_revenue,
          SUM(CASE WHEN ${dealStageFilters.openFilter} THEN COALESCE(amount, 0) ELSE 0 END) as pipeline_value
        FROM deals
      `;

      // 9. CLIENT TYPE COUNTS BY ENTRY SOURCE
      const clientTypeByEntryQuery = `
        SELECT
          CASE
            WHEN NULLIF(c.raw_data->'properties'->>'hs_analytics_first_conversion_event_name', '') IS NOT NULL THEN 'Form'
            WHEN NULLIF(c.raw_data->'properties'->>'hs_analytics_source_data_2', '') IS NOT NULL THEN 'Landing Page'
            WHEN NULLIF(c.raw_data->'properties'->>'hs_analytics_source_data_1', '') IS NOT NULL THEN 'Page Title'
            ELSE 'Lead Source'
          END as entry_type,
          CASE
            WHEN NULLIF(c.raw_data->'properties'->>'hs_analytics_first_conversion_event_name', '') IS NOT NULL
              THEN c.raw_data->'properties'->>'hs_analytics_first_conversion_event_name'
            WHEN NULLIF(c.raw_data->'properties'->>'hs_analytics_source_data_2', '') IS NOT NULL
              THEN c.raw_data->'properties'->>'hs_analytics_source_data_2'
            WHEN NULLIF(c.raw_data->'properties'->>'hs_analytics_source_data_1', '') IS NOT NULL
              THEN c.raw_data->'properties'->>'hs_analytics_source_data_1'
            ELSE COALESCE(d.lead_source, c.raw_data->'properties'->>'hs_analytics_source', 'Unknown')
          END as entry_name,
          SUM(CASE WHEN d.deal_type ILIKE '%mastermind%' OR d.dealname ILIKE '%mastermind%' THEN 1 ELSE 0 END) as mm_count,
          SUM(CASE WHEN d.deal_type ILIKE '%rainmaker%' OR d.deal_type ILIKE '%clinical%'
            OR d.dealname ILIKE '%rainmaker%' OR d.dealname ILIKE '%clinical%' THEN 1 ELSE 0 END) as crm_count,
          COUNT(*) as total_count
        FROM deals d
        LEFT JOIN contacts c ON d.contact_id = c.id
        WHERE ${dealFilters.wonFilter}
        GROUP BY entry_type, entry_name
        ORDER BY total_count DESC
        LIMIT 20
      `;

      const querySafely = async (label, query) => {
        try {
          const result = await client.query(query);
          return { result, error: null };
        } catch (error) {
          console.error(`Attribution query failed: ${label}`, error);
          return { result: { rows: [] }, error: error.message };
        }
      };

      const [
        revenueByTypeResult,
        revenueBySourceResult,
        revenueByFormResult,
        revenueByLandingPageResult,
        revenueByPageTitleResult,
        funnelResult,
        pathsResult,
        summaryResult,
        clientTypeByEntryResult
      ] = await Promise.all([
        querySafely('revenueByType', revenueByTypeQuery),
        querySafely('revenueBySource', revenueBySourceQuery),
        querySafely('revenueByForm', revenueByFormQuery),
        querySafely('revenueByLandingPage', revenueByLandingPageQuery),
        querySafely('revenueByPageTitle', revenueByPageTitleQuery),
        querySafely('funnel', funnelQuery),
        querySafely('topPaths', pathsQuery),
        querySafely('summary', summaryQuery),
        querySafely('clientTypeByEntry', clientTypeByEntryQuery)
      ]);

      // Transform results
      const revenueByType = revenueByTypeResult.result.rows.map(row => ({
        type: row.deal_type,
        count: parseInt(row.count),
        revenue: parseFloat(row.total_revenue) || 0,
        avgDealSize: parseFloat(row.avg_deal_size) || 0
      }));

      const revenueBySource = revenueBySourceResult.result.rows.map(row => ({
        source: row.source,
        deals: parseInt(row.deals_count),
        revenue: parseFloat(row.total_revenue) || 0
      }));

      let revenueByForm = revenueByFormResult.result.rows.map(row => ({
        form: row.form_name,
        dealType: row.deal_type,
        deals: parseInt(row.deals_count),
        revenue: parseFloat(row.total_revenue) || 0
      }));

      let revenueByLandingPage = revenueByLandingPageResult.result.rows.map(row => ({
        landingPage: row.landing_page,
        deals: parseInt(row.deals_count),
        revenue: parseFloat(row.total_revenue) || 0
      }));

      let revenueByPageTitle = revenueByPageTitleResult.result.rows.map(row => ({
        pageTitle: row.page_title,
        deals: parseInt(row.deals_count),
        revenue: parseFloat(row.total_revenue) || 0
      }));

      const funnel = funnelResult.result.rows.map(row => ({
        stage: row.stage,
        count: parseInt(row.count),
        value: parseFloat(row.pipeline_value) || 0
      }));

      let topPaths = pathsResult.result.rows.map(row => ({
        source: row.source,
        form: row.form,
        dealType: row.deal_type,
        conversions: parseInt(row.conversions),
        revenue: parseFloat(row.revenue) || 0
      }));

      const summary = summaryResult.result.rows[0] || {};
      let clientTypeByEntry = clientTypeByEntryResult.result.rows.map(row => ({
        entryType: row.entry_type,
        entryName: row.entry_name,
        mmCount: parseInt(row.mm_count),
        crmCount: parseInt(row.crm_count),
        totalCount: parseInt(row.total_count)
      }));

      const filterOrFallback = (items, getValue) => {
        const filtered = filterLeadMagnets(items, getValue);
        return filtered.length > 0 ? filtered : items;
      };

      revenueByForm = filterOrFallback(revenueByForm, (row) => row.form);
      revenueByLandingPage = filterOrFallback(
        revenueByLandingPage,
        (row) => row.landingPage
      );
      revenueByPageTitle = filterOrFallback(
        revenueByPageTitle,
        (row) => row.pageTitle
      );
      topPaths = filterOrFallback(topPaths, (row) => row.form);
      clientTypeByEntry = filterOrFallback(
        clientTypeByEntry,
        (row) => row.entryName
      );

      return res.status(200).json({
        success: true,
        attribution: {
          summary: {
            totalDeals: parseInt(summary.total_deals) || 0,
            closedWon: parseInt(summary.closed_won) || 0,
            closedLost: parseInt(summary.closed_lost) || 0,
            closedRevenue: parseFloat(summary.closed_revenue) || 0,
            pipelineValue: parseFloat(summary.pipeline_value) || 0
          },
          revenueByType,
          revenueBySource,
          revenueByForm,
          revenueByLandingPage,
          revenueByPageTitle,
          funnel,
          topPaths,
          clientTypeByEntry
        },
        warnings: [
          revenueByTypeResult.error && 'revenueByType',
          revenueBySourceResult.error && 'revenueBySource',
          revenueByFormResult.error && 'revenueByForm',
          revenueByLandingPageResult.error && 'revenueByLandingPage',
          revenueByPageTitleResult.error && 'revenueByPageTitle',
          funnelResult.error && 'funnel',
          pathsResult.error && 'topPaths',
          summaryResult.error && 'summary',
          clientTypeByEntryResult.error && 'clientTypeByEntry'
        ].filter(Boolean)
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

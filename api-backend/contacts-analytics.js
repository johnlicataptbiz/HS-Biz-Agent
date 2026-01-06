import { pool } from "../services/backend/dataService.js";
import { isLeadMagnet } from "./utils/leadMagnets.js";

/**
 * /api/contacts-analytics - Aggregate contact data from JSONB for use across all tabs
 * This endpoint extracts lead sources, form submissions, lifecycle data, etc.
 * from the stored raw_data JSONB to enhance Campaigns, Reports, and other pages.
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const client = await pool.connect();

    try {
      // 1. LEAD SOURCES - Count contacts by original source
      const leadSourcesQuery = `
        SELECT 
          COALESCE(raw_data->'properties'->>'hs_analytics_source', 'Unknown') as source,
          COUNT(*) as count
        FROM contacts
        WHERE raw_data IS NOT NULL
        GROUP BY source
        ORDER BY count DESC
        LIMIT 15
      `;

      // 2. FORM SUBMISSIONS - Count contacts by first conversion form
      const formSubmissionsQuery = `
        SELECT 
          COALESCE(raw_data->'properties'->>'hs_analytics_first_conversion_event_name', 'No Form') as form_name,
          COUNT(*) as count
        FROM contacts
        WHERE raw_data IS NOT NULL
        GROUP BY form_name
        ORDER BY count DESC
        LIMIT 20
      `;

      // 3. LANDING PAGES (Entry Points) - Count contacts by landing page
      const landingPagesQuery = `
        SELECT 
          COALESCE(NULLIF(raw_data->'properties'->>'hs_analytics_source_data_2', ''), 'Unknown') as landing_page,
          COUNT(*) as count
        FROM contacts
        WHERE raw_data IS NOT NULL
        GROUP BY landing_page
        ORDER BY count DESC
        LIMIT 20
      `;

      // 4. PAGE TITLES - Count contacts by first page title
      const pageTitlesQuery = `
        SELECT 
          COALESCE(NULLIF(raw_data->'properties'->>'hs_analytics_source_data_1', ''), 'Unknown') as page_title,
          COUNT(*) as count
        FROM contacts
        WHERE raw_data IS NOT NULL
        GROUP BY page_title
        ORDER BY count DESC
        LIMIT 20
      `;

      // 5. LIFECYCLE DISTRIBUTION
      const lifecycleQuery = `
        SELECT 
          COALESCE(lifecyclestage, 'Unknown') as stage,
          COUNT(*) as count,
          ROUND(AVG(COALESCE(health_score, 0)), 1) as avg_score
        FROM contacts
        GROUP BY stage
        ORDER BY count DESC
      `;

      // 6. RECENT ACTIVITY - Contacts modified in last 30/60/90 days
      const activityQuery = `
        SELECT 
          COUNT(CASE WHEN last_modified > NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days,
          COUNT(CASE WHEN last_modified > NOW() - INTERVAL '30 days' THEN 1 END) as last_30_days,
          COUNT(CASE WHEN last_modified > NOW() - INTERVAL '60 days' THEN 1 END) as last_60_days,
          COUNT(CASE WHEN last_modified > NOW() - INTERVAL '90 days' THEN 1 END) as last_90_days,
          COUNT(*) as total
        FROM contacts
      `;

      // 7. OWNER DISTRIBUTION - Contacts per owner
      const ownerQuery = `
        SELECT 
          COALESCE(hubspot_owner_id, 'Unassigned') as owner_id,
          COUNT(*) as count
        FROM contacts
        GROUP BY owner_id
        ORDER BY count DESC
        LIMIT 10
      `;

      // 8. CLASSIFICATION DISTRIBUTION (Hot, Nurture, etc.)
      const classificationQuery = `
        SELECT 
          COALESCE(classification, 'Unclassified') as classification,
          COUNT(*) as count,
          ROUND(AVG(COALESCE(health_score, 0)), 1) as avg_score
        FROM contacts
        GROUP BY classification
        ORDER BY count DESC
      `;

      // 9. HIGH-VALUE LEADS (Score >= 80)
      const hotLeadsQuery = `
        SELECT 
          id,
          email,
          firstname,
          lastname,
          health_score,
          classification,
          lifecyclestage,
          last_modified
        FROM contacts
        WHERE health_score >= 80
        ORDER BY health_score DESC
        LIMIT 10
      `;

      // 10. DEAL ASSOCIATIONS (from raw_data if available)
      const dealsQuery = `
        SELECT 
          COUNT(CASE WHEN NULLIF(raw_data->'properties'->>'num_associated_deals', '')::int > 0 THEN 1 END) as with_deals,
          COUNT(*) as total
        FROM contacts
        WHERE raw_data IS NOT NULL
      `;

      // Execute all queries in parallel
      const [
        leadSourcesResult,
        formSubmissionsResult,
        landingPagesResult,
        pageTitlesResult,
        lifecycleResult,
        activityResult,
        ownerResult,
        classificationResult,
        hotLeadsResult,
        dealsResult,
      ] = await Promise.all([
        client.query(leadSourcesQuery),
        client.query(formSubmissionsQuery),
        client.query(landingPagesQuery),
        client.query(pageTitlesQuery),
        client.query(lifecycleQuery),
        client.query(activityQuery),
        client.query(ownerQuery),
        client.query(classificationQuery),
        client.query(hotLeadsQuery),
        client.query(dealsQuery),
      ]);

      // Transform results
      const leadSources = {};
      leadSourcesResult.rows.forEach((row) => {
        leadSources[row.source] = parseInt(row.count);
      });

      const formSubmissions = {};
      formSubmissionsResult.rows.forEach((row) => {
        if (row.form_name !== "No Form" && isLeadMagnet(row.form_name)) {
          formSubmissions[row.form_name] = parseInt(row.count);
        }
      });

      const landingPages = {};
      landingPagesResult.rows.forEach((row) => {
        if (row.landing_page !== "Unknown" && isLeadMagnet(row.landing_page)) {
          landingPages[row.landing_page] = parseInt(row.count);
        }
      });

      const pageTitles = {};
      pageTitlesResult.rows.forEach((row) => {
        if (row.page_title !== "Unknown" && isLeadMagnet(row.page_title)) {
          pageTitles[row.page_title] = parseInt(row.count);
        }
      });

      const lifecycleBreakdown = {};
      lifecycleResult.rows.forEach((row) => {
        lifecycleBreakdown[row.stage] = {
          count: parseInt(row.count),
          avgScore: parseFloat(row.avg_score) || 0,
        };
      });

      const classificationBreakdown = {};
      classificationResult.rows.forEach((row) => {
        classificationBreakdown[row.classification] = {
          count: parseInt(row.count),
          avgScore: parseFloat(row.avg_score) || 0,
        };
      });

      const ownerDistribution = {};
      ownerResult.rows.forEach((row) => {
        ownerDistribution[row.owner_id] = parseInt(row.count);
      });

      const activity = activityResult.rows[0];
      const deals = dealsResult.rows[0];

      return res.status(200).json({
        success: true,
        analytics: {
          // For Campaign/Form pages
          leadSources,
          formSubmissions,
          landingPages,
          pageTitles,

          // For Reports/Dashboard
          lifecycleBreakdown,
          classificationBreakdown,

          // For RevOps/Team views
          ownerDistribution,
          contactsWithDeals: parseInt(deals.with_deals) || 0,

          // Activity metrics
          activity: {
            last7Days: parseInt(activity.last_7_days) || 0,
            last30Days: parseInt(activity.last_30_days) || 0,
            last60Days: parseInt(activity.last_60_days) || 0,
            last90Days: parseInt(activity.last_90_days) || 0,
            total: parseInt(activity.total) || 0,
          },

          // Priority leads
          hotLeads: hotLeadsResult.rows.map((row) => ({
            id: row.id,
            email: row.email,
            name:
              `${row.firstname || ""} ${row.lastname || ""}`.trim() ||
              "Anonymous",
            score: row.health_score,
            classification: row.classification,
            stage: row.lifecyclestage,
            lastModified: row.last_modified,
          })),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Contact analytics error:", error);
    return res.status(500).json({
      error: "Failed to fetch contact analytics",
      message: error.message,
    });
  }
}

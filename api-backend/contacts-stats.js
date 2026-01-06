import { pool } from '../services/backend/dataService.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await pool.connect();
    
    try {
      // Aggregate contact statistics from the database
      const statsQuery = `
        SELECT 
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN classification = 'Hot' THEN 1 END) as hot_count,
          COUNT(CASE WHEN classification = 'Nurture' THEN 1 END) as nurture_count,
          COUNT(CASE WHEN classification = 'Watch' THEN 1 END) as watch_count,
          COUNT(CASE WHEN classification = 'New' THEN 1 END) as new_count,
          COUNT(CASE WHEN classification = 'Unqualified' THEN 1 END) as unqualified_count,
          COUNT(CASE WHEN classification = 'Active Client' THEN 1 END) as customer_count,
          COUNT(CASE WHEN classification = 'Employee' THEN 1 END) as employee_count,
          COUNT(CASE WHEN classification = 'Trash' THEN 1 END) as trash_count,
          COUNT(CASE WHEN email IS NULL OR email = '' THEN 1 END) as missing_email,
          COUNT(CASE WHEN hubspot_owner_id IS NULL OR hubspot_owner_id = '' THEN 1 END) as unassigned,
          COUNT(CASE WHEN last_modified < NOW() - INTERVAL '90 days' THEN 1 END) as stale_records,
          COUNT(CASE WHEN lifecyclestage = 'opportunity' AND last_modified < NOW() - INTERVAL '30 days' THEN 1 END) as ghost_opportunities,
          ROUND(AVG(COALESCE(health_score, 0)), 1) as avg_health_score,
          COUNT(CASE WHEN health_score >= 80 THEN 1 END) as high_priority_leads
        FROM contacts
      `;
      
      const statsResult = await client.query(statsQuery);
      const stats = statsResult.rows[0];

      // Lifecycle stage breakdown
      const lifecycleQuery = `
        SELECT 
          COALESCE(lifecyclestage, 'unknown') as stage,
          COUNT(*) as count
        FROM contacts
        GROUP BY lifecyclestage
        ORDER BY count DESC
      `;
      
      const lifecycleResult = await client.query(lifecycleQuery);
      const lifecycleBreakdown = {};
      lifecycleResult.rows.forEach(row => {
        lifecycleBreakdown[row.stage] = parseInt(row.count);
      });

      // Classification breakdown
      const classificationQuery = `
        SELECT 
          COALESCE(classification, 'Unclassified') as classification,
          COUNT(*) as count
        FROM contacts
        GROUP BY classification
        ORDER BY count DESC
      `;
      
      const classificationResult = await client.query(classificationQuery);
      const classificationBreakdown = {};
      classificationResult.rows.forEach(row => {
        classificationBreakdown[row.classification] = parseInt(row.count);
      });

      // Calculate health score
      const totalContacts = parseInt(stats.total_contacts) || 0;
      const issueCount = parseInt(stats.missing_email) + parseInt(stats.unassigned) + parseInt(stats.stale_records);
      const healthScore = totalContacts > 0 
        ? Math.max(0, Math.min(100, Math.round((1 - (issueCount / totalContacts)) * 100)))
        : 0;

      return res.status(200).json({
        success: true,
        stats: {
          totalContacts,
          classifications: {
            hot: parseInt(stats.hot_count) || 0,
            nurture: parseInt(stats.nurture_count) || 0,
            watch: parseInt(stats.watch_count) || 0,
            new: parseInt(stats.new_count) || 0,
            unqualified: parseInt(stats.unqualified_count) || 0,
            customer: parseInt(stats.customer_count) || 0,
            employee: parseInt(stats.employee_count) || 0,
            trash: parseInt(stats.trash_count) || 0
          },
          dataQuality: {
            missingEmail: parseInt(stats.missing_email) || 0,
            unassigned: parseInt(stats.unassigned) || 0,
            staleRecords: parseInt(stats.stale_records) || 0,
            ghostOpportunities: parseInt(stats.ghost_opportunities) || 0
          },
          healthScore,
          avgHealthScore: parseFloat(stats.avg_health_score) || 0,
          highPriorityLeads: parseInt(stats.high_priority_leads) || 0,
          lifecycleBreakdown,
          classificationBreakdown
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Contact stats error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch contact statistics',
      message: error.message 
    });
  }
}

export default async function handler(req, res) {
  // --- CORS HANDSHAKE ---
  const origin = req.headers.origin;
  if (origin && (origin.includes('surge.sh') || origin.includes('localhost') || origin.includes('vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Import pool from dataService
  const { pool } = await import('../services/backend/dataService.js');

  // GET /api/contacts - List contacts with pagination and filters
  if (req.method === 'GET') {
    try {
      const {
        page = 1,
        limit = 50,
        search = '',
        lifecyclestage = '',
        owner = '',
        classification = '',
        sort = 'last_modified',
        order = 'desc'
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params = [];
      let whereClause = 'WHERE 1=1';
      let paramIndex = 1;

      // Search filter (name or email)
      if (search) {
        whereClause += ` AND (
          LOWER(email) LIKE $${paramIndex} OR 
          LOWER(firstname) LIKE $${paramIndex} OR 
          LOWER(lastname) LIKE $${paramIndex} OR
          LOWER(raw_data->>'company') LIKE $${paramIndex}
        )`;
        params.push(`%${search.toLowerCase()}%`);
        paramIndex++;
      }

      // Lifecycle stage filter
      if (lifecyclestage) {
        whereClause += ` AND lifecyclestage = $${paramIndex}`;
        params.push(lifecyclestage);
        paramIndex++;
      }

      // Owner filter
      if (owner) {
        whereClause += ` AND hubspot_owner_id = $${paramIndex}`;
        params.push(owner);
        paramIndex++;
      }

      // Classification filter
      if (classification) {
        whereClause += ` AND classification = $${paramIndex}`;
        params.push(classification);
        paramIndex++;
      }

      // Min Health Score filter
      // Note: minScore needs to be pulled from req.query logic below (add it to destructuring)
      if (req.query.minScore) {
          whereClause += ` AND health_score >= $${paramIndex}`;
          params.push(parseInt(req.query.minScore));
          paramIndex++;
      }

      // Has Owner filter (explicit 'false' check for unassigned)
      if (req.query.hasOwner === 'false') {
          whereClause += ` AND (hubspot_owner_id IS NULL OR hubspot_owner_id = '')`;
      }

      // Deal Type filter (requires subquery)
      if (req.query.dealType) {
          whereClause += ` AND EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = contacts.id AND d.deal_type = $${paramIndex})`;
          params.push(req.query.dealType);
          paramIndex++;
      }

      // Days Inactive filter (Dual mode: Contact Stale vs Ghosted Opps)
      if (req.query.daysInactive) {
          const days = parseInt(req.query.daysInactive);
          if (req.query.hasDeal === 'true') {
             // Ghosted Opportunity Mode: Deal is inactive
             whereClause += ` AND EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = contacts.id AND d.last_modified < NOW() - INTERVAL '${days} days' AND lower(d.dealstage) NOT IN ('closedwon', 'closedlost', 'closed won', 'closed lost'))`;
          } else {
             // Stale Contact Mode
             whereClause += ` AND last_modified < NOW() - INTERVAL '${days} days'`;
          }
      }

      // Lead Source filter (supports comma-separated)
      if (req.query.leadSource) {
          const sources = req.query.leadSource.split(',').map(s => s.trim());
          if (sources.length > 1) {
              whereClause += ` AND raw_data->'properties'->>'hs_analytics_source' = ANY($${paramIndex})`;
              params.push(sources);
              paramIndex++;
          } else {
              whereClause += ` AND raw_data->'properties'->>'hs_analytics_source' = $${paramIndex}`;
              params.push(sources[0]);
              paramIndex++;
          }
      }

      // Form ID filter (checking both first_form and raw property)
      if (req.query.formId) {
          whereClause += ` AND (raw_data->'properties'->>'hs_analytics_source_data_2' = $${paramIndex} OR first_form = $${paramIndex})`;
          params.push(req.query.formId);
          paramIndex++;
      }

      // Validate sort column to prevent SQL injection
      const validSortColumns = ['last_modified', 'email', 'firstname', 'lastname', 'lifecyclestage', 'created_at', 'health_score', 'classification'];
      const sortColumn = validSortColumns.includes(sort) ? sort : 'last_modified';
      const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM contacts ${whereClause}`;
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const dataQuery = `
        SELECT 
          id,
          email,
          firstname,
          lastname,
          lifecyclestage,
          hubspot_owner_id,
          health_score,
          classification,
          last_modified,
          raw_data->>'phone' as phone,
          raw_data->>'company' as company,
          raw_data->>'jobtitle' as jobtitle,
          raw_data->'properties'->>'hs_lead_status' as lead_status,
          raw_data->'properties'->>'hs_analytics_source' as source,
          raw_data->'properties'->>'num_associated_deals' as deals,
          raw_data->>'url' as hubspot_url
        FROM contacts
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(parseInt(limit), offset);

      const result = await pool.query(dataQuery, params);
      
      // If a specific ID was requested, return the first result with FULL raw_data
      const { id } = req.query;
      if (id && result.rows.length > 0) {
        const fullResult = await pool.query('SELECT * FROM contacts WHERE id = $1', [id]);
        return res.status(200).json(fullResult.rows[0]);
      }

      return res.status(200).json({
        contacts: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Contacts API Error:', error);
      return res.status(500).json({ error: 'Failed to fetch contacts', details: error.message });
    }
  }

  // POST /api/contacts - Full-text search
  if (req.method === 'POST') {
    try {
      const { query, filters = {} } = req.body;
      
      if (!query || query.length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
      }

      const searchPattern = `%${query.toLowerCase()}%`;
      
      const result = await pool.query(`
        SELECT 
          id,
          email,
          firstname,
          lastname,
          lifecyclestage,
          health_score,
          classification,
          raw_data->>'company' as company,
          raw_data->>'url' as hubspot_url
        FROM contacts
        WHERE 
          LOWER(email) LIKE $1 OR 
          LOWER(firstname) LIKE $1 OR 
          LOWER(lastname) LIKE $1 OR
          LOWER(raw_data->>'company') LIKE $1
        ORDER BY last_modified DESC
        LIMIT 25
      `, [searchPattern]);

      return res.status(200).json({ results: result.rows });

    } catch (error) {
      console.error('Contact Search Error:', error);
      return res.status(500).json({ error: 'Search failed', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

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

      // Validate sort column to prevent SQL injection
      const validSortColumns = ['last_modified', 'email', 'firstname', 'lastname', 'lifecyclestage', 'created_at'];
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

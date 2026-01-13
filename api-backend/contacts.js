export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!process.env.DATABASE_URL) {
    if (req.method === "GET") {
      return res.status(200).json({
        contacts: [],
        pagination: { page: 1, limit: 0, total: 0, totalPages: 0 },
        warning: "DATABASE_URL not configured",
      });
    }
    if (req.method === "POST") {
      return res.status(200).json({ results: [], warning: "DATABASE_URL not configured" });
    }
  }

  // Import pool from dataService
  const { pool } = await import("../services/backend/dataService.js");

  // GET /api/contacts - List contacts with pagination and filters
  if (req.method === "GET") {
    try {
      const requestedId = req.params?.id || req.query.id;
      if (requestedId) {
        const fullResult = await pool.query(
          "SELECT * FROM contacts WHERE id = $1",
          [String(requestedId)]
        );
        const fullRow = fullResult.rows[0];
        if (!fullRow) {
          return res
            .status(404)
            .json({ error: "Contact not found in mirror", id: requestedId });
        }
        if (fullRow.classification === "Customer") {
          fullRow.classification = "Active Client";
        }
        if (
          fullRow.classification === "Active Client" ||
          fullRow.classification === "Employee"
        ) {
          fullRow.health_score = 0;
        } else if (fullRow.health_score !== null) {
          fullRow.health_score = parseFloat(fullRow.health_score);
        }
        return res.status(200).json(fullRow);
      }

      const {
        page = 1,
        limit = 50,
        search = "",
        lifecyclestage = "",
        excludeLifecycle = "",
        owner = "",
        classification = "",
        sort = "last_modified",
        order = "desc",
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const params = [];
      let whereClause = "WHERE 1=1";
      let paramIndex = 1;

      // Search filter (global: name/email/company/phone + key attribution fields)
      if (search) {
        whereClause += ` AND (
          coalesce(email, '') ILIKE $${paramIndex} OR
          coalesce(firstname, '') ILIKE $${paramIndex} OR
          coalesce(lastname, '') ILIKE $${paramIndex} OR
          (coalesce(firstname, '') || ' ' || coalesce(lastname, '')) ILIKE $${paramIndex} OR
          coalesce(raw_data->'properties'->>'company', '') ILIKE $${paramIndex} OR
          coalesce(raw_data->'properties'->>'phone', '') ILIKE $${paramIndex} OR
          coalesce(raw_data->'properties'->>'hs_analytics_source', '') ILIKE $${paramIndex} OR
          coalesce(raw_data->'properties'->>'hs_analytics_source_data_1', '') ILIKE $${paramIndex} OR
          coalesce(raw_data->'properties'->>'hs_analytics_source_data_2', '') ILIKE $${paramIndex} OR
          coalesce(raw_data->'properties'->>'hs_analytics_first_conversion_event_name', '') ILIKE $${paramIndex}
        )`;
        params.push(`%${String(search).trim()}%`);
        paramIndex++;
      }

      // Lifecycle stage filter
      if (lifecyclestage) {
        whereClause += ` AND lifecyclestage = $${paramIndex}`;
        params.push(lifecyclestage);
        paramIndex++;
      }
      if (excludeLifecycle) {
        whereClause += ` AND (lifecyclestage IS NULL OR lower(lifecyclestage) <> lower($${paramIndex}))`;
        params.push(excludeLifecycle);
        paramIndex++;
      }

      // Owner filter
      if (owner) {
        whereClause += ` AND hubspot_owner_id = $${paramIndex}`;
        params.push(owner);
        paramIndex++;
      }

      // Active Client composite filter (classification OR lifecycle/lead status/member metadata)
      if (req.query.activeClient === "true") {
        const memberPatterns = ["%member%", "%mm%", "%crm%"];
        const statusPatterns = ["%active%", "%member%"];
        whereClause += ` AND (
          classification = $${paramIndex}
          OR lower(lifecyclestage) IN ('customer', 'evangelist')
          OR lower(lifecyclestage) LIKE ANY($${paramIndex + 1})
          OR lower(raw_data->'properties'->>'hs_lead_status') LIKE ANY($${paramIndex + 1})
          OR lower(raw_data->'properties'->>'membership_type') LIKE ANY($${paramIndex + 1})
          OR (
            lower(raw_data->'properties'->>'membership_status') LIKE ANY($${paramIndex + 2})
            AND lower(raw_data->'properties'->>'membership_status') NOT LIKE '%subscriber%'
          )
        )`;
        params.push("Active Client", memberPatterns, statusPatterns);
        paramIndex += 3;
      } else if (classification) {
        // Classification filter
        whereClause += ` AND lower(classification) = lower($${paramIndex})`;
        params.push(classification);
        paramIndex++;
      }
      if (classification && String(classification).toLowerCase() === "hot") {
        whereClause += ` AND (lifecyclestage IS NULL OR lower(lifecyclestage) <> 'opportunity')`;
      }

      // Min Health Score filter
      // Note: minScore needs to be pulled from req.query logic below (add it to destructuring)
      if (req.query.minScore) {
        whereClause += ` AND health_score >= $${paramIndex}`;
        params.push(parseInt(req.query.minScore));
        paramIndex++;
      }

      // Has Owner filter (explicit 'false' check for unassigned)
      if (req.query.hasOwner === "false") {
        whereClause += ` AND (hubspot_owner_id IS NULL OR hubspot_owner_id = '')`;
      }

      // Deal Type filter (requires subquery)
      if (req.query.dealType) {
        whereClause += ` AND EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = contacts.id AND d.deal_type = $${paramIndex})`;
        params.push(req.query.dealType);
        paramIndex++;
      }

      // Deal Stage Exclusion filter (supports comma-separated)
      if (req.query.dealStageExclude) {
        const excludedStages = req.query.dealStageExclude
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        if (excludedStages.length > 0) {
          whereClause += ` AND EXISTS (
            SELECT 1 FROM deals d 
            WHERE d.contact_id = contacts.id 
              AND (d.dealstage IS NULL OR lower(d.dealstage) <> ALL($${paramIndex}))
          )`;
          params.push(excludedStages);
          paramIndex++;
        }
      }

      // Deal Stage filter (most recent deal)
      if (req.query.dealStage) {
        const stage = String(req.query.dealStage).trim().toLowerCase();
        if (stage === "closedlost" || stage === "closed lost") {
          whereClause += ` AND EXISTS (
            SELECT 1 FROM deals d
            WHERE d.contact_id = contacts.id
              AND lower(d.dealstage) IN ('closedlost', 'closed lost')
          )`;
        } else {
          whereClause += ` AND EXISTS (
            SELECT 1 FROM deals d
            WHERE d.contact_id = contacts.id
              AND lower(d.dealstage) = $${paramIndex}
          )`;
          params.push(stage);
          paramIndex++;
        }
      }

      // Has Deal filter
      if (req.query.hasDeal === "true" && !req.query.daysInactive) {
        whereClause += ` AND EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = contacts.id)`;
      } else if (req.query.hasDeal === "false") {
        whereClause += ` AND NOT EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = contacts.id)`;
      }

      // Days Inactive filter (Dual mode: Contact Stale vs Ghosted Opps)
      if (req.query.daysInactive) {
        const days = parseInt(req.query.daysInactive);
        if (req.query.hasDeal === "true") {
          // Ghosted Opportunity Mode: Deal is inactive
          whereClause += ` AND EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = contacts.id AND d.last_modified < NOW() - INTERVAL '${days} days' AND lower(d.dealstage) NOT IN ('closedwon', 'closedlost', 'closed won', 'closed lost'))`;
        } else {
          // Stale Contact Mode
          whereClause += ` AND last_modified < NOW() - INTERVAL '${days} days'`;
        }
      }

      // Lead Source filter (supports comma-separated)
      if (req.query.leadSource) {
        const sources = req.query.leadSource.split(",").map((s) => s.trim());
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
      const validSortColumns = [
        "last_modified",
        "email",
        "firstname",
        "lastname",
        "lifecyclestage",
        "created_at",
        "health_score",
        "classification",
      ];
      const sortColumn = validSortColumns.includes(sort)
        ? sort
        : "last_modified";
      const sortOrder = order.toLowerCase() === "asc" ? "ASC" : "DESC";
      const scoreSort =
        "CASE WHEN classification IN ('Active Client','Customer','Employee') THEN 0 ELSE health_score END";

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
          raw_data->'properties'->>'hs_analytics_source_data_2' as first_form,
          raw_data->'properties'->>'num_associated_deals' as deals,
          raw_data->>'url' as hubspot_url,
          d.dealstage as deal_stage
        FROM contacts
        LEFT JOIN LATERAL (
          SELECT dealstage
          FROM deals
          WHERE deals.contact_id = contacts.id
          ORDER BY last_modified DESC NULLS LAST
          LIMIT 1
        ) d ON true
        ${whereClause}
        ORDER BY ${sortColumn === "health_score" ? scoreSort : sortColumn} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(parseInt(limit), offset);

      const result = await pool.query(dataQuery, params);
      const adjustedRows = result.rows.map((row) => {
        let normalized = row.classification;
        const scoreValue = row.health_score === null ? null : parseFloat(row.health_score);
        if (normalized === "Customer") {
          normalized = "Active Client";
        }
        if (normalized === "Active Client" || normalized === "Employee") {
          return { ...row, classification: normalized, health_score: 0 };
        }
        return { ...row, classification: normalized, health_score: scoreValue };
      });

      return res.status(200).json({
        contacts: adjustedRows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error("Contacts API Error:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch contacts", details: error.message });
    }
  }

  // POST /api/contacts - Full-text search
  if (req.method === "POST") {
    try {
      const { query, filters = {} } = req.body;

      if (!query || query.length < 2) {
        return res
          .status(400)
          .json({ error: "Search query must be at least 2 characters" });
      }

      const searchPattern = `%${query.toLowerCase()}%`;

      const result = await pool.query(
        `
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
      `,
        [searchPattern]
      );

      const adjustedResults = result.rows.map((row) => ({
        ...row,
        health_score: row.health_score === null ? null : parseFloat(row.health_score),
      }));

      return res.status(200).json({ results: adjustedResults });
    } catch (error) {
      console.error("Contact Search Error:", error);
      return res
        .status(500)
        .json({ error: "Search failed", details: error.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

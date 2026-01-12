import { pool } from '../services/backend/dataService.js';

/**
 * /api/segments - Manage Saved Segments (Smart Views)
 */
export default async function handler(req, res) {

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const client = await pool.connect();

        // GET: List all segments
        if (req.method === 'GET') {
            try {
                // Check if we need to seed defaults
                const check = await client.query('SELECT COUNT(*) FROM segments');
                if (parseInt(check.rows[0].count) === 0) {
                    await seedDefaults(client);
                }

                const result = await client.query('SELECT * FROM segments ORDER BY is_system DESC, name ASC');
                const enriched = [];
                for (const seg of result.rows) {
                    const count = await getSegmentCount(client, seg.query_config || {});
                    enriched.push({ ...seg, count });
                }
                return res.status(200).json(enriched);
            } finally {
                client.release();
            }
        }

        // POST: Create new segment
        if (req.method === 'POST') {
            try {
                const { name, description, query_config, icon = 'Filter' } = req.body;
                if (!name || !query_config) {
                    return res.status(400).json({ error: 'Name and query config required' });
                }

                const result = await client.query(
                    'INSERT INTO segments (name, description, query_config, icon) VALUES ($1, $2, $3, $4) RETURNING *',
                    [name, description, query_config, icon]
                );
                return res.status(201).json(result.rows[0]);
            } finally {
                client.release();
            }
        }

        // DELETE: Remove segment
        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'Segment ID required' });

            try {
                await client.query('DELETE FROM segments WHERE id = $1 AND is_system = FALSE', [id]);
                return res.status(200).json({ success: true });
            } finally {
                client.release();
            }
        }

    } catch (e) {
        console.error('Segments API Error:', e);
        return res.status(500).json({ error: e.message });
    }
}

async function getSegmentCount(client, queryConfig = {}) {
    const params = [];
    let paramIndex = 1;
    let whereClause = 'WHERE 1=1';

    if (queryConfig.minScore !== undefined && queryConfig.minScore !== null) {
        whereClause += ` AND health_score >= $${paramIndex}`;
        params.push(parseInt(queryConfig.minScore));
        paramIndex++;
    }

    if (queryConfig.hasOwner === false) {
        whereClause += ` AND (hubspot_owner_id IS NULL OR hubspot_owner_id = '')`;
    }

    if (queryConfig.lifecycleStage) {
        whereClause += ` AND lifecyclestage = $${paramIndex}`;
        params.push(queryConfig.lifecycleStage);
        paramIndex++;
    }

    if (queryConfig.classification) {
        whereClause += ` AND classification = $${paramIndex}`;
        params.push(queryConfig.classification);
        paramIndex++;
    }

    if (queryConfig.dealType) {
        whereClause += ` AND EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = contacts.id AND d.deal_type = $${paramIndex})`;
        params.push(queryConfig.dealType);
        paramIndex++;
    }

    if (queryConfig.dealStageExclude) {
        const excludedStages = String(queryConfig.dealStageExclude)
            .split(',')
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

    if (queryConfig.daysInactive) {
        const days = parseInt(queryConfig.daysInactive);
        if (queryConfig.hasDeal) {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM deals d 
                WHERE d.contact_id = contacts.id 
                  AND d.last_modified < NOW() - ($${paramIndex} || ' days')::interval
                  AND lower(d.dealstage) NOT IN ('closedwon','closedlost','closed won','closed lost')
            )`;
            params.push(String(days));
            paramIndex++;
        } else {
            whereClause += ` AND last_modified < NOW() - ($${paramIndex} || ' days')::interval`;
            params.push(String(days));
            paramIndex++;
        }
    }

    if (queryConfig.hasDeal === true && !queryConfig.daysInactive) {
        whereClause += ` AND EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = contacts.id)`;
    } else if (queryConfig.hasDeal === false) {
        whereClause += ` AND NOT EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = contacts.id)`;
    }

    if (queryConfig.leadSource) {
        const sources = String(queryConfig.leadSource)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        if (sources.length > 1) {
            whereClause += ` AND raw_data->'properties'->>'hs_analytics_source' = ANY($${paramIndex})`;
            params.push(sources);
            paramIndex++;
        } else if (sources.length === 1) {
            whereClause += ` AND raw_data->'properties'->>'hs_analytics_source' = $${paramIndex}`;
            params.push(sources[0]);
            paramIndex++;
        }
    }

    if (queryConfig.formId) {
        whereClause += ` AND (raw_data->'properties'->>'hs_analytics_source_data_2' = $${paramIndex} OR first_form = $${paramIndex})`;
        params.push(queryConfig.formId);
        paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) as total FROM contacts ${whereClause}`;
    const countResult = await client.query(countQuery, params);
    return parseInt(countResult.rows[0].total) || 0;
}

async function seedDefaults(client) {
    const defaults = [
        {
            name: 'Ghosted Opportunities 👻',
            description: 'Deals open > 30 days with no recent activity',
            icon: 'Ghost',
            query_config: {
                hasDeal: true,
                dealStageExclude: ['closedwon', 'closedlost'],
                daysInactive: 30
            }
        },
        {
            name: 'High Value Orphans 🔥',
            description: 'Health Score > 80 with no owner',
            icon: 'Flame',
            query_config: {
                minScore: 80,
                hasOwner: false
            }
        },
        {
            name: 'Stale Customers 💤',
            description: 'Customers not modified in 90+ days',
            icon: 'Moon',
            query_config: {
                lifecycleStage: 'customer',
                daysInactive: 90
            }
        },
        {
            name: 'Mastermind Leads 🧠',
            description: 'Qualified leads for Mastermind program',
            icon: 'Brain',
            query_config: {
                classification: 'Hot',
                dealType: 'Mastermind'
            }
        },
        {
            name: 'Organic Traffic 🌱',
            description: 'Leads from SEO and Direct traffic',
            icon: 'Sprout',
            query_config: {
                leadSource: 'ORGANIC_SEARCH,DIRECT_TRAFFIC'
            }
        },
        {
            name: 'Paid Lead Gen 🚀',
            description: 'Leads from Paid Social and Advertise',
            icon: 'Zap',
            query_config: {
                leadSource: 'PAID_SOCIAL,PAID_SEARCH'
            }
        }
    ];

    for (const seg of defaults) {
        await client.query(
            'INSERT INTO segments (name, description, query_config, is_system, icon) VALUES ($1, $2, $3, TRUE, $4)',
            [seg.name, seg.description, seg.query_config, seg.icon]
        );
    }
}

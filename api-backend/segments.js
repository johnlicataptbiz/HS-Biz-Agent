import { pool } from '../services/backend/dataService.js';

/**
 * /api/segments - Manage Saved Segments (Smart Views)
 */
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
                return res.status(200).json(result.rows);
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

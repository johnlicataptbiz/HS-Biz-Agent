import pg from 'pg';
const { Pool } = pg;

// Connection pool with graceful fallback
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

export const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sync_state (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                email TEXT,
                firstname TEXT,
                lastname TEXT,
                lifecyclestage TEXT,
                hubspot_owner_id TEXT,
                health_score INTEGER,
                last_modified TIMESTAMP,
                raw_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sync_logs (
                id SERIAL PRIMARY KEY,
                status TEXT,
                records_synced INTEGER,
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ PostgreSQL Schema Initialized');
        return true;
    } catch (e) {
        console.error('❌ Database Initialization Failed:', e.message);
        return false;
    }
};

export const saveContacts = async (contacts) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const contact of contacts) {
            const query = `
                INSERT INTO contacts (id, email, firstname, lastname, lifecyclestage, hubspot_owner_id, last_modified, raw_data)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    firstname = EXCLUDED.firstname,
                    lastname = EXCLUDED.lastname,
                    lifecyclestage = EXCLUDED.lifecyclestage,
                    hubspot_owner_id = EXCLUDED.hubspot_owner_id,
                    last_modified = EXCLUDED.last_modified,
                    raw_data = EXCLUDED.raw_data;
            `;
            const values = [
                contact.id,
                contact.properties?.email || null,
                contact.properties?.firstname || null,
                contact.properties?.lastname || null,
                contact.properties?.lifecyclestage || null,
                contact.properties?.hubspot_owner_id || null,
                contact.updatedAt || new Date().toISOString(),
                contact
            ];
            await client.query(query, values);
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const getSyncProgress = async () => {
    if (!process.env.DATABASE_URL) {
        return { count: 0, status: 'error', error: 'Mirror Offline: DATABASE_URL missing' };
    }
    try {
        const res = await pool.query('SELECT COUNT(*) as count FROM contacts');
        const state = await pool.query('SELECT value FROM sync_state WHERE key = $1', ['sync_status']);
        return {
            count: parseInt(res.rows[0].count),
            status: state.rows[0]?.value || 'idle'
        };
    } catch (e) {
        console.error('Database query failed:', e.message);
        throw new Error(`Database query failed: ${e.message}`);
    }
};

export const updateSyncStatus = async (status) => {
    await pool.query(`
        INSERT INTO sync_state (key, value, updated_at) 
        VALUES ('sync_status', $1, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [status]);
    
    if (status === 'completed') {
        await pool.query(`
            INSERT INTO sync_state (key, value, updated_at) 
            VALUES ('last_sync_time', $1, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
        `, [new Date().toISOString()]);
    }
};

export const getLastSyncTime = async () => {
    const res = await pool.query('SELECT value FROM sync_state WHERE key = $1', ['last_sync_time']);
    return res.rows[0]?.value || null;
};

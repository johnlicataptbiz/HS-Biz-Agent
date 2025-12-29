import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function discover() {
  try {
    console.log('--- PROPERTY DISCOVERY ---');
    const keys = await pool.query(`
      SELECT DISTINCT jsonb_object_keys(raw_data->'properties') as key
      FROM contacts
    `);
    
    const relevantKeys = keys.rows
      .map(r => r.key)
      .filter(k => k.toLowerCase().includes('mastermind') || 
                  k.toLowerCase().includes('membership') || 
                  k.toLowerCase().includes('mm_') ||
                  k.toLowerCase().includes('member'));
    
    console.log('Relevant Keys found:', relevantKeys);

    for (const key of relevantKeys) {
      console.log(`\n--- DISTRIBUTION FOR: ${key} ---`);
      const dist = await pool.query(`
        SELECT raw_data->'properties'->>$1 as value, COUNT(*) 
        FROM contacts 
        GROUP BY 1 
        ORDER BY 2 DESC
      `, [key]);
      console.table(dist.rows);
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

discover();

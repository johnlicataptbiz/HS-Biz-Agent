import { pool } from './services/backend/dataService.js';

async function test() {
  try {
    const res = await pool.query('SELECT lifecyclestage, COUNT(*) FROM contacts GROUP BY 1 ORDER BY 2 DESC');
    console.table(res.rows);
    
    // Also look for potential MM fields
    const res2 = await pool.query("SELECT DISTINCT jsonb_object_keys(raw_data->'properties') FROM contacts");
    const keys = res2.rows.map(r => r.jsonb_object_keys);
    const mmKeys = keys.filter(k => k.toLowerCase().includes('mm') || k.toLowerCase().includes('mastermind'));
    console.log('MM related keys:', mmKeys);
    
    for (const key of mmKeys) {
      const res3 = await pool.query(`SELECT raw_data->'properties'->>$1 as val, COUNT(*) FROM contacts GROUP BY 1 ORDER BY 2 DESC`, [key]);
      console.log(`Values for ${key}:`);
      console.table(res3.rows);
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

test();

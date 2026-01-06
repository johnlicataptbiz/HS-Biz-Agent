import pg from "pg";
const { Pool } = pg;

// Connection pool with graceful fallback
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
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
                health_score NUMERIC(5,2),
                classification TEXT,
                last_modified TIMESTAMP,
                raw_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS deals (
                id TEXT PRIMARY KEY,
                dealname TEXT,
                amount NUMERIC,
                dealstage TEXT,
                pipeline TEXT,
                closedate TIMESTAMP,
                last_modified TIMESTAMP,
                deal_type TEXT,
                contact_id TEXT,
                lead_source TEXT,
                first_form TEXT,
                raw_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS segments (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                query_config JSONB NOT NULL,
                is_system BOOLEAN DEFAULT FALSE,
                icon TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sync_logs (
                id SERIAL PRIMARY KEY,
                status TEXT,
                records_synced INTEGER,
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Migrations (Idempotent)
            ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_modified TIMESTAMP;
            ALTER TABLE contacts ADD COLUMN IF NOT EXISTS classification TEXT;
            ALTER TABLE contacts ADD COLUMN IF NOT EXISTS health_score NUMERIC(5,2);
            ALTER TABLE contacts ALTER COLUMN health_score TYPE NUMERIC(5,2) USING health_score::numeric;
        `);
    console.log("✅ PostgreSQL Schema Initialized (with deals table)");
    return true;
  } catch (e) {
    console.error("❌ Database Initialization Failed:", e.message);
    return false;
  }
};

export const saveContacts = async (contacts) => {
  const { calculateHealthScore, classifyLead } = await import(
    "./healthScoreService.js"
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const contact of contacts) {
      const { score } = calculateHealthScore(contact);
      const classification = classifyLead(contact);
      contact.classification = classification;
      const query = `
                INSERT INTO contacts (id, email, firstname, lastname, lifecyclestage, hubspot_owner_id, health_score, classification, last_modified, raw_data)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    firstname = EXCLUDED.firstname,
                    lastname = EXCLUDED.lastname,
                    lifecyclestage = EXCLUDED.lifecyclestage,
                    hubspot_owner_id = EXCLUDED.hubspot_owner_id,
                    health_score = EXCLUDED.health_score,
                    classification = EXCLUDED.classification,
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
        score,
        contact.classification || null,
        contact.updatedAt || new Date().toISOString(),
        contact,
      ];
      await client.query(query, values);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

export const getSyncProgress = async () => {
  if (!process.env.DATABASE_URL) {
    return {
      count: 0,
      status: "error",
      error: "Mirror Offline: DATABASE_URL missing",
    };
  }
  try {
    const res = await pool.query("SELECT COUNT(*) as count FROM contacts");
    const state = await pool.query(
      "SELECT value, updated_at FROM sync_state WHERE key = $1",
      ["sync_status"]
    );
    const errorState = await pool.query(
      "SELECT value FROM sync_state WHERE key = $1",
      ["sync_error"]
    );
    let status = state.rows[0]?.value || "idle";
    const updatedAt = state.rows[0]?.updated_at
      ? new Date(state.rows[0].updated_at)
      : null;

    if (status === "syncing" && updatedAt) {
      const staleMs = 30 * 60 * 1000;
      if (Date.now() - updatedAt.getTime() > staleMs) {
        status = parseInt(res.rows[0].count) > 0 ? "completed" : "idle";
        await updateSyncStatus(status);
      }
    }
    return {
      count: parseInt(res.rows[0].count),
      status,
      error: errorState.rows[0]?.value || "",
    };
  } catch (e) {
    console.error("Database query failed:", e.message);
    throw new Error(`Database query failed: ${e.message}`);
  }
};

export const updateSyncStatus = async (status, message = "") => {
  await pool.query(
    `
        INSERT INTO sync_state (key, value, updated_at) 
        VALUES ('sync_status', $1, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `,
    [status]
  );

  await pool.query(
    `
        INSERT INTO sync_state (key, value, updated_at) 
        VALUES ('sync_error', $1, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `,
    [status === "failed" ? message : ""]
  );

  if (status === "completed") {
    await pool.query(
      `
            INSERT INTO sync_state (key, value, updated_at) 
            VALUES ('last_sync_time', $1, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
        `,
      [new Date().toISOString()]
    );
  }
};

export const getLastSyncTime = async () => {
  const res = await pool.query("SELECT value FROM sync_state WHERE key = $1", [
    "last_sync_time",
  ]);
  return res.rows[0]?.value || null;
};

export const updateContactHealthScore = async (id, score, rawData) => {
  await pool.query(
    "UPDATE contacts SET health_score = $1, raw_data = $2, last_modified = CURRENT_TIMESTAMP WHERE id = $3",
    [score, rawData, id]
  );
};

/**
 * Save deals with contact attribution data
 * Extracts deal type from dealname and links to contact's lead source/form
 */
export const saveDeals = async (deals, contactMap = {}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const deal of deals) {
      const normalizeTimestamp = (value) => {
        if (!value || value === "") return null;
        return value;
      };
      const normalizeNumber = (value) => {
        if (value === "" || value === null || value === undefined) return null;
        const parsed = Number(value);
        return Number.isNaN(parsed) ? null : parsed;
      };
      // Infer deal type from name (Mastermind, Clinical Rainmaker, etc.)
      const dealName = (deal.dealname || deal.name || "").toLowerCase();
      let dealType = "Other";
      if (dealName.includes("mastermind")) dealType = "Mastermind";
      else if (dealName.includes("rainmaker") || dealName.includes("clinical"))
        dealType = "Clinical Rainmaker";
      else if (dealName.includes("coaching")) dealType = "Coaching";
      else if (dealName.includes("consulting")) dealType = "Consulting";

      // Get contact attribution from contactMap if available
      const name = (deal.dealname || "").toLowerCase();
      if (name.includes("mastermind") || name.includes("mm"))
        dealType = "Mastermind";
      else if (name.includes("rainmaker") || name.includes("clinical"))
        dealType = "Clinical Rainmaker";
      else if (name.includes("coaching")) dealType = "Coaching";
      else if (name.includes("consulting")) dealType = "Consulting";

      const query = `
                INSERT INTO deals (id, dealname, amount, dealstage, pipeline, closedate, last_modified, deal_type, contact_id, lead_source, first_form, raw_data)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (id) DO UPDATE SET
                    dealname = EXCLUDED.dealname,
                    amount = EXCLUDED.amount,
                    dealstage = EXCLUDED.dealstage,
                    pipeline = EXCLUDED.pipeline,
                    closedate = EXCLUDED.closedate,
                    last_modified = EXCLUDED.last_modified,
                    deal_type = EXCLUDED.deal_type,
                    contact_id = EXCLUDED.contact_id,
                    raw_data = EXCLUDED.raw_data;
            `;

      await client.query(query, [
        deal.id,
        deal.dealname,
        normalizeNumber(deal.amount),
        deal.dealstage,
        deal.pipeline,
        normalizeTimestamp(deal.closedate),
        normalizeTimestamp(deal.last_modified) || new Date().toISOString(), // New field
        dealType,
        deal.contactId,
        deal.leadSource,
        deal.firstForm,
        JSON.stringify(deal.properties),
      ]);
    }
    await client.query("COMMIT");
    console.log(`✅ Saved ${deals.length} deals to database`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Deal save error:", e);
    throw e;
  } finally {
    client.release();
  }
};

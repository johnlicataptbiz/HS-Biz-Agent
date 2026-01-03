import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Process-level error handling for immediate visibility in Railway logs
process.on("uncaughtException", (err) => {
  console.error("💥 CRITICAL: Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "💥 CRITICAL: Unhandled Rejection at:",
    promise,
    "reason:",
    reason
  );
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// 1. LISTEN FIRST - Respond to healthchecks immediately
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

console.log(`📡 Starting server on port ${port}...`);
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Railway Failover Server live on port ${port}`);
});

// 2. MIDDLEWARE & PROXY (Proxy must come before express.json to avoid issues with content-type on GET)
const allowedOrigins = [
  "https://hubspot-ai-optimizer.vercel.app",
  "https://hubspot-ai-optimizer-murex.vercel.app",
  "https://core-ui-ptbiz.surge.sh",
  "http://localhost:3000",
  "http://localhost:3002",
  "http://localhost:3001",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.includes("vercel.app") ||
        origin.includes("railway.app")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "X-CSRF-Token",
      "X-Api-Version",
    ],
  })
);

// HUBPSOT PROXY (Exempt from global json parsing)
app.all(/^\/api\/hubspot\/(.*)/, async (req, res) => {
  try {
    const pathPart = req.params[0];
    if (!pathPart) return res.status(400).json({ error: "Invalid proxy path" });
    const { default: proxy } = await import("./api-backend/proxy.js");
    req.query.path = pathPart;
    await proxy(req, res);
  } catch (err) {
    console.error("Proxy Route Error:", err);
    if (!res.headersSent)
      res
        .status(500)
        .json({ error: "Proxy Route Failed", details: err.message });
  }
});

app.use(express.json());

// 3. ADAPTIVE ROUTE WRAPPER (Dynamic Import Support)
const wrap = (modulePath) => async (req, res) => {
  try {
    const module = await import(modulePath);
    const handler = module.default;
    await handler(req, res);
  } catch (err) {
    console.error(`❌ Handler Error (${modulePath}):`, err);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: "Internal Server Error", message: err.message });
    }
  }
};

// 4. API ROUTES (Dynamically Loaded)
app.all("/api/token", wrap("./api-backend/token.js"));
app.all("/api/ai", wrap("./api-backend/ai.js"));
app.all("/api/remediate", wrap("./api-backend/remediate.js"));
app.all("/api/cleanup", wrap("./api-backend/cleanup.js"));
app.all("/api/vibe-ai", wrap("./api-backend/vibe-ai.js"));
app.all("/api/oauth-start", wrap("./api-backend/oauth-start.js"));
app.all("/api/contacts", wrap("./api-backend/contacts.js"));
app.all("/api/contacts/aggregates", wrap("./api-backend/aggregates.js"));
app.all("/api/assets", wrap("./api-backend/assets.js"));
app.all(
  "/api/attribution-analytics",
  wrap("./api-backend/attribution-analytics.js")
);
app.all("/api/contact-workflows", wrap("./api-backend/contact-workflows.js"));
app.all("/api/contacts-analytics", wrap("./api-backend/contacts-analytics.js"));
app.all("/api/contacts-stats", wrap("./api-backend/contacts-stats.js"));
app.all("/api/enrich-apply", wrap("./api-backend/enrich-apply.js"));
app.all("/api/enrich", wrap("./api-backend/enrich.js"));
app.all("/api/lead-status-sync", wrap("./api-backend/lead-status-sync.js"));
app.all("/api/segments", wrap("./api-backend/segments.js"));
app.all("/api/sync", wrap("./api-backend/sync.js"));
app.all("/api/velocity", wrap("./api-backend/velocity.js"));
app.all("/api/win-loss", wrap("./api-backend/win-loss.js"));

// 5. CRM SYNC & SPECIAL ENDPOINTS
app.post("/api/sync/start", async (req, res) => {
  try {
    const { startBackgroundSync } = await import(
      "./services/backend/syncService.js"
    );
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ error: "Missing Authorization header" });
    const token = authHeader.replace("Bearer ", "");
    const result = await startBackgroundSync(token);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/sync/status", async (req, res) => {
  try {
    const { getSyncProgress } = await import(
      "./services/backend/dataService.js"
    );
    const progress = await getSyncProgress();
    res.json(progress);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/sync/reset", async (req, res) => {
  try {
    const { updateSyncStatus } = await import(
      "./services/backend/dataService.js"
    );
    await updateSyncStatus("idle");
    res.json({ message: "Sync status reset to idle" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/sync/sample", async (req, res) => {
  try {
    const { pool } = await import("./services/backend/dataService.js");
    const result = await pool.query(
      "SELECT * FROM contacts ORDER BY last_modified DESC LIMIT 5"
    );
    res.json({ leads: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/contacts/process-scores", async (req, res) => {
  try {
    const { pool, updateContactHealthScore } = await import(
      "./services/backend/dataService.js"
    );
    const { calculateHealthScore } = await import(
      "./services/backend/healthScoreService.js"
    );
    res.status(202).json({ message: "Score processing started in background" });
    (async () => {
      console.log("🚀 Starting batch health score processing...");
      let processed = 0,
        hasMore = true,
        lastId = null;
      while (hasMore) {
        const query = lastId
          ? "SELECT id, raw_data FROM contacts WHERE id > $1 ORDER BY id LIMIT 500"
          : "SELECT id, raw_data FROM contacts ORDER BY id LIMIT 500";
        const result = await pool.query(query, lastId ? [lastId] : []);
        if (result.rows.length === 0) {
          hasMore = false;
          break;
        }
        for (const row of result.rows) {
          const { score } = calculateHealthScore(row.raw_data);
          await updateContactHealthScore(row.id, score, row.raw_data);
          processed++;
          lastId = row.id;
        }
        console.log(`📊 Processed ${processed} contact scores...`);
        await new Promise((r) => setTimeout(r, 100));
      }
      console.log("✅ Batch health score processing completed!");
    })();
  } catch (e) {
    console.error("Score processing error:", e);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// Static files & SPA
app.use(express.static(join(__dirname, "dist")));
app.get("/embeds/tour-33", (req, res) =>
  res.sendFile(join(__dirname, "embeds/tour-33.html"))
);
app.get(/.*/, (req, res) => {
  if (req.path.startsWith("/api"))
    return res.status(404).json({ error: "Not Found" });
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// Post-Listen Initialization
(async () => {
  try {
    const { initDb } = await import("./services/backend/dataService.js");
    console.log("🗄️ Initializing Database...");
    await initDb();
    console.log("✅ Database Initialization Complete");
  } catch (err) {
    console.error("❌ Database Initialization Async Error:", err);
  }
})();

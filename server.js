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

// 0. GLOBAL DEBUG LOGGING
app.use((req, res, next) => {
  console.log(
    `[DEBUG] ${req.method} ${req.url} (Original: ${req.originalUrl})`
  );
  next();
});

// 1. LISTEN FIRST - Respond to healthchecks immediately
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/api/debug-ping", (req, res) => {
  res.json({ pong: true, time: new Date().toISOString() });
});

console.log(`📡 Initializing server on port ${port}...`);

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
app.all("/api/hubspot/*", async (req, res) => {
  try {
    const { default: proxy } = await import("./api-backend/proxy.js");
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
app.all("/api/sync/status", wrap("./api-backend/sync.js")); // Route both to the same file which handles GET/POST
app.all("/api/velocity", wrap("./api-backend/velocity.js"));
app.all("/api/win-loss", wrap("./api-backend/win-loss.js"));

// 5. STATIC FILES & SPA FALLBACK
app.use(express.static(join(__dirname, "dist")));

// API Fallback - Must return JSON
app.all("/api/*", (req, res) => {
  console.log(`[404] API Route Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: "API Route Not Found",
    path: req.originalUrl,
    method: req.method,
  });
});

// SPA Fallback - Returns HTML
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// 6. START SERVER
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Railway Failover Server live on port ${port}`);
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

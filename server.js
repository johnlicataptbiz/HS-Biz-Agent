import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || "*";
const port = process.env.PORT || 3001;

// 1. MIDDLEWARE
app.use(
  cors({
    origin: true, // Echoes the request origin, allowing all origins
    credentials: true,
  })
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, X-Requested-With"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});
// PROXY must be before express.json()
// We'll define the proxy within the router below

// 2. ROUTER DEFINITION
const apiRouter = express.Router();

// Logging for API
apiRouter.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Generic Wrapper for Dynamic Imports
const wrap = (modulePath) => async (req, res) => {
  try {
    const module = await import(modulePath);
    await module.default(req, res);
  } catch (err) {
    console.error(`❌ Handler Error (${modulePath}):`, err);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: "Internal Server Error", message: err.message });
    }
  }
};

// --- HUBSPOT PROXY ---
apiRouter.all(/^\/hubspot\/.*/, async (req, res) => {
  try {
    const { default: proxy } = await import("./api-backend/proxy.js");
    await proxy(req, res);
  } catch (err) {
    res.status(500).json({ error: "Proxy Failed", details: err.message });
  }
});

// --- CORE API ROUTES (Standard) ---
apiRouter.use(express.json());

apiRouter.all("/token", wrap("./api-backend/token.js"));
apiRouter.all("/oauth-start", wrap("./api-backend/oauth-start.js"));
apiRouter.all("/ai", wrap("./api-backend/ai.js"));
apiRouter.all(
  "/contacts-analytics",
  wrap("./api-backend/contacts-analytics.js")
);
apiRouter.all("/contacts", wrap("./api-backend/contacts.js"));
apiRouter.all("/segments", wrap("./api-backend/segments.js"));
apiRouter.all("/assets", wrap("./api-backend/assets.js"));
apiRouter.all("/velocity", wrap("./api-backend/velocity.js"));
apiRouter.all("/win-loss", wrap("./api-backend/win-loss.js"));
apiRouter.all(
  "/attribution-analytics",
  wrap("./api-backend/attribution-analytics.js")
);
apiRouter.all("/notes", wrap("./api-backend/notes.js"));
apiRouter.all("/sync", wrap("./api-backend/sync.js"));
apiRouter.all("/sync/status", wrap("./api-backend/sync.js"));
apiRouter.all("/sync/start", wrap("./api-backend/sync.js"));
apiRouter.all("/debug-ping", (req, res) =>
  res.json({ pong: true, env: process.env.NODE_ENV })
);

// Fallback for API
apiRouter.all(/.*/, (req, res) => {
  res
    .status(404)
    .json({ error: "API Route Not Found in Router", path: req.url });
});

// 3. MOUNT ROUTER
app.use("/api", apiRouter);

// 4. STATIC FILES & SPA
app.use(express.static(join(__dirname, "dist")));

app.get("/health", (req, res) => res.status(200).send("OK"));

// Catch-all SPA - STRICTOR CHECK
app.get(/.*/, (req, res) => {
  if (req.url.startsWith("/api")) {
    return res.status(404).json({ error: "API Not Found (Root Fallback)" });
  }
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// 5. START UP
app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Server live on port ${port}`);
});

// DB Init
(async () => {
  try {
    const { initDb } = await import("./services/backend/dataService.js");
    await initDb();
    console.log("✅ DB Connected");
  } catch (err) {
    console.error("❌ DB fail", err);
  }
})();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Get the authorization header from the request
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  // REVOLUTIONARY PROXY STRATEGY:
  // We take the exact string after /api/hubspot/ from the original URL.
  // This preserves encoding, multiple query params, and prevents "double ??" issues.
  const basePrefix = "/api/hubspot/";
  const originalUrl = req.originalUrl || req.url || "";

  let targetPathWithQuery = "";
  if (originalUrl.includes(basePrefix)) {
    targetPathWithQuery = originalUrl.substring(
      originalUrl.indexOf(basePrefix) + basePrefix.length
    );
  } else {
    // Fallback to the path parameter set by server.js
    targetPathWithQuery = req.query.path || "";
  }

  // Trim leading slashes
  targetPathWithQuery = targetPathWithQuery.replace(/^\/+/, "");

  if (!targetPathWithQuery) {
    return res.status(400).json({ error: "Invalid proxy path" });
  }

  // Construct the full HubSpot URL
  const hubspotUrl = `https://api.hubapi.com/${targetPathWithQuery}`;

  console.log(`[Proxy] ${req.method} -> ${hubspotUrl}`);

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    };

    // Forward the body if present (only for non-GET/HEAD)
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.body && Object.keys(req.body).length > 0) {
        fetchOptions.headers["Content-Type"] = "application/json";
        fetchOptions.body = JSON.stringify(req.body);
      }
    }

    const response = await fetch(hubspotUrl, fetchOptions);
    const contentType = response.headers.get("content-type");

    let data;
    const isJson = contentType && contentType.includes("application/json");

    if (isJson) {
      data = await response.json().catch(() => ({}));
    } else {
      const text = await response.text().catch(() => "");
      data = { message: text };
    }

    if (!response.ok) {
      console.error("❌ [Proxy] HubSpot Error:", {
        status: response.status,
        url: hubspotUrl,
        responseBody: data,
      });

      return res.status(response.status).json({
        success: false,
        error: "HubSpot API Error",
        status: response.status,
        message: data?.message || data?.error || `HTTP ${response.status}`,
        details: data,
        proxy_target: hubspotUrl,
      });
    }

    // Forward the status code and data from HubSpot
    res.status(response.status).json(data);
  } catch (error) {
    console.error("HubSpot API Proxy Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to proxy request to HubSpot",
      details: error.message,
      path: hubspotUrl,
    });
  }
}

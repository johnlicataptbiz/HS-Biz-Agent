export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Path is already put into req.query.path by server.js
  let { path, ...otherParams } = req.query;

  if (!path) {
    return res.status(400).json({ error: "Missing path parameter" });
  }

  // Clean leading slash to avoid double slashes in hubspotUrl
  if (path.startsWith("/")) {
    path = path.substring(1);
  }

  // Get the authorization header from the request
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  // Reconstruct the original query string from the request URL to avoid issues with nested params
  // req.url in Express includes the path and query string
  const urlParts = req.url.split("?");
  let queryString = "";
  if (urlParts.length > 1) {
    // We want all params EXCEPT 'path' (which was added by server.js)
    const searchParams = new URLSearchParams(urlParts[1]);
    searchParams.delete("path");
    queryString = searchParams.toString();
    if (queryString) queryString = "?" + queryString;
  }

  // Construct the full HubSpot URL
  const hubspotUrl = `https://api.hubapi.com/${path}${queryString}`;

  console.log(`[Proxy] ${req.method} ${hubspotUrl}`);

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
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
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
        message: data?.message || "Unknown error",
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

export default async function handler(req, res) {
  // --- CORS HANDSHAKE ---
  const origin = req.headers.origin;
  if (
    origin &&
    (origin.includes("surge.sh") ||
      origin.includes("localhost") ||
      origin.includes("vercel.app"))
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Get the path from query parameter
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

  // Build query string from remaining parameters (excluding 'path')
  const queryString =
    Object.keys(otherParams).length > 0
      ? "?" + new URLSearchParams(otherParams).toString()
      : "";

  // Construct the full HubSpot URL with query params
  const hubspotUrl = `https://api.hubapi.com/${path}${queryString}`;

  console.log("Proxying to:", hubspotUrl);

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    };

    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      fetchOptions.headers["Content-Type"] = "application/json";
      fetchOptions.body =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body);
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

    // Forward the status code from HubSpot
    res.status(response.status).json(data);
  } catch (error) {
    console.error("HubSpot API Proxy Error:", error);
    res.status(500).json({
      error: "Failed to proxy request to HubSpot",
      details: error.message,
      path: hubspotUrl,
    });
  }
}

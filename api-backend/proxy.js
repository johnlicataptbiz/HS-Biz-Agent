export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  // Robust path extraction
  const originalUrl = req.originalUrl || req.url || "";
  const hubspotIdentifier = "/hubspot/";

  let targetPathWithQuery = "";
  if (originalUrl.includes(hubspotIdentifier)) {
    targetPathWithQuery = originalUrl.substring(
      originalUrl.indexOf(hubspotIdentifier) + hubspotIdentifier.length
    );
  } else {
    // If not in URL, check if express stripped the prefix already
    targetPathWithQuery = req.params?.[0] || "";
    const queryString = originalUrl.includes("?")
      ? originalUrl.substring(originalUrl.indexOf("?"))
      : "";
    targetPathWithQuery += queryString;
  }

  // Clean leading slashes
  targetPathWithQuery = targetPathWithQuery.replace(/^\/+/, "");

  if (!targetPathWithQuery) {
    return res
      .status(400)
      .json({ error: "Invalid proxy path - target missing" });
  }

  const hubspotUrl = `https://api.hubapi.com/${targetPathWithQuery}`;
  console.log(`[PROXY] -> ${hubspotUrl}`);

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
      data = await response.json().catch(() => ({}));
    } else {
      const text = await response.text().catch(() => "");
      data = { message: text };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        status: response.status,
        message:
          data?.message || data?.error || `HubSpot Error ${response.status}`,
        details: data,
      });
    }

    res.status(response.status).json(data);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Proxy Execution Error", details: error.message });
  }
}

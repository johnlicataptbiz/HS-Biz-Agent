export default async function handler(req, res) {
  // Get the path after /api/hubspot/
  const { path } = req.query;
  const apiPath = Array.isArray(path) ? path.join('/') : path;
  
  // Get the authorization header from the request
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const hubspotUrl = `https://api.hubapi.com/${apiPath}`;
  
  try {
    const response = await fetch(hubspotUrl, {
      method: req.method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();
    
    // Forward the status code from HubSpot
    res.status(response.status).json(data);
  } catch (error) {
    console.error('HubSpot API Proxy Error:', error);
    res.status(500).json({ error: 'Failed to proxy request to HubSpot', details: error.message });
  }
}

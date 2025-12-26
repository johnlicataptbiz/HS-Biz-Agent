export default async function handler(req, res) {
  // Get the path from query parameter
  const { path } = req.query;
  
  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }
  
  // Get the authorization header from the request
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  // Construct the full HubSpot URL
  const hubspotUrl = `https://api.hubapi.com/${path}`;
  
  console.log('Proxying to:', hubspotUrl);
  
  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    };
    
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(hubspotUrl, fetchOptions);
    const data = await response.json();
    
    // Forward the status code from HubSpot
    res.status(response.status).json(data);
  } catch (error) {
    console.error('HubSpot API Proxy Error:', error);
    res.status(500).json({ error: 'Failed to proxy request to HubSpot', details: error.message });
  }
}

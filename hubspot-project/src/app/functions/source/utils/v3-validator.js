const crypto = require('crypto');

exports.validateSignature = (req, clientSecret) => {
  const method = req.method;
  const signature = req.headers['x-hubspot-signature-v3'];
  const timestamp = req.headers['x-hubspot-request-timestamp'];
  const ignoredUrl = req.originalUrl.split('#')[0]; // Remove hash if present

  // 1. Check timestamp (reject if > 5 mins old)
  if (Date.now() - timestamp > 300000) {
    throw new Error('Request too old');
  }

  // 2. Construct source string
  // For GET, body is empty. For POST, use raw body.
  const body = req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : (req.body || "");
  const source = method + ignoredUrl + body + timestamp;

  // 3. Hash
  const hash = crypto.createHmac('sha256', clientSecret).update(source).digest('base64');

  // 4. Compare
  if (hash !== signature) {
    throw new Error('Invalid signature');
  }
  return true;
};

// CORS middleware for Firebase Functions
const cors = require('cors')({
  origin: [
    'http://localhost:3000',
    'https://mycarwebsite-f69e4.web.app',
    'https://mycarwebsite-f69e4.firebaseapp.com',
  ],
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 3600,
});

// Helper function for handling CORS pre-flight requests
function handleCorsAndAuth(handler) {
  return (req, res) => {
    // For OPTIONS requests, respond immediately with CORS headers
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Max-Age', '3600');
      res.set('Access-Control-Allow-Credentials', 'true');
      res.status(204).send('');
      return;
    }

    // For regular requests, use the cors middleware
    return cors(req, res, () => handler(req, res));
  };
}

module.exports = handleCorsAndAuth;

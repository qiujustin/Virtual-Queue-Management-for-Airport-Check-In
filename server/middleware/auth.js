const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  // 1. Get the token from the request header
  const authHeader = req.headers['authorization'];
  
  // Format is usually "Bearer <TOKEN_STRING>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  // 2. Verify the token with your secret key
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token." });
    }

    // 3. Success! Attach user data to the request so routes can use it
    req.user = user; 
    next(); // Move to the actual route handler
  });
}

function requireAdmin(req, res, next) {
  // This runs AFTER authenticateToken, so we already have req.user
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin };
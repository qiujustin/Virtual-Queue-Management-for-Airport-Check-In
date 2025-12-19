const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  // Format: "Bearer <TOKEN_STRING>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token." });
    }

    req.user = user; 
    next();
  });
}

function requireAdmin(req, res, next) {
  // Requires authenticateToken to run first to populate req.user
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin };
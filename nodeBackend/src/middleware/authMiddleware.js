const { verifyToken } = require('../utils/cryptoAuth');

/**
 * Middleware to protect routes and check JWT validity.
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Authentication token is missing' });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token' });
    }

    // Attach user payload to request
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Auth processing failure' });
  }
}

module.exports = authMiddleware;

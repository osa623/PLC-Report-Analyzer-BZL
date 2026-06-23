const crypto = require('crypto');

// Load JWT secret from environment or use a secure fallback for local development
const JWT_SECRET = process.env.JWT_SECRET || 'fdi_document_intelligence_jwt_secret_key_2026';

/**
 * Hash a password using Node's native scrypt algorithm.
 * Returns salt:hash format.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored salt:hash string.
 */
function verifyPassword(password, storedHash) {
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
  } catch (e) {
    return false;
  }
}

/**
 * Helper to encode strings to base64url format (JWT standard).
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Helper to decode base64url strings.
 */
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Sign a token using standard JWT structure (Header.Payload.Signature) with HS256.
 * Token defaults to 7 days expiration.
 */
function signToken(payload) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days expiration
  const body = base64UrlEncode(JSON.stringify({ ...payload, exp }));
  
  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(`${header}.${body}`);
  const signature = base64UrlEncode(hmac.digest());
  
  return `${header}.${body}.${signature}`;
}

/**
 * Verify a standard JWT token. Returns the decoded payload if valid, or null.
 */
function verifyToken(token) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, body, signature] = parts;
    const hmac = crypto.createHmac('sha256', JWT_SECRET);
    hmac.update(`${header}.${body}`);
    const expectedSignature = base64UrlEncode(hmac.digest());
    
    // Constant time signature comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    
    const payload = JSON.parse(base64UrlDecode(body));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expired
    }
    
    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken
};

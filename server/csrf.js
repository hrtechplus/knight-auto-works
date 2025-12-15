// ============================================
// CSRF PROTECTION MODULE
// ============================================

import crypto from 'crypto';

// Store for CSRF tokens (in production, use Redis or database)
const csrfTokens = new Map();

// Token expiry time (1 hour)
const TOKEN_EXPIRY = 60 * 60 * 1000;

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(sessionId) {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(token, {
    sessionId,
    createdAt: Date.now()
  });
  
  // Clean up expired tokens periodically
  cleanupExpiredTokens();
  
  return token;
}

/**
 * Validate a CSRF token
 */
export function validateCsrfToken(token, sessionId) {
  const data = csrfTokens.get(token);
  
  if (!data) {
    return false;
  }
  
  // Check if token has expired
  if (Date.now() - data.createdAt > TOKEN_EXPIRY) {
    csrfTokens.delete(token);
    return false;
  }
  
  // Validate session match
  if (data.sessionId !== sessionId) {
    return false;
  }
  
  return true;
}

/**
 * Invalidate a CSRF token (after use)
 */
export function invalidateCsrfToken(token) {
  csrfTokens.delete(token);
}

/**
 * Cleanup expired tokens
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now - data.createdAt > TOKEN_EXPIRY) {
      csrfTokens.delete(token);
    }
  }
}

/**
 * CSRF Protection Middleware
 * Skip for safe methods (GET, HEAD, OPTIONS)
 */
export function csrfMiddleware(req, res, next) {
  // Skip for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }
  
  // Skip for login endpoint (no session yet)
  if (req.path === '/api/auth/login') {
    return next();
  }
  
  const token = req.headers['x-csrf-token'];
  const sessionId = req.user?.id?.toString() || req.ip;
  
  if (!token || !validateCsrfToken(token, sessionId)) {
    return res.status(403).json({
      error: {
        code: 'CSRF_ERROR',
        message: 'Invalid or missing CSRF token'
      }
    });
  }
  
  next();
}

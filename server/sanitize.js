// ============================================
// INPUT SANITIZATION MODULE
// ============================================

/**
 * Remove HTML tags from a string
 */
export function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Escape HTML entities
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Remove potentially dangerous characters for SQL
 * Note: This is a backup - always use parameterized queries
 */
export function sanitizeForDb(str) {
  if (typeof str !== 'string') return str;
  // Remove null bytes and other control characters
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitize phone numbers - keep only digits, spaces, dashes, plus, and parentheses
 */
export function sanitizePhone(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[^\d\s\-+()]/g, '');
}

/**
 * Sanitize email - basic validation and lowercase
 */
export function sanitizeEmail(str) {
  if (typeof str !== 'string') return str;
  return str.toLowerCase().trim();
}

/**
 * Recursively sanitize an object
 */
export function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return stripHtml(sanitizeForDb(obj));
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }
  return sanitized;
}

/**
 * Sanitization Middleware
 * Sanitizes req.body for all incoming requests
 */
export function sanitizeMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

// ============================================
// DATA ENCRYPTION MODULE
// ============================================

import crypto from 'crypto';

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Get encryption key from environment (must be 32 bytes for AES-256)
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn('WARNING: ENCRYPTION_KEY not set. Using default key (INSECURE for production)');
    return crypto.scryptSync('default-key-change-in-production', 'salt', 32);
  }
  // If key is provided, derive a 32-byte key from it
  return crypto.scryptSync(key, 'knight-auto-salt', 32);
}

/**
 * Encrypt a string
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text in format: iv:authTag:ciphertext (all base64)
 */
export function encrypt(text) {
  if (!text || typeof text !== 'string') return text;
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:ciphertext (all base64 encoded)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error.message);
    return text; // Return original on error (fallback)
  }
}

/**
 * Decrypt a string
 * @param {string} encryptedText - Encrypted text in format: iv:authTag:ciphertext
 * @returns {string} - Decrypted plain text
 */
export function decrypt(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string') return encryptedText;
  
  // Check if it's in encrypted format
  if (!encryptedText.includes(':')) {
    return encryptedText; // Not encrypted, return as-is
  }
  
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    
    if (parts.length !== 3) {
      return encryptedText; // Invalid format, return as-is
    }
    
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const ciphertext = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return encryptedText; // Return original on error
  }
}

/**
 * Check if a string appears to be encrypted
 */
export function isEncrypted(text) {
  if (!text || typeof text !== 'string') return false;
  const parts = text.split(':');
  return parts.length === 3 && parts.every(p => p.length > 0);
}

/**
 * Encrypt specific fields in an object
 */
export function encryptFields(obj, fields) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = encrypt(result[field]);
    }
  }
  return result;
}

/**
 * Decrypt specific fields in an object
 */
export function decryptFields(obj, fields) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = decrypt(result[field]);
    }
  }
  return result;
}

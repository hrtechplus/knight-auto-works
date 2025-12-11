// ============================================
// AUTHENTICATION MODULE
// ============================================

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './database.js';
import { createError, ErrorCodes } from './validation.js';

// Secret key for JWT (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'knight-auto-works-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

export function authMiddleware(req, res, next) {
  // Skip auth for login route and health check
  const publicPaths = ['/api/auth/login', '/api/health'];
  if (publicPaths.includes(req.path)) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(createError(
      ErrorCodes.UNAUTHORIZED || 'UNAUTHORIZED',
      'Authentication required'
    ));
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user still exists and is active
    const user = db.prepare('SELECT id, username, name, role, is_active FROM users WHERE id = ?').get(decoded.userId);
    
    if (!user || !user.is_active) {
      return res.status(401).json(createError(
        ErrorCodes.UNAUTHORIZED || 'UNAUTHORIZED',
        'User not found or inactive'
      ));
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json(createError(
        ErrorCodes.UNAUTHORIZED || 'UNAUTHORIZED',
        'Token expired, please login again'
      ));
    }
    return res.status(401).json(createError(
      ErrorCodes.UNAUTHORIZED || 'UNAUTHORIZED',
      'Invalid token'
    ));
  }
}

// ============================================
// ROLE-BASED AUTHORIZATION (optional)
// ============================================

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(createError(
        ErrorCodes.UNAUTHORIZED || 'UNAUTHORIZED',
        'Authentication required'
      ));
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json(createError(
        'FORBIDDEN',
        'Insufficient permissions'
      ));
    }
    
    next();
  };
}

// ============================================
// AUTH HELPER FUNCTIONS
// ============================================

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// ============================================
// AUTH ROUTES (to be used in index.js)
// ============================================

// Public auth routes (no authentication required)
export function setupPublicAuthRoutes(app) {
  // Login
  app.post('/api/auth/login', (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json(createError(
          ErrorCodes.VALIDATION_ERROR,
          'Username and password are required'
        ));
      }
      
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      
      if (!user) {
        return res.status(401).json(createError(
          ErrorCodes.UNAUTHORIZED || 'UNAUTHORIZED',
          'Invalid credentials'
        ));
      }
      
      if (!user.is_active) {
        return res.status(401).json(createError(
          ErrorCodes.UNAUTHORIZED || 'UNAUTHORIZED',
          'Account is disabled'
        ));
      }
      
      if (!verifyPassword(password, user.password_hash)) {
        return res.status(401).json(createError(
          ErrorCodes.UNAUTHORIZED || 'UNAUTHORIZED',
          'Invalid credentials'
        ));
      }
      
      // Update last login
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
      
      const token = generateToken(user.id);
      
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
    }
  });
}

// Protected auth routes (authentication required)
export function setupProtectedAuthRoutes(app) {
  // Get current user
  app.get('/api/auth/me', (req, res) => {
    if (!req.user) {
      return res.status(401).json(createError(
        ErrorCodes.UNAUTHORIZED || 'UNAUTHORIZED',
        'Not authenticated'
      ));
    }
    res.json(req.user);
  });
  
  // Change password
  app.put('/api/auth/password', (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json(createError(
          ErrorCodes.VALIDATION_ERROR,
          'Current and new password are required'
        ));
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json(createError(
          ErrorCodes.VALIDATION_ERROR,
          'New password must be at least 6 characters'
        ));
      }
      
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      
      if (!verifyPassword(currentPassword, user.password_hash)) {
        return res.status(400).json(createError(
          ErrorCodes.VALIDATION_ERROR,
          'Current password is incorrect'
        ));
      }
      
      const newHash = hashPassword(newPassword);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
      
      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
    }
  });
  
  // Get all users (admin only)
  app.get('/api/users', requireRole('admin'), (req, res) => {
    try {
      const users = db.prepare(`
        SELECT id, username, name, role, is_active, created_at, last_login
        FROM users ORDER BY created_at DESC
      `).all();
      res.json(users);
    } catch (error) {
      res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
    }
  });
  
  // Create user (admin only)
  app.post('/api/users', requireRole('admin'), (req, res) => {
    try {
      const { username, password, name, role } = req.body;
      
      if (!username || !password || !name) {
        return res.status(400).json(createError(
          ErrorCodes.VALIDATION_ERROR,
          'Username, password, and name are required'
        ));
      }
      
      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) {
        return res.status(400).json(createError(
          ErrorCodes.CONFLICT,
          'Username already exists'
        ));
      }
      
      const passwordHash = hashPassword(password);
      const result = db.prepare(`
        INSERT INTO users (username, password_hash, name, role)
        VALUES (?, ?, ?, ?)
      `).run(username, passwordHash, name, role || 'staff');
      
      res.json({
        id: result.lastInsertRowid,
        username,
        name,
        role: role || 'staff'
      });
    } catch (error) {
      res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
    }
  });
  
  // Update user (admin only)
  app.put('/api/users/:id', requireRole('admin'), (req, res) => {
    try {
      const { name, role, is_active, password } = req.body;
      const userId = req.params.id;
      
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!user) {
        return res.status(404).json(createError(ErrorCodes.NOT_FOUND, 'User not found'));
      }
      
      if (password) {
        const newHash = hashPassword(password);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);
      }
      
      db.prepare(`
        UPDATE users SET name = ?, role = ?, is_active = ? WHERE id = ?
      `).run(
        name || user.name,
        role || user.role,
        is_active !== undefined ? is_active : user.is_active,
        userId
      );
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json(createError(ErrorCodes.INTERNAL_ERROR, error.message));
    }
  });
}

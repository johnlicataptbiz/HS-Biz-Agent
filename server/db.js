import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'app.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS hubspot_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at INTEGER,
    portal_id TEXT,
    hub_domain TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_connections_user ON hubspot_connections(user_id);

  CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Lightweight migration: ensure 'role' column exists on users (older DBs)
try {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasRole = columns.some((c) => c.name === 'role');
  if (!hasRole) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member'");
  }
} catch (e) {
  // ignore if pragma unavailable
}

// JWT Secret (use env var in production!)
const JWT_SECRET = process.env.JWT_SECRET || 'hs-biz-agent-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

// ============================================================
// User Management
// ============================================================

export function createUser(email, password, name = null) {
  const id = randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);
  
  try {
    const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, ?, ?, 'member')
    `);
    stmt.run(id, email.toLowerCase(), passwordHash, name);
    return { id, email: email.toLowerCase(), name, role: 'member' };
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new Error('Email already registered');
    }
    throw error;
  }
}

export function authenticateUser(email, password) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const user = stmt.get(email.toLowerCase());
  
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return null;
  }
  
  return { id: user.id, email: user.email, name: user.name };
}

export function getUserById(id) {
  const stmt = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?');
  return stmt.get(id);
}

// ============================================================
// JWT Token Management
// ============================================================

export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Express middleware to authenticate requests
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  req.user = decoded;
  next();
}

// ============================================================
// HubSpot Connection Management
// ============================================================

export function saveHubSpotConnection(userId, accessToken, refreshToken = null, expiresIn = null, portalId = null, hubDomain = null) {
  const id = randomUUID();
  const expiresAt = expiresIn ? Date.now() + (expiresIn * 1000) : null;
  
  // Upsert - replace existing connection for user
  const stmt = db.prepare(`
    INSERT INTO hubspot_connections (id, user_id, access_token, refresh_token, expires_at, portal_id, hub_domain, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, hubspot_connections.refresh_token),
      expires_at = excluded.expires_at,
      portal_id = COALESCE(excluded.portal_id, hubspot_connections.portal_id),
      hub_domain = COALESCE(excluded.hub_domain, hubspot_connections.hub_domain),
      updated_at = CURRENT_TIMESTAMP
  `);
  
  stmt.run(id, userId, accessToken, refreshToken, expiresAt, portalId, hubDomain);
}

export function getHubSpotConnection(userId) {
  const stmt = db.prepare('SELECT * FROM hubspot_connections WHERE user_id = ?');
  return stmt.get(userId);
}

export function deleteHubSpotConnection(userId) {
  const stmt = db.prepare('DELETE FROM hubspot_connections WHERE user_id = ?');
  stmt.run(userId);
}

export function updateHubSpotTokens(userId, accessToken, refreshToken = null, expiresIn = null) {
  const expiresAt = expiresIn ? Date.now() + (expiresIn * 1000) : null;
  
  const stmt = db.prepare(`
    UPDATE hubspot_connections 
    SET access_token = ?, 
        refresh_token = COALESCE(?, refresh_token),
        expires_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `);
  
  stmt.run(accessToken, refreshToken, expiresAt, userId);
}

export function updatePortalInfo(userId, portalId, hubDomain) {
  const stmt = db.prepare(`
    UPDATE hubspot_connections 
    SET portal_id = ?, hub_domain = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `);
  
  stmt.run(portalId, hubDomain, userId);
}

// Check if token needs refresh (5 min buffer)
export function isTokenExpired(connection) {
  if (!connection?.expires_at) return false; // PAT tokens don't expire
  const bufferMs = 5 * 60 * 1000;
  return Date.now() > (connection.expires_at - bufferMs);
}

// ============================================================
// Utility
// ============================================================

export function closeDatabase() {
  db.close();
}

// ============================================================
// Usage Tracking
// ============================================================

export function logUsage(userId, event, metadata = null) {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO usage_events (id, user_id, event, metadata)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, userId, event, metadata ? JSON.stringify(metadata) : null);
}

export default db;

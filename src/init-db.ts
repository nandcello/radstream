#!/usr/bin/env bun

import { Database } from "bun:sqlite";

/**
 * Initialize the database with the required user table
 * that matches the schema from better-auth
 */

const db = new Database("./db.sqlite", { create: true });

const createUserTable = `
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  emailVerified BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

const createSessionTable = `
CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expiresAt DATETIME NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES user (id) ON DELETE CASCADE
);
`;

const createAccountTable = `
CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  accessToken TEXT,
  refreshToken TEXT,
  accessTokenExpiresAt DATETIME,
  refreshTokenExpiresAt DATETIME,
  scope TEXT,
  idToken TEXT,
  password TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES user (id) ON DELETE CASCADE,
  UNIQUE(providerId, accountId)
);
`;

const createVerificationTable = `
CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt DATETIME NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

console.log("🗄️  Initializing database...");

try {
  // Execute table creation
  db.exec(createUserTable);
  console.log("✅ User table created");

  db.exec(createSessionTable);
  console.log("✅ Session table created");

  db.exec(createAccountTable);
  console.log("✅ Account table created");

  db.exec(createVerificationTable);
  console.log("✅ Verification table created");

  // Show the schema to confirm
  const tables = db
    .query("SELECT name FROM sqlite_master WHERE type='table'")
    .all();
  console.log(
    "📋 Tables in database:",
    tables.map((t) => (t as { name: string }).name),
  );

  // Show user table schema specifically
  const userSchema = db.query("PRAGMA table_info(user)").all();
  console.log("👤 User table schema:");
  console.table(userSchema);

  console.log("🎉 Database initialization complete!");
} catch (error) {
  console.error("❌ Database initialization failed:", error);
  process.exit(1);
} finally {
  db.close();
}

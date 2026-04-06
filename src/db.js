const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const dataDir = path.join(__dirname, "..", "data");
const defaultDbPath = path.join(dataDir, "finance.db");

let db;

function getResolvedDbPath() {
  return process.env.DB_PATH || defaultDbPath;
}

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      role TEXT NOT NULL CHECK(role IN ('viewer', 'analyst', 'admin')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS financial_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL CHECK(amount >= 0),
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(created_by) REFERENCES users(id)
    );
  `);

  const userColumns = db.prepare("PRAGMA table_info(users)").all();
  const hasPasswordHash = userColumns.some((col) => col.name === "password_hash");

  if (!hasPasswordHash) {
    db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
  }
}

function seedUsersIfNeeded() {
  const seedUsers = [
    ["System Admin", "admin@finance.local", "Admin@123", "admin", "active"],
    ["Data Analyst", "analyst@finance.local", "Analyst@123", "analyst", "active"],
    ["Dashboard Viewer", "viewer@finance.local", "Viewer@123", "viewer", "active"]
  ];

  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (userCount === 0) {
    const seedStmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows) => {
      for (const [name, email, password, role, status] of rows) {
        const passwordHash = bcrypt.hashSync(password, 10);
        seedStmt.run(name, email, passwordHash, role, status);
      }
    });

    insertMany(seedUsers);
    return;
  }

  const defaultPasswordsByEmail = {
    "admin@finance.local": "Admin@123",
    "analyst@finance.local": "Analyst@123",
    "viewer@finance.local": "Viewer@123"
  };

  const usersWithoutPassword = db
    .prepare("SELECT id, email FROM users WHERE password_hash IS NULL OR password_hash = ''")
    .all();

  const updateStmt = db.prepare("UPDATE users SET password_hash = ? WHERE id = ?");
  const updateMany = db.transaction((rows) => {
    for (const row of rows) {
      const password = defaultPasswordsByEmail[row.email] || "ChangeMe@123";
      updateStmt.run(bcrypt.hashSync(password, 10), row.id);
    }
  });

  if (usersWithoutPassword.length > 0) {
    updateMany(usersWithoutPassword);
  }
}

function initializeDatabase(options = {}) {
  const { forceReset = false } = options;

  if (db && !forceReset) {
    return db;
  }

  if (db && forceReset) {
    db.close();
    db = null;
  }

  const resolvedDbPath = getResolvedDbPath();

  if (resolvedDbPath !== ":memory:" && !fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(resolvedDbPath);
  db.pragma("foreign_keys = ON");

  if (forceReset) {
    db.exec(`
      DROP TABLE IF EXISTS financial_records;
      DROP TABLE IF EXISTS users;
    `);
  }

  ensureSchema();
  seedUsersIfNeeded();

  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call initializeDatabase() first.");
  }

  return db;
}

module.exports = {
  initializeDatabase,
  getDb,
  closeDatabase
};

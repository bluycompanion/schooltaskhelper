const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function openDb(filename = path.join(process.cwd(), 'data', 'dev.sqlite')) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  return db;
}

function ensureColumn(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name);
  if (!columns.includes(columnName)) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  }
}

function runMigrations(db) {
  const upSql = fs.readFileSync(path.join(process.cwd(), 'db', 'migrations', '001_init_up.sql'), 'utf8');
  db.exec(upSql);

  const animationsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_feedback_animations'").get();
  if (animationsTable) {
    ensureColumn(db, 'task_feedback_animations', 'delivered_at', 'TEXT');
    ensureColumn(db, 'task_feedback_animations', 'seen_at', 'TEXT');
  }
}

module.exports = { openDb, runMigrations };

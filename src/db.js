const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function openDb(filename = path.join(process.cwd(), 'data', 'dev.sqlite')) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  return db;
}

function runMigrations(db) {
  const upSql = fs.readFileSync(path.join(process.cwd(), 'db', 'migrations', '001_init_up.sql'), 'utf8');
  db.exec(upSql);
}

module.exports = { openDb, runMigrations };

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '../db/scheduler.db');

let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  initSchema();
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, buffer);
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS interviews (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      position TEXT NOT NULL,
      interviewer_name TEXT NOT NULL,
      interviewer_email TEXT NOT NULL,
      status TEXT DEFAULT 'pending_interviewer',
      interviewer_token TEXT UNIQUE,
      candidate_token TEXT UNIQUE,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS time_slots (
      id TEXT PRIMARY KEY,
      interview_id TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL,
      interview_id TEXT NOT NULL,
      candidate_name TEXT NOT NULL,
      candidate_email TEXT NOT NULL,
      candidate_phone TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(slot_id)
    )
  `);
  saveDb();
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row = {};
    cols.forEach((c, i) => { row[c] = vals[i]; });
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row = {};
    cols.forEach((c, i) => { row[c] = vals[i]; });
    rows.push(row);
  }
  stmt.free();
  return rows;
}

module.exports = { getDb, run, get, all, saveDb };

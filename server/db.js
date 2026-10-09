'use strict';
const fs = require('fs');
const path = require('path');

let pool = null;

function sslFor(url) {
  if (process.env.DATABASE_SSL === 'false') return false;
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false };
  try {
    const host = new URL(url).hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.railway.internal')) return false;
  } catch (e) { /* fall through */ }
  return { rejectUnauthorized: false };
}

async function init() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('DATABASE_URL is not set: running in guest-only mode (no login, no saved scores).');
    return false;
  }
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: url, ssl: sslFor(url), max: 10 });
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Database ready.');
  return true;
}

const enabled = () => !!pool;
const q = (text, params) => pool.query(text, params);

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function close() { if (pool) await pool.end(); pool = null; }

module.exports = { init, enabled, q, tx, close };

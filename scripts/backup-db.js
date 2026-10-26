'use strict';
/* Full database backup to one JSON file (every table in the public schema, every column, every row).
   Run it BEFORE deploying a version that changes the database (see docs/MIGRATION-3.0-P5.md):
     DATABASE_URL=postgres://... node scripts/backup-db.js [out-file]
   The file contains password hashes and personal data: keep it private (do not commit it, do not share it).
   For a restorable binary backup also run pg_dump (see the migration document); this JSON is a readable second copy
   and is what `node scripts/backup-db.js --verify <file>` checks against the live row counts. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Pool } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL is not set'); process.exit(2); }
  const host = (() => { try { return new URL(url).hostname; } catch (e) { return ''; } })();
  const ssl = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.railway.internal') || process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString: url, ssl, max: 2 });
  const tables = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`)).rows.map(r => r.table_name);
  if (process.argv[2] === '--verify') {
    const file = process.argv[3];
    const data = JSON.parse((file.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(file)) : fs.readFileSync(file)).toString('utf8'));
    let bad = 0;
    for (const t of Object.keys(data.tables)) {
      const n = tables.includes(t) ? Number((await pool.query(`SELECT count(*) FROM "${t}"`)).rows[0].count) : null;
      const same = n === data.tables[t].length;
      if (!same) bad++;
      console.log(`${same ? 'same' : 'DIFF'}  ${t}: backup ${data.tables[t].length} rows, database ${n === null ? '(table missing)' : n} rows`);
    }
    await pool.end(); process.exit(bad ? 1 : 0);
  }
  const out = { kind: 'netlab-full-backup', createdAt: new Date().toISOString(), version: require('../package.json').version, tables: {} };
  // one snapshot for all tables
  const c = await pool.connect();
  try {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    for (const t of tables) out.tables[t] = (await c.query(`SELECT * FROM "${t}"`)).rows;
    await c.query('COMMIT');
  } finally { c.release(); }
  await pool.end();
  const file = process.argv[2] || path.join(process.cwd(), `netlab-full-backup-${out.createdAt.slice(0, 19).replace(/[:T]/g, '-')}.json.gz`);
  fs.writeFileSync(file, file.endsWith('.gz') ? zlib.gzipSync(JSON.stringify(out)) : JSON.stringify(out));
  console.log(`backup written: ${file}`);
  for (const t of tables) console.log(`  ${t}: ${out.tables[t].length} rows`);
}
main().catch(e => { console.error(e.message); process.exit(1); });

'use strict';
/* 2.9 practice-room merge: inspect, apply or undo the one-time score migration.
   DATABASE_URL=... node scripts/merge-rooms.js --plan       what would change (writes nothing)
   DATABASE_URL=... node scripts/merge-rooms.js --status     has it run, and what it did
   DATABASE_URL=... node scripts/merge-rooms.js --apply      run it now (the server also runs it once at start-up)
   DATABASE_URL=... node scripts/merge-rooms.js --rollback   remove credited rows / restore changed rows from the backup table
   After --rollback, set NETLAB_SKIP_MERGE=1 (or deploy 2.8) so the server does not apply it again at the next start. */
process.chdir(require('path').join(__dirname, '..'));
const mode = process.argv[2] || '--plan';
(async () => {
  const db = require('../server/db');
  if (!process.env.DATABASE_URL) { console.error('set DATABASE_URL'); process.exit(1); }
  process.env.NETLAB_SKIP_MERGE = '1';            // init must not apply it on its own here
  await db.init();
  const M = require('../server/merge-rooms');
  let out;
  if (mode === '--plan') out = await M.plan();
  else if (mode === '--status') out = (await db.q('SELECT id, ran_at, info FROM app_migrations WHERE id=$1', [M.ID])).rows[0] || { ran: false };
  else if (mode === '--apply') { delete process.env.NETLAB_SKIP_MERGE; out = await M.run(); }
  else if (mode === '--rollback') out = await M.rollback();
  else { console.error('unknown option ' + mode); process.exit(1); }
  console.log(JSON.stringify(out, null, 2));
  await db.close();
})().catch(e => { console.error(e.message); process.exit(1); });

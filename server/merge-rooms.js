'use strict';
/* 2.9 one-time migration: practice rooms -> lessons.
   Nothing is deleted. For every task that is now done in one place only (TWINS: hidden room copy -> kept week copy,
   and room Linux VM missions -> the same missions in the week lab), a student who had solved the hidden copy gets a
   linked, solved row on the kept copy with the same points and time (linked_from = the original key).
   XP and streaks ignore linked rows (server/game.js), so totals do not change.
   Safety: runs inside one transaction with an advisory lock, writes a full backup table of task_progress first,
   records itself in app_migrations and never runs twice. Rollback: node scripts/merge-rooms.js --rollback */
const db = require('./db');
const { TWINS } = require('./content');
const ID = '2.9-merge-rooms';
const BACKUP = 'backup_29_task_progress';

const pairs = () => [...TWINS.entries()].map(([from, to]) => ({ from, to: to.key, toLab: to.lab }));

/* what the migration would do, without writing anything */
async function plan(cx) {
  const q = cx ? (t, p) => cx.query(t, p) : db.q;
  const P = pairs();
  const rows = (await q(`SELECT s.user_id, s.task_key AS from_key, d.solved AS to_solved, (d.user_id IS NOT NULL) AS to_exists
                           FROM task_progress s
                           JOIN unnest($1::text[], $2::text[]) AS m(f, t) ON m.f = s.task_key
                           LEFT JOIN task_progress d ON d.user_id = s.user_id AND d.task_key = m.t
                          WHERE s.solved`, [P.map(p => p.from), P.map(p => p.to)])).rows;
  const link = rows.filter(r => !r.to_solved);
  return {
    pairs: P.length,
    solvedHiddenRows: rows.length,
    alreadySolvedInWeek: rows.length - link.length,
    toInsert: link.filter(r => !r.to_exists).length,
    toUpdate: link.filter(r => r.to_exists).length,
    students: new Set(link.map(r => r.user_id)).size
  };
}

/* credit the kept copy for every solved merged copy (optionally only rows solved after `after`); returns rows written */
async function link(cx, after, cnt = { inserted: 0, updated: 0 }) {
  for (const p of pairs()) {
    const r = await cx.query(`INSERT INTO task_progress(user_id,task_key,lab_id,attempts,hint_used,solved,points,solved_at,updated_at,linked_from)
                              SELECT user_id, $2, $3, attempts, hint_used, true, points, solved_at, now(), $1 FROM task_progress
                               WHERE task_key=$1 AND solved AND ($4::timestamptz IS NULL OR solved_at > $4)
                              ON CONFLICT (user_id, task_key) DO UPDATE SET solved=true, points=EXCLUDED.points, solved_at=EXCLUDED.solved_at,
                                attempts=EXCLUDED.attempts, hint_used=EXCLUDED.hint_used, linked_from=EXCLUDED.linked_from, updated_at=now()
                              WHERE NOT task_progress.solved
                              RETURNING (xmax = 0) AS ins`, [p.from, p.to, p.toLab, after]);
    r.rows.forEach(x => { if (x.ins) cnt.inserted++; else cnt.updated++; });
  }
  return cnt.inserted + cnt.updated;
}

async function run() {
  if (!db.enabled() || process.env.NETLAB_SKIP_MERGE === '1') return null;   // NETLAB_SKIP_MERGE=1 keeps a rolled-back database as it is
  return db.tx(async cx => {
    await cx.query('SELECT pg_advisory_xact_lock(290029)');
    const done = (await cx.query('SELECT info, ran_at FROM app_migrations WHERE id=$1', [ID])).rows[0];
    if (done) {
      // catch-up only: during a rolling deploy an old 2.8 instance may still have accepted room answers after the
      // migration; credit those (solved after ran_at). Older rows are never touched again, so teacher resets stay reset.
      const late = await link(cx, done.ran_at);
      if (late) console.log(`merge-rooms: credited ${late} answer(s) saved after the migration`);
      return { skipped: true, late, info: done.info };
    }
    const before = await plan(cx);
    await cx.query(`DROP TABLE IF EXISTS ${BACKUP}`);   // only reached when the migration has not run (or was rolled back)
    await cx.query(`CREATE TABLE ${BACKUP} AS SELECT * FROM task_progress`);
    const backupRows = (await cx.query(`SELECT count(*)::int n FROM ${BACKUP}`)).rows[0].n;
    const cnt = { inserted: 0, updated: 0 };
    await link(cx, null, cnt);
    const { inserted, updated } = cnt;
    const info = { at: new Date().toISOString(), before, inserted, updated, backupTable: BACKUP, backupRows };
    await cx.query(`INSERT INTO app_migrations(id, info) VALUES($1, $2) ON CONFLICT (id) DO UPDATE SET info=EXCLUDED.info, ran_at=now()`, [ID, JSON.stringify(info)]);
    if (inserted || updated) console.log(`merge-rooms: credited ${inserted + updated} task(s) for ${before.students} student(s); backup in ${BACKUP}`);
    return info;
  });
}

/* undo: remove rows the migration inserted, restore rows it changed, forget the migration (content must be reverted too) */
async function rollback() {
  return db.tx(async cx => {
    const has = (await cx.query(`SELECT to_regclass($1) AS t`, [BACKUP])).rows[0].t;
    if (!has) throw new Error('no backup table ' + BACKUP);
    const del = await cx.query(`DELETE FROM task_progress t WHERE t.linked_from IS NOT NULL
                                  AND NOT EXISTS (SELECT 1 FROM ${BACKUP} b WHERE b.user_id=t.user_id AND b.task_key=t.task_key)`);
    const upd = await cx.query(`UPDATE task_progress t SET solved=b.solved, points=b.points, solved_at=b.solved_at, attempts=b.attempts,
                                  hint_used=b.hint_used, linked_from=NULL, updated_at=now()
                                  FROM ${BACKUP} b WHERE t.linked_from IS NOT NULL AND b.user_id=t.user_id AND b.task_key=t.task_key`);
    await cx.query('DELETE FROM app_migrations WHERE id=$1', [ID]);
    return { removed: del.rowCount, restored: upd.rowCount };
  });
}

module.exports = { run, plan, rollback, ID, BACKUP };

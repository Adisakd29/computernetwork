// 2.9 migration test (practice rooms -> lessons) on a real PostgreSQL with mock students. WIPES the database it is given.
//   TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/netlab_test node tests/merge-rooms.test.js
'use strict';
const assert = require('assert');
const url = process.env.TEST_DATABASE_URL;
if (!url) { console.log('SKIP merge-rooms tests: set TEST_DATABASE_URL'); process.exit(0); }
process.env.DATABASE_URL = url;
const { Pool } = require('pg');
let passed = 0;
const it = async (name, fn) => { try { await fn(); passed++; console.log('  ✓', name); } catch (e) { console.log('  ✗', name, '\n    ', e.stack.split('\n').slice(0, 3).join('\n     ')); process.exitCode = 1; } };

(async () => {
  const pool = new Pool({ connectionString: url });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const db = require('../server/db');
  await db.init();                                    // fresh database: the migration runs on an empty table
  const M = require('../server/merge-rooms');
  const game = require('../server/game');
  const { TWINS, labKeys, allKeys, LABS } = require('../server/content');
  const q = (t, p) => pool.query(t, p).then(r => r.rows);

  /* mock "before 2.9" data: undo the empty run, then write room answers the way 2.8 stored them */
  await q('DELETE FROM app_migrations');
  const mk = async name => (await q(`INSERT INTO users(username,password_hash,display_name,role) VALUES($1,'x',$1,'student') RETURNING id`, [name]))[0].id;
  const A = await mk('mock.a'), B = await mk('mock.b'), C = await mk('mock.c');
  const put = (u, key, lab, solved, points, extra = {}) => q(`INSERT INTO task_progress(user_id,task_key,lab_id,attempts,hint_used,solved,points,solved_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [u, key, lab, extra.att || 0, !!extra.hint, solved, points, solved ? (extra.at || new Date('2026-09-01T03:00:00Z')) : null]);
  // A: solved room copies (incl. a hint), a VM mission in r9, never did the week labs
  await put(A, 'r9-0', 'r9', true, 10); await put(A, 'r9-1', 'r9', true, 5, { hint: true }); await put(A, 'r10-8', 'r10', true, 8, { att: 1 });
  await put(A, 'r9-vm3', 'r9', true, 10); await put(A, 'r9-4', 'r9', true, 10);
  // B: solved the same question in both places (must not be credited twice) and tried the week copy without solving
  await put(B, 'r9-0', 'r9', true, 10); await put(B, 'w8-0', 'w8', true, 6, { att: 2 });
  await put(B, 'r10-8', 'r10', true, 10); await put(B, 'w14-1', 'w14', false, 0, { att: 1 });
  await put(B, 'r12-vm0', 'r12', false, 0, { att: 3 });     // unsolved room VM mission: nothing to credit
  // C: no room work at all
  await put(C, 'w1-0', 'w1', true, 10);
  const before = await q('SELECT * FROM task_progress ORDER BY user_id, task_key');
  const xpBefore = await game.xpOf([A, B, C]);

  await it('dry run (plan) reports what would change and writes nothing', async () => {
    const p = await M.plan();
    assert.equal(p.pairs, TWINS.size);
    assert.equal(p.solvedHiddenRows, 6); assert.equal(p.alreadySolvedInWeek, 1); assert.equal(p.toInsert, 4); assert.equal(p.toUpdate, 1); assert.equal(p.students, 2);
    assert.deepEqual(await q('SELECT * FROM task_progress ORDER BY user_id, task_key'), before);
  });
  let info;
  await it('migration credits the kept copy once, keeps points/time/hint, backs up first', async () => {
    info = await M.run();
    assert.equal(info.inserted, 4); assert.equal(info.updated, 1); assert.equal(info.backupRows, before.length);
    const rows = await q(`SELECT user_id, task_key, solved, points, hint_used, attempts, linked_from, solved_at FROM task_progress WHERE linked_from IS NOT NULL ORDER BY user_id, task_key`);
    const get = (u, k) => rows.find(r => r.user_id === u && r.task_key === k);
    assert.deepEqual([get(A, 'w8-0').points, get(A, 'w8-0').linked_from], [10, 'r9-0']);
    assert.deepEqual([get(A, 'w8-1').points, get(A, 'w8-1').hint_used], [5, true]);
    assert.equal(get(A, 'w14-1').points, 8); assert.equal(get(A, 'w12-vm3').points, 10);
    assert.equal(+get(A, 'w8-0').solved_at, +new Date('2026-09-01T03:00:00Z'), 'keeps the original time');
    assert.equal(get(B, 'w14-1').points, 10, 'unsolved week attempt is replaced by the solved room answer');
    assert(!get(B, 'w8-0'), 'already solved in the week: untouched');
    assert.equal((await q(`SELECT points FROM task_progress WHERE user_id=$1 AND task_key='w8-0'`, [B]))[0].points, 6);
    assert(!get(B, 'w12-vm0') && !get(B, 'w18-vm0'), 'unsolved room work is not credited');
    // original rows are all still there, unchanged
    for (const r of before) {
      const now = (await q('SELECT * FROM task_progress WHERE user_id=$1 AND task_key=$2', [r.user_id, r.task_key]))[0];
      if (r.task_key === 'w14-1' && r.user_id === B) continue;   // the only updated row
      assert.deepEqual(now, r, 'row changed: ' + r.task_key);
    }
    assert.equal((await q(`SELECT count(*)::int n FROM ${M.BACKUP}`))[0].n, before.length);
  });
  await it('XP, streak days and "new activity" do not count linked rows twice', async () => {
    const xp = await game.xpOf([A, B, C]);
    for (const u of [A, B, C]) assert.equal(xp[u].total, xpBefore[u].total, 'XP changed for ' + u);
  });
  await it('scores per lab count only tasks still in that lab (3.2: the rooms are retired, their rows stay as history)', async () => {
    const r9 = LABS.get('r9');
    assert.equal(r9.retired, true); assert.deepEqual(labKeys(r9), [], 'a retired room scores nothing');
    assert(allKeys(r9).includes('r9-4'), 'its keys are still known for history');
    assert.equal((await q(`SELECT count(*)::int n FROM task_progress WHERE user_id=$1 AND task_key='r9-4'`, [A]))[0].n, 1, 'the old row is kept');
    const sum = async (u, lab) => (await q(`SELECT coalesce(sum(points),0)::int s FROM task_progress WHERE user_id=$1 AND lab_id=$2 AND task_key = ANY($3)`, [u, lab, labKeys(LABS.get(lab))]))[0].s;
    assert.equal(await sum(A, 'r9'), 0); assert.equal(await sum(A, 'w8'), 15); assert.equal(await sum(A, 'w12'), 10);
  });
  await it('never runs twice (idempotent), even when called again', async () => {
    const again = await M.run(); assert.equal(again.skipped, true);
    assert.equal((await q('SELECT count(*)::int n FROM task_progress WHERE linked_from IS NOT NULL'))[0].n, 5);
    await db.close(); await db.init(); assert.equal((await q('SELECT count(*)::int n FROM task_progress WHERE linked_from IS NOT NULL'))[0].n, 5, 'restart does not re-run');
  });
  await it('catch-up after a rolling deploy credits only answers saved after the migration; teacher resets stay reset', async () => {
    await q(`DELETE FROM task_progress WHERE user_id=$1 AND task_key='w8-0'`, [A]);              // teacher reset of A's week 8 lab
    await put(C, 'r9-1', 'r9', true, 10, { at: new Date(Date.now() + 1000) });                  // answered on an old 2.8 instance after the migration
    const r = await M.run(); assert.equal(r.skipped, true); assert.equal(r.late, 1);
    assert.equal((await q(`SELECT linked_from FROM task_progress WHERE user_id=$1 AND task_key='w8-1'`, [C]))[0].linked_from, 'r9-1');
    assert.equal((await q(`SELECT count(*)::int n FROM task_progress WHERE user_id=$1 AND task_key='w8-0'`, [A]))[0].n, 0, 'reset row not re-created');
    await q(`DELETE FROM task_progress WHERE user_id=$1 AND task_key IN ('r9-1','w8-1')`, [C]);   // back to the state the rollback test expects
    await q(`INSERT INTO task_progress(user_id,task_key,lab_id,attempts,hint_used,solved,points,solved_at,linked_from) VALUES($1,'w8-0','w8',0,false,true,10,'2026-09-01T03:00:00Z','r9-0')`, [A]);
  });
  await it('rollback restores the exact pre-migration table', async () => {
    const r = await M.rollback(); assert.deepEqual(r, { removed: 4, restored: 1 });
    const after = await q('SELECT user_id,task_key,lab_id,attempts,wrong_seen,hint_used,solved,points,solved_at FROM task_progress ORDER BY user_id, task_key');
    assert.deepEqual(after, before.map(x => ({ user_id: x.user_id, task_key: x.task_key, lab_id: x.lab_id, attempts: x.attempts, wrong_seen: x.wrong_seen, hint_used: x.hint_used, solved: x.solved, points: x.points, solved_at: x.solved_at })));
    assert.equal((await q("SELECT count(*)::int n FROM app_migrations WHERE id NOT IN ('path-1', 'practical-1')"))[0].n, 0);   // path-1 = Progressive Unlock, practical-1 = 3.2 legacy results: not part of this migration
    const again = await M.run(); assert.equal(again.inserted + again.updated, 5, 'can be applied again after a rollback');
  });
  console.log(`\n${passed} passed`);
  await pool.end(); await db.close();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });

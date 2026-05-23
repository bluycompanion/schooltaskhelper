const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { createApp } = require('../src/app');

function setup() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const sql = fs.readFileSync(path.join(process.cwd(), 'db', 'migrations', '001_init_up.sql'), 'utf8');
  db.exec(sql);
  db.prepare("INSERT INTO users (id, role, display_name) VALUES ('child1','child','Child'),('parent1','parent','Parent'),('agent1','agent','Agent')").run();
  db.prepare("INSERT INTO child_parent_access (child_user_id,parent_user_id) VALUES ('child1','parent1')").run();
  const app = createApp(db);
  return { db, app };
}

test('hunger +3 on new task and -1 progression capped at 3', async () => {
  const { app } = setup();
  const create = await request(app).post('/agent/tasks').send({ child_user_id: 'child1', title: 'T1', source: 'manual', source_external_id: 'a1' });
  assert.equal(create.status, 201);
  const taskId = create.body.id;

  let p = await request(app).get('/children/child1/progress');
  assert.equal(p.body.hunger_score, 3);

  await request(app).patch(`/tasks/${taskId}/planning`).set('x-role', 'child').send({ difficulty: 'easy', planned_window: 'today' });
  await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'child').send({ to_status: 'started' });
  await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'child').send({ to_status: 'thinks_done' });

  p = await request(app).get('/children/child1/progress');
  assert.equal(p.body.hunger_score, 0);

  // toggle spam should not reduce below cap
  await request(app).post(`/tasks/${taskId}/reject`).set('x-role', 'parent').send({});
  await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'child').send({ to_status: 'thinks_done' });
  p = await request(app).get('/children/child1/progress');
  assert.equal(p.body.hunger_score, 0);
});

test('stars/xp by difficulty + nausea + one-shot animation ack', async () => {
  const { app, db } = setup();
  const create = await request(app).post('/agent/tasks').send({ child_user_id: 'child1', title: 'T2', source: 'manual', source_external_id: 'a2' });
  const taskId = create.body.id;

  await request(app).patch(`/tasks/${taskId}/planning`).set('x-role', 'child').send({ difficulty: 'hard', planned_window: 'today' });
  await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'child').send({ to_status: 'started' });
  await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'child').send({ to_status: 'thinks_done' });

  await request(app).post(`/tasks/${taskId}/reject`).set('x-role', 'parent').send({});
  let progress = await request(app).get('/children/child1/progress');
  assert.equal(progress.body.nausea_score, 1);

  let pending = await request(app).get('/children/child1/animations/pending');
  assert.equal(pending.body.length, 1);
  const animId = pending.body[0].id;

  const ack1 = await request(app).post(`/children/child1/animations/${animId}/ack`);
  assert.equal(ack1.body.acknowledged, true);
  const ack2 = await request(app).post(`/children/child1/animations/${animId}/ack`);
  assert.equal(ack2.body.acknowledged, false);

  await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'child').send({ to_status: 'thinks_done' });
  await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'parent').send({ to_status: 'confirmed_done' });
  progress = await request(app).get('/children/child1/progress');
  assert.equal(progress.body.stars_total, 10);
  assert.equal(progress.body.xp_total, 10);

  // 24h decay
  db.prepare("UPDATE child_progress_state SET nausea_updated_at = datetime('now','-25 hours') WHERE child_user_id='child1'").run();
  progress = await request(app).get('/children/child1/progress');
  assert.equal(progress.body.nausea_score, 0);
});

test('lists active tasks by due date with can_actions and task details', async () => {
  const { app } = setup();
  const late = await request(app).post('/agent/tasks').send({
    child_user_id: 'child1',
    title: 'Late task',
    source: 'manual',
    source_external_id: 'late',
    subject: 'Math',
    due_date: '2026-06-03'
  });
  const early = await request(app).post('/agent/tasks').send({
    child_user_id: 'child1',
    title: 'Early task',
    source: 'manual',
    source_external_id: 'early',
    subject: 'English',
    due_date: '2026-05-30'
  });

  const list = await request(app).get('/tasks?child_user_id=child1');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map(t => t.title), ['Early task', 'Late task']);
  assert.deepEqual(list.body[0].can_actions, ['set_difficulty', 'set_planning', 'mark_started', 'comment']);
  assert.equal(list.body[0].subject, 'English');
  assert.equal(list.body[0].due_date, '2026-05-30');

  await request(app).patch(`/tasks/${early.body.id}/planning`).set('x-role', 'child').send({ difficulty: 'easy', planned_window: 'today' });
  await request(app).patch(`/tasks/${early.body.id}/status`).set('x-role', 'child').send({ to_status: 'started' });
  await request(app).patch(`/tasks/${early.body.id}/status`).set('x-role', 'child').send({ to_status: 'thinks_done' });
  await request(app).patch(`/tasks/${early.body.id}/status`).set('x-role', 'parent').send({ to_status: 'confirmed_done' });

  const detail = await request(app).get(`/tasks/${late.body.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.title, 'Late task');
  assert.deepEqual(detail.body.can_actions, ['set_difficulty', 'set_planning', 'mark_started', 'comment']);

  const afterConfirm = await request(app).get('/tasks?child_user_id=child1');
  assert.deepEqual(afterConfirm.body.map(t => t.title), ['Late task']);
});

test('creates and reads task comment thread', async () => {
  const { app } = setup();
  const create = await request(app).post('/agent/tasks').send({ child_user_id: 'child1', title: 'T3', source: 'manual', source_external_id: 'a3' });
  const taskId = create.body.id;

  const missingRole = await request(app).post(`/tasks/${taskId}/comments`).send({ message: 'No role' });
  assert.equal(missingRole.status, 403);

  const first = await request(app).post(`/tasks/${taskId}/comments`).set('x-role', 'child').set('x-user-id', 'child1').send({ message: 'Jag börjar idag.' });
  assert.equal(first.status, 201);
  assert.equal(first.body.author_role, 'child');
  assert.equal(first.body.message, 'Jag börjar idag.');

  const second = await request(app).post(`/tasks/${taskId}/comments`).set('x-role', 'parent').set('x-user-id', 'parent1').send({ message: 'Bra, jag kollar sen.' });
  assert.equal(second.status, 201);

  const thread = await request(app).get(`/tasks/${taskId}/comments`);
  assert.equal(thread.status, 200);
  assert.deepEqual(thread.body.map(c => c.message), ['Jag börjar idag.', 'Bra, jag kollar sen.']);
  assert.deepEqual(thread.body.map(c => c.author_role), ['child', 'parent']);
});

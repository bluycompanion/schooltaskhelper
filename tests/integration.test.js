const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { createApp } = require('../src/app');
const { runMigrations } = require('../src/db');
const { DEMO_CHILD_USER_ID, DEMO_PARENT_USER_ID, seedDevData } = require('../scripts/seed_dev_data');

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

test('seedDevData resets predictable local GUI verification data', async () => {
  const { app, db } = setup();
  await request(app).post('/agent/tasks').send({ child_user_id: DEMO_CHILD_USER_ID, title: 'Old manual task', source: 'manual', source_external_id: 'old-manual' });

  seedDevData(db);
  let list = await request(app).get(`/tasks?child_user_id=${DEMO_CHILD_USER_ID}`);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((task) => [task.title, task.status]), [
    ['Lämna in NO-labb', 'thinks_done'],
    ['Läs svenska kapitel 4', 'received'],
    ['Träna glosor i engelska', 'received'],
    ['Gör matteuppgifter 12–18', 'started'],
    ['Rensa skolväskan', 'received'],
  ]);

  const taskToPatch = list.body.find(t => t.source_external_id === 'demo-received');
  await request(app).patch(`/tasks/${taskToPatch.id}/status`).set('x-role', 'child').send({ to_status: 'started' });
  seedDevData(db);

  list = await request(app).get(`/tasks?child_user_id=${DEMO_CHILD_USER_ID}`);
  assert.deepEqual(list.body.map((task) => [task.source_external_id, task.status]), [
    ['demo-review', 'thinks_done'],
    ['demo-received', 'received'],
    ['demo-planning', 'received'],
    ['demo-started', 'started'],
    ['demo-no-due', 'received'],
  ]);
  assert.equal(
    db.prepare('SELECT parent_user_id FROM child_parent_access WHERE child_user_id=?').get(DEMO_CHILD_USER_ID).parent_user_id,
    DEMO_PARENT_USER_ID,
  );
});

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
  assert.equal(pending.body[0].seen_at, null);
  assert.match(pending.body[0].delivered_at, /^\d{4}-\d{2}-\d{2}T/);
  const animId = pending.body[0].id;

  const ack1 = await request(app).post(`/children/child1/animations/${animId}/ack`);
  assert.equal(ack1.body.acknowledged, true);
  assert.match(ack1.body.seen_at, /^\d{4}-\d{2}-\d{2}T/);
  const ack2 = await request(app).post(`/children/child1/animations/${animId}/ack`);
  assert.equal(ack2.body.acknowledged, false);

  pending = await request(app).get('/children/child1/animations/pending');
  assert.equal(pending.body.length, 0);

  const events = await request(app).get(`/tasks/${taskId}/events`);
  assert.equal(events.status, 200);
  const rejectEvent = events.body.find((event) => event.event_type === 'confirmation_rejected');
  assert.ok(rejectEvent);
  assert.deepEqual(JSON.parse(rejectEvent.payload_json), { reason: null, from_status: 'thinks_done', to_status: 'started', nausea_delta: 1 });

  await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'child').send({ to_status: 'thinks_done' });
  await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'parent').send({ to_status: 'confirmed_done' });
  await request(app).post(`/tasks/${taskId}/collect_reward`).set('x-role', 'child').send();
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
  await request(app).post(`/tasks/${early.body.id}/collect_reward`).set('x-role', 'child').send();

  const detail = await request(app).get(`/tasks/${late.body.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.title, 'Late task');
  assert.deepEqual(detail.body.can_actions, ['set_difficulty', 'set_planning', 'mark_started', 'comment']);

  const afterConfirm = await request(app).get('/tasks?child_user_id=child1');
  assert.deepEqual(afterConfirm.body.map(t => t.title), ['Late task']);
});

test('role headers are enforced on mutating child, parent, and comment endpoints', async () => {
  const { app } = setup();
  const create = await request(app).post('/agent/tasks').send({ child_user_id: 'child1', title: 'Role task', source: 'manual', source_external_id: 'role1' });
  const taskId = create.body.id;

  const parentPlanning = await request(app).patch(`/tasks/${taskId}/planning`).set('x-role', 'parent').send({ difficulty: 'easy', planned_window: 'today' });
  assert.equal(parentPlanning.status, 403);

  const missingRoleStarted = await request(app).patch(`/tasks/${taskId}/status`).send({ to_status: 'started' });
  assert.equal(missingRoleStarted.status, 400);

  const childStarted = await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'child').send({ to_status: 'started' });
  assert.equal(childStarted.status, 200);

  const parentThinksDone = await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'parent').send({ to_status: 'thinks_done' });
  assert.equal(parentThinksDone.status, 400);

  const childThinksDone = await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'child').send({ to_status: 'thinks_done' });
  assert.equal(childThinksDone.status, 200);

  const childConfirm = await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'child').send({ to_status: 'confirmed_done' });
  assert.equal(childConfirm.status, 400);

  const childReject = await request(app).post(`/tasks/${taskId}/reject`).set('x-role', 'child').send({});
  assert.equal(childReject.status, 403);

  const missingCommentRole = await request(app).post(`/tasks/${taskId}/comments`).send({ message: 'No role' });
  assert.equal(missingCommentRole.status, 403);
});

test('can_actions are status-based UI hints and active list excludes confirmed_done', async () => {
  const { app } = setup();
  const received = await request(app).post('/agent/tasks').send({ child_user_id: 'child1', title: 'Received', source: 'manual', source_external_id: 'hint-received', due_date: '2026-06-01' });
  const started = await request(app).post('/agent/tasks').send({ child_user_id: 'child1', title: 'Started', source: 'manual', source_external_id: 'hint-started', due_date: '2026-06-02' });
  const review = await request(app).post('/agent/tasks').send({ child_user_id: 'child1', title: 'Review', source: 'manual', source_external_id: 'hint-review', due_date: '2026-06-03' });
  const done = await request(app).post('/agent/tasks').send({ child_user_id: 'child1', title: 'Done', source: 'manual', source_external_id: 'hint-done', due_date: '2026-06-04' });

  await request(app).patch(`/tasks/${started.body.id}/status`).set('x-role', 'child').send({ to_status: 'started' });
  await request(app).patch(`/tasks/${review.body.id}/status`).set('x-role', 'child').send({ to_status: 'started' });
  await request(app).patch(`/tasks/${review.body.id}/status`).set('x-role', 'child').send({ to_status: 'thinks_done' });
  await request(app).patch(`/tasks/${done.body.id}/status`).set('x-role', 'child').send({ to_status: 'started' });
  await request(app).patch(`/tasks/${done.body.id}/status`).set('x-role', 'child').send({ to_status: 'thinks_done' });
  await request(app).patch(`/tasks/${done.body.id}/status`).set('x-role', 'parent').send({ to_status: 'confirmed_done' });
  await request(app).post(`/tasks/${done.body.id}/collect_reward`).set('x-role', 'child').send();

  const receivedDetail = await request(app).get(`/tasks/${received.body.id}`);
  const startedDetail = await request(app).get(`/tasks/${started.body.id}`);
  const reviewDetail = await request(app).get(`/tasks/${review.body.id}`);
  const doneDetail = await request(app).get(`/tasks/${done.body.id}`);

  assert.deepEqual(receivedDetail.body.can_actions, ['set_difficulty', 'set_planning', 'mark_started', 'comment']);
  assert.deepEqual(startedDetail.body.can_actions, ['set_difficulty', 'set_planning', 'mark_thinks_done', 'comment']);
  assert.deepEqual(reviewDetail.body.can_actions, ['comment', 'confirm_done', 'reject_done']);
  assert.deepEqual(doneDetail.body.can_actions, ['comment']);

  const list = await request(app).get('/tasks?child_user_id=child1');
  assert.deepEqual(list.body.map(t => t.title), ['Received', 'Started', 'Review']);
});

test('events endpoint records task lifecycle, rewards, feedback delivery, and ack events', async () => {
  const { app } = setup();
  const create = await request(app).post('/agent/tasks').set('x-user-id', 'agent1').send({ child_user_id: 'child1', title: 'Event task', source: 'manual', source_external_id: 'event1' });
  const taskId = create.body.id;

  let events = await request(app).get(`/tasks/${taskId}/events`);
  assert.equal(events.status, 200);
  assert.deepEqual(events.body.map((event) => event.event_type), ['task_created']);
  assert.equal(events.body[0].actor_ref, 'agent1');
  assert.deepEqual(JSON.parse(events.body[0].payload_json), { source: 'manual', source_external_id: 'event1', hunger_delta: 3 });

  await request(app).patch(`/tasks/${taskId}/planning`).set('x-role', 'child').set('x-user-id', 'child1').send({ difficulty: 'hard', planned_window: 'today' });
  await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'child').set('x-user-id', 'child1').send({ to_status: 'started' });
  await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'child').set('x-user-id', 'child1').send({ to_status: 'thinks_done' });
  await request(app).post(`/tasks/${taskId}/reject`).set('x-role', 'parent').set('x-user-id', 'parent1').send({ reason: 'Needs sources' });
  const pending = await request(app).get('/children/child1/animations/pending');
  assert.equal(pending.body.length, 1);
  await request(app).post(`/children/child1/animations/${pending.body[0].id}/ack`);
  await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'child').set('x-user-id', 'child1').send({ to_status: 'thinks_done' });
  await request(app).patch(`/tasks/${taskId}/status`).set('x-role', 'parent').set('x-user-id', 'parent1').send({ to_status: 'confirmed_done' });
  await request(app).post(`/tasks/${taskId}/collect_reward`).set('x-role', 'child').set('x-user-id', 'child1').send();
  await request(app).post(`/tasks/${taskId}/comments`).set('x-role', 'parent').set('x-user-id', 'parent1').send({ message: 'Bra jobbat.' });

  events = await request(app).get(`/tasks/${taskId}/events`);
  assert.equal(events.status, 200);
  assert.deepEqual(events.body.map((event) => event.event_type), [
    'task_created',
    'planning_updated',
    'status_changed',
    'status_changed',
    'confirmation_rejected',
    'animation_delivered',
    'animation_acknowledged',
    'status_changed',
    'status_changed',
    'reward_available',
    'reward_granted',
    'comment_created'
  ]);

  const planningEvent = events.body.find((event) => event.event_type === 'planning_updated');
  assert.equal(planningEvent.actor_ref, 'child1');
  const planningPayload = JSON.parse(planningEvent.payload_json);
  assert.deepEqual(planningPayload.difficulty, { from: 'unknown', to: 'hard' });
  assert.deepEqual(planningPayload.planned_window, { from: 'unknown', to: 'today' });

  const rejectEvent = events.body.find((event) => event.event_type === 'confirmation_rejected');
  assert.equal(rejectEvent.actor_ref, 'parent1');
  assert.deepEqual(JSON.parse(rejectEvent.payload_json), { reason: 'Needs sources', from_status: 'thinks_done', to_status: 'started', nausea_delta: 1 });

  const rewardEvent = events.body.find((event) => event.event_type === 'reward_granted');
  assert.deepEqual(JSON.parse(rewardEvent.payload_json), { difficulty: 'hard', xp_delta: 10, stars_delta: 10 });

  const deliveredEvent = events.body.find((event) => event.event_type === 'animation_delivered');
  assert.equal(JSON.parse(deliveredEvent.payload_json).animation_id, pending.body[0].id);

  const commentEvent = events.body.find((event) => event.event_type === 'comment_created');
  assert.equal(commentEvent.actor_ref, 'parent1');
  assert.equal(typeof JSON.parse(commentEvent.payload_json).comment_id, 'string');
});

test('runMigrations adds delivered_at to existing local task_feedback_animations tables non-destructively', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE task_feedback_animations (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      child_user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      animation_type TEXT NOT NULL CHECK(animation_type IN ('reject_nausea')),
      animation_key TEXT NOT NULL UNIQUE,
      seen_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO task_feedback_animations (id, task_id, child_user_id, event_id, animation_type, animation_key, seen_at, created_at)
    VALUES ('anim1', 'task1', 'child1', 'event1', 'reject_nausea', 'key1', NULL, '2026-05-25T00:00:00.000Z');
  `);

  runMigrations(db);

  const columns = db.prepare('PRAGMA table_info(task_feedback_animations)').all().map(c => c.name);
  assert.equal(columns.includes('delivered_at'), true);
  assert.equal(columns.includes('seen_at'), true);
  const row = db.prepare('SELECT id, animation_key, delivered_at, seen_at FROM task_feedback_animations WHERE id=?').get('anim1');
  assert.deepEqual(row, { id: 'anim1', animation_key: 'key1', delivered_at: null, seen_at: null });
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

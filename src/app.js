const express = require('express');
const crypto = require('crypto');

function nowIso() { return new Date().toISOString(); }
function id() { return crypto.randomUUID(); }

function starPoints(difficulty) {
  if (difficulty === 'easy') return 3;
  if (difficulty === 'hard') return 10;
  return 6;
}

function canActions(status) {
  if (status === 'received') return ['set_difficulty', 'set_planning', 'mark_started', 'comment'];
  if (status === 'started') return ['set_difficulty', 'set_planning', 'mark_thinks_done', 'comment'];
  if (status === 'thinks_done') return ['comment', 'confirm_done', 'reject_done'];
  if (status === 'confirmed_done') return ['comment'];
  return ['comment'];
}

function withCanActions(task) {
  return task ? { ...task, can_actions: canActions(task.status) } : task;
}

function createApp(db) {
  const app = express();
  app.use(express.json());

  function ensureProgress(childId) {
    db.prepare(`INSERT OR IGNORE INTO child_progress_state (child_user_id, hunger_score, hunger_capacity, xp_total, stars_total, level, nausea_score, updated_at)
                VALUES (?,0,0,0,0,1,0,?)`).run(childId, nowIso());
  }

  function recalcHungerCapacity(childId) {
    const n = db.prepare(`SELECT count(*) as c FROM tasks WHERE child_user_id = ? AND status != 'confirmed_done'`).get(childId).c;
    const cap = n * 10;
    db.prepare('UPDATE child_progress_state SET hunger_capacity=?, updated_at=? WHERE child_user_id=?').run(cap, nowIso(), childId);
  }

  function applyNauseaDecay(childId) {
    const p = db.prepare('SELECT nausea_score, nausea_updated_at FROM child_progress_state WHERE child_user_id=?').get(childId);
    if (!p) return;
    if (!p.nausea_updated_at || p.nausea_score <= 0) return;
    const ageMs = Date.now() - new Date(p.nausea_updated_at).getTime();
    if (ageMs >= 24 * 3600 * 1000) {
      db.prepare('UPDATE child_progress_state SET nausea_score=0, nausea_updated_at=?, updated_at=? WHERE child_user_id=?').run(nowIso(), nowIso(), childId);
    }
  }

  function applyHungerStep(taskId, attemptNo, effectKey, childId) {
    const exists = db.prepare('SELECT 1 FROM task_effect_flags WHERE task_id=? AND attempt_no=? AND effect_key=?').get(taskId, attemptNo, effectKey);
    if (exists) return false;
    const used = db.prepare(`SELECT count(*) as c FROM task_effect_flags WHERE task_id=? AND attempt_no=? AND effect_key IN ('difficulty_set','planning_set','status_started','status_thinks_done')`).get(taskId, attemptNo).c;
    if (used >= 3) return false;
    db.prepare('INSERT INTO task_effect_flags (task_id, attempt_no, effect_key) VALUES (?,?,?)').run(taskId, attemptNo, effectKey);
    db.prepare('UPDATE child_progress_state SET hunger_score = max(hunger_score - 1, 0), updated_at=? WHERE child_user_id=?').run(nowIso(), childId);
    return true;
  }

  app.post('/agent/tasks', (req, res) => {
    const { child_user_id, title, source, source_external_id, subject = null, due_date = null } = req.body || {};
    if (!child_user_id || !title || !source || !source_external_id) return res.status(400).json({ error: 'missing fields' });
    ensureProgress(child_user_id);

    const existing = db.prepare('SELECT * FROM tasks WHERE source=? AND source_external_id=?').get(source, source_external_id);
    if (existing) return res.status(200).json(existing);

    const tx = db.transaction(() => {
      const taskId = id();
      db.prepare(`INSERT INTO tasks (id, child_user_id, title, subject, due_date, source, source_external_id, status, difficulty, planned_window, current_attempt_no, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'received', 'unknown', 'unknown', 1, ?, ?)`).run(taskId, child_user_id, title, subject, due_date, source, source_external_id, nowIso(), nowIso());
      db.prepare('UPDATE child_progress_state SET hunger_score = hunger_score + 3, updated_at=? WHERE child_user_id=?').run(nowIso(), child_user_id);
      recalcHungerCapacity(child_user_id);
      return db.prepare('SELECT * FROM tasks WHERE id=?').get(taskId);
    });

    res.status(201).json(tx());
  });

  app.get('/tasks', (req, res) => {
    const childId = req.query.child_user_id;
    if (!childId) return res.status(400).json({ error: 'child_user_id required' });
    const rows = db.prepare(`SELECT * FROM tasks
                             WHERE child_user_id = ? AND status != 'confirmed_done'
                             ORDER BY due_date IS NULL ASC, due_date ASC, created_at ASC`).all(childId);
    res.json(rows.map(withCanActions));
  });

  app.get('/tasks/:id', (req, res) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'not found' });
    res.json(withCanActions(task));
  });

  app.patch('/tasks/:id/planning', (req, res) => {
    const role = req.headers['x-role'];
    if (role !== 'child') return res.status(403).json({ error: 'only child can plan' });
    const { difficulty, planned_window } = req.body || {};
    const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'not found' });
    ensureProgress(task.child_user_id);

    const tx = db.transaction(() => {
      if (difficulty && difficulty !== task.difficulty) {
        db.prepare('UPDATE tasks SET difficulty=?, updated_at=? WHERE id=?').run(difficulty, nowIso(), task.id);
        applyHungerStep(task.id, task.current_attempt_no, 'difficulty_set', task.child_user_id);
      }
      if (planned_window && planned_window !== task.planned_window) {
        db.prepare('UPDATE tasks SET planned_window=?, updated_at=? WHERE id=?').run(planned_window, nowIso(), task.id);
        applyHungerStep(task.id, task.current_attempt_no, 'planning_set', task.child_user_id);
      }
      return db.prepare('SELECT * FROM tasks WHERE id=?').get(task.id);
    });

    res.json(tx());
  });

  app.patch('/tasks/:id/status', (req, res) => {
    const role = req.headers['x-role'];
    const { to_status } = req.body || {};
    const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'not found' });
    ensureProgress(task.child_user_id);

    const allowed = (
      (role === 'child' && task.status === 'received' && to_status === 'started') ||
      (role === 'child' && task.status === 'started' && to_status === 'thinks_done') ||
      ((role === 'parent' || role === 'agent') && task.status === 'thinks_done' && to_status === 'confirmed_done')
    );
    if (!allowed) return res.status(400).json({ error: 'invalid transition' });

    const tx = db.transaction(() => {
      if (to_status === 'started') applyHungerStep(task.id, task.current_attempt_no, 'status_started', task.child_user_id);
      if (to_status === 'thinks_done') applyHungerStep(task.id, task.current_attempt_no, 'status_thinks_done', task.child_user_id);

      db.prepare('UPDATE tasks SET status=?, updated_at=? WHERE id=?').run(to_status, nowIso(), task.id);

      if (to_status === 'confirmed_done') {
        const points = starPoints(task.difficulty);
        db.prepare('UPDATE child_progress_state SET xp_total=xp_total+?, stars_total=stars_total+?, updated_at=? WHERE child_user_id=?').run(points, points, nowIso(), task.child_user_id);
      }
      recalcHungerCapacity(task.child_user_id);
      return db.prepare('SELECT * FROM tasks WHERE id=?').get(task.id);
    });

    res.json(tx());
  });

  app.post('/tasks/:id/reject', (req, res) => {
    const role = req.headers['x-role'];
    if (!(role === 'parent' || role === 'agent')) return res.status(403).json({ error: 'forbidden' });
    const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'not found' });
    if (task.status !== 'thinks_done') return res.status(400).json({ error: 'only reject from thinks_done' });
    ensureProgress(task.child_user_id);

    const tx = db.transaction(() => {
      const eventId = id();
      db.prepare('INSERT INTO task_events (id, task_id, event_type, actor_type, actor_ref, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(eventId, task.id, 'confirmation_rejected', role, role, nowIso());
      db.prepare('UPDATE tasks SET status=?, current_attempt_no=current_attempt_no+1, updated_at=? WHERE id=?').run('started', nowIso(), task.id);
      db.prepare('UPDATE child_progress_state SET nausea_score=nausea_score+1, nausea_updated_at=?, updated_at=? WHERE child_user_id=?')
        .run(nowIso(), nowIso(), task.child_user_id);
      const animationKey = `${task.id}:${eventId}:reject_nausea`;
      db.prepare('INSERT INTO task_feedback_animations (id, task_id, child_user_id, event_id, animation_type, animation_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id(), task.id, task.child_user_id, eventId, 'reject_nausea', animationKey, nowIso());
      return { ok: true };
    });

    res.json(tx());
  });

  app.get('/tasks/:id/comments', (req, res) => {
    const task = db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'not found' });
    const rows = db.prepare(`SELECT * FROM task_comments
                             WHERE task_id=? AND deleted_at IS NULL
                             ORDER BY created_at ASC`).all(req.params.id);
    res.json(rows);
  });

  app.post('/tasks/:id/comments', (req, res) => {
    const role = req.headers['x-role'];
    const userId = req.headers['x-user-id'] || role;
    const message = (req.body && req.body.message || '').trim();
    if (!(role === 'child' || role === 'parent' || role === 'agent')) return res.status(403).json({ error: 'forbidden' });
    if (!message) return res.status(400).json({ error: 'message required' });
    const task = db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'not found' });

    const commentId = id();
    db.prepare(`INSERT INTO task_comments (id, task_id, author_user_id, author_role, message, created_at)
                VALUES (?, ?, ?, ?, ?, ?)`).run(commentId, req.params.id, userId, role, message, nowIso());
    res.status(201).json(db.prepare('SELECT * FROM task_comments WHERE id=?').get(commentId));
  });

  app.get('/children/:childUserId/progress', (req, res) => {
    const child = req.params.childUserId;
    ensureProgress(child);
    applyNauseaDecay(child);
    recalcHungerCapacity(child);
    const row = db.prepare('SELECT * FROM child_progress_state WHERE child_user_id=?').get(child);
    res.json(row);
  });

  app.get('/children/:childUserId/animations/pending', (req, res) => {
    const rows = db.prepare('SELECT * FROM task_feedback_animations WHERE child_user_id=? AND seen_at IS NULL ORDER BY created_at ASC').all(req.params.childUserId);
    res.json(rows);
  });

  app.post('/children/:childUserId/animations/:animationId/ack', (req, res) => {
    const r = db.prepare('UPDATE task_feedback_animations SET seen_at=? WHERE id=? AND child_user_id=? AND seen_at IS NULL')
      .run(nowIso(), req.params.animationId, req.params.childUserId);
    res.json({ acknowledged: r.changes === 1 });
  });

  return app;
}

module.exports = { createApp };

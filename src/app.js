const express = require('express');
const crypto = require('crypto');

function nowIso() { return new Date().toISOString(); }
function id() { return crypto.randomUUID(); }

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'unknown']);
const VALID_PLANNED_WINDOWS = new Set(['today', 'tomorrow', 'this_week', 'next_week', 'unknown']);

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addLocalDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function derivePlannedDate(plannedWindow, baseDate = new Date()) {
  if (plannedWindow === 'unknown' || plannedWindow == null) return null;
  if (!VALID_PLANNED_WINDOWS.has(plannedWindow)) return null;

  const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  if (plannedWindow === 'today') return formatLocalDate(today);
  if (plannedWindow === 'tomorrow') return formatLocalDate(addLocalDays(today, 1));

  const dayOfWeek = today.getDay();
  if (plannedWindow === 'this_week') {
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    return formatLocalDate(addLocalDays(today, daysUntilFriday));
  }

  if (plannedWindow === 'next_week') {
    const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    return formatLocalDate(addLocalDays(today, daysUntilNextMonday));
  }

  return null;
}

function starPoints(difficulty) {
  if (difficulty === 'easy') return 3;
  if (difficulty === 'hard') return 10;
  return 6;
}

function canActions(task) {
  if (task.status === 'received') return ['set_difficulty', 'set_planning', 'mark_started', 'comment'];
  if (task.status === 'started') return ['set_difficulty', 'set_planning', 'mark_thinks_done', 'comment'];
  if (task.status === 'thinks_done') return ['comment', 'confirm_done', 'reject_done'];
  if (task.status === 'confirmed_done') {
    if (!task.reward_collected_at) return ['collect_reward', 'comment'];
    return ['comment'];
  }
  return ['comment'];
}

function withCanActions(task) {
  return task ? { ...task, can_actions: canActions(task) } : task;
}

function eventPayload(req, payload = {}) {
  const agentProvider = req.headers['x-agent-provider'];
  if (!agentProvider) return payload;
  return { ...payload, agent_provider: String(agentProvider) };
}

function isQuestionComment(message) {
  const text = (message || '').trim().toLowerCase();
  if (!text) return false;
  if (text.includes('?')) return true;
  return /^(kan du|kan jag|kan man|hur|varför|varfor|vad|vem|vilken|vilka|när|nar|var|får jag|far jag)\b/.test(text);
}

function agentQuestionAnswered(db, comment) {
  return !!db.prepare(`SELECT 1
                       FROM task_comments
                       WHERE task_id = ?
                         AND deleted_at IS NULL
                         AND created_at >= ?
                         AND id != ?
                         AND author_role IN ('parent', 'agent')
                       LIMIT 1`).get(comment.task_id, comment.created_at, comment.id);
}

function resolveDueWindow(query) {
  const today = new Date();
  const defaultDueTo = today.toISOString().slice(0, 10);
  const defaultDueFrom = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dueFrom = typeof query.due_from === 'string' && query.due_from ? query.due_from : defaultDueFrom;
  const dueTo = typeof query.due_to === 'string' && query.due_to ? query.due_to : defaultDueTo;
  return { dueFrom, dueTo };
}

function canAgentUpdateStatus(fromStatus, toStatus) {
  return (
    (fromStatus === 'received' && toStatus === 'started') ||
    (fromStatus === 'started' && toStatus === 'thinks_done') ||
    (fromStatus === 'thinks_done' && toStatus === 'confirmed_done')
  );
}

function createApp(db) {
  const app = express();
  app.use(express.json());

  function actorRef(req, fallbackRole) {
    return req.headers['x-user-id'] || fallbackRole || 'system';
  }

  function emitTaskEvent(taskId, eventType, actorType, actorRefValue, payload = {}) {
    db.prepare('INSERT INTO task_events (id, task_id, event_type, actor_type, actor_ref, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id(), taskId, eventType, actorType, actorRefValue, nowIso(), JSON.stringify(payload));
  }

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
    const role = req.headers['x-role'];
    if (role !== 'agent') return res.status(403).json({ error: 'forbidden' });
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
      emitTaskEvent(taskId, 'task_created', 'agent', actorRef(req, 'agent'), eventPayload(req, { source, source_external_id, hunger_delta: 3 }));
      recalcHungerCapacity(child_user_id);
      return db.prepare('SELECT * FROM tasks WHERE id=?').get(taskId);
    });

    res.status(201).json(tx());
  });

  app.get('/agent/tasks', (req, res) => {
    const role = req.headers['x-role'];
    if (role !== 'agent') return res.status(403).json({ error: 'forbidden' });
    const { child_user_id: childId = null } = req.query || {};
    const { dueFrom, dueTo } = resolveDueWindow(req.query || {});
    const params = [dueFrom, dueTo];
    const childFilter = childId ? ' AND child_user_id = ?' : '';
    if (childId) params.push(childId);
    const rows = db.prepare(`SELECT * FROM tasks
                             WHERE due_date IS NOT NULL
                               AND due_date >= ?
                               AND due_date <= ?${childFilter}
                             ORDER BY due_date ASC, created_at ASC`).all(...params);
    res.json(rows.map(withCanActions));
  });

  app.get('/tasks', (req, res) => {
    const childId = req.query.child_user_id;
    if (!childId) return res.status(400).json({ error: 'child_user_id required' });
    const rows = db.prepare(`SELECT * FROM tasks
                             WHERE child_user_id = ? AND (status != 'confirmed_done' OR reward_collected_at IS NULL)
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
    if (difficulty !== undefined && !VALID_DIFFICULTIES.has(difficulty)) return res.status(400).json({ error: 'invalid difficulty' });
    if (planned_window !== undefined && !VALID_PLANNED_WINDOWS.has(planned_window)) return res.status(400).json({ error: 'invalid planned_window' });
    const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'not found' });
    ensureProgress(task.child_user_id);

    const tx = db.transaction(() => {
      const changes = {};
      if (difficulty && difficulty !== task.difficulty) {
        db.prepare('UPDATE tasks SET difficulty=?, updated_at=? WHERE id=?').run(difficulty, nowIso(), task.id);
        changes.difficulty = { from: task.difficulty, to: difficulty };
        changes.difficulty_hunger_applied = applyHungerStep(task.id, task.current_attempt_no, 'difficulty_set', task.child_user_id);
      }
      if (planned_window !== undefined) {
        const plannedDate = derivePlannedDate(planned_window);
        if (planned_window !== task.planned_window || plannedDate !== task.planned_date) {
          db.prepare('UPDATE tasks SET planned_window=?, planned_date=?, updated_at=? WHERE id=?').run(planned_window, plannedDate, nowIso(), task.id);
          changes.planned_window = { from: task.planned_window, to: planned_window };
          changes.planned_date = { from: task.planned_date || null, to: plannedDate };
          changes.planned_window_hunger_applied = applyHungerStep(task.id, task.current_attempt_no, 'planning_set', task.child_user_id);
        }
      }
      if (Object.keys(changes).length > 0) {
        emitTaskEvent(task.id, 'planning_updated', role, actorRef(req, role), eventPayload(req, { attempt_no: task.current_attempt_no, ...changes }));
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
      (role === 'agent' && canAgentUpdateStatus(task.status, to_status)) ||
      (role === 'child' && task.status === 'received' && to_status === 'started') ||
      (role === 'child' && task.status === 'started' && to_status === 'thinks_done') ||
      ((role === 'parent' || role === 'agent') && task.status === 'thinks_done' && to_status === 'confirmed_done')
    );
    if (!allowed) {
      if (role === 'child' && task.status === 'thinks_done') return res.status(400).json({ error: 'Endast en vuxen kan markera uppgiften som helt klar.' });
      if (to_status === 'received' || to_status === 'started') return res.status(400).json({ error: 'Det går inte att backa statusen på detta sätt.' });
      return res.status(400).json({ error: `Otillåten statusövergång från '${task.status}' till '${to_status}' för rollen '${role}'.` });
    }

    const tx = db.transaction(() => {
      let hungerApplied = false;
      if (to_status === 'started') hungerApplied = applyHungerStep(task.id, task.current_attempt_no, 'status_started', task.child_user_id);
      if (to_status === 'thinks_done') hungerApplied = applyHungerStep(task.id, task.current_attempt_no, 'status_thinks_done', task.child_user_id);

      db.prepare('UPDATE tasks SET status=?, updated_at=? WHERE id=?').run(to_status, nowIso(), task.id);
      emitTaskEvent(task.id, 'status_changed', role, actorRef(req, role), eventPayload(req, { from_status: task.status, to_status, attempt_no: task.current_attempt_no, hunger_applied: hungerApplied }));

      if (to_status === 'confirmed_done') {
        emitTaskEvent(task.id, 'reward_available', role, actorRef(req, role), eventPayload(req, { difficulty: task.difficulty }));
      }
      recalcHungerCapacity(task.child_user_id);
      return db.prepare('SELECT * FROM tasks WHERE id=?').get(task.id);
    });

    res.json(tx());
  });

  app.post('/tasks/:id/collect_reward', (req, res) => {
    const role = req.headers['x-role'];
    if (role !== 'child') return res.status(403).json({ error: 'only child can collect reward' });
    const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'not found' });
    if (task.status !== 'confirmed_done') return res.status(400).json({ error: 'task not confirmed' });
    if (task.reward_collected_at) return res.status(400).json({ error: 'reward already collected' });
    ensureProgress(task.child_user_id);

    const tx = db.transaction(() => {
      const points = starPoints(task.difficulty);
      db.prepare('UPDATE tasks SET reward_collected_at=?, updated_at=? WHERE id=?').run(nowIso(), nowIso(), task.id);
      db.prepare('UPDATE child_progress_state SET xp_total=xp_total+?, stars_total=stars_total+?, updated_at=? WHERE child_user_id=?').run(points, points, nowIso(), task.child_user_id);
      emitTaskEvent(task.id, 'reward_granted', role, actorRef(req, role), eventPayload(req, { difficulty: task.difficulty, xp_delta: points, stars_delta: points }));
      return db.prepare('SELECT * FROM tasks WHERE id=?').get(task.id);
    });

    res.json(tx());
  });

  app.post('/tasks/:id/reject', (req, res) => {
    const role = req.headers['x-role'];
    const reason = req.body && typeof req.body.reason === 'string' ? req.body.reason : null;
    if (!(role === 'parent' || role === 'agent')) return res.status(403).json({ error: 'forbidden' });
    const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'not found' });
    if (task.status !== 'thinks_done') return res.status(400).json({ error: 'only reject from thinks_done' });
    ensureProgress(task.child_user_id);

    const tx = db.transaction(() => {
      const eventId = id();
      db.prepare('INSERT INTO task_events (id, task_id, event_type, actor_type, actor_ref, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(eventId, task.id, 'confirmation_rejected', role, actorRef(req, role), nowIso(), JSON.stringify(eventPayload(req, { reason, from_status: task.status, to_status: 'started', nausea_delta: 1 })));
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

  app.get('/agent/questions', (req, res) => {
    const role = req.headers['x-role'];
    if (role !== 'agent') return res.status(403).json({ error: 'forbidden' });
    const { child_user_id: childId = null } = req.query || {};
    const params = [];
    const childClause = childId ? 'WHERE t.child_user_id = ?' : '';
    if (childId) params.push(childId);
    const rows = db.prepare(`SELECT c.*, t.title AS task_title, t.status AS task_status
                             FROM task_comments c
                             JOIN tasks t ON t.id = c.task_id
                             ${childClause}
                             ORDER BY c.created_at ASC`).all(...params);
    const questions = rows
      .filter((row) => row.deleted_at == null)
      .filter((row) => row.author_role === 'child')
      .filter((row) => isQuestionComment(row.message))
      .map((row) => ({
        ...row,
        answered: agentQuestionAnswered(db, row),
        is_question: true,
      }));
    res.json(questions);
  });

  app.post('/agent/questions/:commentId/reply', (req, res) => {
    const role = req.headers['x-role'];
    if (role !== 'agent') return res.status(403).json({ error: 'forbidden' });
    const message = (req.body && req.body.message || '').trim();
    if (!message) return res.status(400).json({ error: 'message required' });

    const parentComment = db.prepare(`SELECT c.*, t.title AS task_title
                                      FROM task_comments c
                                      JOIN tasks t ON t.id = c.task_id
                                      WHERE c.id = ? AND c.deleted_at IS NULL`).get(req.params.commentId);
    if (!parentComment) return res.status(404).json({ error: 'not found' });

    const commentId = id();
    const userId = actorRef(req, 'agent');
    const tx = db.transaction(() => {
      db.prepare(`INSERT INTO task_comments (id, task_id, author_user_id, author_role, message, created_at)
                  VALUES (?, ?, ?, ?, ?, ?)`).run(commentId, parentComment.task_id, userId, 'agent', message, nowIso());
      emitTaskEvent(parentComment.task_id, 'comment_created', 'agent', userId, eventPayload(req, {
        comment_id: commentId,
        reply_to_comment_id: parentComment.id,
        reply_to_author_user_id: parentComment.author_user_id,
      }));
    });
    tx();
    res.status(201).json(db.prepare('SELECT * FROM task_comments WHERE id=?').get(commentId));
  });

  app.get('/tasks/:id/comments', (req, res) => {
    const task = db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'not found' });
    const rows = db.prepare(`SELECT * FROM task_comments
                             WHERE task_id=? AND deleted_at IS NULL
                             ORDER BY created_at ASC`).all(req.params.id);
    res.json(rows);
  });

  app.get('/tasks/:id/events', (req, res) => {
    const task = db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'not found' });
    const rows = db.prepare(`SELECT * FROM task_events
                             WHERE task_id=?
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
    const tx = db.transaction(() => {
      db.prepare(`INSERT INTO task_comments (id, task_id, author_user_id, author_role, message, created_at)
                  VALUES (?, ?, ?, ?, ?, ?)`).run(commentId, req.params.id, userId, role, message, nowIso());
      emitTaskEvent(req.params.id, 'comment_created', role, userId, eventPayload(req, { comment_id: commentId }));
    });
    tx();
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
    const deliveredAt = nowIso();
    const tx = db.transaction(() => {
      const newlyDelivered = db.prepare('SELECT * FROM task_feedback_animations WHERE child_user_id=? AND seen_at IS NULL AND delivered_at IS NULL ORDER BY created_at ASC').all(req.params.childUserId);
      db.prepare('UPDATE task_feedback_animations SET delivered_at=? WHERE child_user_id=? AND seen_at IS NULL AND delivered_at IS NULL')
        .run(deliveredAt, req.params.childUserId);
      for (const animation of newlyDelivered) {
        emitTaskEvent(animation.task_id, 'animation_delivered', 'system', 'system', { animation_id: animation.id, animation_type: animation.animation_type, delivered_at: deliveredAt });
      }
    });
    tx();
    const rows = db.prepare('SELECT * FROM task_feedback_animations WHERE child_user_id=? AND seen_at IS NULL ORDER BY created_at ASC').all(req.params.childUserId);
    res.json(rows);
  });

  app.post('/children/:childUserId/animations/:animationId/ack', (req, res) => {
    const seenAt = nowIso();
    const tx = db.transaction(() => {
      const animation = db.prepare('SELECT * FROM task_feedback_animations WHERE id=? AND child_user_id=?').get(req.params.animationId, req.params.childUserId);
      const r = db.prepare('UPDATE task_feedback_animations SET seen_at=? WHERE id=? AND child_user_id=? AND seen_at IS NULL')
        .run(seenAt, req.params.animationId, req.params.childUserId);
      if (r.changes === 1 && animation) {
        emitTaskEvent(animation.task_id, 'animation_acknowledged', 'child', req.params.childUserId, { animation_id: animation.id, seen_at: seenAt });
      }
      return r;
    });
    const r = tx();
    res.json({ acknowledged: r.changes === 1, seen_at: r.changes === 1 ? seenAt : null });
  });

  return app;
}

module.exports = { createApp, derivePlannedDate };

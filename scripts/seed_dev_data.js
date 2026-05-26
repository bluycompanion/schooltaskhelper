#!/usr/bin/env node
const { openDb, runMigrations } = require('../src/db');

const DEMO_CHILD_USER_ID = 'child1';
const DEMO_PARENT_USER_ID = 'parent1';
const DEMO_TASK_SOURCE = 'manual';
const DEMO_TASK_EXTERNAL_IDS = ['demo-received', 'demo-started', 'demo-review'];

function nowIso() {
  return new Date().toISOString();
}

function seedDevData(db) {
  const stamp = nowIso();
  const tx = db.transaction(() => {
    db.prepare(`INSERT OR REPLACE INTO users (id, role, display_name, created_at) VALUES
      (?, 'child', 'Demo-barn', COALESCE((SELECT created_at FROM users WHERE id=?), ?)),
      (?, 'parent', 'Demo-vuxen', COALESCE((SELECT created_at FROM users WHERE id=?), ?)),
      ('agent1', 'agent', 'Demo-agent', COALESCE((SELECT created_at FROM users WHERE id='agent1'), ?))`)
      .run(DEMO_CHILD_USER_ID, DEMO_CHILD_USER_ID, stamp, DEMO_PARENT_USER_ID, DEMO_PARENT_USER_ID, stamp, stamp);

    db.prepare('INSERT OR IGNORE INTO child_parent_access (child_user_id, parent_user_id) VALUES (?, ?)')
      .run(DEMO_CHILD_USER_ID, DEMO_PARENT_USER_ID);

    const existingTaskIds = db.prepare('SELECT id FROM tasks WHERE child_user_id=?').all(DEMO_CHILD_USER_ID).map((row) => row.id);
    for (const taskId of existingTaskIds) {
      db.prepare('DELETE FROM task_feedback_animations WHERE task_id=?').run(taskId);
      db.prepare('DELETE FROM task_events WHERE task_id=?').run(taskId);
      db.prepare('DELETE FROM task_effect_flags WHERE task_id=?').run(taskId);
      db.prepare('DELETE FROM task_comments WHERE task_id=?').run(taskId);
      db.prepare('DELETE FROM tasks WHERE id=?').run(taskId);
    }

    db.prepare('DELETE FROM child_progress_state WHERE child_user_id=?').run(DEMO_CHILD_USER_ID);
    db.prepare(`INSERT INTO child_progress_state
      (child_user_id, hunger_score, hunger_capacity, xp_total, stars_total, level, nausea_score, updated_at)
      VALUES (?, 7, 30, 0, 0, 1, 0, ?)`)
      .run(DEMO_CHILD_USER_ID, stamp);

    const rows = [
      {
        id: 'demo-task-received',
        title: 'Läs svenska kapitel 4',
        subject: 'Svenska',
        due_date: '2026-05-28',
        difficulty: 'unknown',
        planned_window: 'unknown',
        status: 'received',
        source_external_id: 'demo-received',
        current_attempt_no: 1,
      },
      {
        id: 'demo-task-planning',
        title: 'Träna glosor i engelska',
        subject: 'Engelska',
        due_date: '2026-05-29',
        difficulty: 'easy',
        planned_window: 'next_week',
        status: 'received',
        source_external_id: 'demo-planning',
        current_attempt_no: 1,
      },
      {
        id: 'demo-task-started',
        title: 'Gör matteuppgifter 12–18',
        subject: 'Matte',
        due_date: '2026-05-30',
        difficulty: 'medium',
        planned_window: 'today',
        status: 'started',
        source_external_id: 'demo-started',
        current_attempt_no: 1,
      },
      {
        id: 'demo-task-review',
        title: 'Lämna in NO-labb',
        subject: 'NO',
        due_date: '2026-05-27',
        difficulty: 'hard',
        planned_window: 'this_week',
        status: 'thinks_done',
        source_external_id: 'demo-review',
        current_attempt_no: 1,
      },
      {
        id: 'demo-task-no-due',
        title: 'Rensa skolväskan',
        subject: 'Mentorstid',
        due_date: null,
        difficulty: 'unknown',
        planned_window: 'this_week',
        status: 'received',
        source_external_id: 'demo-no-due',
        current_attempt_no: 1,
      },
    ];

    for (const task of rows) {
      db.prepare(`INSERT INTO tasks
        (id, child_user_id, title, subject, due_date, difficulty, planned_window, status, source, source_external_id, current_attempt_no, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          task.id,
          DEMO_CHILD_USER_ID,
          task.title,
          task.subject,
          task.due_date,
          task.difficulty,
          task.planned_window,
          task.status,
          DEMO_TASK_SOURCE,
          task.source_external_id,
          task.current_attempt_no,
          stamp,
          stamp,
        );
    }

    db.prepare(`INSERT INTO task_comments (id, task_id, author_user_id, author_role, message, created_at)
      VALUES ('demo-comment-review', 'demo-task-review', ?, 'child', 'Jag tror att den är klar, men kolla gärna slutsatsen.', ?)`)
      .run(DEMO_CHILD_USER_ID, stamp);
  });

  tx();
}

if (require.main === module) {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed demo data with NODE_ENV=production.');
    process.exit(1);
  }
  const db = openDb(process.env.SCHOOLTASKHELPER_DB_PATH);
  runMigrations(db);
  seedDevData(db);
  db.close();
  console.log(`Seeded demo GUI data for child=${DEMO_CHILD_USER_ID}, parent=${DEMO_PARENT_USER_ID}`);
}

module.exports = { DEMO_CHILD_USER_ID, DEMO_PARENT_USER_ID, seedDevData };

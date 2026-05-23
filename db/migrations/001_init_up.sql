PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('child','parent','agent','system')),
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS child_parent_access (
  child_user_id TEXT NOT NULL,
  parent_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (child_user_id, parent_user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  child_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  due_date TEXT,
  difficulty TEXT NOT NULL DEFAULT 'unknown' CHECK(difficulty IN ('easy','medium','hard','unknown')),
  planned_window TEXT NOT NULL DEFAULT 'unknown' CHECK(planned_window IN ('today','tomorrow','this_week','next_week','unknown')),
  status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','started','thinks_done','confirmed_done')),
  source TEXT NOT NULL,
  source_external_id TEXT NOT NULL,
  current_attempt_no INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source, source_external_id)
);

CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  author_role TEXT NOT NULL CHECK(author_role IN ('child','parent','agent')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS task_effect_flags (
  task_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  effect_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, attempt_no, effect_key)
);

CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_ref TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS task_feedback_animations (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  child_user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  animation_type TEXT NOT NULL CHECK(animation_type IN ('reject_nausea')),
  animation_key TEXT NOT NULL UNIQUE,
  seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS child_progress_state (
  child_user_id TEXT PRIMARY KEY,
  hunger_score INTEGER NOT NULL DEFAULT 0,
  hunger_capacity INTEGER NOT NULL DEFAULT 0,
  xp_total INTEGER NOT NULL DEFAULT 0,
  stars_total INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  nausea_score INTEGER NOT NULL DEFAULT 0,
  nausea_updated_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

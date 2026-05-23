-- SchoolTaskHelper v1 DB prep (Postgres-first)
-- Date: 2026-05-22
-- Scope: database preparation only (no API implementation)

create extension if not exists pgcrypto;

-- Enums
create type user_role as enum ('child','parent','agent','system');
create type task_difficulty as enum ('easy','medium','hard','unknown');
create type task_planned_window as enum ('today','tomorrow','this_week','next_week','unknown');
create type task_status as enum ('received','started','thinks_done','confirmed_done');
create type confirm_actor_type as enum ('parent','agent');
create type attempt_outcome as enum ('pending','confirmed','rejected');
create type reward_effect_type as enum ('bonus','neutral_bonus','penalty');
create type animation_type as enum ('reject_nausea');

-- Core
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  role user_role not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists child_parent_access (
  child_user_id uuid not null references users(id) on delete cascade,
  parent_user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (child_user_id, parent_user_id)
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  child_user_id uuid not null references users(id) on delete cascade,
  title text not null,
  subject text,
  source text not null,
  source_external_id text not null,
  due_date date,
  difficulty task_difficulty not null default 'unknown',
  planned_window task_planned_window not null default 'unknown',
  status task_status not null default 'received',
  current_attempt_no int not null default 0,
  child_comment text,
  parent_comment text,
  confirmed_by_type confirm_actor_type,
  confirmed_by_ref text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_external_id)
);

create index if not exists idx_tasks_child_due_created
  on tasks (child_user_id, due_date asc, created_at asc);

create table if not exists task_attempts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  attempt_no int not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  outcome attempt_outcome not null default 'pending',
  confirmed_by_type confirm_actor_type,
  confirmed_by_ref text,
  rejected_by_type confirm_actor_type,
  rejected_by_ref text,
  notes text,
  created_at timestamptz not null default now(),
  unique (task_id, attempt_no)
);

create table if not exists task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  attempt_no int,
  event_type text not null,
  from_status text,
  to_status text,
  actor_type user_role not null,
  actor_ref text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_events_task_created on task_events(task_id, created_at);

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_user_id uuid not null references users(id) on delete cascade,
  author_role user_role not null,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index if not exists idx_task_comments_task_created on task_comments(task_id, created_at);

create table if not exists child_progress_state (
  child_user_id uuid primary key references users(id) on delete cascade,
  xp_total int not null default 0,
  stars_total int not null default 0,
  level int not null default 1,
  hunger_score int not null default 0,
  hunger_capacity int not null default 0,
  nausea_score int not null default 0,
  streak_days int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists reward_events (
  id uuid primary key default gen_random_uuid(),
  child_user_id uuid not null references users(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  attempt_no int,
  effect_type reward_effect_type not null,
  points int not null,
  reason text not null,
  actor_type user_role,
  actor_ref text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);

-- One-shot animation delivery state
create table if not exists task_feedback_animations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  child_user_id uuid not null references users(id) on delete cascade,
  event_id uuid not null references task_events(id) on delete cascade,
  animation_type animation_type not null,
  animation_key text not null unique,
  delivered_at timestamptz,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_feedback_child_unseen
  on task_feedback_animations(child_user_id, seen_at, created_at);

-- Operational notes:
-- 1) Hunger rules (playtest): +3 new task, -1 meaningful progression, max 3 decreases per task/attempt cycle.
-- 2) Stars/XP on confirmed_done by difficulty: easy=3, medium=6, hard=10 (unknown=>medium).
-- 3) Nausea: +1 on thinks_done->rejected, decay after 24h or clear on level-up.
-- 4) One-shot reject animation is persisted via task_feedback_animations and acknowledged via seen_at.

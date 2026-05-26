# API/DB baseline reconciliation — 2026-05-25

Scope: reconcile the current Express + SQLite MVP baseline against `docs/API_V1_CONTRACT.md`, the live SQLite migration `db/migrations/001_init_up.sql`, `src/app.js`, `src/db.js`, and `tests/integration.test.js`.

Runtime baseline recorded
- Source path: `/Users/Shared/dev/projects/schooltaskhelper`
- Node: v24.13.1
- npm: 11.8.0
- `npm test` baseline after native module rebuild: pass, 8/8 tests.
- During reconciliation/verification, the local `better-sqlite3` native module can report a Node ABI mismatch after Node runtime changes. Running `npm rebuild better-sqlite3` aligns the native module with the current Node runtime before testing.
- `runMigrations(db)` now non-destructively adds missing `delivered_at` and `seen_at` columns to an existing local `task_feedback_animations` table, preserving local rows while making old `data/dev.sqlite` files compatible with the current pending-animation endpoints.

Current live MVP database choice
- SQLite is the only MVP database.
- The live executable schema is `db/migrations/001_init_up.sql`.

Fixed now
- `task_feedback_animations` now includes both `delivered_at` and `seen_at` in the SQLite migration.
- `runMigrations(db)` now non-destructively adds missing `delivered_at` and `seen_at` columns for existing local `data/dev.sqlite` files whose `task_feedback_animations` table was created before those columns existed.
- `GET /children/:childUserId/animations/pending` sets `delivered_at` the first time an unseen animation is returned and keeps `seen_at` null until ack.
- `POST /children/:childUserId/animations/:animationId/ack` sets `seen_at` and returns `{ acknowledged, seen_at }`.
- Added `GET /tasks/:taskId/events` for the current audit/event trail.
- Task events now cover `task_created`, `planning_updated`, `status_changed`, `reward_granted`, `confirmation_rejected`, `animation_delivered`, `animation_acknowledged`, and `comment_created`.
- Reject events persist payload with reject `reason`, status transition, and nausea delta; other events use small event-specific JSON payloads.
- Integration tests now cover delivered/seen animation timestamps and lifecycle audit events for create/planning/status/reward/reject/animation/comment behavior.

Documented baseline deltas
- `docs/API_V1_CONTRACT.md` remains the broader v1 contract/historical planning doc. Some entries describe target/future behavior that is not yet fully implemented in SQLite.
- The SQLite migration intentionally has a small MVP event model: no `task_attempts`, no `reward_events`, and no `from_status`/`to_status` columns yet.
- The current event trail covers task create, planning changes, status transitions, reward grants, reject events, animation delivery/ack, and comments. It is still not a visible history UI.
- The current auth/action model is local MVP header-based behavior, not production auth.

Deferred
- Rich task attempt history (`task_attempts`) and separate reward ledger (`reward_events`).
- Nausea decay is currently read/write-time behavior in `GET /children/:childUserId/progress`, not a scheduled worker.
- Level-up behavior and nausea reset on level-up are not implemented.
- Production-grade auth/permissions are not implemented.
- Production deploy is not approved.

Accepted MVP direction after JW update
- Keep SQLite as the only active MVP DB. Do not preserve alternate database backends as an active implementation plan for this phase.
- Keep `can_actions` as local MVP UI hints based on role/status intent and current task status; do not treat it as authorization.
- Backend validation in mutating endpoints remains authoritative through simple local `x-role` checks.
- Keep visible history UI out of v1; active task list excludes `confirmed_done` tasks.
- Backend event/audit capability remains in scope; current MVP event trail covers create/planning/status/reward/reject/animation/comment events. Synlig historik-UI remains out of v1 scope.

`can_actions` current local MVP semantics
- Plain-language meaning: `can_actions` tells the UI which buttons may make sense for the task's current status.
- It is a UI hint, not authorization and not a security boundary.
- Current API output is computed from task status only. The UI must still separate child/parent controls using its local role/view context.
- Each mutating endpoint enforces simple local role/status checks via `x-role`; those backend checks are authoritative.
- Current mapping:
  - `received`: `set_difficulty`, `set_planning`, `mark_started`, `comment`
  - `started`: `set_difficulty`, `set_planning`, `mark_thinks_done`, `comment`
  - `thinks_done`: `comment`, `confirm_done`, `reject_done`
  - `confirmed_done`: `comment`
- Simplest viable local MVP semantics: keep this status-based union in API responses for now, and let the frontend show the appropriate fixed buttons for its local role/context. Do not treat `can_actions` as an authorization source. Endpoint role checks remain authoritative.

Endpoint readiness snapshot
- `POST /agent/tasks`: implemented; idempotent by `source + source_external_id`; new task increases hunger by 3.
- `GET /tasks?child_user_id=...`: implemented; active tasks only; due-date ordering with nulls last; includes `can_actions`.
- `GET /tasks/:taskId`: implemented; includes `can_actions`.
- `PATCH /tasks/:taskId/planning`: implemented for child role via `x-role: child`; hunger decrease is idempotent per attempt/effect key and capped.
- `PATCH /tasks/:taskId/status`: implemented for current status transitions with local role header checks.
- `POST /tasks/:taskId/reject`: implemented for parent/agent role; increments nausea; reopens to started; creates reject event and pending animation.
- `GET /tasks/:taskId/comments` and `POST /tasks/:taskId/comments`: implemented.
- `GET /tasks/:taskId/events`: implemented for create/planning/status/reward/reject/animation/comment audit events.
- `GET /children/:childUserId/progress`: implemented; recalculates hunger capacity and applies nausea decay when read.
- `GET /children/:childUserId/animations/pending`: implemented; marks delivered animations via `delivered_at`.
- `POST /children/:childUserId/animations/:animationId/ack`: implemented; marks seen animations via `seen_at`.

Frontend notes
- Use the real API; do not create frontend mock task/progress/comment/animation data.
- For local MVP requests that mutate child/parent/agent actions, send the expected `x-role` header (`child`, `parent`, or `agent`). Comments should also send `x-user-id` when available.
- `can_actions` is a UI hint, not security/authorization. Frontend must not expose parent controls to child users only because a status-level hint includes them.
- Pending reject animations have both `delivered_at` and `seen_at`; `seen_at` stays null until ack.
- `GET /tasks/:taskId/events` now gives frontend/debug tooling a backend audit trail for create/planning/status/reward/reject/animation/comment lifecycle events; keep visible history UI out of v1 unless reprioritized.

Production deploy status
- Production deploy requires explicit JW approval.
- Status: Not approved for production deploy.

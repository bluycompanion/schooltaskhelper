# Future Action Tracker — API focus

> **Status:** planning only
>
> **Scope now:** no implementation yet, no deploy, no UI work
>
> **Goal:** move the project toward an agent-friendly API where Hermès and OpenClaw can read tasks, update status, create tasks, and handle child questions via comments while every action is traced in the event log.

## Notes from latest review

### Warnings
- `scripts/inspect_build.js` looks brittle if the bundle name changes on the next build.
- The current manual status popup feels more like debug/admin UI than the minimal v1 direction.
- Reward / status state is not surfaced clearly enough in the log yet, even though the backend records it.

### Suggestions
- Keep the next phase API-first and avoid UI polish until the data model is settled.
- Treat the audit/event trail as the source of truth for agent activity.
- Keep agent permissions narrow: agents may change status, but not difficulty or planning.
- Prefer one shared agent contract for both Hermès and OpenClaw so the backend does not fork by tool/provider.

## API goals to support

1. **Fetch tasks by due date window**
   - Agent must be able to fetch tasks whose `due_date` falls inside a rolling 12-month lookback window ending today.
   - The query should be explicit about date bounds so the window is deterministic.

2. **Update task status**
   - Agent may update `status` only.
   - Agent must *not* be able to update `difficulty` or `planned_window`.

3. **Create tasks**
   - Agent may insert new tasks.
   - Task creation must be idempotent where possible and always logged.

4. **Trace every action**
   - All mutating actions must emit events into the log.
   - Read-only queries do not need event rows, but any agent write action must be traceable.

5. **Extract child questions from comments**
   - The API must let an agent fetch comments that are likely questions from the child.
   - The API must let an agent reply through the same task/comment system.

6. **Support both Hermès and OpenClaw**
   - Same backend contract.
   - Different actor identity is fine, but the API shape should stay identical.

## Proposed backend shape

### Read endpoints
- `GET /agent/tasks?child_user_id=...&due_from=...&due_to=...`
  - Returns task rows in the requested date window.
- `GET /tasks/:id/comments`
  - Returns the full comment thread.
- `GET /agent/questions?child_user_id=...`
  - Returns comments that look like child questions and have not yet been answered.

### Mutating endpoints
- `POST /agent/tasks`
  - Create a task.
- `PATCH /tasks/:id/status`
  - Allow agent status updates only.
- `POST /tasks/:id/comments`
  - Agent can reply to a task comment thread.
- Optional future extension:
  - `POST /agent/questions/:commentId/reply` if we want a dedicated reply helper.

## Proposed rules

### Agent permissions
- Allowed: read tasks, create tasks, update status, comment/reply.
- Not allowed: change `difficulty`.
- Not allowed: change `planned_window`.

### Event logging
Recommended event types:
- `task_created`
- `status_changed`
- `comment_created`
- `question_detected` if we decide to materialize extraction
- `question_replied` if we want a dedicated audit event for responses

### Identity / traceability
- Keep `x-role: agent` as the authorization role.
- Add a provider/actor field for traceability so we can distinguish:
  - Hermès
  - OpenClaw
- The backend should record who acted without changing the API contract per provider.

## Implementation order suggestion

1. Freeze the agent contract in docs.
2. Add the read query for the 12-month due-date window.
3. Enforce status-only agent mutations.
4. Add comment question extraction semantics.
5. Add agent reply flow.
6. Backfill and expand event logging tests.
7. Update docs/action log after each meaningful slice.

## Open questions to settle before coding

- Should the 12-month window be relative to *today* or relative to a supplied anchor date?
- Should question extraction be heuristic-only (`?` in text) or support explicit flags later?
- Should agent replies reuse normal comments, or do we want a dedicated reply endpoint?
- Do we want a separate actor header for provider name, or is `x-user-id` enough for traceability?

## Current recommendation

Use one shared agent API for both Hermès and OpenClaw, keep the mutation surface narrow, and let the event log capture the full audit trail. Build the question-reply flow on top of comments instead of inventing a new subsystem.

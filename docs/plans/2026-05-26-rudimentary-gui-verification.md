# Rudimentary GUI Verification Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task after JW approves it.

**Goal:** Make SchoolTaskHelper easy to verify manually before any production deploy, using a minimal touch-first GUI and deterministic local test data.

**Architecture:** Keep the existing React/Vite app as the GUI. Add only small dev/test affordances needed to exercise the current SQLite-backed API: child view, parent view, seeded active tasks, planning/status actions, comments, confirmation/reject, progress, and one-shot feedback animation. No auth, no filtering, no history UI, no production deploy.

**Tech Stack:** Express + SQLite backend, React/Vite frontend, TypeScript API client, Node tests.

---

## Current source of truth

- Active MVP DB: SQLite.
- Existing frontend entry: `apps/web/src/App.tsx`.
- Existing API client: `apps/web/src/api/apiClient.ts`.
- Existing API contract: `docs/API_V1_CONTRACT.md`.
- Existing UX guardrails: `docs/UIUX_BRIEF_V1.md`, `AGENTS.md`.

## Allowed change scope

- Dev/test GUI affordances only.
- Small backend dev-only endpoint/script if needed for seed/reset.
- Frontend tests and docs updates.
- No production deploy.
- No Postgres work.
- No authentication system.

## Deferred scope

- No login/user management.
- No filtering UI.
- No visible history UI.
- No dark/light mode.
- No polished animation system beyond current one-shot feedback behavior.

---

## Acceptance criteria

Manual verifier can, locally:

1. Open the GUI and see active tasks.
2. Switch between **Barnvy** and **Vuxenvy** without changing code.
3. Reset/seed predictable demo data.
4. As child: set difficulty, set planned window, mark started, mark thinks done, comment.
5. As parent: comment, confirm done, reject done.
6. See progress/topbar update after actions.
7. Trigger reject feedback once, reload, and confirm it does not replay after ack.
8. Run `npm run test:web`, `npm run typecheck:web`, `npm run build:web`, and `npm test` successfully.

---

## Task 1: Baseline verification before edits

**Objective:** Confirm current repo state and current web/API checks before changing anything.

**Files:** none.

**Steps:**
1. Run `git status --short`.
2. Run `npm run test:web`.
3. Run `npm run typecheck:web`.
4. Run `npm run build:web`.
5. Run `npm test`.

**Expected:** all checks pass and any dirty files are understood before implementation.

---

## Task 2: Add a dev-only seed/reset path

**Objective:** Give manual testers predictable GUI data without hand-crafting curl calls.

**Preferred approach:** Add a script first; only add an HTTP endpoint if the GUI needs a button.

**Files:**
- Create: `scripts/seed_dev_data.js`
- Possibly modify: `package.json`
- Test/update: `tests/integration.test.js` if HTTP endpoint is added

**Implementation direction:**
- Seed one fixed child user and one fixed parent user.
- Clear/recreate demo tasks in `data/dev.sqlite` safely for dev only.
- Create at least:
  - one `received` task with due date
  - one `started` task
  - one `thinks_done` task for parent confirm/reject
- Preserve production safety: script must require `NODE_ENV !== 'production'` or explicit dev DB path.

**Verification:**
- `npm run seed:dev` creates predictable rows.
- `GET /tasks?child_user_id=<demo-child>` returns the demo tasks sorted by due date.

---

## Task 3: Add role/view switcher for local verification

**Objective:** Allow JW to test child and parent flows from the same GUI.

**Files:**
- Modify: `apps/web/src/config.ts`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/api/apiClient.test.ts` only if config behavior is covered there

**Implementation direction:**
- Read role from querystring, e.g. `?role=child` / `?role=parent`.
- Keep current default local context if no querystring is present.
- Add a tiny top-panel control/link pair:
  - `Barnvy`
  - `Vuxenvy`
- Do not add auth or account selection.

**Verification:**
- `http://127.0.0.1:5173/?role=child` shows child actions.
- `http://127.0.0.1:5173/?role=parent` shows parent actions.

---

## Task 4: Add a minimal tester panel if seed/reset via GUI is needed

**Objective:** Make manual testing possible without terminal once app is running.

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/api/apiClient.ts` if dev endpoint exists
- Modify: `apps/web/src/styles.css`

**Implementation direction:**
- Add a small collapsible “Testläge” panel only in local/dev mode.
- Include:
  - current role
  - child user id
  - “Ladda om” button
  - optionally “Återställ demo-data” if backend endpoint exists
- Keep it visually secondary and out of the core child UI.

**Verification:**
- Panel is visible only in dev/local mode.
- Reset/reload does not break normal task flow.

---

## Task 5: Manual verification checklist doc

**Objective:** Give JW a repeatable click-path before deploy approval.

**Files:**
- Create: `docs/GUI_MANUAL_VERIFICATION.md`
- Modify: `docs/ACTION_LOG.md`

**Checklist should include:**
1. Start backend and frontend locally.
2. Seed/reset demo data.
3. Child flow: plan → start → thinks done → comment.
4. Parent flow: comment → reject → verify child feedback once.
5. Parent flow: confirm done → verify stars/progress.
6. Reload checks.
7. Commands for automated checks.

---

## Task 6: Final verification and commit

**Objective:** Prove GUI is safe to use as pre-deploy verification surface.

**Commands:**
- `npm run test:web`
- `npm run typecheck:web`
- `npm run build:web`
- `npm test`
- `git diff --check`

**Commit:**
```bash
git add apps/web scripts package.json tests docs
GIT_AUTHOR_NAME="B2LeadDev" GIT_AUTHOR_EMAIL="bluycompanion@gmail.com" \
GIT_COMMITTER_NAME="B2LeadDev" GIT_COMMITTER_EMAIL="bluycompanion@gmail.com" \
  git commit -m "feat: add rudimentary GUI verification flow"
```

---

## Recommended execution path

1. Implement Task 1–3 first.
2. Pause and let JW test the GUI manually.
3. Add Task 4 only if terminal-based seed/reset feels too clunky.
4. Complete Task 5–6 before discussing deploy.

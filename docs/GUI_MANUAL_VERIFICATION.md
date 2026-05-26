# GUI Manual Verification — SchoolTaskHelper

Status: local/dev verification only. Do **not** treat this as production deploy approval.

## 1. Prepare demo data

From `/Users/Shared/dev/projects/schooltaskhelper`:

```bash
npm rebuild better-sqlite3   # only needed after Node version changes
npm run seed:dev
```

Expected output:

```text
Seeded demo GUI data for child=child1, parent=parent1
```

The seed resets `child1` demo data and creates:

- `Läs svenska kapitel 4` — `received`
- `Gör matteuppgifter 12–18` — `started`
- `Lämna in NO-labb` — `thinks_done`

## 2. Start local services

Terminal A:

```bash
PORT=3001 /opt/homebrew/bin/node src/server.js
```

Terminal B:

```bash
npm run dev:web
```

Open:

- Child view: `http://127.0.0.1:5173/?role=child&child_user_id=child1&user_id=child1`
- Parent view: `http://127.0.0.1:5173/?role=parent&child_user_id=child1&user_id=parent1`

The local test panel should show the active role and provide **Barnvy**, **Vuxenvy**, and **Ladda om**.

## 3. Child flow

In **Barnvy**:

1. Confirm active task cards are visible.
2. Open `Läs svenska kapitel 4`.
3. Set difficulty and planned window.
4. Click **Spara plan**.
5. Click **Jag har börjat**.
6. Open or use `Gör matteuppgifter 12–18`.
7. Click **Jag tror jag är klar**.
8. Add a short comment.

Expected:

- Success copy appears in the live region.
- Topbar progress updates after actions.
- Child cannot confirm or reject finished work.

## 4. Parent flow — reject

In **Vuxenvy**:

1. Open `Lämna in NO-labb` or another `Tror klar` task.
2. Add a short parent comment.
3. Click **Kolla igen**.
4. Switch back to **Barnvy** or reload child view.

Expected:

- Task returns to `Påbörjad`.
- Child sees mild reject feedback once.
- After the animation is acknowledged, reload should not replay the same feedback.

## 5. Parent flow — confirm

1. Reset demo data again with `npm run seed:dev` if needed.
2. Open **Vuxenvy**.
3. Confirm `Lämna in NO-labb` with **Bekräfta klar**.

Expected:

- The confirmed task disappears from the active list.
- Stars/progress update.

## 6. Automated gates before deploy discussion

Run:

```bash
npm run test:web
npm run typecheck:web
npm run build:web
npm test
git diff --check
```

All must pass before asking JW for production deploy approval.

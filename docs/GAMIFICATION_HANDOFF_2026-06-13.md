# Gamification Overhaul — Agent Handoff (2026-06-13)

> **Purpose:** Self-contained handoff so another AI agent can pick up the gamification
> work without re-deriving context. Supersedes the dirty-tree warning in
> `docs/NEXT_AGENT_HANDOFF_2026-06-12.md` (that work is now committed).
>
> **Theme goal:** Clash Royale ("glänsande"/shimmer on anything that wants attention) ×
> Tamagotchi (avatar reacts visibly to every action). Dark, vibrant, stylish — not childish.
> The whole point is to *pull* a 10–16 yo into updating status, planning well, and finishing tasks.

---

## 1. Repository state

- Branch: `main`, last commit `17c0859 feat: enhance task gamification and handoff docs`.
- Working tree is **clean** — all gamification work described below is committed.
- Local `main` is **behind origin/main by 1 commit**. Review before pulling; do not force-sync over local history without checking.
- Remote: `https://github.com/bluycompanion/schooltaskhelper.git`.

**Verification baseline (all green):**
```
npm test               14/14 backend integration
npm run test:web        6/6 frontend/client
npm run typecheck:web   pass
npm run build:web       pass
```
PowerShell may block `npm.ps1`; use `npm.cmd ...` or the Bash tool if so.

---

## 2. What was delivered this phase

### Visual foundation
- **Dark vibrant theme** via a CSS custom-property system in `apps/web/src/styles.css`
  (`:root` tokens: `--bg-page`, `--accent-green`, `--accent-gold`, `--glow-*`, etc.).
  Replaced ~25 hardcoded hex values. No HTML structure change.
- **Shimmer-sweep** (`@keyframes shimmer`) + **pulse-scale** on actionable cards
  (`.taskCard--actionable`) and primary buttons — the Clash Royale "glänsande" look:
  a lighter diagonal gradient drifting across the element.

### Avatar (Tamagotchi)
- `avatarMood` computed inline in `App.tsx:387`. Seven states:
  `normal 🙂 / happy 😄 / excited 🤩 / sick 🤢 / busy 😮‍💨 / hungry 😫 / sleeping 😴`.
- Per-state CSS animations: `avatarBounce`, `avatarShake`, `avatarWobble`, `avatarGlow`.
- Level badge rendered on the avatar box (`App.tsx:579`).
- **Mood priority:** `sick` (only while reject feedback is showing) → temp mood →
  `sleeping` (no tasks) → `hungry` (unplanned tasks exist) → `busy` (green < 40%) → `normal`.

### Particle system
- `spawnParticles(emojis, originEvent, bar)` — `App.tsx:272`. 5–8 emoji particles arc
  from the click point to the avatar with staggered delay + random angle (`.flyingFood`).
- Per-action emoji mixes via `particlesForAction(...)`; `bar` arg routes the end-of-flight
  flash to `'hunger' | 'xp' | 'both' | 'none'`.

### Bars (two separate)
- **XP bar:** simple fill. Level math is frontend-only: `LEVEL_XP = 20` (`App.tsx:50`),
  `level = floor(xp_total / 20) + 1`. Level-up banner + excited avatar on level increase.
- **Hunger bar (Sims-style, layered):**
  - Green fills **from the left**, one slice per task, 3 fillable sub-steps per task
    (planning, started, thinks_done) — mirrors the backend hunger decrements.
  - Nausea-**brown eats in from the right**, one task-slice per nausea point (max 40%).
  - **Red alert** background + `alertPulse` glow when ≥1 task is fully unplanned
    (`difficulty === 'unknown' && planned_window === 'unknown'`).
  - Segment ticks per task slice via `::after` with an inline `--slice` CSS variable.
  - Bar math lives in `App.tsx` around the computed-values block (`greenPercent`,
    `brownPercent`, `slicePercent`, `totalSlices`).

### Reward flow
- `collect_reward` is the strongest CTA: `.btn-reward` (gold shimmer + pulse + glow),
  `.taskCard--reward` (gold border), 8-particle burst, then `.taskCard--slideout`.

### Backend logic changes (`src/app.js`)
- **Nausea is derived, not a decaying counter.** `refreshNausea(childId)` (`app.js:133`)
  sets `nausea_score = count(tasks WHERE current_attempt_no > 1 AND status != 'confirmed_done')`.
  The old 24h `applyNauseaDecay` is gone. Brown clears **only when an adult confirms**
  the task done (called at confirm in `app.js:300` and on every `/progress` read `app.js:446`).
- **Planning bonus:** flag `planned_before_thinks_done` is set when a task reaches
  `thinks_done` with both difficulty + window chosen (`app.js:291`); `collect_reward`
  adds **+2 XP** if the flag exists (`app.js:319`). Base points: easy 3 / medium 6 / hard 10
  (`starPoints`, `app.js:45`). `reward_granted` payload now includes `planning_bonus`.
- **Parent-created tasks:** `POST /tasks` with `x-role: parent` (`app.js:190`) creates a
  manual task (`source='manual'`, `source_external_id='manual-{id}'`, hunger +3, emits
  `task_created`). Validates title + `due_date` format.
- **`completed_today`:** `/progress` now returns count of tasks whose reward was collected
  since local midnight (`app.js:455`). The frontend keeps those as fully-fed slices so
  **finishing a task never shrinks the green bar**; it resets naturally next morning.

### Frontend wiring
- `apiClient.ts`: `createParentTask(...)`; `ChildProgress.completed_today?: number`.
- Rejected-and-unconfirmed tasks get `.taskCard--nausea` (brown border) + a 🤢 badge
  before the title (`App.tsx:722`). Card class priority: slideout → reward → nausea → actionable.
- Parent toolbar "+ Ny uppgift" → popup form (title, subject, due date).

---

## 3. RESOLVED (2026-06-13) — next-step button + checklist chips + bonus

The "next-step button skips planning" bug and the two pedagogical companions are **done**.

**The bug was:** the collapsed-card primary-action selector filtered out planning, so a
new task showed "Jag har börjat" and the child could start without planning.

**Fix (`App.tsx`):**
- New `nextStepAction(task, actions)` helper returns the single next logical step in
  pedagogical order: `confirm_done` → `collect_reward` → `set_difficulty` ("Välj svårighet",
  if difficulty unknown) → `set_planning` ("Planera tid", if window unknown) → `mark_started`
  → `mark_thinks_done` → `reject_done`.
- Collapsed card shows only that next step. Expanded card additionally shows remaining
  progression actions, so a child can still start before planning (**soft guidance**, not a
  hard gate — per user choice).
- **Checklist chips** replaced the passive `subMetaLine` text. For child role each chip is a
  button (`ChecklistChip`) showing ○ (todo, gold + pulse) or ✓ (done, green + value);
  tapping opens the difficulty/planning popup. For parent role they render as display-only
  spans. Status shown as a dashed display chip.
- **Planning bonus hint** ("✨ Planera klart = +2 ⭐ bonus") shows on child cards only while
  not fully planned and not yet `thinks_done`/`confirmed_done`; disappears once both are set.
- `tinyActions` trimmed to a child-only "Ändra status" override (difficulty/plan now live in
  the clickable chips). The manual status popup is still considered debug-ish (see
  `FUTURE_ACTION_TRACKER`) — candidate for removal later.

Verified in the browser (child + parent views) and via `typecheck:web` / `test:web` / `build:web`.
These changes are **uncommitted** as of this writing.

---

## 4. Pedagogical improvement proposals

Recommended first bundle (all reuse existing infrastructure):

1. **Next-step primary button** (= the bug fix above). One clear next action per card,
   never skipping ahead. Biggest clarity win; matches spec for concentration support.
2. **Checklist-style chips.** Today the card shows passive text ("Svårighet: Inte valt ·
   Plan: Vet inte än · Status: Ny"). Turn these into a fillable ✓/○ checklist that fills
   step by step — a "complete the set" game feel that makes the process visible.
3. **Surface the planning bonus.** The +2 ⭐ for planning already exists in the backend but
   is invisible. A small "Planera klart = +2 ⭐" hint turns a hidden mechanic into an
   active incentive — directly supports the "plan well" goal.

Further options if going deeper:
- Numbered stepper ("Steg 2 av 4") on each card.
- Per-step particle feedback (particle system already exists).
- Stronger positive vs. reject feedback asymmetry (spec requirement — verify current state).

---

## 5. Roadmap

| Priority | Item |
|---|---|
| ~~Now~~ ✅ | ~~Fix the next-step primary button (§3)~~ — done 2026-06-13 |
| ~~Now~~ ✅ | ~~Checklist chips + surface planning bonus~~ — done 2026-06-13 |
| **Next** | Commit the uncommitted next-step/chips/bonus work (branch vs main per JW) |
| Soon | Mobile-viewport + a11y pass: 44px touch targets, keyboard path, `prefers-reduced-motion` for the new shimmer/pulse/particle animations. Note: new clickable chips need keyboard focus/contrast check |
| Soon | Verify positive completion feedback is stronger than reject (spec §6/§10) |
| Later | Level system: DB `level` column is unused (frontend computes it). Persist + emit `level_up` events if server-side reward logic is wanted |
| Later | Answer open UX questions in spec §16 (e.g. can child edit planning while `thinks_done`?) |
| Later | Update demo seed (`scripts/seed_dev_data.js`) to showcase the new states (nausea card, reward-ready card, unplanned/red bar) |

---

## 6. How to run & verify

```sh
npm install
npm start            # API on PORT or 3001
npm run dev:web      # Vite frontend, proxies to :3001
```
Local view switching via querystring (dev-only identity):
- Child:  `http://localhost:5173/?role=child&child_user_id=child1&user_id=child1`
- Parent: `http://localhost:5173/?role=parent&child_user_id=child1&user_id=parent1`

`npm run seed:dev` resets predictable demo data for `child1`/`parent1`.

**Test-data caveat:** the local `data/dev.sqlite` currently holds ad-hoc tasks and a high
`xp_total` / `completed_today` from manual end-to-end testing during this session. Run
`npm run seed:dev` for a clean predictable state before demos.

---

## 7. Scope guards & constraints (still in force)

- **V1 scope guard:** no filtering UI, no dedicated history UI, single theme mode, online-only.
- **Deploy gate:** production deploy requires explicit JW approval. Status: not approved.
- **Auth is dev-header based** (`x-role`, `x-user-id`, optional `x-agent-provider`), not
  production auth. `can_actions` is an advisory UI hint, **not** authorization — backend
  role/status checks in mutating endpoints remain authoritative.
- **Agent permissions stay narrow:** agents may change status, not difficulty/planning
  (see `docs/FUTURE_ACTION_TRACKER.md`).
- Per `AGENTS.md`: keep changes reversible/small and update `docs/ACTION_LOG.md` after
  meaningful changes.

---

## 8. Key files map

| File | Role |
|---|---|
| `apps/web/src/App.tsx` | All UI, gamification state, avatar mood, particles, bar math, parent form, card rendering |
| `apps/web/src/styles.css` | Theme tokens, keyframes (shimmer/pulse/avatar/bar flash), all component styling |
| `apps/web/src/api/apiClient.ts` | Types, `getVisibleActions`, role/status action maps, `createParentTask`, `ChildProgress` |
| `src/app.js` | Express routes, hunger/nausea/XP logic, `refreshNausea`, `POST /tasks`, reward + planning bonus |
| `db/migrations/001_init_up.sql` | Schema (`tasks`, `child_progress_state`, `task_effect_flags`, `task_events`, `task_feedback_animations`) |
| `tests/integration.test.js` | Backend integration coverage (14 tests) |
| `docs/UX_WORKING_SPEC_NEXT_PHASE.md` | Authoritative UX spec (state/action matrix §7, copy, a11y gates) |

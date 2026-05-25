# SchoolTaskHelper — UX working spec for next phase

Datum: 2026-05-25
Ägare: Product UX
Status: Working spec, redo för frontend-planering med lokal MVP-semantik för `can_actions` som UI-hint

## 1. UX readiness

Verdict: Approved for next frontend planning step under the agreed local MVP semantics.

Current backend/action baseline:
- `can_actions` is a role/status-oriented UI hint in plain language, not authorization.
- Current API output is status-based; frontend must apply its own local child/parent view context so child users never see parent confirm/reject controls just because a status-level hint includes them.
- Backend validation remains authoritative in mutating endpoints through simple local `x-role` checks.

## 2. Target group and usage context

Target group:
- Children and young people age 10–16.
- Extra focus on users who need concentration support.
- Secondary users: parents who review, comment, confirm done, or reject gently.

Usage context:
- Touch-first web app, primarily mobile or tablet.
- Short sessions: checking what to do, planning one task, marking progress, reading comments.
- Online-only in v1.
- Same visual UI for child and parent, but actions differ by role.

Primary user goal:
- Child: understand what school tasks exist, choose the next small action, and feel progress.
- Parent: see what the child marked as done, comment supportively, confirm or gently reject.

Desired feeling:
- Calm, clear, motivating, and safe.
- Positive feedback should feel much stronger than setbacks.
- Negative/reject feedback must be mild, non-shaming, and easy to recover from.

## 3. V1 scope guard

In v1:
- One main task list with all active tasks.
- Deadline-first ordering.
- Expandable task cards.
- Hunger/progress top section with emoji avatar placeholder.
- Difficulty, planning window, status actions, comments.
- Positive completion rewards and mild reject feedback.
- One-shot reject animation using persisted animation state.

Out of scope for v1:
- Filters.
- History UI.
- Theme switch / multiple themes.
- Offline mode.
- Advanced dashboards.
- Complex avatar customization.
- Parent editing child difficulty or planning.
- Showing completed-task history in the list.

## 4. Main screen purpose

Screen: Active tasks
Purpose: Help the child quickly understand workload, pick the next safe action, and see progress without clutter.

Layout:
- Sticky/top section: hunger/progress bar, avatar, short status line.
- Main content: active task list sorted by due date.
- Task cards: collapsed by default, expandable for details and comments.
- Feedback area: short success/error messages, one-shot animation layer.

Text-based wireframe:

[Top section]
  [Hunger/progress bar: Lagom / Lite mycket / Fullt upp]
  [Avatar emoji] [Level/stars small text]
  Short status: "Du har 3 uppgifter att hålla koll på."

[Task list]
  [Task card collapsed]
    Title
    Subject · Due date
    Chips: Svårighet · Planering · Status
    Primary next action button
    Expand chevron

  [Task card expanded]
    Details
    Difficulty choices
    Planning choices
    Comments preview/thread
    Role-allowed action buttons

[Empty/loading/error state replaces task list when needed]

## 5. Screen and component behavior

### 5.1 Top section: hunger/progress + avatar

Purpose:
- Show current workload/pressure and emotional state without scaring or blaming the child.

Inputs:
- `hunger_score`
- `hunger_capacity`
- `nausea_score`
- `xp_total` / `stars_total`
- `level`
- pending feedback animations

UX rules:
- Hunger means workload/need for planning, not personal failure.
- Use neutral-to-positive language. Avoid "dåligt", "misslyckat", "straff", "fel av dig".
- Progress improvements should be visible and rewarding.
- Nausea is a mild temporary signal that something needs another look.

Suggested labels:
- Low/healthy hunger: "Bra läge"
- Medium hunger: "Lite att planera"
- High hunger: "Fullt upp"
- Nausea active: "Behöver kollas igen"

Suggested avatar states:
- Normal: 🙂
- Positive/completion: 😄 or 🌟
- Hungry/busy: 😮‍💨 (use sparingly)
- Mild nausea/reject: 🤢 but softened by text and short duration

Important framing:
- Hunger increase from new task = "Ny uppgift att ta hand om", not punishment.
- Hunger decrease from progression = "Bra, du gjorde nästa steg."
- Nausea increase from reject = "Den behöver kollas en gång till", not "du hade fel".

### 5.2 Task card collapsed

Show:
- Title, max 1–2 lines.
- Subject if present.
- Due date if present; otherwise "Inget datum".
- Difficulty chip.
- Planning chip.
- Status chip.
- One primary next action if clearly available.
- Expand affordance.

Do not show:
- Full comment history.
- Technical IDs.
- All possible actions at once.
- Filters or history controls.

### 5.3 Task card expanded

Show:
- Same summary as collapsed.
- Source: "Källa: Skolplattformen", "Källa: Manuell", or similar.
- Difficulty selector.
- Planning selector.
- Status/action section.
- Comments thread and one short comment input.
- Parent confirmation/reject actions only when role allows.

Keep expanded content chunked:
1. "Planera"
2. "Status"
3. "Kommentarer"

Only one task should need to be expanded at a time on small screens. If multiple expansion is implemented, visual clutter must remain low.

## 6. Swedish labels and microcopy

### 6.1 Field labels

Task title:
- "Uppgift"

Subject:
- "Ämne"

Source:
- "Källa"

Due date:
- "Ska vara klar"
- If unknown: "Inget datum"

Difficulty:
- Label: "Hur svår känns den?"
- easy: "Enkel"
- medium: "Medel"
- hard: "Svår"
- unknown: "Inte valt"

Planning window:
- Label: "När tänker du jobba med den?"
- today: "Idag"
- tomorrow: "Imorgon"
- this_week: "Denna vecka"
- next_week: "Nästa vecka"
- unknown: "Vet inte än"

Status:
- received: "Ny"
- started: "Påbörjad"
- thinks_done: "Tror klar"
- confirmed_done: "Klar"

Comments:
- Section title: "Kommentarer"
- Input placeholder: "Skriv en kort kommentar…"
- Send: "Skicka"

### 6.2 Action labels

Child actions:
- set_difficulty: "Välj svårighet"
- set_planning: "Planera tid"
- mark_started: "Jag har börjat"
- mark_thinks_done: "Jag tror jag är klar"
- comment: "Kommentera"

Parent/agent actions:
- comment: "Kommentera"
- confirm_done: "Bekräfta klar"
- reject_done: "Kolla igen"

Generic:
- Save: "Spara"
- Cancel: "Avbryt"
- Retry: "Försök igen"
- Expand: "Visa mer"
- Collapse: "Visa mindre"

### 6.3 Feedback copy

After setting difficulty:
- "Bra, nu vet vi hur den känns."

After setting planning:
- "Snyggt, nu finns en plan."

After marking started:
- "Bra start!"

After marking thinks_done:
- "Toppen. Nu kan en vuxen kolla."

After parent confirms done:
- "Klar! Du fick stjärnor. 🌟"
- Alternative shorter: "Klar! +{points} stjärnor 🌟"

After parent rejects:
- Child-facing: "Nästan! Den behöver kollas en gång till."
- Parent-facing after action: "Uppgiften skickades tillbaka på ett snällt sätt."

Empty comments:
- "Inga kommentarer än."

Validation/error:
- Missing comment: "Skriv något kort först."
- Save failed: "Det gick inte att spara just nu. Försök igen."
- Invalid action: "Den här knappen går inte att använda just nu."

Tone rules:
- Use "du" and simple Swedish.
- Prefer one short sentence.
- Avoid sarcasm, blame, or school-grade framing.
- Do not say "fel", "misslyckades", "dåligt", or "straff" in child-facing reject states.

## 7. State/action matrix

Important: This UX matrix reflects product intent. In the current MVP, frontend should use `can_actions` as a non-authoritative UI hint and use local role/view context to keep child and parent controls separated. Backend mutating endpoints remain authoritative.

### 7.1 Child role

| Status | Visible state | Primary action | Secondary actions | Unavailable actions |
|---|---|---|---|---|
| received | New task, may lack difficulty/planning | If both missing: "Välj svårighet". If difficulty chosen: "Planera tid". | "Jag har börjat", "Kommentera" | Confirm/reject hidden |
| started | Work has started | If planning missing: "Planera tid". Else "Jag tror jag är klar" | "Uppdatera svårighet", "Uppdatera planering", "Kommentera" | Confirm/reject hidden |
| thinks_done | Waiting for adult/agent | No status primary action | "Kommentera" | Planning edits should be hidden or disabled pending product/backend decision |
| confirmed_done | Completed | No primary action | None in active list; if detail reachable, read-only | All task-changing actions hidden |

V1 list should normally exclude confirmed_done tasks, because history UI is out of scope.

### 7.2 Parent role

| Status | Visible state | Primary action | Secondary actions | Unavailable actions |
|---|---|---|---|---|
| received | Child has not finished | "Kommentera" | None | Difficulty/planning/start/thinks done hidden |
| started | Child is working | "Kommentera" | None | Difficulty/planning/start/thinks done hidden |
| thinks_done | Needs review | "Bekräfta klar" | "Kolla igen", "Kommentera" | Child planning actions hidden |
| confirmed_done | Completed | "Kommentera" only if detail is reachable | None | Confirm/reject hidden |

### 7.3 Agent/system role

The frontend generally should not expose agent/system controls to children. If an admin/test harness exists outside v1, it must not appear in the child-facing v1 UI.

## 8. How unavailable actions should be shown

Default rule:
- Hide actions the current role is never allowed to use.
- Disable actions only when the user can understand and fix why it is unavailable.

Examples:
- Parent cannot set child difficulty: hide.
- Child cannot confirm done: hide.
- Child is on `thinks_done` and waiting: show a calm waiting state, not disabled confirm/reject buttons.
- Save button with empty required comment: disable with helper text "Skriv något kort först."
- Network request in progress: keep button visible but disabled with loading label.

Disabled visual treatment:
- Minimum contrast still readable.
- Use `aria-disabled="true"` or native `disabled` where appropriate.
- Do not rely on opacity alone; add short helper text when needed.

Unavailable copy:
- Waiting for adult: "Väntar på att en vuxen kollar."
- Already done: "Uppgiften är klar."
- Needs selection: "Välj ett alternativ först."
- Offline/server problem: "Det gick inte att hämta just nu."

## 9. Hunger, nausea, and reject framing

### Hunger

Meaning:
- Workload/planning need.

Do:
- Frame hunger as "tasks need attention".
- Reward meaningful progress by visibly lowering hunger.
- Show high hunger as busy/full, not failure.

Do not:
- Tell the child they caused a bad state.
- Use red alarm visuals as default.

Suggested levels:
- 0–33%: "Bra läge"
- 34–66%: "Lite att planera"
- 67–100%: "Fullt upp"

### Nausea

Meaning:
- A temporary mild signal after a rejected `thinks_done` attempt.

Do:
- Show a short, mild visual cue.
- Pair it with recovery copy.
- Let normal progress and time reduce emotional weight.

Do not:
- Make nausea the dominant visual state for long periods.
- Shame the child.
- Replay reject animation after reload once acknowledged.

### Reject

Child-facing frame:
- "Nästan — kolla en gång till."

Parent-facing frame:
- Reject means "send back for another look", not "mark wrong".
- Use action label "Kolla igen" instead of "Avvisa" in child-facing/parent UI.

## 10. One-shot animation behavior

Current data model:
- Each reject creates one animation event with stable identity.
- Event has a unique `animation_key`.
- SQLite MVP stores both `delivered_at` and `seen_at` so each reject animation can be delivered, displayed/acknowledged, and not replayed after ack.

Existing API:
- `GET /children/:childUserId/animations/pending` returns unseen events and sets `delivered_at` the first time an event is delivered.
- `POST /children/:childUserId/animations/:animationId/ack` sets `seen_at` after display or reduced-motion fallback.

UX requirement:
- Frontend must never infer one-shot animation only from status or nausea score.
- Frontend should fetch pending animations after loading progress/tasks.
- Frontend should play each pending animation at most once in the current UI session.
- Frontend should ack only after the animation has been displayed or intentionally skipped due to reduced-motion preference.
- If animation display fails, do not ack; allow retry on next load.

Backend semantics:
- `delivered_at`: set when event is returned to a client, useful for diagnostics and multi-client handling.
- `seen_at`: set when client confirms the child has either seen the animation or reduced-motion fallback message.

Recommended frontend flow:
1. Load active tasks and progress.
2. Load pending animations.
3. For each pending animation not already played in memory:
   - If `prefers-reduced-motion: reduce`, show static message and ack.
   - Else play short animation once, then ack.
4. Do not replay after ack even if nausea_score remains > 0.

Animation details:
- Reject animation duration: about 600–900 ms.
- Motion: small emoji/soft marker from task card toward hunger bar/avatar.
- Bar: brief muted color shift, then return to normal.
- Copy: "Nästan — kolla en gång till."
- Positive animations may be stronger/brighter than reject animations.

Reduced motion fallback:
- No flying emoji.
- Show static toast/status: "Nästan — kolla en gång till."
- Ack the animation after the fallback is shown.

## 11. Loading, empty, success, error, and offline states

### Loading: first page load

Show:
- Top skeleton or short text: "Hämtar uppgifter…"
- 2–3 simple card skeletons.

Avoid:
- Spinners only.
- Large animated loaders.

### Loading: action in progress

Show:
- Button disabled with label:
  - "Sparar…"
  - "Markerar…"
  - "Skickar…"
- Keep current card content visible.

### Empty active list

Show:
- Positive empty state.
- Copy: "Inga aktiva uppgifter just nu. Skönt!"
- Secondary copy: "När en ny uppgift kommer in syns den här."
- Avatar can be happy/calm.

Do not show:
- History link.
- Filter controls.

### Error: task list load failed

Show:
- Copy: "Det gick inte att hämta uppgifterna just nu."
- Button: "Försök igen"
- Keep layout calm.

### Error: action failed

Show inline in card:
- "Det gick inte att spara just nu. Försök igen."
- Keep user input where possible.

### Error: comments failed

Show:
- "Kommentarerna kunde inte hämtas just nu."
- Retry button if space allows.

### Offline/network loss in v1

Since offline mode is out of scope:
- Show online-only error when request fails due to network.
- Copy: "Du behöver internet för att använda appen."
- Do not queue offline actions in v1.

## 12. Accessibility and touch gates

Touch gates:
- Minimum touch target: 44 x 44 px, recommended 48 x 48 px.
- Primary action reachable without precision tapping.
- Spacing between adjacent destructive/negative and positive actions.
- Parent `Bekräfta klar` and `Kolla igen` must not be too close; avoid accidental reject.

Keyboard/accessibility gates:
- All interactive controls reachable by keyboard.
- Visible focus state.
- Buttons use semantic `<button>` behavior.
- Expanded panels announce state via `aria-expanded`.
- Status changes should use a polite live region.
- Error messages linked to related input with `aria-describedby` where relevant.

Text and visual gates:
- Swedish labels readable at small mobile width.
- Avoid icon-only actions; icons need text labels or accessible labels.
- Color cannot be the only status indicator; use text chips.
- Contrast should meet WCAG AA for text and controls.
- Motion respects `prefers-reduced-motion`.

Cognitive accessibility gates:
- One primary next action per card when possible.
- Short sentences.
- No dense tables in the child UI.
- Keep parent-only review controls visually separate from child planning controls.

## 13. How UX should consume `can_actions`

Current MVP meaning:
- `can_actions` is a plain-language UI hint: it tells the UI which action buttons may be relevant for the task's current status.
- It is not authorization and not a security boundary.
- Current API output is status-based; it can include actions for more than one role in the same status.
- Backend mutating endpoints enforce simple local role/status checks with `x-role`; those checks are authoritative.

Frontend rule for this MVP:
- Use `can_actions` as a hint, then filter/render controls through the current local role/view context.
- Child views must never show `confirm_done` or `reject_done` only because a status-level hint includes them.
- Parent views must not expose child planning/progress controls.
- If `can_actions` is empty after role/view filtering, show status/help text rather than disabled button clutter.
- If an unknown action appears, ignore it and log/report during development.

Future direction:
- Production auth and/or viewer-aware role-specific `can_actions` can replace this local hint model later, but that is not required for the current MVP frontend planning handoff.

Suggested action display priority:
1. Safety/status actions: confirm_done / reject_done for parent on thinks_done.
2. Child next-step action: set_difficulty, set_planning, mark_started, mark_thinks_done.
3. Comment.
4. Secondary edits.

## 14. Acceptance criteria for frontend implementation

A frontend task based on this spec is UX-ready only if all criteria below are met:

1. Main view shows active tasks only, sorted by deadline as provided by API.
2. No filter UI, no history UI, no theme switch, no offline queue.
3. Top section shows hunger/progress, avatar, and short Swedish status copy.
4. Task cards are touch-first, low clutter, collapsed by default, expandable for details.
5. Each card shows title, subject/date where present, difficulty, planning window, and status.
6. Swedish labels match this spec or are equally short, clear, and non-shaming.
7. Child and parent actions are not mixed. Child must not see parent confirm/reject controls.
8. Unavailable actions are hidden by default; disabled only when user can fix the condition.
9. Reject uses "Kolla igen" / "Nästan — kolla en gång till" framing, not shame/blame language.
10. Positive completion feedback is stronger than reject feedback.
11. Pending reject animations play once per persisted event and are acknowledged only after display or reduced-motion fallback.
12. Reload after ack does not replay reject animation.
13. `prefers-reduced-motion` receives static feedback instead of flying animation.
14. Loading, empty, action-saving, list-error, action-error, and comments-error states are implemented.
15. Touch targets are at least 44 x 44 px with visible focus states.
16. Status is conveyed by text plus color/icon, never color alone.
17. Error messages preserve user input where possible.
18. Microcopy remains short enough for mobile cards.

## 15. Recommended next work sequence

1. Frontend UX implementation task:
   - Build main active-task view, top section, task cards, expanded details, and state rendering from this spec.
   - Treat `can_actions` as a UI hint and filter controls by local role/view context.
   - Use `delivered_at` + `seen_at` for one-shot reject animation delivery and ack.

2. UX review task:
   - Review implemented screens on mobile-width viewport and keyboard path.
   - Verify child/parent action separation, no v1 scope creep, and one-shot animation behavior.

## 16. Open questions

These are not blockers for this working spec, but should be answered before final frontend merge:

1. Should child be able to edit planning while status is `thinks_done`, or should it remain locked while waiting for review?
2. Should parent comments be visible immediately in the expanded child card, or loaded only after expansion? UX preference: load on expansion to reduce first-load clutter.
3. When production auth is introduced later, should `can_actions` become viewer-specific instead of status-hint based?

## 17. Message to orchestrator

This spec is ready to hand to frontend planning under the agreed local MVP semantics: `can_actions` is a UI hint, local role/view context keeps child and parent actions separated, and backend `x-role` validation remains authoritative. Keep v1 minimal: active list only, no filters/history/theme/offline, and prioritize touch-first low-clutter Swedish UI for ages 10–16.

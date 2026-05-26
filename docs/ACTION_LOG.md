# ACTION_LOG

## 2026-05-01
- Initialized project skeleton at `/Users/Shared/dev/projects/schooltaskhelper`.
- Added base docs: README, AGENTS, ENVIRONMENTS, DECISIONS, ACTION_LOG.
- Captured initial product constraints and UX direction from JW.
- Added `docs/UIUX_BRIEF_V1.md` as send-ready design brief for UI/UX designer.

## 2026-05-21
- Låste API-relevanta produktbeslut med JW utifrån skisser (sortering, fasta actions, trådade kommentarer, föräldraroll, gamificationregler).
- Skrev `docs/API_V1_CONTRACT.md` med konkret endpointlista, action-matris, side effects och DB-justeringar (`task_comments`, `nausea_score`).
- Definierade anti-toggle-princip för hungerpåverkan (ingen exploaterbar fram-och-tillbaka-ändring).


## 2026-05-22

- Satte upp autonomt bakgrundsflöde i `autonomy/` med rollrotation planner->executor->auditor och state/loggar.
- Implementerade obiaserad auditor: verify-kommandon avgör pass/fail via exit-koder (inte textbedömning).
- Lade max audit-försök per steg = 3 och auto-markering `blocked` vid utebliven förbättring.
- Implementerade tidsguard 16:00-19:00 och 5-minuters iterationer i runnern.
- Försökte installera launchd/cron men miljön nekade; satte därför upp alternativ lokal loopdaemon `scripts/autonomy_loop.sh` (startad).
- Dokumenterade uppdaterade gamificationregler från JW (hunger +3 vid ny uppgift, -1 per meningsfull progression, max 3 per uppgift/cykel).
- Låste XP/stjärnor per svårighetsgrad (easy=3, medium=6, hard=10).
- Låste nausea-regel: +1 vid reject samt decay efter 24h eller level-up.
- Dokumenterade one-shot UX-animation vid reject och att detta kräver persistent state som påverkar DB, API och UX.
- Uppdaterade `docs/API_V1_CONTRACT.md`, `docs/skoluppgift-arkitektur-underlag.md`, `docs/UIUX_BRIEF_V1.md`, `docs/DECISIONS.md`.
- Förberedde ett tidigt DB-schemautkast (inkl. one-shot animationsstate, hunger/nausea/progress-fält, anti-toggle-idempotensnyckel).

- Implementerade körbar SQL/API-slice: `db/migrations/001_init_up.sql`, `db/migrations/001_init_down.sql`, `src/app.js`, `src/db.js`, `src/server.js`.
- Lade in endpoints för task flow, progress, reject+nausea och one-shot animation ack.
- Lade in integrationstester i `tests/integration.test.js` för hunger, XP/stjärnor, nausea-decay och one-shot ack.
- Körde tester: `npm test` (pass: 2, fail: 0).
- Hårdade autonomiflödet: verkliga rollscript (`scripts/autonomy_role_step.sh`) och skarpa verify commands i `autonomy/steps.json`.

## 2026-05-23
- Lade till `.gitignore` så `node_modules/`, lokal SQLite-data och autonomi-runtime (`logs/`, `state/`, `outbox/`) inte råkar commit:as.
- Kompletterade API-slicen med `GET /tasks`, `GET /tasks/:id`, `GET/POST /tasks/:id/comments`, `subject` och `due_date` i task-migrationen.
- Utökade integrationstesterna till 4 tester för task-listning/detalj, kommentartråd och befintlig gamification; `npm test` passerar.

## 2026-05-25
- Verifierade Express/SQLite-baseline mot API-/DB-dokumenten och skrev reconciliation i `docs/API_DB_BASELINE_RECONCILIATION_2026-05-25.md`.
- Bekräftade SQLite som MVP-databas och `db/migrations/001_init_up.sql` som körbar schema-baseline.
- Dokumenterade lokala MVP-semantiken för `can_actions`: statusbaserad UI-hint, inte auktorisation; `x-role`-kontroller är fortsatt auktoritativa i muterande endpoints.
- Lade till `delivered_at` i SQLite-tabellen `task_feedback_animations` så reject-/feedback-animationer har både `delivered_at` och `seen_at`.
- Lade till `GET /tasks/:taskId/events`, reject payload med `reason`, samt integrationstest för event-/animation-delivery/ack-baseline.
- Körde `npm rebuild better-sqlite3` efter Node ABI-mismatch och verifierade med `npm test` (4/4 passerar).
- Hårdade frontend-redo API-baseline: `runMigrations(db)` lägger nu till saknade `delivered_at`/`seen_at` på befintliga lokala `task_feedback_animations`-tabeller utan destruktiv reset.
- Utökade integrationstesterna till 8 tester för statusbaserad `can_actions` som UI-hint, `x-role`-enforcement på muterande endpoints, pending-animation `delivered_at`/`seen_at`, sparse events-baseline och aktiv lista utan `confirmed_done`; `npm test` passerar efter `npm rebuild better-sqlite3`.
- Dokumenterade mutation response shapes och frontend refresh-förväntan i `docs/API_V1_CONTRACT.md`.
- Lade till `docs/UX_WORKING_SPEC_NEXT_PHASE.md` som nästa fasens UX-arbetsspec: state/action-matris, svensk mikrocopy, unavailable actions, hunger/nausea/reject-framing, one-shot animation, accessibility/touch gates och `can_actions`-konsumtion.
- Efter JW-beslut: frontendimplementation kan gå vidare med `can_actions` som icke-auktoritativ UI-hint och lokal roll-/vyfiltrering; backendens `x-role`-validering är fortsatt auktoritativ.

- Uppdaterade verifierings-/handoffdokumentation efter JW-beslut: SQLite är enda aktiva MVP-databas.
- Förtydligade lokal auth/action-semantik: `x-role`/`x-user-id` är enkla dev-headers, `can_actions` är en UI-hint i plain language och inte auktorisation; backendvalidering är fortsatt auktoritativ.
- Förtydligade scope: backend event/audit-baseline är i scope medan synlig historik-UI är out of scope för v1.
- Rättade UX-arbetsspecen så reject-animationer kräver både `delivered_at` och `seen_at`, och tog bort stale blockers kring `delivered_at`/role-aware `can_actions` för nuvarande MVP.
- Uppdaterade `README.md`, `docs/ENVIRONMENTS.md`, `docs/DECISIONS.md`, `docs/API_V1_CONTRACT.md`, `docs/API_DB_BASELINE_RECONCILIATION_2026-05-25.md` och `docs/UX_WORKING_SPEC_NEXT_PHASE.md` med runtime/test-baseline och deploy-säkerhet.
- Noterade deploystatus: Production deploy requires explicit JW approval. Status: Not approved for production deploy.
- Rensade aktiv dokumentation efter JW-beslut: SQLite är enda MVP-databas, `db/migrations/001_init_up.sql` är källa till sanning, och det stale DB-prep-SQL-utkastet togs bort.
- Lade till minimalt Vite/React/TypeScript-frontendskal i `apps/web/` för aktiv uppgiftsvy utan mockad task/progress/comment/animation-data.
- Lade till real API-client/data foundation för tasks, comments, planning/status/reject, progress och pending animation ack; muterande requests skickar lokal dev-roll via `x-role` och kommentarer skickar `x-user-id` när lokal user-id finns.
- Lade till lokal dev-only frontendkonfiguration via `VITE_CHILD_USER_ID`, `VITE_ROLE`, `VITE_USER_ID` och `VITE_API_BASE_URL`.
- Dokumenterade frontend-scripts i `README.md`; Vite/React/TypeScript lades till som valda frontend-stackberoenden för v1-skalet.
- Implementerade v1 aktiv uppgiftsvy mot real API-client: topbar/progress, expanderbara kort, rollseparerade actions, planering/status, kommentartråd, child-only one-shot reject-feedback med ack, samt loading/tom/error/saving-states.
- Tog UX-reviewns små polishnoteringar direkt: svenskade `Level` till `Nivå`, gjorde positiv save/status-feedback synlig och lade in hjälpkopy för kommentarens tomma Skicka-state.
- QA godkände v1 backend/frontend active-task-slice med minor notes only: backend/frontend-tester, typecheck, build, `git diff --check`, npm audit, source review, lokal API-smoke, role separation, `can_actions`-semantik och one-shot animation delivery/ack passerade. Production deploy är fortfarande inte godkänd.
- Uppdaterade release-prep/docs efter QA: README anger aktuell backend+frontend QA-baseline och `npm rebuild better-sqlite3` som lokal Node ABI-mitigering.
- Utökade backend audit/event-trailen för SQLite-MVP: `task_created`, `planning_updated`, `status_changed`, `reward_granted`, `confirmation_rejected`, `animation_delivered`, `animation_acknowledged` och `comment_created` skrivs nu till `task_events` utan att införa synlig historik-UI.
- Uppdaterade integrationstest och API-/reconciliation-dokumentation för den bredare eventtäckningen.

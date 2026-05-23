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
- Förberedde DB-schema i `docs/DB_SCHEMA_V1_PREP.sql` (inkl. one-shot animationsstate, hunger/nausea/progress-fält, anti-toggle-idempotensnyckel).

- Implementerade körbar SQL/API-slice: `db/migrations/001_init_up.sql`, `db/migrations/001_init_down.sql`, `src/app.js`, `src/db.js`, `src/server.js`.
- Lade in endpoints för task flow, progress, reject+nausea och one-shot animation ack.
- Lade in integrationstester i `tests/integration.test.js` för hunger, XP/stjärnor, nausea-decay och one-shot ack.
- Körde tester: `npm test` (pass: 2, fail: 0).
- Hårdade autonomiflödet: verkliga rollscript (`scripts/autonomy_role_step.sh`) och skarpa verify commands i `autonomy/steps.json`.

## 2026-05-23
- Lade till `.gitignore` så `node_modules/`, lokal SQLite-data och autonomi-runtime (`logs/`, `state/`, `outbox/`) inte råkar commit:as.
- Kompletterade API-slicen med `GET /tasks`, `GET /tasks/:id`, `GET/POST /tasks/:id/comments`, `subject` och `due_date` i task-migrationen.
- Utökade integrationstesterna till 4 tester för task-listning/detalj, kommentartråd och befintlig gamification; `npm test` passerar.

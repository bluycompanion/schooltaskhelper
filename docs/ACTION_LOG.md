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

## 2026-05-26
- Lade till rudimentärt lokalt GUI-verifieringsflöde före deploy: `npm run seed:dev` resetar demo-data för `child1`/`parent1`, frontend kan växla Barnvy/Vuxenvy via querystring och visar en liten lokal testpanel med reload.
- Utökade demo-seeden med fler uppgifter för att testa sortering, planering, svårighetsgrad, start, klarmarkering och vuxenbekräftelse.
- Lade till `docs/GUI_MANUAL_VERIFICATION.md` och `docs/plans/2026-05-26-rudimentary-gui-verification.md` med manuell verifieringschecklista och fortsatt deploy-gate.
- Utökade backend/frontend-tester för dev seed-reset och querystring-baserad rollvy.
- Lade till deploy-stöd för webhosting subpath: root `server.js`, `/health`, statisk build från `dist/web`, och Vite `base` via `VITE_BASE_PATH` så appen kan köras bakom `/dev/schooltaskhelper/`.
- Körde dev-deploy lokalt på `PORT=4321` med seedad demo-data, rebuilt `better-sqlite3` för aktuell Node, och la in live Caddy-route för `/dev/schooltaskhelper` via admin-API.
- 2026-05-26: Genomförde en ultraminimalistisk uppdatering av gränssnittet. Ersatte stora etiketter med liten text, kombinerade kommentarer och historik till en kompakt, omvänd tidslinje, lade till små knappar för att ändra status/plan/svårighet manuellt från expanderad vy, samt flyttade källinformation in i loggen.
- 2026-05-26: Hårdade frontendens tidslinje-rendering mot trasiga event-payloads (safe JSON-parse med fallback) och rattade saving-state key för popup-val av svårighet/planering så rätt action läses under sparning.
- Skapade `docs/FUTURE_ACTION_TRACKER.md` med noteringar från senaste reviewen och ett API-fokuserat planutkast för agentstödet.
- Deployade senaste `origin/main` i dev, seedade demo-data och bekräftade att backend svarar på `/health`.
- Lade till agent-API för testning från andra platser/andra agenter: `/agent/tasks`, `/agent/questions` och `/agent/questions/:commentId/reply`; agent-anrop använder `x-role: agent` och kan bära `x-agent-provider` för Hermes/OpenClaw-spårning.
- Verifierade lokalt att nya agent-endpoints fungerar mot dev-servern och seedade om demo-data efter smoke-test.
- Rättade agent-API-kontraktet så status-only agentövergångar är dokumenterade, `reward_available`/`collect_reward`-semantiken syns i API-kontraktet och `x-agent-provider` sparas i eventpayloads för muterande agentanrop.

## 2026-05-30
- Förberedde `gui/501`-flöde för schooltaskhelper med lokala driftsskript:
  - `scripts/dev-start.sh`
  - `scripts/install_dev_launchd.sh`
  - `scripts/service.sh`
- Skripten installerar LaunchAgent i `~/Library/LaunchAgents/com.webhosting.schooltaskhelper.dev.plist` och använder `launchctl` i `gui/501`-domänen.

## 2026-06-13
- Verifierade aktuell dev-baseline efter Node ABI-omkompilering av `better-sqlite3` (`npm rebuild better-sqlite3`).
- Körde `npm test`, `npm run test:web`, `npm run typecheck:web` och `npm run build:web`; alla passerade.
- Bekräftade att lokala dev-hälsan svarar på `http://127.0.0.1:4321/health` och att public dev-route finns bakom Caddy-auth på `https://bluycompanion.duckdns.org/dev/schooltaskhelper/`.
- Synkade API-kontrakt och arkitekturunderlag med faktisk implementation: `POST /tasks` finns för parent-manual tasks, `GET /agent/tasks` finns för agent-listning, frontend använder fortfarande `/tasks` som huvudflöde, och `POST /tasks/:taskId/reject` återöppnar i nuvarande backend alltid till `started`.

## 2026-06-12
- Synkade lokal `main` med GitHub `origin/main`; lokal checkout var 2 commits bakom och fast-forwardades till `50fc5cf`.
- Pulled commits: `bed74fb feat: finalize agent API and reward flow updates` och `50fc5cf Fix subpath API base detection and improve 404 API error copy`.
- Verifierade efter sync med `npm.cmd test` (13/13), `npm.cmd run test:web` (6/6), `npm.cmd run typecheck:web` och `npm.cmd run build:web`; alla passerade.
- Lade till `docs/NEXT_AGENT_HANDOFF_2026-06-12.md` med sammanfattning av GitHub-synken, verifierad baseline och varning om lokala ocommittade ändringar som inte ska skrivas över utan JW-beslut.
- Uppdaterade `docs/FUTURE_ACTION_TRACKER.md` så agent-API-planen inte längre beskrivs som helt oimplementerad efter `bed74fb`.
- Verifierade även aktuell ocommittad arbetsyta efter handoff-noteringarna: `npm.cmd test` (14/14), `npm.cmd run test:web` (6/6), `npm.cmd run typecheck:web` och `npm.cmd run build:web` passerade.

## 2026-06-13
- Slutförde gamification-overhaul (Clash Royale × Tamagotchi): mörkt vibrant CSS-variabeltema, shimmer/pulse på actionable kort+knappar, 7-stegs avatarhumör med animationer, partikelsystem (5–8 emojis i båge → avatar), två separata bars (hunger + XP), reward-flöde med guld-CTA/partikelburst/slide-out.
- Sims-stil hungerbar: grönt fylls från vänster per delsteg, illamående-brunt äter in från höger (en task-slice/poäng), röd alert vid oplanerat, segment-ticks per task.
- Backend: nausea härleds nu per task (attempt > 1 & ej bekräftad) och försvinner när vuxen bekräftar (ersatte 24h-decay); +2 XP planeringsbonus; `POST /tasks` för förälder-skapade uppgifter; `completed_today` i `/progress` så att slutförda tasks inte krymper baren.
- Skrev `docs/GAMIFICATION_HANDOFF_2026-06-13.md` med fullständig överlämning: levererat arbete, aktiv bugg (primärknapp hoppar över planering, `App.tsx:761`), pedagogiska förbättringsförslag, roadmap, körinstruktioner och scope-guards.
- Dokumenterad känd bugg att åtgärda härnäst: hopfällt kort visar "Jag har börjat" på nya tasks istället för planeringssteget först.
- Åtgärdade nästa-steg-buggen: ny `nextStepAction`-helper väljer ett enda nästa logiskt steg (Välj svårighet → Planera tid → Jag har börjat → Jag tror jag är klar; confirm/collect/reject för respektive roll). Hopfällt kort visar bara nästa steg; expanderat visar resten (mjuk styrning, ingen hård gate).
- Ersatte passiv subMetaLine med klickbara checklist-chips (`ChecklistChip`): ○ guld/pulserande för todo, ✓ grön med värde för klart; barn-only klickbara (öppnar popup), display-only för förälder. Trimmade tinyActions till barn-only "Ändra status".
- La till planeringsbonus-hint ("✨ Planera klart = +2 ⭐ bonus") som visas på barnkort tills uppgiften är fullt planerad.
- Verifierade i barn- och vuxenvy samt med typecheck:web/test:web/build:web (allt grönt).
- Kompakthet/mobil + effekt-i-knapp + glänsande ram (iteration efter feedback):
  - Effekt ("mat som matar baren") visas nu på nästa-steg-knappen och på ○-todo-chips: 🍊 svårighet, 🍓 planera, 🍕 börja, 🍒 tror klar (+1 vardera). 🌟+2-bonus visas på det planeringssteg som fullbordar full planering.
  - Tog bort den separata bonus-hint-raden och gjorde chipsen mindre (font 0.72rem, tightare padding) → kompaktare och mer mobilvänligt.
  - Partiklarna matchar nu stegens frukter för visuell konsekvens.
  - Bytte helyte-shimmer på actionable/reward-kort mot en tunn glänsande gradient-ram (mask-composite), behöll knapp-glans och mild puls.
  - Iteration efter feedback: dämpade shimmern ytterligare (mjuk ljusgrön glint mot dämpad grön ram istället för neon). La chips + nästa-steg-knapp på samma rad (`cardControlRow`, flex-wrap → knappen bryts ner på smal mobil) för att spara höjd. Chips nu nowrap på en rad, mindre (0.7rem). Flyttade 🌟+2-bonusen till enbart knappen (chips smalare). Minskade kort-padding (0.7/0.8rem). Responsivt/modulärt utan hårda brytpunkter.
  - Iteration 3: tonade shimmern ytterligare (glint-opacitet 0.22, smalare band, 4s). Avataren är nu glad som DEFAULT och reagerar bara transient (handling→studs, reject→🤢, level/reward→🤩) och återgår till glad; 😴 endast när inga uppgifter finns. Tog bort ihållande hungrig/upptagen-lägen. La till dev-knapp i testpanelen "Stäng av puls & gläns" (localStorage-persisterad) som via `.animationsOff`-klass stänger av kort-puls + all shimmer (avatar-reaktioner och partiklar behålls). Verifierade allt via Claude_Preview MCP.
  - Iteration 4 (inför delning med barn): tog bort vilseledande 🌟+2 från planeringssteget — stjärnor delas bara ut vid firande (collect_reward); endast mat-effekten (+1🍊/🍓/🍕/🍒) visas nu. Default-avatar är normalt glad 😊 och blir väldigt glad 😄 vid matning, sedan tillbaka. Testläget styrs nu av `import.meta.env.DEV` eller `?dev=1` (ej längre hostname) så en produktionsbuild aldrig visar testpanelen — säker att dela. Verifierat via Claude_Preview MCP (avatar 😊, "Välj svårighet +1🍊" utan stjärna).
- 2026-06-13: Smoke-testade public dev-route för `https://bluycompanion.duckdns.org/dev/schooltaskhelper/`; utan Basic Auth returnerar den korrekt 401. Hittade att live `dist/web/index.html` var byggd utan `VITE_BASE_PATH`, vilket gav root-assets (`/assets/...`) och skulle bryta GUI under subpath. Byggde om med `VITE_BASE_PATH=/dev/schooltaskhelper npm run build:web`; HTML pekar nu på `/dev/schooltaskhelper/assets/...`. `npm run test:web` passerade efteråt.
- 2026-06-13: JW godkände prod-deploy av SchoolTaskHelper. Lade till standardiserade prod-skript (`preflight.sh`, `release.sh`, `deploy-prod.sh`) och utökade `service.sh` för prod. Synkade `package-lock.json` efter att `npm ci --omit=dev` blockerade release. Körde deploy-gates (`npm test`, `npm run test:web`, `npm run typecheck:web`, prod-build med `VITE_BASE_PATH=/schooltaskhelper`) och skapade release `/Users/Shared/dev/runtime/schooltaskhelper/releases/20260613-132512`.
- 2026-06-13: Installerade Caddy-route för prod `/schooltaskhelper* -> 127.0.0.1:4320` och laddade om Caddy via admin-API. Startade prod-processen direkt med `nohup` på port 4320 (pidfil: `/Users/Shared/dev/logs/schooltaskhelper/prod.pid`) eftersom sessionen saknade sudo/elevated och `launchctl bootstrap user/504` nekade nya jobs. Verifierade lokal health (`frontend:true`), korrekt prod asset-prefix (`/schooltaskhelper/assets/...`), Caddy admin-config för `/schooltaskhelper`, och extern Basic Auth 401 utan credentials på `https://bluycompanion.duckdns.org/schooltaskhelper/`.

# schooltaskhelper

Touch-first webbapp/API för att hjälpa barn (10–16 år) att planera och följa upp skoluppgifter.

## Fokus i första iterationen
- Visa alla aktuella uppgifter (ingen historikvy).
- Svårighetsgrad före planering.
- Statusflöde med barn + förälder/agent-bekräftelse.
- Gamification med hungerbar, stjärnor/XP, mild nausea-feedback och emoji-placeholder.
- One-shot reject-animationer som lagras med `delivered_at` och `seen_at`.

## Lokal MVP-baseline
- Backend/API: Express.
- Databas: SQLite via `better-sqlite3`.
- Körbart schema: `db/migrations/001_init_up.sql`.
- Lokal dev-datafil: `data/dev.sqlite` skapas automatiskt vid start och ska inte commit:as.

## Struktur
- `src/` – Express API och SQLite-koppling.
- `apps/web/` – Vite/React/TypeScript frontend-skal för aktiv uppgiftsvy.
- `db/migrations/` – körbar SQLite-baseline för MVP.
- `tests/` – Node integrationstester.
- `docs/` – beslut, miljöer, API-kontrakt, UX-underlag och action log.
- `scripts/` – lokala/autonoma stödscripts.

## Lokal körning
Förutsätter Node/npm.

```sh
npm install
npm start
```

API startar på `PORT` om satt, annars `3001`.

Frontend-skalet körs separat med Vite och proxar lokala API-anrop till `http://localhost:3001`:

```sh
npm run dev:web
```

Lokal frontend-identitet är dev-only och styrs med Vite-env vid behov:
- `VITE_CHILD_USER_ID` (default `child1`)
- `VITE_ROLE` (`child`, `parent` eller `agent`; default `child`)
- `VITE_USER_ID` (default barn-id för child, annars rollen)
- `VITE_API_BASE_URL` (default tom sträng/Vite-proxy)

## Tester

```sh
npm test
npm run test:web
npm run typecheck:web
npm run build:web
```

Senast dokumenterad QA-baseline 2026-05-25: `npm test` passerar 8/8 backend-integrationstester, `npm run test:web` passerar 5/5 frontend/client-tester, `npm run typecheck:web` passerar och `npm run build:web` passerar. Om Node-versionen ändras och `better-sqlite3` klagar på ABI mismatch, kör:

```sh
npm rebuild better-sqlite3
npm test
```

## Lokal auth/action-semantik
Den lokala MVP:n använder enkla dev-headers för muterande requests:
- `x-role`: `child`, `parent` eller `agent`.
- `x-user-id`: valfri lokal användaridentifierare för kommentarer; faller tillbaka till rollen i nuvarande API.

`can_actions` i task-responser är en plain-language UI-hint: den beskriver vilka knappar som kan vara relevanta för taskens status. Den är inte säkerhet eller auktorisation. Backendens roll-/statusvalidering i muterande endpoints är fortsatt auktoritativ.

## V1 scope guard
- Ingen filter-UI.
- Ingen synlig historik-UI; aktiva listan exkluderar `confirmed_done`.
- Backend event/audit-baseline är i scope, men synlig historikvy är out of scope.
- Single theme mode.
- Online-only.

## Deploy
Ingen production deploy är godkänd här.

Production deploy requires explicit JW approval.

Status: Not approved for production deploy.

# Skoluppgift-hjälpen – Arkitekturunderlag (DB + API)

_Datum: 2026-05-09_

## Bekräftade beslut

- V1 med fristående users (ingen household/family-modell krävs nu).
- En uppgift tillhör exakt ett barn (`child_user_id`) men kan vara synlig för flera föräldrar.
- Agent ska kunna skapa uppgift och bekräfta uppgift som klar (spårbart).
- Flera verifieringscykler tillåts (thinks done -> rejected -> thinks done -> confirmed).
- Varje cykel och varje ändring ska loggas i löpande historik med aktör.
- Barnets progress/avatarpåverkan ska vara förberedd i DB från start.

---

## Databasutkast (MVP+förberett)

## 1) users
Syfte: användare i systemet.

Fält:
- `id` (uuid, pk)
- `role` (enum: `child|parent|agent|system`)
- `display_name` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `nausea_score` (int, default 0)
- `hunger_capacity` (int, dynamisk utifrån aktiva uppgifter)

Notering:
- Agent kan även representeras externt, men `actor_type` + `actor_ref` loggas alltid i events.

## 2) tasks
Syfte: nuvarande state för uppgift (snabb läsning i UI).

Fält:
- `id` (uuid, pk)
- `child_user_id` (uuid, fk -> users.id)
- `title` (text, not null)
- `subject` (text, null)
- `source` (text, not null)  
- `source_external_id` (text, not null)
- `due_date` (date, null)
- `difficulty` (enum: `easy|medium|hard|unknown`, default `unknown`)
- `planned_window` (enum: `today|tomorrow|this_week|next_week|unknown`, default `unknown`)
- `status` (enum: `received|started|thinks_done|confirmed_done`, default `received`)
- `current_attempt_no` (int, default 0)
- `child_comment` (text, null)
- `parent_comment` (text, null)
- `confirmed_by_type` (enum: `parent|agent|null`)
- `confirmed_by_ref` (text, null)  
- `confirmed_at` (timestamptz, null)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `nausea_score` (int, default 0)
- `hunger_capacity` (int, dynamisk utifrån aktiva uppgifter)

Constraints:
- unique (`source`, `source_external_id`)

## 3) task_parent_access
Syfte: vilka föräldrar som får se/hantera barnets uppgifter.

Fält:
- `task_id` (uuid, fk -> tasks.id)
- `parent_user_id` (uuid, fk -> users.id)
- `created_at` (timestamptz)

PK:
- (`task_id`, `parent_user_id`)

## 4) task_attempts
Syfte: en rad per verifieringscykel.

Fält:
- `id` (uuid, pk)
- `task_id` (uuid, fk -> tasks.id)
- `attempt_no` (int, not null)
- `started_at` (timestamptz, not null)
- `ended_at` (timestamptz, null)
- `outcome` (enum: `pending|confirmed|rejected`, default `pending`)
- `confirmed_by_type` (enum: `parent|agent|null`)
- `confirmed_by_ref` (text, null)
- `rejected_by_type` (enum: `parent|agent|null`)
- `rejected_by_ref` (text, null)
- `notes` (text, null)

Constraints:
- unique (`task_id`, `attempt_no`)

## 5) task_events
Syfte: löpande auditlogg (historik/sanning).

Fält:
- `id` (uuid, pk)
- `task_id` (uuid, fk -> tasks.id)
- `attempt_no` (int, null)
- `event_type` (text, not null)
- `from_status` (text, null)
- `to_status` (text, null)
- `actor_type` (enum: `child|parent|agent|system`, not null)
- `actor_ref` (text, not null)
- `payload_json` (jsonb, default `{}`)
- `created_at` (timestamptz)

Exempel `event_type`:
- `task_created_by_agent`
- `status_changed`
- `child_marked_thinks_done`
- `confirmation_rejected`
- `parent_confirmed_done`
- `agent_confirmed_done`
- `status_reopened`
- `difficulty_updated`
- `planned_window_updated`
- `reward_applied`
- `penalty_applied`

## 6) child_progress_state
Syfte: snabb snapshot för UI (kan alltid räknas om från events).

Fält:
- `child_user_id` (uuid, pk, fk -> users.id)
- `xp_total` (int, default 0)
- `level` (int, default 1)
- `hunger_score` (int, default 0)
- `streak_days` (int, default 0)
- `updated_at` (timestamptz)
- `nausea_score` (int, default 0)
- `hunger_capacity` (int, dynamisk utifrån aktiva uppgifter)

## 7) reward_events
Syfte: separata poäng-/avatarhändelser (för transparens och finjustering).

Fält:
- `id` (uuid, pk)
- `child_user_id` (uuid, fk -> users.id)
- `task_id` (uuid, fk -> tasks.id)
- `attempt_no` (int, null)
- `effect_type` (enum: `bonus|neutral_bonus|penalty`)
- `points` (int, not null)
- `reason` (text, not null)
- `actor_type` (enum: `child|parent|agent|system`)
- `actor_ref` (text)
- `created_at` (timestamptz)

---

## API-utkast (v1)

## A) Agent API (system/agent)

### `POST /agent/tasks`
Skapa uppgift.

Body (min):
- `child_user_id`
- `title`
- `source`
- `source_external_id`

Valfritt:
- `subject`, `due_date`, `difficulty`, `planned_window`

Svar:
- `201 created` eller `200 existing` vid idempotent träff.

### `POST /agent/tasks/:taskId/status`
Agent ändrar status (inkl. `confirmed_done`).

Body:
- `to_status`
- `actor_ref` (agent-id/namn)
- `reason` (valfri men rekommenderad)

Regel:
- Alla ändringar loggas i `task_events`.
- Vid `confirmed_done` av agent: event `agent_confirmed_done` + rewardlogik.

### `POST /agent/tasks/:taskId/reject`
Markerar att “thinks_done” ej stämde.

Body:
- `actor_ref`
- `reason`
- `reopen_to_status` (`started` default)

Regel:
- Skapar `confirmation_rejected` + negativ liten påverkan + stänger attempt.

## B) App API (UI)

### `GET /tasks?child_user_id=...`
Hämtar aktuella uppgifter (v1: ingen historiklista i UI, men API kan returnera summary).

### `GET /tasks/:taskId`
Detaljer för uppgift.

### `PATCH /tasks/:taskId/status`
Barn/förälder ändrar status enligt rollregler.

### `PATCH /tasks/:taskId/planning`
Sätt/uppdatera `difficulty` + `planned_window`.

### `PATCH /tasks/:taskId/comment`
Sätt `child_comment` eller `parent_comment`.

### `GET /tasks/:taskId/events`
Full historik för uppgiften.

### `GET /children/:childUserId/progress`
Nuvarande progress/avatar-state.

---

## Status- och cykelregler

- Barn: `received -> started -> thinks_done`
- Förälder/agent: `thinks_done -> confirmed_done`
- Förälder/agent kan avvisa och återöppna (`confirmation_rejected`, normalt tillbaka till `started`)
- Barn kan markera `thinks_done` igen i ny cykel
- `current_attempt_no` höjs när ny “thinks_done”-cykel startar

---

## Belöningslogik (v1-förslag)

- **Bonus**: `thinks_done` + senare bekräftad klar.
- **Neutral/liten bonus**: bekräftad klar utan tidigare `thinks_done`.
- **Liten penalty**: `thinks_done` avvisas.

Notering:
- Positiv vinst ska väga tydligt mer än bakslag.
- Poängvärden beslutas separat, men struktur finns i `reward_events`.

---

## Kompletterande beslut (2026-05-09)

### Auth/identitet (v1)

- Enkel JWT-baserad identitet i API.
- Claims minst: `sub` (user id), `role` (`child|parent|agent`), valfria kontextclaims.
- Lokal utveckling får ha en dev-only tokenväg (t.ex. `/dev/login-as`) för snabb testning.
- Dev-endpoints/tokens ska vara avstängda utanför lokal miljö.

### Accessmodell (v1)

Ny tabell:
- `child_parent_access`
  - `child_user_id` (uuid, fk -> users.id)
  - `parent_user_id` (uuid, fk -> users.id)
  - `created_at` (timestamptz)
  - PK: (`child_user_id`, `parent_user_id`)

Regel:
- Task ägs alltid av ett barn (`tasks.child_user_id`).
- Föräldrar får läsa/agera på task om relation finns i `child_parent_access`.

### Fält vs status (beslut)

- `status` används endast för uppgiftens arbetsflöde:
  - `received|started|thinks_done|confirmed_done`
- `difficulty` och `planned_window` är fält, inte statussteg.
- Alla ändringar av status/fält loggas i `task_events` med aktör och tid.

### OpenAPI-light (v1, exempel)

#### `POST /agent/tasks`

Request:
```json
{
  "child_user_id": "uuid",
  "title": "Matteläxa kap 3",
  "source": "school_platform",
  "source_external_id": "sp-12345",
  "subject": "Matematik",
  "due_date": "2026-05-12"
}
```

Response `201`:
```json
{
  "id": "uuid",
  "child_user_id": "uuid",
  "title": "Matteläxa kap 3",
  "status": "received",
  "created_at": "2026-05-09T11:20:00Z"
}
```

#### `PATCH /tasks/{taskId}/planning`

Request:
```json
{
  "difficulty": "hard",
  "planned_window": "this_week"
}
```

Response `200`:
```json
{
  "id": "uuid",
  "difficulty": "hard",
  "planned_window": "this_week",
  "updated_at": "2026-05-09T11:22:00Z"
}
```

### Lokal DB-strategi (tillfällig)

- Starta lokalt med SQLite för snabb labb/test.
- Använd seed/testscript för att populera child/parent/agent/tasks/events i dev.
- Markera tydligt som tillfälligt (`ENABLE_DEV_SEED=true`) och ta bort innan produktionssättning.
- Målbild för MVP: SQLite-modell och migrationer hålls som källa till sanning.

---

## Testbarhet från start

- Seeddata för child + parent + agent + tasks.
- Idempotens-test för `POST /agent/tasks`.
- Rolltest för statusövergångar.
- Eventloggtest: varje ändring ska skapa `task_events`-rad.
- Rewardtest: rätt effekt vid confirm/reject.


## Tillägg 2026-05-22 (gamification/UX-state)

### Låsta poängregler
- `tasks.difficulty=easy` + `confirmed_done` => +3 stjärnor
- `tasks.difficulty=medium` + `confirmed_done` => +6 stjärnor
- `tasks.difficulty=hard` + `confirmed_done` => +10 stjärnor
- `difficulty=unknown` behandlas som `medium` i v1

### Hungerregler v1 (playtest-bas)
- Ny uppgift från agent/system: hunger +3
- Meningsfull progression: hunger -1 per steg
- Max 3 hunger-sänkningar per uppgift/attempt-cykel
- Idempotens krävs så toggle-spam inte ger extra effekt

### Nausea-regler v1
- `thinks_done -> rejected` ger `nausea_score +1`
- Nausea ska kunna försvinna automatiskt efter 24h
- Nausea ska nollställas vid level-up

### Ny tabell: `task_feedback_animations`
Syfte: säkra one-shot animation i UI (färg + emoji-flyg) exakt en gång per relevant reject-event.

Fält:
- `id` (uuid, pk)
- `task_id` (uuid, fk -> tasks.id)
- `child_user_id` (uuid, fk -> users.id)
- `event_id` (uuid, fk -> task_events.id)
- `animation_type` (enum: `reject_nausea`)
- `animation_key` (text, unique)
- `delivered_at` (timestamptz, null)
- `seen_at` (timestamptz, null)
- `created_at` (timestamptz)

Regel:
- Skapas vid reject-event.
- API exponerar opelade animationer för barnet.
- När UI har spelat animationen kvitteras den (`seen_at`) och ska inte spelas igen.

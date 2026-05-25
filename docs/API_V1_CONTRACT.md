# API v1 Contract — SchoolTaskHelper

_Datum: 2026-05-21_

## Låsta produktbeslut (från JW)

1. Listordning: **deadline först**.
2. UI-actions: **fasta knappar** per status/roll.
3. Kommentarer: **riktig tråd** per uppgift.
4. Förälder: får **kommentera + bekräfta**, inte ändra planering/svårighet.
5. Gamification:
   - Hunger **ökar** när ny uppgift kommer in.
   - Hunger **minskar** när barnet gör meningsfull progression: sätter svårighet, planerar, uppdaterar status.
   - Samma typ av ändring ska inte kunna ge upprepade hunger-förändringar vid fram-och-tillbaka (idempotent per steg/cykel).
   - XP/stjärnor ökar när uppgift blir **confirmed_done** enligt svårighetsgrad (enkel=3, medel=6, svår=10).
   - Illamående (brun indikator från höger) ökar vid **thinks_done -> rejected**.
   - Illamående ska kunna minska/försvinna efter 24h eller vid level up.
6. Ingen gruppering i v1: alla uppgifter listas i en radad lista.
7. API ska stödja att **agent/system matar in uppgifter**.

---

## Föreslagna API-endpoints (v1)

## Agent/System

### `POST /agent/tasks`
Skapa uppgift (idempotent på `source + source_external_id`).

Body:
```json
{
  "child_user_id": "uuid",
  "title": "text",
  "source": "school_platform|manual|...",
  "source_external_id": "text",
  "subject": "text?",
  "due_date": "YYYY-MM-DD?"
}
```

Response:
- `201 Created` ny uppgift
- `200 OK` om redan finns (idempotent)

Side effects:
- `tasks.status=received`
- event: `task_created_by_agent`
- hunger +3 (initial belastning när ny uppgift kommer in)

---

## App/UI

### `GET /tasks?child_user_id=<uuid>`
Returnerar alla aktiva uppgifter för barnet, sorterade på deadline.

Sortering:
1. `due_date` stigande (`NULLS LAST`)
2. `created_at` stigande

Response-item (kort):
```json
{
  "id": "uuid",
  "title": "Planera en idrottsläxa",
  "subject": "Idrott",
  "due_date": "2026-06-03",
  "difficulty": "easy|medium|hard|unknown",
  "planned_window": "today|tomorrow|this_week|next_week|unknown",
  "status": "received|started|thinks_done|confirmed_done",
  "can_actions": ["set_difficulty","set_planning","mark_started","mark_thinks_done","confirm_done","reject_done","comment"]
}
```

### `GET /tasks/:taskId`
Detaljvy för expanderat kort.

### Mutation response shapes and frontend refresh behavior
Current SQLite MVP mutation responses are intentionally small and stable:
- `POST /agent/tasks` returns the created task row with status `received`, or the existing task row for the idempotent `source + source_external_id` case. It does not currently add `can_actions` to this mutation response; frontend should refetch `GET /tasks?child_user_id=...` or `GET /tasks/:taskId` when it needs hint-enriched state.
- `PATCH /tasks/:taskId/planning` returns the updated task row after difficulty/planning changes. Refetch detail/list to receive `can_actions`.
- `PATCH /tasks/:taskId/status` returns the updated task row after accepted status transitions. Refetch active list after `confirmed_done`, because active list excludes completed tasks.
- `POST /tasks/:taskId/reject` returns `{ "ok": true }`; frontend should refetch task detail/list, progress, events only if needed for diagnostics, and `GET /children/:childUserId/animations/pending` for one-shot reject feedback.
- `POST /tasks/:taskId/comments` returns the created comment row; frontend can append it locally or refetch `GET /tasks/:taskId/comments`.
- `POST /children/:childUserId/animations/:animationId/ack` returns `{ acknowledged, seen_at }`; after `acknowledged: true`, the same animation will not appear in pending animations.

### `PATCH /tasks/:taskId/planning`
Barn sätter svårighet + planering.

Body:
```json
{
  "difficulty": "easy|medium|hard|unknown",
  "planned_window": "today|tomorrow|this_week|next_week|unknown"
}
```

Regel:
- Endast child (förälder saknar behörighet)
- Trigger hunger-minskning **en gång per meningsfullt steg**, inte vid toggle-spam.
- Total hunger-minskning: max **3** per uppgift/attempt-cykel.

### `PATCH /tasks/:taskId/status`
Statusändring enligt fasta regler.

Body:
```json
{ "to_status": "started|thinks_done|confirmed_done" }
```

Rollregler:
- Child: `received->started`, `started->thinks_done`
- Parent/agent: `thinks_done->confirmed_done`

Side effects:
- meningsfull statusprogression => hunger minskar
- `confirmed_done` => XP/stjärnor ökar enligt svårighetsgrad

### `POST /tasks/:taskId/reject`
Förälder/agent avvisar `thinks_done`.

Body:
```json
{
  "reason": "text?",
  "reopen_to_status": "started"
}
```

Side effects:
- status tillbaka till `started`
- avsluta aktuell attempt som `rejected`
- illamående ökar
- visuell feedback-flagga för "fel-animation" markeras som osedd (ska kunna spelas exakt en gång i UI)

### `GET /tasks/:taskId/comments`
Hämta kommentartråd.

### `POST /tasks/:taskId/comments`
Skapa kommentar i tråd.

Body:
```json
{
  "message": "text"
}
```

### `GET /tasks/:taskId/events`
Audit/historik.

### `GET /children/:childUserId/progress`
Returnerar topbar-data.

Response:
```json
{
  "child_user_id": "uuid",
  "hunger_score": 12,
  "hunger_capacity": 28,
  "xp_total": 340,
  "level": 4,
  "stars_total": 340,
  "nausea_score": 2,
  "updated_at": "timestamp"
}
```

---

## DB-justeringar för att stödja beslut 3 + 5

## Ny tabell: `task_comments`
- `id` uuid pk
- `task_id` uuid fk
- `author_user_id` uuid fk
- `author_role` enum(`child|parent|agent`)
- `message` text not null
- `created_at` timestamptz
- `updated_at` timestamptz null
- `deleted_at` timestamptz null (optional soft delete)

## Progressfält
`child_progress_state` kompletteras med:
- `nausea_score` int default 0
- `hunger_capacity` int (dynamisk, beror på antal aktiva uppgifter)

## Anti-toggle/idempotens
Lägg skydd via events/flags så hunger inte manipuleras med fram-och-tillbaka:
- reward/event-nycklar per task+attempt+action_type
- ignorera dublett inom samma steg/cykel

---

## Fast action-matris (UI)

### Child
- `received`: [Sätt svårighet, Sätt planering, Markera påbörjad]
- `started`: [Uppdatera svårighet, Uppdatera planering, Markera "Tror klar", Kommentera]
- `thinks_done`: [Kommentera] (väntar bekräftelse)
- `confirmed_done`: []

### Parent
- `received|started`: [Kommentera]
- `thinks_done`: [Bekräfta klar, Inte klar]
- `confirmed_done`: [Kommentera]

---

## Rekommenderad implementeringsordning
1. DB-migration: `task_comments`, `nausea_score`.
2. Endpoints för comments + progress.
3. Status/reject med side effects (xp/hunger/nausea).
4. `GET /tasks` med deadline-sortering + `can_actions`.
5. Tester för rollregler och anti-toggle.


## XP/stjärnor per svårighetsgrad (låst v1)
- `easy` => +3
- `medium` => +6
- `hard` => +10

`unknown` vid confirm_done hanteras som `medium` tills annat beslutas.

## Nausea-decay (låst v1)
- `nausea_score +1` vid `thinks_done -> rejected`
- `nausea_score` minskar automatiskt efter 24h
- `nausea_score` nollställs vid level-up

Implementationsnot: decay kan köras via schemalagd process eller vid read/write med tidskontroll.

## One-shot UX-animation (felhändelse)
Vid reject ska UI visa visuell feedback (färgskifte i hungerbar + emoji från felaktig uppgift till hungerbar) **endast en gång**.

Det kräver persistens:
- per reject-event: `animation_key`
- per child-view: `seen_at`/`delivered_at`

API behöver därför stöd för att hämta och acka opelade animationsevents.

### `GET /children/:childUserId/animations/pending`
Hämtar osedda reject-/feedback-animationer för barnet.

SQLite-MVP-beteende:
- Returnerar endast rader där `seen_at IS NULL`.
- Sätter `delivered_at` första gången en osedd animation levereras till klienten.
- `seen_at` är `null` tills klienten ackar animationen.

Response-item:
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "child_user_id": "uuid",
  "event_id": "uuid",
  "animation_type": "reject_nausea",
  "animation_key": "text",
  "delivered_at": "timestamp",
  "seen_at": null,
  "created_at": "timestamp"
}
```

### `POST /children/:childUserId/animations/:animationId/ack`
Markerar en levererad/osedd animation som sedd.

Response:
```json
{
  "acknowledged": true,
  "seen_at": "timestamp"
}
```

Om samma animation ackas igen returneras `acknowledged: false`.

## SQLite MVP baseline notes (2026-05-25)
- SQLite är MVP-databasen. `db/migrations/001_init_up.sql` är körbar baseline och enda aktiva schemaunderlag för MVP.
- Lokal v1-auth/action använder enkla dev-headers: `x-role` (`child|parent|agent`) och valfritt `x-user-id` för kommentarer. Detta är inte production auth.
- Plain language för `can_actions`: listan berättar vilka knappar som kan vara relevanta för en uppgifts nuvarande status. Den är en UI-hint, inte auktorisation. Frontend ska fortfarande separera barn-/föräldrakontroller med sin lokala rollkontext, och muterande endpoints gör auktoritativa roll/status-kontroller via `x-role`.
- `GET /tasks/:taskId/events` finns för aktuell backend audit/event-trail, men eventtäckningen är ännu sparsam. Reject skriver `confirmation_rejected`; full historik för create/planning/status/reward är uppskjuten. Synlig historik-UI är out of scope för v1.
- Reject-/feedback-animationer använder både `delivered_at` och `seen_at`: pending-read sätter `delivered_at`, ack sätter `seen_at`.
- Production deploy kräver explicit JW-godkännande. Status: Not approved for production deploy.
- Mer detaljerad reconciliation finns i `docs/API_DB_BASELINE_RECONCILIATION_2026-05-25.md`.

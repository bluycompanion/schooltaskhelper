# DECISIONS

## 2026-05-01
- Project name: `schooltaskhelper`
- Platform: touch-first web
- Primary age target (v1): 10–16
- UI style: clear gamification, not childish, still clean
- Avatar: emoji placeholder in v1
- Views: same UI for child/parent, different allowed actions
- Start in v1: show all active tasks; prepare for future start-view
- Filtering in v1: none
- History in v1: hidden from UI (active tasks only)
- Connectivity: online-only
- Theme: single mode in v1
- Feedback: wins should outweigh setbacks (~10x)


## 2026-05-22
- Hungerregel (v1/playtest): +3 vid ny uppgift, -1 per meningsfull progression, max 3 sänkningar per uppgift/attempt-cykel.
- XP/stjärnor vid `confirmed_done` låses till svårighetsgrad: easy=3, medium=6, hard=10.
- Nausea +1 vid `thinks_done -> rejected`.
- Nausea ska kunna försvinna efter 24h eller nollställas vid level-up.
- Reject ska trigga one-shot visuell feedback (hungerbar-färg + emoji från uppgift till hungerbar), med persistent state så animationen spelas exakt en gång per händelse.
- Både parent och agent får bekräfta `confirmed_done` i v1.
- Hungerbarens kapacitet ska vara variabel och bero på antal uppgifter.

## 2026-05-25
- SQLite är enda MVP-databas; alternativa hosted SQL-backends ingår inte i MVP-scope.
- Lokal v1-auth använder enkla dev-headers (`x-role`, valfritt `x-user-id`) för API-validering under MVP-utveckling; detta är inte production auth.
- `can_actions` är en roll-/statusnära UI-hint i plain language, inte auktorisation. Backendens muterande endpoints fortsätter vara auktoritativa för tillåtna roll/status-övergångar.
- Backend event/audit-baseline är i scope för v1-spårbarhet, men synlig historik-UI är out of scope.
- Reject-/feedback-animationer ska ha både `delivered_at` och `seen_at` så UI kan skilja leverans från faktisk visning/ack och spela varje händelse högst en gång.
- Production deploy kräver explicit JW-godkännande.
- Prod-deploy är för närvarande blockerad av runtime-behörigheter: `/Users/Shared/dev/runtime/schooltaskhelper/releases` ägs av `openclaw`, och Hermes-sessionen saknar lösenordslös sudo till den användaren.

## 2026-05-26
- **UI/UX Refinement (Gamification & Kompakthet):**
  - **En knapp:** Enbart nästa logiska åtgärd visas på det oexpanderade kortet.
  - **Expandera:** En liten pil (ner/upp) i övre högra hörnet används. Endast en uppgift kan vara expanderad åt gången.
  - **Ångra/Ändra:** Möjlighet att ändra tidigare val finns tillgängligt när kortet expanderas.
  - **Popups:** Inga radioknappar för val. Klick öppnar en modal/popup med stora touch-vänliga knappar (t.ex. tre nivåer på rad). Val sparas automatiskt vid klick.
  - **Gamification:** Visuell animation (mat-emojis flyger från den klickade knappen till "hunger-baren") sker vid varje framsteg för att belöna direkt.
  - **Logg:** En kompakt, rullbar historiklogg läggs till i den expanderade vyn.
  - **Kommentarer:** Minimeras och döljs bakom ett knapptryck (t.ex. en penna) inne i den expanderade vyn för att undvika onödig platsbrist.

### Ultraminimalistiskt Uppgiftskort (2026-05-26)
- **Liten meta-text:** Stora bubblor/chips togs bort till f�rm�n f�r en liten textrad med fetstilta v�rden (.subMetaLine).
- **Kompakta listor:** Kommentarer flyttades in inline i loggen/tidslinjen. Tidslinjen renderas i omv�nd kronologisk ordning med datum och h�ndelse p� samma rad f�r att spara vertikal yta.
- **Sm� �tg�rdsknappar:** I den expanderade vyn lades en rad med mycket sm� knappar till (.tinyActions) f�r att manuellt �ndra sv�righet, plan och status. Statusval kan nu g�ras via popup-f�nster precis som de andra valen.
- **Fast pil-ikon:** Expanderings-ikonen l�stes (position: absolute) i �versta h�gra h�rnet f�r att undvika brytningar.
- **K�lla flyttad:** Visning av datak�lla flyttades till att vara det allra f�rsta elementet i loggen ist�llet f�r en frist�ende rubrik.

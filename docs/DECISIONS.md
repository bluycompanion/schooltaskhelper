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

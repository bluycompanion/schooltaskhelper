# Autonomous 5-minute workflow (Planner → Executor → Auditor)

Det här flödet kör i 5-minuters tickar och roterar roller per steg:
1. Planner
2. Executor
3. Selfcheck (agenten verifierar sin egen leverans och förbättrar innan audit)
4. Auditor (obiaserad: kör verify-kommandon direkt och dömer pass/fail på exit-koder)

## Körfönster
- Endast mellan **16:00 och 19:00** (lokal tid)
- Tick varje 5:e minut via launchd

## Grundidé
- `autonomy/steps.json` = checklista med steg
- `autonomy/state/state.json` = nuvarande position/roll/försök
- `autonomy/logs/*.jsonl` = körlogg
- `autonomy/outbox/` = artefakter från planner/executor

## Viktigt om obiaserad verifiering
Auditor använder **inte** tidigare instruktioner som sanning. Den kör `verify_commands` från steget och bedömer:
- alla exit=0 => PASS
- något fail => FAIL

Vid fail:
- om audit-försök < `max_audit_attempts_per_step` (default 3) → tillbaka till Planner för ny förbättringscykel
- annars markeras steg som `blocked`

## Hur man klarmarkerar steg
Steg blir klarmarkerat automatiskt av Auditor när verify passerar.

## Manuell körning
```bash
cd /Users/Shared/dev/projects/schooltaskhelper
python3 scripts/autonomy_runner.py
```

## Installera bakgrundsjobb
```bash
cd /Users/Shared/dev/projects/schooltaskhelper
bash scripts/install_autonomy_launchd.sh
```

## Stoppa bakgrundsjobb
```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/ai.schooltaskhelper.autonomy.plist
```


## HALT vid behov av mänsklig input
Om ett steg saknar kritisk input/prereq kan runnern stanna sig själv:
- sätter `autonomy/state/state.json -> halted=true`
- skriver `autonomy/state/halt_request.json`
- skriver en kort notis i `autonomy/outbox/halt-message.txt`

Resume efter att input är given:
```bash
bash scripts/autonomy_resume.sh
```

# Implementation checklist (autonomy flow)

- [x] Scope: only SQL + API integration + tests (no GUI work)
- [x] Role loop: planner -> executor -> auditor
- [x] Auditor verdict based on verify command exit codes
- [x] Max audit attempts per step = 3
- [x] Run cadence = every 5 minutes
- [x] Work window = 16:00-19:00
- [x] Persistent step/state/log files

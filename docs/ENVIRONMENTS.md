# ENVIRONMENTS

## Planned
- Local dev
- Test/staging (TBD)
- Production (TBD)

## Local dev baseline
- API: Express, started with `npm start`.
- Default port: `3001` unless `PORT` is set.
- MVP DB: SQLite via `better-sqlite3`.
- Local DB file: `data/dev.sqlite` (generated locally, not committed).
- Tests: `npm test`.

## Database direction
- SQLite is the only MVP database.
- The live executable schema is `db/migrations/001_init_up.sql`.
- Local DB files such as `data/dev.sqlite` are generated locally and should not be committed.

## Deploy status
Production deploy requires explicit JW approval.

Status: Approved by JW and deployed 2026-06-13.

## Production
- Public URL: `https://bluycompanion.duckdns.org/schooltaskhelper/`
- Port: `4320`
- Route: Caddy `handle_path /schooltaskhelper*` → `127.0.0.1:4320`
- Build base path: `VITE_BASE_PATH=/schooltaskhelper`
- Current runtime: `/Users/Shared/dev/runtime/schooltaskhelper/current`
- Current caveat: this first prod process was started directly via `nohup` + `/Users/Shared/dev/logs/schooltaskhelper/prod.pid` because this Telegram/OpenClaw session could not install or bootstrap a system/user launchd service without sudo/root. Convert to a proper LaunchDaemon when elevated access is available.

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
- Prod service: system LaunchDaemon `system/com.webhosting.schooltaskhelper.prod`
- LaunchDaemon plist: `/Library/LaunchDaemons/com.webhosting.schooltaskhelper.prod.plist`
- Source plist: `/Users/Shared/dev/ops/webhosting/launchd/com.webhosting.schooltaskhelper.prod.plist`
- Note: Hermes deploys now rebuild `better-sqlite3` before tests when the active Node ABI differs from the local dev tree.
- Smoke test: authenticated request to the public prod URL returns HTTP 200 and the `SchoolTaskHelper` HTML shell.

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

Status: Not approved for production deploy.

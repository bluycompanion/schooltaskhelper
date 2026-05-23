#!/usr/bin/env bash
set -euo pipefail
ROLE="${1:?role}"
STEP="${2:?step}"
LOGDIR="autonomy/outbox"
mkdir -p "$LOGDIR"

case "$ROLE:$STEP" in
  planner:sql-01)
    cat > "$LOGDIR/sql-01.planner.txt" <<'TXT'
Plan: create migration files from agreed schema and ensure SQL is runnable.
TXT
    ;;
  executor:sql-01)
    test -f db/migrations/001_init_up.sql
    test -f db/migrations/001_init_down.sql
    echo "SQL migrations present" > "$LOGDIR/sql-01.executor.txt"
    ;;
  selfcheck:sql-01)
    grep -q "CREATE TABLE IF NOT EXISTS tasks" db/migrations/001_init_up.sql
    grep -q "CREATE TABLE IF NOT EXISTS child_progress_state" db/migrations/001_init_up.sql
    echo "SQL selfcheck pass" > "$LOGDIR/sql-01.selfcheck.txt"
    ;;

  planner:api-01)
    echo "Plan: implement agreed endpoints and side-effects in src/app.js" > "$LOGDIR/api-01.planner.txt"
    ;;
  executor:api-01)
    test -f src/app.js
    grep -q "app.post('/agent/tasks'" src/app.js
    grep -q "app.get('/children/:childUserId/progress'" src/app.js
    echo "API implementation present" > "$LOGDIR/api-01.executor.txt"
    ;;
  selfcheck:api-01)
    node -e "require('./src/app')"
    echo "API selfcheck import pass" > "$LOGDIR/api-01.selfcheck.txt"
    ;;

  planner:test-01)
    echo "Plan: run integration tests and require green." > "$LOGDIR/test-01.planner.txt"
    ;;
  executor:test-01)
    npm test > "$LOGDIR/test-01.executor.txt"
    ;;
  selfcheck:test-01)
    npm test > "$LOGDIR/test-01.selfcheck.txt"
    ;;

  *)
    echo "No handler for $ROLE:$STEP" >&2
    exit 2
    ;;
esac

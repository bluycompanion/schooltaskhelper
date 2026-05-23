#!/usr/bin/env bash
set -euo pipefail
PROJECT="/Users/Shared/dev/projects/schooltaskhelper"
PYTHON_BIN="$(command -v python3)"
LOG_OUT="$PROJECT/autonomy/logs/cron.out.log"
LOG_ERR="$PROJECT/autonomy/logs/cron.err.log"

mkdir -p "$PROJECT/autonomy/logs"
LINE="*/5 16-18 * * * cd $PROJECT && $PYTHON_BIN scripts/autonomy_runner.py >> $LOG_OUT 2>> $LOG_ERR"

TMP=$(mktemp)
(crontab -l 2>/dev/null | grep -v 'autonomy_runner.py' || true) > "$TMP"
echo "$LINE" >> "$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "Installed cron line:"
echo "$LINE"
crontab -l | grep 'autonomy_runner.py' || true

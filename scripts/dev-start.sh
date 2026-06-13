#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/Users/Shared/dev/projects/schooltaskhelper"
LOG_DIR="$HOME/Library/Logs/schooltaskhelper"
OUT_LOG="$LOG_DIR/dev.stdout.log"
ERR_LOG="$LOG_DIR/dev.stderr.log"

mkdir -p "$LOG_DIR"
cd "$PROJECT_DIR"

export APP_ENV=dev
export HOST=127.0.0.1
export PORT=4321

exec /usr/local/bin/node "$PROJECT_DIR/server.js" >>"$OUT_LOG" 2>>"$ERR_LOG"

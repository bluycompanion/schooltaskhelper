#!/usr/bin/env bash
set -euo pipefail
PROJECT="/Users/Shared/dev/projects/schooltaskhelper"
PYTHON_BIN="$(command -v python3)"
PIDFILE="$PROJECT/autonomy/state/loop.pid"
LOG="$PROJECT/autonomy/logs/loop.log"

mkdir -p "$PROJECT/autonomy/state" "$PROJECT/autonomy/logs"

start() {
  if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "already running pid $(cat "$PIDFILE")"
    exit 0
  fi

  nohup bash -c '
    while true; do
      h=$(date +%H)
      if [ "$h" -ge 16 ] && [ "$h" -lt 19 ]; then
        cd "'$PROJECT'" && "'$PYTHON_BIN'" scripts/autonomy_runner.py
      fi
      sleep 300
    done
  ' >> "$LOG" 2>&1 &

  echo $! > "$PIDFILE"
  echo "started pid $(cat "$PIDFILE")"
}

stop() {
  if [[ -f "$PIDFILE" ]]; then
    pid=$(cat "$PIDFILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" || true
      echo "stopped pid $pid"
    fi
    rm -f "$PIDFILE"
  else
    echo "not running"
  fi
}

status() {
  if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "running pid $(cat "$PIDFILE")"
  else
    echo "not running"
  fi
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  *) echo "usage: $0 {start|stop|restart|status}"; exit 1 ;;
esac

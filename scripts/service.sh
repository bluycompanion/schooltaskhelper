#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-status}"
LABEL="com.webhosting.schooltaskhelper.dev"
DOMAIN="gui/$(id -u)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

usage() {
  echo "Usage: $0 [status|restart|start|stop]" >&2
}

if [[ "$ACTION" != "status" && "$ACTION" != "restart" && "$ACTION" != "start" && "$ACTION" != "stop" ]]; then
  usage
  exit 2
fi

run_launchctl() {
  launchctl "$@"
}

print_compact_status() {
  local pattern
  pattern="state =|pid =|last exit code|path =|program ="
  if command -v rg >/dev/null 2>&1; then
    rg -n "$pattern"
  else
    grep -nE "$pattern"
  fi
}

case "$ACTION" in
  status)
    run_launchctl print "$DOMAIN/$LABEL" | print_compact_status
    ;;
  restart)
    run_launchctl kickstart -k "$DOMAIN/$LABEL"
    run_launchctl print "$DOMAIN/$LABEL" | print_compact_status
    ;;
  start)
    [[ -f "$PLIST" ]] || { echo "Missing LaunchAgent plist: $PLIST" >&2; exit 1; }
    run_launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    run_launchctl bootstrap "$DOMAIN" "$PLIST"
    run_launchctl enable "$DOMAIN/$LABEL"
    run_launchctl kickstart -k "$DOMAIN/$LABEL"
    run_launchctl print "$DOMAIN/$LABEL" | print_compact_status
    ;;
  stop)
    run_launchctl bootout "$DOMAIN/$LABEL"
    ;;
esac

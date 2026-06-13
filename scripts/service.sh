#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-status}"
ENV_NAME="${2:-dev}"
UID_JADMIN=501
PLIST_DIR="/Users/Shared/dev/ops/webhosting/launchd"
USER_PLIST_DIR="$HOME/Library/LaunchAgents"

if [[ "$ACTION" != "status" && "$ACTION" != "restart" && "$ACTION" != "start" && "$ACTION" != "stop" ]]; then
  echo "Usage: $0 [status|restart|start|stop] [dev|prod]" >&2
  exit 2
fi

if [[ "$ENV_NAME" != "dev" && "$ENV_NAME" != "prod" ]]; then
  echo "Usage: $0 [status|restart|start|stop] [dev|prod]" >&2
  exit 2
fi

if [[ "$ENV_NAME" == "dev" ]]; then
  LABEL="com.webhosting.schooltaskhelper.dev"
  PLIST="$PLIST_DIR/$LABEL.plist"
else
  LABEL="com.webhosting.schooltaskhelper.prod"
  PLIST="$USER_PLIST_DIR/$LABEL.plist"
fi

run_dev_launchctl() {
  if [[ "$(id -un)" == "jadmin" ]]; then
    launchctl "$@"
  else
    sudo -n -u jadmin -H launchctl "$@"
  fi
}

run_prod_launchctl() {
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
    if [[ "$ENV_NAME" == "dev" ]]; then
      run_dev_launchctl print "gui/$UID_JADMIN/$LABEL"
    else
      run_prod_launchctl print "user/$(id -u)/$LABEL"
    fi
    ;;
  restart)
    if [[ "$ENV_NAME" == "dev" ]]; then
      run_dev_launchctl kickstart -k "gui/$UID_JADMIN/$LABEL"
      run_dev_launchctl print "gui/$UID_JADMIN/$LABEL" | print_compact_status
    else
      run_prod_launchctl kickstart -k "user/$(id -u)/$LABEL" 2>/dev/null || {
        [[ -f "$PLIST" ]] || { echo "Missing prod plist: $PLIST" >&2; exit 1; }
        run_prod_launchctl bootstrap "user/$(id -u)" "$PLIST"
        run_prod_launchctl kickstart -k "user/$(id -u)/$LABEL"
      }
      run_prod_launchctl print "user/$(id -u)/$LABEL" | print_compact_status
    fi
    ;;
  start)
    if [[ "$ENV_NAME" == "dev" ]]; then
      run_dev_launchctl bootout "gui/$UID_JADMIN/$LABEL" 2>/dev/null || true
      run_dev_launchctl bootstrap "gui/$UID_JADMIN" "$PLIST"
      run_dev_launchctl kickstart -k "gui/$UID_JADMIN/$LABEL"
      run_dev_launchctl print "gui/$UID_JADMIN/$LABEL" | print_compact_status
    else
      [[ -f "$PLIST" ]] || { echo "Missing prod plist: $PLIST" >&2; exit 1; }
      run_prod_launchctl bootout "user/$(id -u)/$LABEL" 2>/dev/null || true
      run_prod_launchctl kickstart -k "user/$(id -u)/$LABEL" 2>/dev/null || {
        [[ -f "$PLIST" ]] || { echo "Missing prod plist: $PLIST" >&2; exit 1; }
        run_prod_launchctl bootstrap "user/$(id -u)" "$PLIST"
        run_prod_launchctl kickstart -k "user/$(id -u)/$LABEL"
      }
      run_prod_launchctl print "user/$(id -u)/$LABEL" | print_compact_status
    fi
    ;;
  stop)
    if [[ "$ENV_NAME" == "dev" ]]; then
      run_dev_launchctl bootout "gui/$UID_JADMIN/$LABEL"
    else
      run_prod_launchctl bootout "user/$(id -u)/$LABEL"
    fi
    ;;
  *) echo "Usage: $0 [status|restart|start|stop] [dev|prod]" >&2; exit 2 ;;
esac

#!/usr/bin/env bash
set -euo pipefail

CURRENT_USER="$(id -un)"
USER_HOME="$(dscl . -read "/Users/$CURRENT_USER" NFSHomeDirectory | awk '{print $2}')"
export HOME="${USER_HOME:-$HOME}"
export npm_config_cache="$HOME/.npm"

APPROVE_FLAG="${1:-}"
if [[ "$APPROVE_FLAG" != "--approve" ]]; then
  echo "Deploy blocked. Run: $0 --approve" >&2
  exit 2
fi

BASE_DIR="/Users/Shared/dev/projects/schooltaskhelper"
cd "$BASE_DIR"
"$BASE_DIR/scripts/preflight.sh" dev
"$BASE_DIR/scripts/rebuild-native-modules.sh"
npm test
npm run test:web
npm run typecheck:web
"$BASE_DIR/scripts/release.sh" --approve
"$BASE_DIR/scripts/service.sh" restart prod
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:4320/health >/dev/null; then
    echo "[deploy-prod] PASS"
    exit 0
  fi
  sleep 1
done
echo "[deploy-prod] FAIL health endpoint did not respond on port 4320" >&2
exit 1

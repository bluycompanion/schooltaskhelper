#!/usr/bin/env bash
set -euo pipefail

CURRENT_USER="$(id -un)"
USER_HOME="$(dscl . -read "/Users/$CURRENT_USER" NFSHomeDirectory | awk '{print $2}')"
export HOME="${USER_HOME:-$HOME}"
export npm_config_cache="$HOME/.npm"

APPROVE_FLAG="${1:-}"
if [[ "$APPROVE_FLAG" != "--approve" ]]; then
  echo "Release blocked. Run: $0 --approve" >&2
  exit 2
fi

PROJECT_SLUG="schooltaskhelper"
DEV_DIR="/Users/Shared/dev/projects/$PROJECT_SLUG"
RUNTIME_ROOT="/Users/Shared/dev/runtime/$PROJECT_SLUG"
RELEASES_DIR="$RUNTIME_ROOT/releases"
CURRENT_LINK="$RUNTIME_ROOT/current"
TS="$(date +%Y%m%d-%H%M%S)"
NEW_RELEASE="$RELEASES_DIR/$TS"

mkdir -p "$RELEASES_DIR"
echo "[release] building frontend for /schooltaskhelper"
(cd "$DEV_DIR" && VITE_BASE_PATH=/schooltaskhelper npm run build:web)
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'data' \
  --exclude 'autonomy/state' \
  --exclude 'autonomy/logs' \
  --exclude 'autonomy/outbox' \
  "$DEV_DIR/" "$NEW_RELEASE/"

if [[ -f "$NEW_RELEASE/package-lock.json" ]]; then
  echo "[release] installing prod dependencies via npm ci --omit=dev"
  (cd "$NEW_RELEASE" && npm ci --omit=dev --no-audit --no-fund)
elif [[ -f "$NEW_RELEASE/package.json" ]]; then
  echo "[release] installing prod dependencies via npm install --omit=dev"
  (cd "$NEW_RELEASE" && npm install --omit=dev --no-audit --no-fund)
fi

mkdir -p "$NEW_RELEASE/data"
"$DEV_DIR/scripts/preflight.sh" prod "$NEW_RELEASE"
ln -sfn "$NEW_RELEASE" "$CURRENT_LINK"
echo "[release] current -> $NEW_RELEASE"

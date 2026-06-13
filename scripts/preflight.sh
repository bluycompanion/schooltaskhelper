#!/usr/bin/env bash
set -euo pipefail

ENV_NAME="${1:-dev}"
TARGET_OVERRIDE="${2:-}"
PROJECT_SLUG="schooltaskhelper"
BASE_DIR="/Users/Shared/dev/projects/$PROJECT_SLUG"
RUNTIME_DIR="/Users/Shared/dev/runtime/$PROJECT_SLUG/current"

if [[ "$ENV_NAME" != "dev" && "$ENV_NAME" != "prod" ]]; then
  echo "Usage: $0 [dev|prod] [optional-target-dir]" >&2
  exit 2
fi

if [[ -n "$TARGET_OVERRIDE" ]]; then
  TARGET_DIR="$TARGET_OVERRIDE"
elif [[ "$ENV_NAME" == "dev" ]]; then
  TARGET_DIR="$BASE_DIR"
else
  TARGET_DIR="$RUNTIME_DIR"
fi

echo "[preflight] env=$ENV_NAME target=$TARGET_DIR"
[[ -d "$TARGET_DIR" ]] || { echo "Missing target dir: $TARGET_DIR" >&2; exit 1; }
[[ -f "$TARGET_DIR/server.js" ]] || { echo "Missing server.js" >&2; exit 1; }
[[ -f "$TARGET_DIR/src/server.js" ]] || { echo "Missing src/server.js" >&2; exit 1; }
[[ -f "$TARGET_DIR/src/app.js" ]] || { echo "Missing src/app.js" >&2; exit 1; }
[[ -f "$TARGET_DIR/package.json" ]] || { echo "Missing package.json" >&2; exit 1; }
[[ -f "$TARGET_DIR/dist/web/index.html" ]] || { echo "Missing dist/web/index.html (run build:web)" >&2; exit 1; }

node --check "$TARGET_DIR/server.js"
node --check "$TARGET_DIR/src/server.js"
node --check "$TARGET_DIR/src/app.js"
echo "[preflight] syntax OK"
echo "[preflight] PASS"

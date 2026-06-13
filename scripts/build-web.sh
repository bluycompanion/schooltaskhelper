#!/usr/bin/env bash
set -euo pipefail

BASE_PATH="${1:-}"
if [[ -z "$BASE_PATH" || "${BASE_PATH:0:1}" != "/" ]]; then
  echo "Usage: $0 /dev/schooltaskhelper|/schooltaskhelper" >&2
  exit 2
fi

PROJECT_DIR="/Users/Shared/dev/projects/schooltaskhelper"
cd "$PROJECT_DIR"

GIT_SHA="$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
BUILD_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BUILD_ID="$(date -u +%Y%m%d-%H%M%S)-$GIT_SHA"
APP_VERSION="$(node -p "require('./package.json').version")"

export VITE_BASE_PATH="$BASE_PATH"
export VITE_STH_BUILD_ID="$BUILD_ID"
export VITE_STH_BUILD_AT="$BUILD_AT"
export VITE_APP_VERSION="$APP_VERSION"

npm run build:web:raw

python3 "$PROJECT_DIR/scripts/verify-build-output.py" "$PROJECT_DIR/dist/web/index.html" "$BASE_PATH"

python3 - <<'PY'
import json
import os
from pathlib import Path

dist_dir = Path('/Users/Shared/dev/projects/schooltaskhelper/dist/web')
info = {
    'appVersion': os.environ['VITE_APP_VERSION'],
    'buildId': os.environ['VITE_STH_BUILD_ID'],
    'builtAt': os.environ['VITE_STH_BUILD_AT'],
    'basePath': os.environ['VITE_BASE_PATH'],
}
dist_dir.mkdir(parents=True, exist_ok=True)
(dist_dir / 'build-info.json').write_text(json.dumps(info, indent=2, ensure_ascii=False) + '\n')
print(json.dumps(info, indent=2, ensure_ascii=False))
PY
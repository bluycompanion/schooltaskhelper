#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/Users/Shared/dev/projects/schooltaskhelper"
cd "$PROJECT_DIR"

# Keep the list short and explicit. Extend centrally when the project needs more.
NATIVE_MODULES=("better-sqlite3")

for module in "${NATIVE_MODULES[@]}"; do
  if [[ -d "node_modules/$module" ]]; then
    npm rebuild "$module" --no-audit --no-fund
  fi
done

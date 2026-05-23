#!/usr/bin/env bash
set -euo pipefail

PROJECT="/Users/Shared/dev/projects/schooltaskhelper"
PYTHON_BIN="$(command -v python3)"
PLIST="$HOME/Library/LaunchAgents/ai.schooltaskhelper.autonomy.plist"
LOG_OUT="$PROJECT/autonomy/logs/launchd.out.log"
LOG_ERR="$PROJECT/autonomy/logs/launchd.err.log"

mkdir -p "$HOME/Library/LaunchAgents" "$PROJECT/autonomy/logs"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>ai.schooltaskhelper.autonomy</string>

    <key>ProgramArguments</key>
    <array>
      <string>$PYTHON_BIN</string>
      <string>$PROJECT/scripts/autonomy_runner.py</string>
    </array>

    <key>WorkingDirectory</key>
    <string>$PROJECT</string>

    <key>StartInterval</key>
    <integer>300</integer>

    <key>StandardOutPath</key>
    <string>$LOG_OUT</string>

    <key>StandardErrorPath</key>
    <string>$LOG_ERR</string>

    <key>RunAtLoad</key>
    <true/>
  </dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/ai.schooltaskhelper.autonomy" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/ai.schooltaskhelper.autonomy"
launchctl kickstart -k "gui/$(id -u)/ai.schooltaskhelper.autonomy"

echo "Installed: $PLIST"
launchctl print "gui/$(id -u)/ai.schooltaskhelper.autonomy" | head -n 30 || true

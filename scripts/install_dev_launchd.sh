#!/usr/bin/env bash
set -euo pipefail

LABEL="com.webhosting.schooltaskhelper.dev"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PROJECT_DIR="/Users/Shared/dev/projects/schooltaskhelper"
LOG_DIR="$HOME/Library/Logs/schooltaskhelper"
START_SCRIPT="$PROJECT_DIR/scripts/dev-start.sh"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

cat >"$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>$LABEL</string>

    <key>ProgramArguments</key>
    <array>
      <string>$START_SCRIPT</string>
    </array>

    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>$LOG_DIR/launchd.stdout.log</string>

    <key>StandardErrorPath</key>
    <string>$LOG_DIR/launchd.stderr.log</string>
  </dict>
</plist>
PLIST

chmod 644 "$PLIST"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/$LABEL"
launchctl kickstart -k "gui/$(id -u)/$LABEL"
launchctl print "gui/$(id -u)/$LABEL" | head -40 || true

echo "Installed: $PLIST"

#!/usr/bin/env bash
set -euo pipefail

LABEL="com.webhosting.schooltaskhelper.prod"
SOURCE_PLIST="/Users/Shared/dev/ops/webhosting/launchd/$LABEL.plist"
SYSTEM_PLIST="/Library/LaunchDaemons/$LABEL.plist"
LOG_DIR="/Users/Shared/dev/logs/schooltaskhelper"
START_SCRIPT="/Users/Shared/dev/ops/webhosting/scripts/schooltaskhelper-prod-start.sh"
TMP_PLIST="$(mktemp "/tmp/${LABEL}.XXXXXX")"

mkdir -p "$LOG_DIR"

cat >"$TMP_PLIST" <<PLIST
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
    <string>/Users/Shared/dev/runtime/schooltaskhelper/current</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>$LOG_DIR/launchd-prod.stdout.log</string>

    <key>StandardErrorPath</key>
    <string>$LOG_DIR/launchd-prod.stderr.log</string>
  </dict>
</plist>
PLIST

chmod 644 "$TMP_PLIST"

sudo -n install -o root -g wheel -m 644 "$TMP_PLIST" "$SOURCE_PLIST"
sudo -n install -o root -g wheel -m 644 "$TMP_PLIST" "$SYSTEM_PLIST"
sudo -n launchctl bootout system/"$LABEL" 2>/dev/null || true
sudo -n launchctl bootstrap system "$SYSTEM_PLIST"
sudo -n launchctl enable system/"$LABEL"
sudo -n launchctl kickstart -k system/"$LABEL"
sudo -n launchctl print system/"$LABEL" | head -40 || true

rm -f "$TMP_PLIST"
echo "Installed: $SYSTEM_PLIST"

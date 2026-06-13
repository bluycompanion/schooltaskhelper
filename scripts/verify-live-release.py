#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def fetch(url: str, auth: tuple[str, str] | None = None) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "schooltaskhelper-release-verify/1.0"})
    if auth:
        token = base64.b64encode(f"{auth[0]}:{auth[1]}".encode()).decode()
        req.add_header("Authorization", f"Basic {token}")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8", errors="replace")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-path", required=True)
    parser.add_argument("--health-url", default="http://127.0.0.1:4320/health")
    parser.add_argument("--page-url", default="http://127.0.0.1:4320/")
    parser.add_argument("--expected-build-info", required=True)
    parser.add_argument("--auth-user")
    parser.add_argument("--auth-pass")
    args = parser.parse_args()

    expected = json.loads(Path(args.expected_build_info).read_text(encoding="utf-8"))
    expected_build_id = expected.get("buildId")
    expected_base_path = args.base_path.rstrip("/")

    auth = None
    if args.auth_user and args.auth_pass:
        auth = (args.auth_user, args.auth_pass)

    health = json.loads(fetch(args.health_url, auth=None))
    errors: list[dict[str, object]] = []

    if health.get("ok") is not True or health.get("frontend") is not True:
        errors.append({"error": "health-failed", "health": health})

    health_build = health.get("build") or {}
    if expected_build_id and isinstance(health_build, dict):
        live_build_id = health_build.get("buildId")
        if live_build_id != expected_build_id:
            errors.append({"error": "build-id-mismatch", "expected": expected_build_id, "live": live_build_id, "health": health})
    elif expected_build_id:
        errors.append({"error": "missing-health-build", "health": health})

    html = fetch(args.page_url, auth=auth)
    expected_asset_prefix = f'{expected_base_path}/assets/' if expected_base_path else '/assets/'
    if expected_asset_prefix not in html:
        errors.append({"error": "asset-prefix-mismatch", "expected_prefix": expected_asset_prefix})

    bundle_text = ""
    script_match = re.search(r'<script[^>]+src="([^"]+)"', html)
    if not script_match:
        errors.append({"error": "missing-script-asset"})
    else:
        script_src = script_match.group(1)
        if expected_base_path and not script_src.startswith(expected_asset_prefix):
            errors.append({"error": "script-prefix-mismatch", "expected_prefix": expected_asset_prefix, "script_src": script_src})
        script_url = urllib.parse.urljoin(args.page_url, script_src)
        bundle_text = fetch(script_url, auth=auth)

        # Direct checks against the Node process run without Caddy's handle_path strip.
        # In that mode an HTML page may reference /schooltaskhelper/assets/..., while
        # Express serves the same file as /assets/... . Try the stripped URL too.
        if expected_build_id and expected_build_id not in bundle_text and expected_base_path and script_src.startswith(expected_base_path + "/"):
            stripped_src = script_src[len(expected_base_path):]
            stripped_url = urllib.parse.urljoin(args.page_url, stripped_src)
            try:
                stripped_text = fetch(stripped_url, auth=auth)
                if expected_build_id in stripped_text:
                    bundle_text = stripped_text
            except urllib.error.URLError:
                pass

    # The build footer is rendered by React, so it is not present in raw index.html.
    # Verify that the JS bundle contains the expected build id instead.
    if expected_build_id and bundle_text and expected_build_id not in bundle_text:
        errors.append({"error": "build-bundle-mismatch", "expected_build_id": expected_build_id})

    if errors:
        print(json.dumps({"errors": errors, "health": health}, indent=2, ensure_ascii=False), file=sys.stderr)
        return 1

    print(json.dumps({
        "status": "ok",
        "expected_build_id": expected_build_id,
        "base_path": expected_base_path,
        "health": {"ok": health.get("ok"), "frontend": health.get("frontend")},
    }, indent=2, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    try:
      raise SystemExit(main())
    except urllib.error.URLError as exc:
      print(json.dumps({"error": "fetch-failed", "detail": str(exc)}, indent=2, ensure_ascii=False), file=sys.stderr)
      raise SystemExit(1)
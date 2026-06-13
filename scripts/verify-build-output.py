#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print('Usage: verify-build-output.py <index.html> <base-path>', file=sys.stderr)
        return 2

    html_path = Path(sys.argv[1])
    base_path = sys.argv[2].rstrip('/')
    expected_prefix = f'{base_path}/assets/' if base_path else '/assets/'

    html = html_path.read_text(encoding='utf-8', errors='ignore')
    refs = re.findall(r'''(?:src|href)="([^"]+)"''', html)
    asset_refs = [ref for ref in refs if '/assets/' in ref]

    bad_prefix = [ref for ref in asset_refs if not ref.startswith(expected_prefix)]
    missing = []
    for ref in asset_refs:
        if not ref.startswith(expected_prefix):
            continue
        relative = ref[len(base_path):] if base_path else ref
        relative = relative.lstrip('/')
        if not (html_path.parent / relative).exists():
            missing.append(ref)

    if bad_prefix:
      print(json.dumps({
          'error': 'asset-prefix-mismatch',
          'expected_prefix': expected_prefix,
          'bad_refs': bad_prefix,
      }, indent=2, ensure_ascii=False), file=sys.stderr)
      return 1

    if missing:
      print(json.dumps({
          'error': 'missing-asset-files',
          'missing_refs': missing,
      }, indent=2, ensure_ascii=False), file=sys.stderr)
      return 1

    print(json.dumps({
        'status': 'ok',
        'expected_prefix': expected_prefix,
        'asset_count': len(asset_refs),
        'index_html': str(html_path),
    }, indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
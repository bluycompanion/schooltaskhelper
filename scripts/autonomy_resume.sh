#!/usr/bin/env bash
set -euo pipefail
STATE="/Users/Shared/dev/projects/schooltaskhelper/autonomy/state/state.json"
HALT="/Users/Shared/dev/projects/schooltaskhelper/autonomy/state/halt_request.json"
python3 - <<'PY'
import json
from pathlib import Path
p=Path('/Users/Shared/dev/projects/schooltaskhelper/autonomy/state/state.json')
state=json.loads(p.read_text())
state['halted']=False
state['last_result']='resumed_by_human'
p.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n')
print('resumed')
PY
rm -f "$HALT"
echo "halt cleared"

#!/usr/bin/env python3
import json, os, shlex, subprocess, sys
from datetime import datetime
from pathlib import Path

ROOT = Path('/Users/Shared/dev/projects/schooltaskhelper')
AUTO = ROOT / 'autonomy'
STATE_PATH = AUTO / 'state/state.json'
STEPS_PATH = AUTO / 'steps.json'
CFG_PATH = AUTO / 'config.json'
LOG_PATH = AUTO / f"logs/{datetime.now().strftime('%Y-%m-%d')}.jsonl"
LOCK_PATH = AUTO / 'state/runner.lock'
HALT_PATH = AUTO / 'state/halt_request.json'


def load_json(path):
    return json.loads(path.read_text())


def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def log(event):
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open('a') as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")


def run_cmd(cmd, timeout=240):
    p = subprocess.run(cmd, shell=True, cwd=str(ROOT), text=True, capture_output=True, timeout=timeout)
    return {
        'cmd': cmd,
        'exit_code': p.returncode,
        'stdout': p.stdout[-4000:],
        'stderr': p.stderr[-4000:]
    }


def within_hours(cfg):
    now = datetime.now()
    h = now.hour
    start = cfg['working_hours']['start_hour']
    end = cfg['working_hours']['end_hour_exclusive']
    return start <= h < end


def next_role(role):
    return {'planner': 'executor', 'executor': 'selfcheck', 'selfcheck': 'auditor', 'auditor': 'planner'}[role]




def set_halt(step, reason, needs, recent_event=None):
    payload = {
        'ts': datetime.now().isoformat(),
        'step_id': step.get('id'),
        'step_title': step.get('title'),
        'reason': reason,
        'needs_human_input': needs,
        'recent_event': recent_event or {}
    }
    HALT_PATH.parent.mkdir(parents=True, exist_ok=True)
    HALT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    msg = AUTO / 'outbox/halt-message.txt'
    msg.write_text(
        f"HALT: {step.get('id')} - {step.get('title')}\n"
        f"Reason: {reason}\n"
        f"Needs: {needs}\n"
        f"See: autonomy/state/halt_request.json\n"
    )

def main():
    if LOCK_PATH.exists():
        print('lock exists; skip')
        return 0
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOCK_PATH.write_text(str(os.getpid()))

    try:
        cfg = load_json(CFG_PATH)
        state = load_json(STATE_PATH)
        if state.get('halted'):
            event = {'ts': datetime.now().isoformat(), 'type': 'halted_waiting_for_human'}
            log(event)
            state['last_run'] = event['ts']
            state['last_result'] = 'halted_waiting_for_human'
            save_json(STATE_PATH, state)
            return 0
        steps_doc = load_json(STEPS_PATH)
        steps = steps_doc['steps']

        if not within_hours(cfg):
            event = {'ts': datetime.now().isoformat(), 'type': 'skip_outside_hours'}
            log(event)
            state['last_run'] = event['ts']
            state['last_result'] = 'skipped_outside_hours'
            save_json(STATE_PATH, state)
            return 0

        if state['step_index'] >= len(steps):
            event = {'ts': datetime.now().isoformat(), 'type': 'all_done'}
            log(event)
            state['last_run'] = event['ts']
            state['last_result'] = 'all_done'
            save_json(STATE_PATH, state)
            return 0

        step = steps[state['step_index']]
        if step.get('status') in ('done', 'blocked'):
            state['step_index'] += 1
            state['role'] = 'planner'
            state['audit_attempts_on_current_step'] = 0
            save_json(STATE_PATH, state)
            save_json(STEPS_PATH, steps_doc)
            return 0

        role = state['role']
        ts = datetime.now().isoformat()
        event = {'ts': ts, 'type': 'tick', 'role': role, 'step_id': step['id'], 'step_title': step['title']}

        for hc in step.get('halt_if_missing', []):
            r = run_cmd(hc.get('check_command','true'), timeout=60)
            if r['exit_code'] != 0:
                state['halted'] = True
                state['last_run'] = ts
                state['last_result'] = 'halted_needs_human_input'
                event['result'] = 'halted_needs_human_input'
                event['halt_check'] = {'check': hc, 'command_result': r}
                set_halt(step, hc.get('reason','missing prerequisite'), hc.get('needs','human decision'), event)
                log(event)
                save_json(STATE_PATH, state)
                save_json(STEPS_PATH, steps_doc)
                return 0

        if role in ('planner', 'executor', 'selfcheck'):
            if role == 'planner':
                tmpl_key = 'planner_command_template'
            elif role == 'executor':
                tmpl_key = 'executor_command_template'
            else:
                tmpl_key = 'selfcheck_command_template'
            cmd = cfg[tmpl_key].format(step_id=step['id'], step_title=step['title'])
            result = run_cmd(cmd, timeout=220)
            event['command_result'] = result
            if result['exit_code'] != 0:
                event['result'] = 'failed'
                state['last_result'] = f'{role}_failed'
            else:
                event['result'] = 'ok'
                state['role'] = next_role(role)
                state['last_result'] = f'{role}_ok'

        elif role == 'auditor':
            checks = []
            all_ok = True
            for c in step.get('verify_commands', []):
                r = run_cmd(c, timeout=120)
                checks.append(r)
                if r['exit_code'] != 0:
                    all_ok = False
            event['checks'] = checks
            if all_ok:
                step['status'] = 'done'
                event['result'] = 'pass'
                state['step_index'] += 1
                state['role'] = 'planner'
                state['audit_attempts_on_current_step'] = 0
                state['last_result'] = 'audit_pass'
            else:
                state['audit_attempts_on_current_step'] += 1
                if state['audit_attempts_on_current_step'] >= cfg.get('max_audit_attempts_per_step', 3):
                    step['status'] = 'blocked'
                    event['result'] = 'blocked_after_max_attempts'
                    state['step_index'] += 1
                    state['role'] = 'planner'
                    state['audit_attempts_on_current_step'] = 0
                    state['last_result'] = 'audit_blocked'
                else:
                    event['result'] = 'fail_refine'
                    state['role'] = 'planner'
                    state['last_result'] = 'audit_fail_refine'

        state['last_run'] = ts
        log(event)
        save_json(STATE_PATH, state)
        save_json(STEPS_PATH, steps_doc)
        return 0

    finally:
        try:
            LOCK_PATH.unlink(missing_ok=True)
        except Exception:
            pass


if __name__ == '__main__':
    sys.exit(main())

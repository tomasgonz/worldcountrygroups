#!/usr/bin/env python3
"""Run one scheduled data job safely and record how it went.

Every cron job goes through this wrapper. It:
  - skips the run if the previous run of the same job is still going (lock file)
  - stops the script after the job's time limit (timeoutMin, default 30)
  - retries a failed run (retries, default 1) after a short pause
  - keeps a copy of each output file first, and puts it back if the new file is
    not valid JSON or has shrunk to under 30% of its previous size, so a bad
    download never replaces good data
  - appends the output to a persistent log (~/.local/state/wcg/logs/<job>.log)
  - records the result in site/server/data/job-status.json for the admin page
    and the health check

Usage:
  run_job.py JOB_ID [--trigger cron|manual]
"""

import argparse
import fcntl
import json
import os
import shlex
import shutil
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA = os.environ.get("WCG_SITE_DATA") or os.path.join(ROOT, "site", "server", "data")
STATE = os.path.join(os.path.expanduser("~"), ".local", "state", "wcg")
LOCKS = os.path.join(STATE, "locks")
LOGS = os.path.join(STATE, "logs")
PREV = os.path.join(STATE, "previous")
STATUS = os.path.join(DATA, "job-status.json")
MAX_LOG_BYTES = 2 * 1024 * 1024


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def load_job(job_id):
    with open(os.path.join(DATA, "cron-config.json")) as f:
        for j in json.load(f).get("jobs", []):
            if j["id"] == job_id:
                return j
    return None


def update_status(job_id, patch):
    """Merge patch into this job's entry in job-status.json (atomic, locked)."""
    os.makedirs(LOCKS, exist_ok=True)
    with open(os.path.join(LOCKS, "status.lock"), "w") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        try:
            with open(STATUS) as f:
                st = json.load(f)
        except Exception:
            st = {}
        entry = st.get(job_id, {})
        entry.update(patch)
        st[job_id] = entry
        tmp = STATUS + ".tmp"
        with open(tmp, "w") as f:
            json.dump(st, f, indent=1)
        os.replace(tmp, STATUS)
        return entry


def trim_log(path):
    try:
        if os.path.getsize(path) > MAX_LOG_BYTES:
            with open(path, "rb") as f:
                f.seek(-MAX_LOG_BYTES // 2, os.SEEK_END)
                tail = f.read()
            with open(path, "wb") as f:
                f.write(b"...(older log lines removed)\n" + tail[tail.find(b"\n") + 1:])
    except OSError:
        pass


def snapshot(outputs):
    """Copy each existing output so it can be restored. Returns {name: size}."""
    os.makedirs(PREV, exist_ok=True)
    sizes = {}
    for name in outputs:
        src = os.path.join(DATA, name)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(PREV, name))
            sizes[name] = os.path.getsize(src)
    return sizes


def check_outputs(outputs, before):
    """Return a list of problems; restore the previous copy of any broken file."""
    problems = []
    for name in outputs:
        path = os.path.join(DATA, name)
        prev = os.path.join(PREV, name)
        if not os.path.exists(path):
            if name in before:
                shutil.copy2(prev, path)
                problems.append(f"{name} disappeared; previous version restored")
            continue
        size = os.path.getsize(path)
        bad = None
        try:
            with open(path) as f:
                json.load(f)
        except Exception as e:
            bad = f"is not valid JSON ({str(e)[:80]})"
        if not bad and name in before and before[name] > 20_000 and size < before[name] * 0.3:
            bad = f"shrank from {before[name]:,} to {size:,} bytes"
        if bad:
            if name in before:
                shutil.copy2(prev, path)
                problems.append(f"{name} {bad}; previous version kept")
            else:
                problems.append(f"{name} {bad}")
    return problems


def run_once(job, log, timeout_s):
    parts = shlex.split(job["script"])
    script = parts[0] if os.path.isabs(parts[0]) else os.path.join(ROOT, parts[0])
    cmd = [sys.executable, script, *parts[1:]]
    started = time.time()
    proc = subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            start_new_session=True, env={**os.environ, "PYTHONUNBUFFERED": "1"})
    lines = []
    timed_out = False
    try:
        out, _ = proc.communicate(timeout=timeout_s)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(proc.pid, signal.SIGTERM)
        try:
            out, _ = proc.communicate(timeout=20)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)
            out, _ = proc.communicate()
    text = (out or b"").decode("utf-8", "replace")
    log.write(text)
    lines = [l for l in text.splitlines() if l.strip()]
    rc = proc.returncode
    err = None
    if timed_out:
        err = f"Stopped after the {timeout_s // 60}-minute time limit" if timeout_s >= 60 else f"Stopped after the {timeout_s}-second time limit"
    elif rc != 0:
        tb = [l for l in lines if l.strip()][-1:] or [f"exit code {rc}"]
        err = tb[0][:300]
    return rc, err, lines[-25:], round(time.time() - started, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("job")
    ap.add_argument("--trigger", default="cron")
    args = ap.parse_args()

    job = load_job(args.job)
    if not job:
        print(f"Unknown job {args.job}", file=sys.stderr)
        return 2

    os.makedirs(LOCKS, exist_ok=True)
    os.makedirs(LOGS, exist_ok=True)
    lock = open(os.path.join(LOCKS, f"{job['id']}.lock"), "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        update_status(job["id"], {"lastSkipped": now(), "skipReason": "previous run still going"})
        print("Previous run still going; skipped")
        return 0

    log_path = os.path.join(LOGS, f"{job['id']}.log")
    outputs = job.get("outputs") or []
    timeout_s = int(float(job.get("timeoutMin") or 30) * 60)
    retries = int(job.get("retries", 1))
    start = now()
    update_status(job["id"], {"running": True, "lastStart": start, "trigger": args.trigger, "pid": os.getpid()})

    rc, err, tail, dur, problems, attempt = 1, None, [], 0.0, [], 0
    with open(log_path, "a") as log:
        for attempt in range(1, retries + 2):
            log.write(f"\n===== {now()} {job['id']} attempt {attempt} ({args.trigger}) =====\n")
            log.flush()
            before = snapshot(outputs)
            rc, err, tail, dur = run_once(job, log, timeout_s)
            problems = check_outputs(outputs, before)
            if rc == 0 and not problems:
                break
            if problems:
                log.write("OUTPUT CHECK: " + "; ".join(problems) + "\n")
                err = err or problems[0]
            if attempt <= retries:
                log.write(f"Failed ({err}); retrying in 90 seconds\n")
                log.flush()
                time.sleep(90)
        log.write(f"===== finished {now()} {'OK' if rc == 0 and not problems else 'FAILED'} in {dur}s =====\n")
    trim_log(log_path)

    ok = rc == 0 and not problems
    prev = {}
    try:
        with open(STATUS) as f:
            prev = json.load(f).get(job["id"], {})
    except Exception:
        pass
    patch = {
        "running": False, "pid": None, "lastEnd": now(), "ok": ok, "exitCode": rc,
        "durationSec": dur, "attempts": attempt, "error": None if ok else err,
        "outputProblems": problems, "tail": tail,
        "consecutiveFailures": 0 if ok else int(prev.get("consecutiveFailures", 0)) + 1,
    }
    if ok:
        patch["lastSuccess"] = patch["lastEnd"]
    update_status(job["id"], patch)
    print(f"{job['id']}: {'OK' if ok else 'FAILED: ' + str(err)} ({dur}s, attempt {attempt})")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

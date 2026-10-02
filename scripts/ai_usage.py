"""Record AI token usage from Python scripts for the admin cost panel.

Adds to site/server/data/ai-usage-batch.json (daily totals per task, provider and
model), which the site merges with its own usage file. Safe to call from threads
and from several processes at once.
"""

import fcntl
import json
import os
import threading
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA = os.environ.get("WCG_SITE_DATA") or os.path.join(ROOT, "site", "server", "data")
USAGE = os.path.join(DATA, "ai-usage-batch.json")
_lock = threading.Lock()


def record(task, provider, model, input_tokens=0, output_tokens=0, cached=0, failed=False):
    try:
        with _lock, open(USAGE + ".lock", "w") as lk:
            fcntl.flock(lk, fcntl.LOCK_EX)
            try:
                with open(USAGE) as f:
                    u = json.load(f)
            except Exception:
                u = {"days": {}}
            day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            row = u.setdefault("days", {}).setdefault(day, {}).setdefault(
                f"{task}|{provider}|{model}", {"calls": 0, "input": 0, "output": 0, "cached": 0, "errors": 0})
            row["calls"] += 1
            row["errors"] += 1 if failed else 0
            row["input"] += int(input_tokens or 0)
            row["output"] += int(output_tokens or 0)
            row["cached"] += int(cached or 0)
            tmp = USAGE + ".tmp"
            with open(tmp, "w") as f:
                json.dump(u, f)
            os.replace(tmp, USAGE)
    except Exception:
        pass  # usage tracking must never break a data job

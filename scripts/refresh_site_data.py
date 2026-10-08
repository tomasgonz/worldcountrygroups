#!/usr/bin/env python3
"""Ask the running site to refresh data it fetches itself (World Bank country
statistics, resolution themes). Used by the scheduler, so these refresh on a
timetable instead of only when an admin presses the button.

The request goes to the site on localhost with a private token kept in
site/server/data/.internal-token (created here if missing, readable only by
this user and root).

Usage:
  refresh_site_data.py country|themes|briefings|alerts|ai-costs|said|votes-import|un-briefing
"""

import json
import os
import secrets
import sys
import urllib.error
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA = os.environ.get("WCG_SITE_DATA") or os.path.join(ROOT, "site", "server", "data")
TOKEN = os.path.join(DATA, ".internal-token")
SITE = os.environ.get("WCG_LOCAL_URL", "http://127.0.0.1:3000")


def token():
    if not os.path.exists(TOKEN):
        fd = os.open(TOKEN, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as f:
            f.write(secrets.token_hex(32))
    with open(TOKEN) as f:
        return f.read().strip()


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else ""
    if target not in ("country", "themes", "briefings", "alerts", "ai-costs", "said", "votes-import", "un-briefing"):
        print(__doc__)
        return 2
    path = f"/api/internal/run?task={target}" if target in ("briefings", "alerts", "ai-costs", "said", "votes-import", "un-briefing") else f"/api/internal/refresh?target={target}"
    req = urllib.request.Request(f"{SITE}{path}", method="POST",
                                 headers={"X-Internal-Token": token()})
    try:
        with urllib.request.urlopen(req, timeout=3300) as r:
            res = json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read()[:300]!r}")
        return 1
    print(json.dumps(res)[:1500])
    if not res.get("ok"):
        print("Refresh reported a problem:", "; ".join(res.get("errors") or []) or "unknown")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

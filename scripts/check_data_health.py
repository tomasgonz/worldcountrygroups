#!/usr/bin/env python3
"""Check that every dataset is being refreshed, and email the admins when not.

For each scheduled job it works out a status:
  ok        refreshed within its expected window (maxAgeHours)
  running   a run is in progress
  stale     not refreshed within maxAgeHours
  failing   the last run failed (or the last two runs, for frequent jobs)
  disabled  switched off in the admin
It also reports datasets that are only updated by hand (the per-country
General Assembly votes and the curated tables) with their age, and counts the
recorded General Assembly votes that the per-country voting data is missing.

Writes data-health.json. With --email it sends one email when problems appear
and one when they clear, to the addresses in cron-config.json "alertEmails"
(or admin users' emails). Mail goes through the exe.dev email gateway.

Usage:
  check_data_health.py [--email] [--json]
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA = os.environ.get("WCG_SITE_DATA") or os.path.join(ROOT, "site", "server", "data")
SITE_URL = os.environ.get("WCG_SITE_URL", "https://worldcountrygroups.exe.xyz")
GATEWAY = "http://169.254.169.254/gateway/email/send"

# Datasets with no automatic source: shown with their age, never alerted on
MANUAL = [
    ("un-votes-resolutions.json", "UN General Assembly votes by country", "Upload the UN Digital Library voting CSV in Admin"),
    ("sanctions.json", "Sanctions regimes", "Curated by hand"),
    ("conflict-events.json", "Conflict events", "Curated by hand"),
    ("military-capabilities.json", "Military capabilities", "Curated by hand"),
    ("treaties.json", "Treaties", "Curated by hand"),
    ("recognition.json", "Recognition disputes", "Curated by hand"),
]


def load(name, default=None):
    try:
        with open(os.path.join(DATA, name)) as f:
            return json.load(f)
    except Exception:
        return default


def parse(ts):
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def mtime(name):
    p = os.path.join(DATA, name)
    return datetime.fromtimestamp(os.path.getmtime(p), timezone.utc) if os.path.exists(p) else None


def iso(dt):
    return dt.isoformat(timespec="seconds").replace("+00:00", "Z") if dt else None


def pid_alive(pid):
    try:
        os.kill(int(pid), 0)
        return True
    except (OSError, TypeError, ValueError):
        return False


def voting_gap():
    """Recorded GA votes (from the library's tallies) newer than the per-country data."""
    votes = load("un-votes-resolutions.json", {}) or {}
    latest = max((r.get("d", "") for r in votes.get("resolutions", [])), default="")
    ga = load("ga-resolutions.json", {}) or {}
    missing = [r for r in ga.get("resolutions", [])
               if not r.get("without_vote") and r.get("tally") and (r.get("date") or "") > latest]
    missing.sort(key=lambda r: r.get("date", ""))
    return {
        "latestVote": latest or None,
        "missingRecordedVotes": len(missing),
        "firstMissing": missing[0]["date"] if missing else None,
        "lastMissing": missing[-1]["date"] if missing else None,
        "examples": [f"{r['id']} ({r['date']}): {r.get('title', '')[:90]}" for r in missing[-5:]],
    }


def compute():
    cfg = load("cron-config.json", {}) or {}
    status = load("job-status.json", {}) or {}
    now = datetime.now(timezone.utc)
    jobs = []
    for j in cfg.get("jobs", []):
        st = status.get(j["id"], {})
        outs = j.get("outputs") or []
        out_times = [t for t in (mtime(o) for o in outs) if t]
        last_success = parse(st.get("lastSuccess"))
        # a file written by an older run (before this wrapper existed) still counts
        refreshed = max([t for t in [last_success, *out_times] if t], default=None)
        max_age = j.get("maxAgeHours")
        age_h = (now - refreshed).total_seconds() / 3600 if refreshed else None
        fails = int(st.get("consecutiveFailures", 0))
        running = bool(st.get("running")) and pid_alive(st.get("pid")) and j["id"] != "health-check"
        if not j.get("enabled"):
            state = "disabled"
        elif running:
            state = "running"
        elif st.get("ok") is False and (fails >= 2 or not max_age or max_age >= 48):
            state = "failing"
        elif max_age and (age_h is None or age_h > max_age):
            state = "stale"
        else:
            state = "ok"
        jobs.append({
            "id": j["id"], "label": j.get("label", j["id"]), "schedule": j.get("schedule"),
            "enabled": bool(j.get("enabled")), "status": state, "maxAgeHours": max_age,
            "refreshedAt": iso(refreshed), "ageHours": round(age_h, 1) if age_h is not None else None,
            "outputs": [{"file": o, "updatedAt": iso(mtime(o))} for o in outs],
            "lastStart": st.get("lastStart"), "lastEnd": st.get("lastEnd"), "lastSuccess": st.get("lastSuccess"),
            "ok": st.get("ok"), "error": st.get("error"), "durationSec": st.get("durationSec"),
            "consecutiveFailures": fails, "tail": st.get("tail") or [], "trigger": st.get("trigger"),
            "lastSkipped": st.get("lastSkipped"),
        })
    manual = []
    for f, label, how in MANUAL:
        t = mtime(f)
        manual.append({"file": f, "label": label, "how": how, "updatedAt": iso(t),
                       "ageDays": round((now - t).total_seconds() / 86400) if t else None})
    gap = voting_gap()
    problems = [f"{j['label']}: {j['status']}" + (f" ({j['error']})" if j["status"] == "failing" and j["error"] else
                                                  f" (last refreshed {j['refreshedAt'] or 'never'})" if j["status"] == "stale" else "")
                for j in jobs if j["status"] in ("failing", "stale")]
    if gap["missingRecordedVotes"] >= 10:
        problems.append(f"UN voting data: {gap['missingRecordedVotes']} recorded General Assembly votes since "
                        f"{gap['latestVote']} are not in the per-country data")
    counts = {}
    for j in jobs:
        counts[j["status"]] = counts.get(j["status"], 0) + 1
    return {"generatedAt": iso(now), "counts": counts, "problems": problems, "jobs": jobs,
            "manual": manual, "votingGap": gap}


def send_email(to, subject, body):
    req = urllib.request.Request(GATEWAY, method="POST",
                                 data=json.dumps({"to": to, "subject": subject, "body": body}).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            resp = json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            resp = json.loads(e.read() or b"{}")
        except Exception:
            resp = {"error": f"HTTP {e.code}"}
    except Exception as e:
        resp = {"error": str(e)}
    return resp.get("success") is True, resp.get("error")


def alert(report):
    """Email when the set of problems changes: new problems, or all clear."""
    cfg = load("cron-config.json", {}) or {}
    to = [e for e in cfg.get("alertEmails", []) if "@" in e]
    if not to:
        users = (load("users.json", {}) or {}).get("users", [])
        to = [u["email"] for u in users if u.get("role") == "admin" and "@" in (u.get("email") or "")]
    state_path = os.path.join(DATA, "health-alert-state.json")
    state = load("health-alert-state.json", {}) or {}
    before = set(state.get("problems", []))
    # compare by the subject before the colon, so changing counts or dates don't re-alert
    key = lambda p: p.split(":")[0]
    now_keys = {key(p) for p in report["problems"]}
    new = [p for p in report["problems"] if key(p) not in before]
    cleared = sorted(before - now_keys)
    result = {"sent": False, "to": to, "new": new, "cleared": cleared}
    if (new or cleared) and to:
        lines = []
        if new:
            lines += ["New problems:", *[f"  - {p}" for p in new], ""]
        if cleared:
            lines += ["Resolved:", *[f"  - {p}" for p in cleared], ""]
        still = [p for p in report["problems"] if p not in new]
        if still:
            lines += ["Still open:", *[f"  - {p}" for p in still], ""]
        lines += [f"Data health: {SITE_URL}/admin#data-health"]
        subject = (f"World Country Groups: {len(report['problems'])} data problem{'s' if len(report['problems']) != 1 else ''}"
                   if report["problems"] else "World Country Groups: data refresh back to normal")
        errors = []
        for addr in to:
            ok, err = send_email(addr, subject, "\n".join(lines))
            if not ok:
                errors.append(f"{addr}: {err}")
        result["sent"] = not errors
        result["errors"] = errors
    if not (new or cleared) or result["sent"] or not to:
        state = {"problems": sorted(now_keys), "updatedAt": report["generatedAt"]}
        tmp = state_path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(state, f, indent=1)
        os.replace(tmp, state_path)
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", action="store_true", help="email admins when problems appear or clear")
    ap.add_argument("--json", action="store_true", help="print the report as JSON")
    args = ap.parse_args()
    report = compute()
    if args.email:
        report["alert"] = alert(report)
    tmp = os.path.join(DATA, "data-health.json.tmp")
    with open(tmp, "w") as f:
        json.dump(report, f, indent=1)
    os.replace(tmp, os.path.join(DATA, "data-health.json"))
    if args.json:
        json.dump(report, sys.stdout)
    else:
        print(f"{report['generatedAt']}: {report['counts']}")
        for p in report["problems"]:
            print("  PROBLEM", p)
        if "alert" in report:
            print("  alert:", report["alert"])


if __name__ == "__main__":
    main()

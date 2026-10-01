#!/usr/bin/env python3
"""Scheduled updater for UN General Debate speeches.

Fetches the current and previous General Debate sessions from gadebate.un.org,
re-checks garbled or truncated texts, then runs the AI analysis on any speech
that doesn't have one yet. Safe to run repeatedly: existing data is merged,
never dropped. Intended to run daily from mid-September to the end of October.
"""
import datetime
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def run(args):
    print("$", " ".join(args), flush=True)
    return subprocess.run([sys.executable, *args], cwd=HERE).returncode


def main():
    today = datetime.date.today()
    # Session N's General Debate is held in late September of year 1945 + N
    latest = today.year - 1945 - (1 if today.month < 9 else 0)
    print(f"[{datetime.datetime.now().isoformat(timespec='seconds')}] updating sessions {latest - 1}-{latest}", flush=True)

    rc = run([os.path.join(HERE, "fetch_gadebate.py"),
              "--session", str(latest - 1), "--session", str(latest), "--recheck"])
    if rc != 0:
        sys.exit(rc)
    for session in (latest, latest - 1):
        # analyze_speeches exits 1 when a session has no speeches yet; that's fine
        run([os.path.join(HERE, "analyze_speeches.py"), "--session", str(session),
             "--model", os.environ.get("DEBATE_ANALYSIS_MODEL", "gpt-4o"), "--concurrency", "4"])
    # Rebuild the quote repository from the (possibly new) analyses
    run([os.path.join(HERE, "build_quotes.py")])


if __name__ == "__main__":
    main()

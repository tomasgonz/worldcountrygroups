#!/usr/bin/env python3
"""Email digests for users' watched (bookmarked) countries.

Each user who opts in on their account page (daily or weekly) gets a plain-text
email listing, for every country they follow:
  - General Debate speeches delivered since their last digest
  - General Assembly votes where the country broke with the majority of one of
    its voting blocs (EU, G77, NAM, AU, OIC, ...)
  - a drop in its V-Dem electoral democracy score in the latest data release
  - new official statements and news mentioning it

Mail goes through the exe.dev email gateway, which only delivers to allowed
recipients (the VM owner, team members, people who signed in through exe.dev,
or people who emailed the VM with subject "subscribe").

State (what each user has already been sent) lives in digest-state.json.

Usage:
  send_digests.py                 # cron: send every due digest
  send_digests.py --user ID --force [--dry-run]   # preview / test for one user
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.environ.get("WCG_SITE_DATA") or os.path.join(ROOT, "site", "server", "data")
GROUPS_DIR = os.path.join(ROOT, "worldcountrygroups", "data", "groups")
STATE_FILE = os.path.join(DATA, "digest-state.json")
SITE_URL = os.environ.get("WCG_SITE_URL", "https://worldcountrygroups.exe.xyz")
GATEWAY = "http://169.254.169.254/gateway/email/send"

FREQ_DAYS = {"daily": 1, "weekly": 7}
VOTE_LOOKBACK_DAYS = 60      # votes within this many days of the newest recorded vote
SPEECH_LOOKBACK_DAYS = 60
BLOCS = ["eu", "nato", "g77", "nam", "au", "asean", "oic", "las", "gcc", "caricom",
         "celac", "aosis", "brics", "sco", "cis"]
MAX_ITEMS = 5


def load(name, default=None):
    path = os.path.join(DATA, name)
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def parse_dt(s):
    if not s:
        return None
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        try:
            return datetime.strptime(s[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception:
            return None


class Sources:
    """Lazily loaded data shared across all users in one run."""

    def __init__(self):
        world = json.load(open(os.path.join(GROUPS_DIR, "world.json")))["countries"]
        self.name = {c["iso3"]: c["name"] for c in world}
        self.iso2to3 = {c["iso2"].upper(): c["iso3"] for c in world if c.get("iso2")}
        self.blocs = {}
        for gid in BLOCS:
            p = os.path.join(GROUPS_DIR, f"{gid}.json")
            if os.path.exists(p):
                g = json.load(open(p))
                self.blocs[gid] = (g.get("acronym") or gid.upper(), {c["iso3"] for c in g["countries"]})
        self.speeches = (load("un-speeches-index.json", {}) or {}).get("speeches", [])
        self.statements = (load("statements-feed.json", {}) or {}).get("statements", [])
        self.news = (load("news-feed.json", {}) or {}).get("articles", [])
        self.vdem = load("vdem-data.json", {}) or {}
        # Vote data arrives in batches, often months late, so the window is anchored to the
        # newest recorded vote; "reported" keys stop a vote being sent twice.
        allres = (load("un-votes-resolutions.json", {}) or {}).get("resolutions", [])
        newest = max((r.get("d", "") for r in allres), default="")
        cutoff = ""
        if newest:
            cutoff = (datetime.strptime(newest, "%Y-%m-%d") - timedelta(days=VOTE_LOOKBACK_DAYS)).strftime("%Y-%m-%d")
        self.resolutions = [r for r in allres if r.get("d", "") >= cutoff]

    def to_iso3(self, code):
        code = (code or "").upper()
        return self.iso2to3.get(code, code)


def bloc_breaks(src, iso3):
    """Votes where `iso3` voted differently from most other members of one of its blocs."""
    out = []
    my_blocs = [(gid, acr, members) for gid, (acr, members) in src.blocs.items() if iso3 in members]
    for r in src.resolutions:
        mine = r["v"].get(iso3)
        if mine not in ("Y", "N", "A"):
            continue
        for gid, acr, members in my_blocs:
            tally = {"Y": 0, "N": 0, "A": 0}
            for m in members:
                v = r["v"].get(m)
                if m != iso3 and v in tally:
                    tally[v] += 1
            total = sum(tally.values())
            if total < 3:
                continue
            bloc_vote, n = max(tally.items(), key=lambda kv: kv[1])
            if n / total >= 0.6 and bloc_vote != mine:
                out.append({"id": r["id"], "date": r["d"], "title": r["t"], "mine": mine,
                            "bloc": acr, "bloc_vote": bloc_vote, "share": n / total})
    return out


VOTE_WORD = {"Y": "yes", "N": "no", "A": "abstain"}


def build_country_section(src, iso3, since, state):
    lines = []
    name = src.name.get(iso3, iso3)
    reported = set(state.get("reported", []))
    new_keys = []

    # General Debate speeches
    speech_cutoff = datetime.now(timezone.utc) - timedelta(days=SPEECH_LOOKBACK_DAYS)
    for s in src.speeches:
        if s["iso3"] != iso3:
            continue
        key = f"speech:{iso3}:{s['session']}"
        d = parse_dt(s.get("date"))
        if key in reported or not d or d < speech_cutoff:
            continue
        who = s.get("speaker") or "A representative"
        title = f", {s['speaker_title']}" if s.get("speaker_title") else ""
        lines.append(f"* Spoke at the General Debate ({s['date']}): {who}{title}.")
        summ = (s.get("analysis") or {}).get("summary") or ""
        if summ:
            lines.append(f"  {summ}")
        lines.append(f"  {SITE_URL}/countries/{iso3.lower()}/speeches")
        new_keys.append(key)

    # Votes against its blocs
    by_res = {}
    for b in bloc_breaks(src, iso3):
        if f"vote:{iso3}:{b['id']}" not in reported:
            by_res.setdefault(b["id"], []).append(b)
    if by_res:
        lines.append(f"* Broke with its voting blocs on {len(by_res)} General Assembly vote(s). Most recent:")
        ordered = sorted(by_res.values(), key=lambda bs: (bs[0]["date"], len(bs)), reverse=True)
        for bs in ordered[:MAX_ITEMS]:
            b0 = bs[0]
            blocs = "; ".join(f"{round(b['share'] * 100)}% of {b['bloc']} voted {VOTE_WORD[b['bloc_vote']]}" for b in bs)
            lines.append(f"  - {b0['date']}: voted {VOTE_WORD[b0['mine']]} ({blocs}). {b0['title'][:120]}")
        for rid in by_res:
            new_keys.append(f"vote:{iso3}:{rid}")

    # Democracy decline in the latest V-Dem release
    release = (src.vdem.get("_meta") or {}).get("source", "")
    c = (src.vdem.get("countries") or {}).get(iso3)
    if c and len(c.get("trend", [])) >= 2:
        last, prev = c["trend"][-1], c["trend"][-2]
        key = f"vdem:{iso3}:{last['year']}"
        a, b = prev.get("v2x_polyarchy"), last.get("v2x_polyarchy")
        if key not in reported and a is not None and b is not None and a - b >= 0.03:
            lines.append(f"* Democracy decline: V-Dem electoral democracy score fell from {a:.2f} ({prev['year']}) "
                         f"to {b:.2f} ({last['year']}).")
            new_keys.append(key)

    # Statements and news since the last digest
    def recent(items, label):
        hits = []
        for it in items:
            codes = {src.to_iso3(x) for x in (it.get("countries") or [])}
            if iso3 not in codes:
                continue
            seen = parse_dt(it.get("firstSeenAt") or it.get("publishedAt"))
            key = f"item:{it.get('id')}"
            if not seen or seen < since or key in reported:
                continue
            hits.append(it)
        hits.sort(key=lambda it: it.get("publishedAt") or "", reverse=True)
        if hits:
            lines.append(f"* {len(hits)} new {label}:")
            for it in hits[:MAX_ITEMS]:
                lines.append(f"  - {it.get('title', '').strip()[:160]}")
                lines.append(f"    {it.get('url', '')}")
        return [f"item:{it.get('id')}" for it in hits]

    new_keys += recent(src.statements, "official statement(s)")
    new_keys += recent(src.news, "news article(s)")

    if not lines:
        return None, []
    header = f"{name.upper()}\n{SITE_URL}/countries/{iso3.lower()}"
    return header + "\n" + "\n".join(lines), new_keys


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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", help="only this user id")
    ap.add_argument("--force", action="store_true", help="send even if not yet due")
    ap.add_argument("--dry-run", action="store_true", help="print instead of sending; don't update state")
    args = ap.parse_args()

    users = (load("users.json", {}) or {}).get("users", [])
    state = load("digest-state.json", {}) or {}
    state.setdefault("users", {})
    now = datetime.now(timezone.utc)
    src = None
    results = []

    for u in users:
        if args.user and u["id"] != args.user:
            continue
        prefs = u.get("preferences") or {}
        freq = prefs.get("emailDigest", "off")
        countries = prefs.get("bookmarkedCountries") or []
        if u.get("status") != "approved" or not u.get("email"):
            continue
        if freq not in FREQ_DAYS and not args.force:
            continue
        ustate = state["users"].setdefault(u["id"], {"reported": []})
        last = parse_dt(ustate.get("lastSent"))
        period = timedelta(days=FREQ_DAYS.get(freq, 7))
        # small slack so a daily cron at a fixed time is always due
        if not args.force and last and now - last < period - timedelta(hours=2):
            continue
        if not countries:
            results.append({"user": u["id"], "status": "no watched countries"})
            continue

        src = src or Sources()
        since = last or (now - period)
        sections, keys = [], []
        for code in countries:
            sec, k = build_country_section(src, src.to_iso3(code), since, ustate)
            if sec:
                sections.append(sec)
                keys += k

        if not sections:
            results.append({"user": u["id"], "status": "nothing new"})
            if not args.dry_run:
                ustate["lastSent"] = now.isoformat()
            continue

        label = {"daily": "Daily", "weekly": "Weekly"}.get(freq, "")
        subject = f"{label} watchlist digest: {len(sections)} of your countries had activity".strip()
        body = (f"Hello {u.get('displayName') or u.get('username')},\n\n"
                f"Here is what happened with the countries you follow since "
                f"{since.strftime('%d %B %Y')}.\n\n"
                + "\n\n".join(sections)
                + f"\n\n--\nManage your watchlist and digest settings: {SITE_URL}/account\n")

        if args.dry_run:
            print(f"To: {u['email']}\nSubject: {subject}\n\n{body}")
            results.append({"user": u["id"], "status": "dry-run", "sections": len(sections)})
            continue

        ok, err = send_email(u["email"], subject, body)
        if ok:
            ustate["lastSent"] = now.isoformat()
            ustate["lastError"] = None
            # keep the reported list bounded
            ustate["reported"] = (ustate.get("reported", []) + keys)[-5000:]
            results.append({"user": u["id"], "status": "sent", "sections": len(sections)})
        else:
            ustate["lastError"] = err
            results.append({"user": u["id"], "status": "error", "error": err})

    if not args.dry_run:
        tmp = STATE_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(state, f, indent=2)
        os.replace(tmp, STATE_FILE)

    print(json.dumps({"ran_at": now.isoformat(), "results": results}))
    if any(r["status"] == "error" for r in results) and args.user:
        sys.exit(2)


if __name__ == "__main__":
    main()

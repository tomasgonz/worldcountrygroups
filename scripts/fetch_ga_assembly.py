#!/usr/bin/env python3
"""
General Assembly committees and ECOSOC: bureaus (chairs), and press coverage.

  * Bureaus of the six Main Committees from their un.org pages (where readable).
  * Press releases on plenary, committee and ECOSOC meetings (UN Meetings Coverage, press.un.org),
    as indexed by Google News (press.un.org itself blocks automated access): headline, date, link.
    Each item is assigned to a body from its headline and summary.

Votes, meetings and members come from other files (un-votes, un-journal.json, un-elections.json).
Output: site/server/data/ga-assembly.json
"""
import html
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote
from urllib.request import Request, urlopen
from xml.etree import ElementTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_statements import build_country_map, compile_country_patterns, tag_countries  # noqa: E402

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "server", "data")
OUT = os.path.join(DATA, "ga-assembly.json")
UA = "Mozilla/5.0 (compatible; WorldCountryGroups/1.0; research)"
GN = "https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
log = lambda *a: print(*a, flush=True)  # noqa: E731

BODIES = [
    ("plenary", "General Assembly plenary", None, r"\bGeneral Assembly\b(?!.*\b(First|Second|Third|Fourth|Fifth|Sixth) Committee)", '"General Assembly" adopts OR plenary OR "General Assembly" debate'),
    ("first", "First Committee", "Disarmament and International Security", r"\bFirst Committee\b", '"First Committee" disarmament'),
    ("second", "Second Committee", "Economic and Financial", r"\bSecond Committee\b", '"Second Committee" economic financial'),
    ("third", "Third Committee", "Social, Humanitarian and Cultural", r"\bThird Committee\b", '"Third Committee" social humanitarian OR "human rights"'),
    ("fourth", "Fourth Committee", "Special Political and Decolonization", r"\bFourth Committee\b", '"Fourth Committee" decolonization OR "special political"'),
    ("fifth", "Fifth Committee", "Administrative and Budgetary", r"\bFifth Committee\b", '"Fifth Committee" budget'),
    ("sixth", "Sixth Committee", "Legal", r"\bSixth Committee\b", '"Sixth Committee" legal OR "international law"'),
    ("ecosoc", "Economic and Social Council", None, r"\bECOSOC\b|Economic and Social Council", '"Economic and Social Council" OR ECOSOC'),
]
OFFICIAL = re.compile(r"(^|\.)un\.org$")


def fetch(url, timeout=40):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={"User-Agent": UA}), timeout=timeout) as r:
                return r.read()
        except Exception:  # noqa: BLE001
            if attempt == 2:
                raise
            time.sleep(3 * (attempt + 1))


def text_of(page):
    page = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", page, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", page)))


def session_now(now):
    return now.year - 1945 if (now.month, now.day) >= (9, 9) else now.year - 1946


def bureau(cid, sess):
    paths = [f"https://www.un.org/en/ga/{cid}/{sess}/bureau.shtml", f"https://www.un.org/en/ga/{cid}/{sess}/bureau{sess}.shtml"]
    for u in paths:
        try:
            t = text_of(fetch(u).decode("utf-8", "replace"))
        except Exception:  # noqa: BLE001
            continue
        m = re.search(r"\bChair(?:person|man|woman)?\s+(?:H\.E\.\s+)?(?:(?:Mr|Ms|Mrs|Dr)\.?\s+)?([A-ZÀ-Ý][\w'’.\- ]{2,60}?)\s*\(([^)]+)\)", t)
        if m:
            return {"chair": m.group(1).strip(), "country": m.group(2).strip(), "url": u}
    return None


def news(now, first_run, prev_items):
    items = {re.sub(r"[^a-z0-9]+", " ", x["title"].lower())[:120]: x for x in prev_items}
    days, step = (120, 14) if first_run else (21, 7)
    end = now.date() + timedelta(days=1)
    windows = []
    while (now.date() - end).days < days:
        start = end - timedelta(days=step)
        windows.append((start.isoformat(), end.isoformat()))
        end = start
    for bid, _, _, title_re, q in BODIES:
        rx = re.compile(title_re, re.I)
        for a, b in windows:
            try:
                root = ElementTree.fromstring(fetch(GN.format(q=quote(f"{q} after:{a} before:{b}"))))
            except Exception as e:  # noqa: BLE001
                log(f"  ! {bid} {a}: {e}")
                continue
            for it in root.iter("item"):
                src = it.find("source")
                host = re.sub(r"^https?://(www\.)?", "", (src.get("url") if src is not None else "") or "").strip("/").lower()
                if not OFFICIAL.search(host):
                    continue
                name = (src.text or "").strip() if src is not None else ""
                title = (it.findtext("title") or "").strip().replace("’", "'")
                if name and title.endswith(" - " + name):
                    title = title[: -len(name) - 3]
                title = re.sub(r"\s+[-|–]\s+(UN Meetings Coverage and Press Releases|United Nations.*|UN News|Welcome to the United Nations)$", "", title).strip()
                # photo captions and web pages are not meeting coverage
                if re.match(r"^(Scene at|View of|Office of the President|LIVE:|Role of the General Assembly)", title) or re.search(r"\bAddresses \d+\w* Session of General Assembly Debate$", title):
                    continue
                if len(title) < 25 or not rx.search(title + " " + (it.findtext("description") or "")):
                    continue
                try:
                    d = parsedate_to_datetime(it.findtext("pubDate")).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                except Exception:  # noqa: BLE001
                    continue
                k = re.sub(r"[^a-z0-9]+", " ", title.lower())[:120]
                rec = items.get(k) or {"title": title, "url": (it.findtext("link") or "").strip(), "date": d, "outlet": name, "bodies": []}
                if bid not in rec["bodies"]:
                    rec["bodies"].append(bid)
                rec["date"] = min(rec["date"], d)
                items[k] = rec
            time.sleep(1.0)
    cutoff = (now - timedelta(days=365)).strftime("%Y-%m-%d")
    return sorted([x for x in items.values() if x["date"] >= cutoff], key=lambda x: x["date"], reverse=True)


def main():
    now = datetime.now(timezone.utc)
    sess = session_now(now)
    patterns = compile_country_patterns(build_country_map())
    try:
        with open(OUT) as f:
            prev = json.load(f)
    except Exception:  # noqa: BLE001
        prev = {}
    committees = []
    for bid, name, mandate, _, _ in BODIES:
        if bid in ("plenary", "ecosoc"):
            continue
        b = bureau(bid, sess) or next((c.get("bureau") for c in prev.get("committees", []) if c["id"] == bid), None)
        committees.append({"id": bid, "name": name, "mandate": mandate, "bureau": b,
                           "site": f"https://www.un.org/en/ga/{bid}/", "documentation": f"https://www.un.org/en/ga/{bid}/{sess}/documentation.shtml"})
        log(f"  {name}: chair {b['chair'] + ' (' + b['country'] + ')' if b else 'not found'}")
        time.sleep(0.8)
    items = news(now, not prev.get("_meta", {}).get("newsBackfilled"), prev.get("press", []))
    for x in items:
        x["countries"] = sorted(tag_countries(x["title"], patterns))
    log(f"  press items: {len(items)}")
    out = {"_meta": {"updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "session": sess, "newsBackfilled": True,
                     "source": "Committee pages on un.org; UN Meetings Coverage press releases as indexed by Google News"},
           "session": sess, "committees": committees, "press": items}
    with open(OUT + ".tmp", "w") as f:
        json.dump(out, f, ensure_ascii=False)
    os.replace(OUT + ".tmp", OUT)
    log(f"wrote {OUT}")


if __name__ == "__main__":
    main()

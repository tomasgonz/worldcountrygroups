#!/usr/bin/env python3
"""Keep the Elections page's news current.

Writes site/server/data/election-news.json with recent news for:
  council   the race for Security Council seats (general coverage and each
            declared candidate's campaign), from un-elections.json
  pga       the race for the next President of the General Assembly
  national  every national election in the next 90 days (and the last 14),
            from elections.json

Sources: targeted Google News searches, plus matching items already in the
site's news archive (archive.db). (The Secretary-General race has its own news,
refreshed by fetch_sg_selection.py.)

Items are de-duplicated by link and title, newest first, last 30 days.
"""

import json
import os
import re
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA = os.environ.get("WCG_SITE_DATA") or os.path.join(ROOT, "site", "server", "data")
OUT = os.path.join(DATA, "election-news.json")
UA = "Mozilla/5.0 (compatible; WorldCountryGroups/1.0; +https://worldcountrygroups.exe.xyz)"
NOW = datetime.now(timezone.utc)
WINDOW_DAYS = 30
NATIONAL_WORDS = re.compile(r"\b(election|elections|electoral|vote|votes|voting|voters|polls?|polling|ballot|campaign|candidates?|candidacy|runoff|run-off|referendum|turnout|parliamentary|presidential)\b", re.I)
ELECTION_WORDS = re.compile(r"\b(election|elections|electoral|vote|votes|voting|voters|polls?|ballot|campaign|candidate|candidates|candidacy|runoff|run-off|referendum|bid|seat)\b", re.I)


def load(name, default=None):
    try:
        with open(os.path.join(DATA, name)) as f:
            return json.load(f)
    except Exception:
        return default


def gnews(query, days=14, limit=12):
    q = f"{query} when:{days}d"
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": q, "hl": "en-US", "gl": "US", "ceid": "US:en"})
    time.sleep(1.0)  # be gentle with the search service
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=25) as r:
            root = ET.fromstring(r.read())
    except Exception as e:
        print(f"  search failed ({query[:60]}): {e}", file=sys.stderr)
        return []
    out = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        outlet = (it.findtext("source") or "").strip()
        if " - " in title:
            head, tail = title.rsplit(" - ", 1)
            if len(tail) <= 80 and len(head) >= 12:
                title, outlet = head.strip(), outlet or tail.strip()
        try:
            date = parsedate_to_datetime(it.findtext("pubDate") or "").astimezone(timezone.utc)
        except Exception:
            continue  # undated items are skipped rather than stamped "now"
        out.append({"title": title, "url": (it.findtext("link") or "").strip(), "outlet": outlet,
                    "date": date.isoformat(timespec="seconds").replace("+00:00", "Z"), "via": "search"})
        if len(out) >= limit:
            break
    return out


def archive(iso3=None, words=None, days=14, limit=12, require_election=True):
    path = os.path.join(DATA, "archive.db")
    if not os.path.exists(path):
        return []
    since = (NOW - timedelta(days=days)).strftime("%Y-%m-%d")
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    sql = "SELECT i.title, i.url, i.outlet, i.published_at, i.kind FROM items i"
    params = []
    where = ["i.day >= ?"]
    params.append(since)
    if iso3:
        sql += " JOIN item_countries c ON c.item_id = i.id"
        where.append("c.iso3 = ?")
        params.append(iso3)
    for w in words or []:
        where.append("(i.title || ' ' || i.summary) LIKE ?")
        params.append(f"%{w}%")
    rows = con.execute(f"{sql} WHERE {' AND '.join(where)} ORDER BY i.published_at DESC LIMIT 200", params).fetchall()
    con.close()
    out = []
    for title, url, outlet, pub, kind in rows:
        if require_election and not ELECTION_WORDS.search(title or ""):
            continue
        out.append({"title": title, "url": url, "outlet": outlet, "date": pub, "via": "official" if kind == "statement" else "archive"})
        if len(out) >= limit:
            break
    return out


ADJ = {"France": "French", "Spain": "Spanish", "Switzerland": "Swiss", "Netherlands": "Dutch", "United Kingdom": "British",
       "Germany": "German", "Czechia": "Czech", "Czech Republic": "Czech", "Philippines": "Filipino|Philippine", "Côte d'Ivoire": "Ivorian|Ivory Coast",
       "São Tomé and Príncipe": "Sao Tome|São Tomé", "Bosnia and Herzegovina": "Bosnia|Bosnian", "Korea, Rep.": "South Korea|Korean",
       "United States": "US |U\\.S\\.|American", "Kyrgyz Republic": "Kyrgyz", "Viet Nam": "Vietnam", "Türkiye": "Turkey|Turkish"}
BID = re.compile(r"seat|bid|candidac|candidature|campaign|elect|non-permanent|vot", re.I)


def names_country(title, name):
    """Does the headline name the country (or use its adjective)?"""
    parts = [re.escape(name.split(",")[0])] + [w for w in ADJ.get(name, "").split("|") if w]
    stem = re.sub(r"[^A-Za-z]", "", name)[:5]
    if len(stem) >= 5:
        parts.append(stem)  # Brazil -> Brazilian, Morocco -> Moroccan
    return re.search("|".join(parts), title or "", re.I) is not None


def backs_other(title, name):
    """'Slovakia backs India's bid': about another country's campaign."""
    m = re.search(r"\b(?:backs?|supports?|endorses?)\s+([A-Z][\w ]+?)['’]s\b", title or "")
    return bool(m) and not names_country(m.group(1), name)


def norm(t):
    return re.sub(r"[^a-z0-9 ]", "", (t or "").lower())[:80]


def merge(*lists, limit=20):
    seen_url, seen_title, out = set(), set(), []
    cutoff = (NOW - timedelta(days=WINDOW_DAYS)).isoformat()
    for it in sorted([x for l in lists for x in l], key=lambda x: x.get("date") or "", reverse=True):
        if (it.get("date") or "") < cutoff[:19]:
            continue
        k = norm(it["title"])
        if it["url"] in seen_url or k in seen_title:
            continue
        seen_url.add(it["url"])
        seen_title.add(k)
        out.append(it)
        if len(out) >= limit:
            break
    return out


def council_news():
    u = load("un-elections.json", {}) or {}
    ne = (u.get("security_council") or {}).get("next_election") or {}
    year = ne.get("year") or NOW.year + 1
    general = gnews(f'"Security Council" (election OR seat OR bid OR candidacy OR "non-permanent") {year}', days=30)
    general += archive(words=["Security Council"], days=30, limit=15)
    general = [x for x in general if re.search(r"seat|bid|candidac|elect|non-permanent|campaign", x["title"], re.I)
               and not re.search(r"(?<!non-)permanent|veto|reform", x["title"], re.I)]
    by_country = {}
    for group, cands in (ne.get("candidates") or {}).items():
        for c in cands:
            if c.get("withdrawn"):
                continue
            items = gnews(f'"{c["name"]}" "Security Council" (seat OR bid OR candidacy OR candidature OR campaign)', days=30, limit=12)
            items += archive(c["iso3"], ["Security Council"], days=30, limit=12, require_election=False)
            # about this country's own campaign for a seat (not, say, a Council briefing on it)
            items = [x for x in items if names_country(x["title"], c["name"]) and BID.search(x["title"])
                     and not re.search(r"(?<!non-)permanent|UNSC reform|reform of the|expansion|brief", x["title"], re.I)
                     and not backs_other(x["title"], c["name"])]
            by_country[c["iso3"]] = {"name": c["name"], "group": group, "items": merge(items, limit=8)}
    return {"year": year, "general": merge(general, limit=15), "candidates": by_country}


def pga_news():
    u = load("un-elections.json", {}) or {}
    nxt = (u.get("pga") or {}).get("next") or {}
    session = nxt.get("session") or ""
    items = gnews(f'"President of the General Assembly" ({session}th OR "{session}th session" OR candidate OR candidacy OR elected OR election)', days=30)
    items += gnews(f'"President of the UN General Assembly" (candidate OR candidacy OR nominate OR elected)', days=30)
    items += archive(words=["President of the General Assembly"], days=30, limit=10, require_election=False)
    items += archive(words=["PGA"], days=30, limit=10, require_election=False)
    # about the Assembly presidency itself, not the Secretary-General race
    items = [x for x in items if re.search(r"President of the (UN )?General Assembly|General Assembly President|\bPGA\b", x["title"], re.I)
             and not re.search(r"Secretary-General|Secretary General|Guterres", x["title"], re.I)]
    keep = [x for x in items if re.search(r"candidat|elect|nominat|bid|successor|next president|8\dnd session", x["title"], re.I)]
    current = [x for x in items if x not in keep]
    return {"session": session, "group": nxt.get("group_label"), "race": merge(keep, limit=12), "current_president": merge(current, limit=8)}


def national_news():
    els = (load("elections.json", {}) or {}).get("elections", [])
    today = NOW.strftime("%Y-%m-%d")
    soon = (NOW + timedelta(days=90)).strftime("%Y-%m-%d")
    recent = (NOW - timedelta(days=14)).strftime("%Y-%m-%d")
    out = {}
    for e in els:
        d = e.get("sort_date") or e.get("date") or ""
        if not e.get("iso3") or e.get("territory") or not (recent <= d <= soon):
            continue
        if e.get("precision") == "year":
            continue
        key = e.get("id") or f"{e['iso3']}-{d}"
        kind = {"presidential": "presidential election", "parliamentary": "parliamentary election", "referendum": "referendum"}.get(e.get("type"), "election")
        items = gnews(f'"{e["country"]}" ({kind} OR election OR vote OR polls)', days=14, limit=10)
        items += archive(e["iso3"], days=14, limit=10)
        items = [x for x in items if names_country(x["title"], e["country"]) and NATIONAL_WORDS.search(x["title"])]
        out[key] = {"iso3": e["iso3"], "country": e["country"], "date": e.get("date"), "precision": e.get("precision"),
                    "description": e.get("description"), "type": e.get("type"), "items": merge(items, limit=8)}
    return out


def main():
    t0 = time.time()
    data = {
        "_meta": {"updated_at": NOW.isoformat(timespec="seconds").replace("+00:00", "Z"), "window_days": WINDOW_DAYS,
                  "sources": "Google News searches and the site's news archive"},
        "council": council_news(),
        "pga": pga_news(),
        "national": national_news(),
    }
    n_nat = sum(len(v["items"]) for v in data["national"].values())
    total = len(data["council"]["general"]) + sum(len(v["items"]) for v in data["council"]["candidates"].values()) + len(data["pga"]["race"]) + n_nat
    if total == 0:
        print("No election news found; keeping the previous file", file=sys.stderr)
        return 1
    tmp = OUT + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=1)
    os.replace(tmp, OUT)
    print(f"Election news: council {len(data['council']['general'])} + {len(data['council']['candidates'])} candidates, "
          f"PGA {len(data['pga']['race'])}, national {len(data['national'])} elections / {n_nat} items ({time.time() - t0:.0f}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

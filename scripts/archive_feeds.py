#!/usr/bin/env python3
"""Keep every news article and official statement permanently.

The live feeds (news-feed.json, statements-feed.json) only hold the most recent
items. This script copies each item, once, into site/server/data/archive.db so
history is never lost. The News page reads its trends from here, and the
full-text search index (build_search_index.py) indexes everything in it.

Tables
  items          one row per article or statement (id from the feed; also
                 de-duplicated by URL), with outlet, ownership, countries, topics
  item_countries (item_id, iso3, day, kind)   for fast per-country daily counts
  item_topics    (item_id, topic, day, kind)  for fast per-topic daily counts
  meta           bookkeeping

Topics come from site/server/data/news-topics.json, the same rules the News page
uses, so live and archived numbers agree.

Usage:
  archive_feeds.py            # add new items from the live feeds
  archive_feeds.py --retopic  # re-apply the topic rules to every archived item
"""

import argparse
import html
import json
import os
import re
import sqlite3
import sys
import time
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA = os.environ.get("WCG_SITE_DATA") or os.path.join(ROOT, "site", "server", "data")
DB = os.path.join(DATA, "archive.db")

OUTLET_OWNERSHIP = {  # publication names as Google News reports them; keep in step with news-analysis.ts
    "xinhua": "state-run (China)", "global times": "state-run (China)", "cgtn": "state-run (China)", "china daily": "state-run (China)",
    "tass": "state-run (Russia)", "rt": "state-run (Russia)", "sputnik": "state-run (Russia)", "presstv": "state-run (Iran)",
    "press tv": "state-run (Iran)", "irna": "state-run (Iran)", "anadolu agency": "state-run (Türkiye)", "trt world": "state-run (Türkiye)",
    "al jazeera": "state-funded (Qatar)", "saudi press agency": "state-run (Saudi Arabia)", "wam": "state-run (UAE)",
    "kcna": "state-run (North Korea)", "vietnamplus": "state-run (Viet Nam)", "bernama": "state-owned (Malaysia)",
    "antara news": "state-owned (Indonesia)", "philippine news agency": "state-run (Philippines)", "ahram online": "state-owned (Egypt)",
    "voice of america": "US government-funded", "radio free europe/radio liberty": "US government-funded",
    "france 24": "public broadcaster (France)", "dw": "publicly funded (Germany)", "bbc": "public broadcaster (UK)",
    "nhk world": "public broadcaster (Japan)", "yonhap news agency": "publicly funded (South Korea)",
}


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def load(name, default=None):
    try:
        with open(os.path.join(DATA, name)) as f:
            return json.load(f)
    except Exception:
        return default


def as_list(v):
    if isinstance(v, list):
        return v
    if isinstance(v, str) and v.startswith("["):
        try:
            return json.loads(v.replace("'", '"'))
        except Exception:
            return []
    return []


def clean(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = html.unescape(s.replace("&nbsp;", " "))
    return re.sub(r"\s+", " ", s).strip()


def topic_rules():
    t = (load("news-topics.json", {}) or {}).get("topics", [])
    return [(x["id"], re.compile(x["pattern"], re.IGNORECASE)) for x in t]


def classify(text, rules):
    return [tid for tid, rx in rules if rx.search(text)][:4]


def connect():
    con = sqlite3.connect(DB, timeout=60)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    con.executescript("""
    CREATE TABLE IF NOT EXISTS items(
      id TEXT PRIMARY KEY, kind TEXT, source TEXT, outlet TEXT, ownership TEXT, source_type TEXT,
      title TEXT, summary TEXT, url TEXT, published_at TEXT, day TEXT, first_seen TEXT,
      countries TEXT, topics TEXT, speaker TEXT, language TEXT, archived_at TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS items_url ON items(url) WHERE url <> '';
    CREATE INDEX IF NOT EXISTS items_day ON items(day, kind);
    CREATE TABLE IF NOT EXISTS item_countries(item_id TEXT, iso3 TEXT, day TEXT, kind TEXT, PRIMARY KEY(item_id, iso3));
    CREATE INDEX IF NOT EXISTS ic_day ON item_countries(day, kind, iso3);
    CREATE INDEX IF NOT EXISTS ic_iso ON item_countries(iso3, day);
    CREATE TABLE IF NOT EXISTS item_topics(item_id TEXT, topic TEXT, day TEXT, kind TEXT, PRIMARY KEY(item_id, topic));
    CREATE INDEX IF NOT EXISTS it_day ON item_topics(day, kind, topic);
    CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
    """)
    return con


def source_names():
    out = {}
    for f in ("news-config.json", "statements-config.json"):
        for s in (load(f, {}) or {}).get("sources", []):
            out[s["id"]] = {"name": re.sub(r" \(via Google News\)$", "", s.get("name") or s["id"]),
                            "ownership": s.get("ownership"), "country": s.get("country")}
    return out


def rows_from_feeds(rules):
    names = source_names()
    feeds = [("news", (load("news-feed.json", {}) or {}).get("articles", []), "description"),
             ("statement", (load("statements-feed.json", {}) or {}).get("statements", []), "excerpt")]
    for kind, items, desc_key in feeds:
        for x in items:
            if x.get("source") == "un-webtv-schedule" or not x.get("publishedAt") or not x.get("title"):
                continue
            title = clean(x["title"])
            summary = clean(x.get(desc_key) or "")
            if summary.lower().startswith(title.lower()[:40]):
                summary = ""
            meta = names.get(x.get("source"), {"name": x.get("source", ""), "ownership": None, "country": None})
            outlet = clean(x.get("outlet") or "") or meta["name"]
            ownership = x.get("sourceOwnership") or OUTLET_OWNERSHIP.get(outlet.lower()) or meta.get("ownership")
            countries = sorted(set(as_list(x.get("countries")) + ([x["country"]] if x.get("country") else [])))
            yield {
                "id": x.get("id") or f"{kind}:{x.get('url')}", "kind": kind, "source": x.get("source", ""), "outlet": outlet,
                "ownership": ownership, "source_type": x.get("sourceType") or ("official" if kind == "statement" else "news"),
                "title": title, "summary": summary[:600], "url": x.get("url") or "", "published_at": x["publishedAt"],
                "day": x["publishedAt"][:10], "first_seen": x.get("firstSeenAt") or now(),
                "countries": countries, "topics": classify(f"{title} {summary}", rules),
                "speaker": x.get("speaker") or "", "language": x.get("language") or "en",
            }


def write_links(cur, r):
    cur.execute("DELETE FROM item_countries WHERE item_id=?", (r["id"],))
    cur.execute("DELETE FROM item_topics WHERE item_id=?", (r["id"],))
    cur.executemany("INSERT OR IGNORE INTO item_countries VALUES(?,?,?,?)", [(r["id"], c, r["day"], r["kind"]) for c in r["countries"]])
    cur.executemany("INSERT OR IGNORE INTO item_topics VALUES(?,?,?,?)", [(r["id"], t, r["day"], r["kind"]) for t in r["topics"]])


def archive(con, rules):
    cur = con.cursor()
    added = updated = 0
    merged = {}
    for r in rows_from_feeds(rules):  # an item can sit in both feeds: keep one, with all its countries
        prev = merged.get(r["id"])
        if prev:
            prev["countries"] = sorted(set(prev["countries"]) | set(r["countries"]))
            if r["kind"] == "statement" and prev["kind"] != "statement":
                r["countries"] = prev["countries"]
                merged[r["id"]] = r
        else:
            merged[r["id"]] = r
    for r in merged.values():
        row = cur.execute("SELECT id, countries, outlet FROM items WHERE id=? OR (url<>'' AND url=?)", (r["id"], r["url"])).fetchone()
        if row is None:
            cur.execute("""INSERT INTO items(id, kind, source, outlet, ownership, source_type, title, summary, url, published_at, day,
                           first_seen, countries, topics, speaker, language, archived_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        (r["id"], r["kind"], r["source"], r["outlet"], r["ownership"], r["source_type"], r["title"], r["summary"], r["url"],
                         r["published_at"], r["day"], r["first_seen"], json.dumps(r["countries"]), json.dumps(r["topics"]),
                         r["speaker"], r["language"], now()))
            write_links(cur, r)
            added += 1
        else:
            # the feeds keep improving items (country tags, outlet names); carry that over
            if row[0] != r["id"]:
                continue  # same URL already archived under another feed id
            if json.dumps(r["countries"]) != row[1] or (r["outlet"] and r["outlet"] != row[2]):
                cur.execute("UPDATE items SET countries=?, outlet=?, ownership=COALESCE(?, ownership) WHERE id=?",
                            (json.dumps(r["countries"]), r["outlet"] or row[2], r["ownership"], r["id"]))
                write_links(cur, r)
                updated += 1
    con.commit()
    return added, updated


def retopic(con, rules):
    cur = con.cursor()
    n = 0
    for iid, title, summary, day, kind in cur.execute("SELECT id, title, summary, day, kind FROM items").fetchall():
        topics = classify(f"{title} {summary}", rules)
        cur.execute("UPDATE items SET topics=? WHERE id=?", (json.dumps(topics), iid))
        cur.execute("DELETE FROM item_topics WHERE item_id=?", (iid,))
        cur.executemany("INSERT OR IGNORE INTO item_topics VALUES(?,?,?,?)", [(iid, t, day, kind) for t in topics])
        n += 1
    con.commit()
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--retopic", action="store_true")
    args = ap.parse_args()
    t0 = time.time()
    rules = topic_rules()
    con = connect()
    if args.retopic:
        print(f"Re-applied topics to {retopic(con, rules)} items")
    added, updated = archive(con, rules)
    total, news = con.execute("SELECT COUNT(*), SUM(kind='news') FROM items").fetchone()
    first = con.execute("SELECT MIN(day) FROM items WHERE day >= '2026-01-01' OR archived_at < day").fetchone()[0]
    con.execute("INSERT OR REPLACE INTO meta VALUES('updated_at', ?)", (json.dumps(now()),))
    con.execute("INSERT OR REPLACE INTO meta VALUES('counts', ?)", (json.dumps({"items": total, "news": news, "statements": total - (news or 0), "first_day": first}),))
    con.commit()
    con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    con.close()
    print(f"Archive: +{added} new, {updated} updated; {total} items since {first} ({time.time() - t0:.1f}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

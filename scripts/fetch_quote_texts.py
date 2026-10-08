#!/usr/bin/env python3
"""
Quoted passages from the full text of recent UN News stories, for "What was said".

Reads the archive (archive.db) for UN News stories of the last few days, fetches each story once
(news.un.org allows it; the UN press site does not), and keeps every quoted passage of at least
eight words with the paragraph around it, so the speaker can be read from the text. Quotes are
stored verbatim.

Output: site/server/data/quote-texts.json  {url: {title, date, fetchedAt, quotes: [{q, context}]}}
"""
import html
import json
import os
import re
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError
from urllib.request import Request, urlopen

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "server", "data")
OUT = os.path.join(DATA, "quote-texts.json")
DAYS = 7
MAX_FETCH = 25
UA = "Mozilla/5.0 (compatible; WorldCountryGroups/1.0; research)"
QUOTE = re.compile(r"[“\"]([^“”\"]{40,600})[”\"]")


def paragraphs(page):
    page = re.sub(r"<(script|style|figure|figcaption)[^>]*>.*?</\1>", "", page, flags=re.S)
    out = []
    for p in re.findall(r"<p[^>]*>(.*?)</p>", page, re.S):
        t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", p))).strip()
        if len(t) > 40 and not re.match(r"^(©|Photo:|UN Photo|Facebook Twitter)", t):
            out.append(t)
    return out


def main():
    try:
        with open(OUT) as f:
            store = json.load(f)
    except Exception:  # noqa: BLE001
        store = {}
    since = (datetime.now(timezone.utc) - timedelta(days=DAYS)).date().isoformat()
    con = sqlite3.connect(f"file:{os.path.join(DATA, 'archive.db')}?mode=ro", uri=True)
    rows = con.execute("SELECT url, title, published_at FROM items WHERE day >= ? AND url LIKE 'https://news.un.org/%' ORDER BY published_at DESC", (since,)).fetchall()
    con.close()
    fetched = 0
    for url, title, date in rows:
        if (url in store and not store[url].get("error")) or fetched >= MAX_FETCH:
            continue
        try:
            with urlopen(Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en"}), timeout=30) as r:
                page = r.read().decode("utf-8", "replace")
        except HTTPError as e:
            if e.code in (403, 406, 429, 503):  # throttled: stop now and try again next run
                print(f"throttled ({e.code}); stopping")
                break
            store[url] = {"title": title, "date": date, "fetchedAt": datetime.now(timezone.utc).isoformat(), "error": str(e)[:120], "quotes": []}
            continue
        except Exception as e:  # noqa: BLE001
            print(f"  ! {url}: {e}")
            continue
        fetched += 1
        if "Client Challenge" in page:
            store[url] = {"title": title, "date": date, "fetchedAt": datetime.now(timezone.utc).isoformat(), "error": "challenge", "quotes": []}
            break
        paras = paragraphs(page)
        quotes = []
        for i, p in enumerate(paras):
            for m in QUOTE.finditer(p):
                q = m.group(1).strip().rstrip(",")
                if len(q.split()) < 8:
                    continue
                context = (paras[i - 1] + " " if i else "") + p
                quotes.append({"q": q, "context": context[:900]})
        store[url] = {"title": title, "date": date, "fetchedAt": datetime.now(timezone.utc).isoformat(), "quotes": quotes[:12]}
        time.sleep(4)
    # keep two weeks
    cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    store = {u: v for u, v in store.items() if (v.get("date") or v.get("fetchedAt") or "") >= cutoff}
    with open(OUT + ".tmp", "w") as f:
        json.dump(store, f, ensure_ascii=False)
    os.replace(OUT + ".tmp", OUT)
    print(f"stories fetched: {fetched}; stored {len(store)}; quotes {sum(len(v['quotes']) for v in store.values())}")


if __name__ == "__main__":
    main()

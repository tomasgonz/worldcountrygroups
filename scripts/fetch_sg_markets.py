#!/usr/bin/env python3
"""UN Secretary-General selection: what the prediction markets say.

Builds site/server/data/sg-markets.json from Polymarket's public APIs (no key, stdlib only):

  * Gamma API (gamma-api.polymarket.com): finds the open "next Secretary-General of the UN"
    events and reads each outcome's best bid, best ask, last trade, volume and price change.
  * CLOB API (clob.polymarket.com/prices-history): the price history of each outcome, every 12 h
    since the market opened.

Polymarket can list the same question more than once. Events with less than MIN_LIQUIDITY dollars
on their order books are not shown (their prices are a handful of stray orders); they are named in
_meta.skipped. The price is the midpoint of the best bid and best ask, as in Polymarket's price
history. Polymarket's site shows the last trade instead when the two are more than 10 points apart,
but on a thin book one $3 trade then moves the figure by 30 points; such outcomes are flagged
"thin" and keep their bid, ask and last trade.

Market names are matched to the official candidates and "also mentioned" names in
sg-selection.json, so the page can tie a price to a candidate.

Every run also appends a snapshot (price, bid, ask per outcome) to the file, so the site keeps its
own record of the market at the time of each straw poll, independent of Polymarket's history.

The output is written atomically. If Polymarket cannot be read, the previous file is left
untouched and the script exits 1.
"""

import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA_DIR = os.path.join(ROOT, "site", "server", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "sg-markets.json")
SG_FILE = os.path.join(DATA_DIR, "sg-selection.json")

UA = "WorldCountryGroups/1.0 (+https://worldcountrygroups.exe.xyz)"
GAMMA = "https://gamma-api.polymarket.com"
CLOB = "https://clob.polymarket.com"
EVENT_URL = "https://polymarket.com/event/"
SEARCH_TERMS = ["Secretary-General of the United Nations", "Secretary-General of the UN"]
KNOWN_SLUGS = ["next-secretary-general-of-the-united-nations"]  # found 2026-10-22; searched for as well
TITLE_RE = re.compile(r"secretary[- ]general of the (un|united nations)\b", re.I)

MIN_LIQUIDITY = 10_000      # dollars on the order books for an event to be shown
THIN_SPREAD = 0.10          # a bid-ask gap above this marks a thin price
HISTORY_FIDELITY = 720      # minutes between history points (12 h)
MAX_SNAPSHOTS = 24 * 120    # hourly runs: about four months

# Market name -> our id, for names the matching below cannot pair on its own.
ALIASES = {}


def log(*a):
    print(*a, flush=True)


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def get_json(url, tries=3, timeout=30):
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"{url}: {type(last).__name__}: {last}")


def num(v):
    try:
        return None if v is None or v == "" else float(v)
    except (TypeError, ValueError):
        return None


def fold(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn").lower()
    return re.sub(r"\s+", " ", re.sub(r"[-.'’]", " ", s)).strip()


# ---------------------------------------------------------------------------- names

def load_people():
    """Official candidates and "also mentioned" names from sg-selection.json, for matching."""
    try:
        with open(SG_FILE, encoding="utf-8") as f:
            sg = json.load(f)
    except Exception as e:  # noqa: BLE001
        log(f"sg-selection.json not readable ({e}); market names stay unmatched")
        return []
    people = []
    for c in sg.get("candidates", []):
        people.append({"id": c["id"], "name": c["name"], "kind": "candidate", "status": c.get("status"),
                       "names": [c.get("name"), c.get("official_name")]})
    for m in sg.get("also_mentioned", []):
        people.append({"id": m["id"], "name": m["name"], "kind": "mentioned", "status": m.get("status"),
                       "names": [m.get("name")]})
    return people


def match_person(market_name, people):
    """Same full name, or same first name and the market's surname among the person's names."""
    if market_name in ALIASES:
        return next((p for p in people if p["id"] == ALIASES[market_name]), None)
    mt = fold(market_name).split()
    if not mt:
        return None
    for exact in (True, False):
        for p in people:
            for n in filter(None, p["names"]):
                pt = fold(n).split()
                if not pt:
                    continue
                if exact and pt == mt:
                    return p
                if not exact and pt[0] == mt[0] and (mt[-1] in pt or pt[-1] in mt):
                    return p
    return None


# ---------------------------------------------------------------------------- Polymarket

def find_events():
    """Open events asking who the next UN Secretary-General will be."""
    slugs = list(KNOWN_SLUGS)
    for term in SEARCH_TERMS:
        q = urllib.parse.urlencode({"q": term, "limit_per_type": 20, "events_status": "active"})
        try:
            res = get_json(f"{GAMMA}/public-search?{q}")
        except RuntimeError as e:
            log(f"search '{term}' failed: {e}")
            continue
        for e in res.get("events") or []:
            if TITLE_RE.search(e.get("title") or "") and not e.get("closed") and e.get("slug") not in slugs:
                slugs.append(e["slug"])
    events = []
    for slug in slugs:
        res = get_json(f"{GAMMA}/events?slug={urllib.parse.quote(slug)}")
        if res and not res[0].get("closed"):
            events.append(res[0])
    return events


def price_history(token_id):
    q = urllib.parse.urlencode({"market": token_id, "interval": "max", "fidelity": HISTORY_FIDELITY})
    try:
        res = get_json(f"{CLOB}/prices-history?{q}")
    except RuntimeError as e:
        log(f"history failed for {token_id[:12]}…: {e}")
        return []
    return [[int(x["t"]), round(float(x["p"]), 4)] for x in res.get("history") or [] if "t" in x and "p" in x]


def read_outcome(m, people, event_slug):
    """One person's Yes market, or None for placeholders ("Person X", "Other") and dead outcomes."""
    name = (m.get("groupItemTitle") or "").strip()
    if not name or m.get("closed") or not m.get("active") or m.get("negRiskOther"):
        return None
    volume = num(m.get("volumeNum") if m.get("volumeNum") is not None else m.get("volume")) or 0.0
    if volume <= 0:
        return None
    bid, ask, last = num(m.get("bestBid")), num(m.get("bestAsk")), num(m.get("lastTradePrice"))
    spread = round(ask - bid, 4) if bid is not None and ask is not None else None
    price = round((bid + ask) / 2, 4) if spread is not None else last
    if price is None:
        return None
    try:
        token = json.loads(m.get("clobTokenIds") or "[]")[0]
    except (ValueError, IndexError):
        token = None
    p = match_person(name, people)
    if p is None:
        race = None
    elif p["kind"] == "candidate":
        race = {"nominated": "candidate"}.get(p["status"], p["status"])  # candidate / withdrawn / selected
    else:
        race = "mentioned"
    return {
        "name": p["name"] if p else name,
        "market_name": name,
        "person_id": p["id"] if p else None,
        "race_status": race,
        "price": round(price, 4),
        "bid": bid, "ask": ask, "last": last, "spread": spread,
        "thin": spread is None or spread > THIN_SPREAD,
        "change_1d": num(m.get("oneDayPriceChange")),
        "change_1w": num(m.get("oneWeekPriceChange")),
        "volume": round(volume),
        "volume_24h": round(num(m.get("volume24hr")) or 0),
        "url": f"{EVENT_URL}{event_slug}/{m.get('slug') or ''}",
        "token_id": token,
        "history": [],
    }


def read_event(e, people):
    out = []
    for m in e.get("markets") or []:
        o = read_outcome(m, people, e["slug"])
        if o:
            out.append(o)
    out.sort(key=lambda o: -o["price"])
    return {
        "source": "Polymarket",
        "slug": e["slug"],
        "title": e.get("title"),
        "url": EVENT_URL + e["slug"],
        "opened": (e.get("startDate") or "")[:10] or None,
        "closes": (e.get("endDate") or "")[:10] or None,
        "volume": round(num(e.get("volume")) or 0),
        "volume_24h": round(num(e.get("volume24hr")) or 0),
        "liquidity": round(num(e.get("liquidity")) or 0),
        "open_interest": round(num(e.get("openInterest")) or 0),
        "price_sum": round(sum(o["price"] for o in out), 4),
        "outcomes": out,
    }


# ---------------------------------------------------------------------------- main

def load_previous():
    try:
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return {}


def main():
    people = load_people()
    prev = load_previous()
    try:
        events = find_events()
    except RuntimeError as e:
        sys.exit(f"Polymarket could not be read ({e}); {OUTPUT_FILE} left unchanged.")
    if not events:
        sys.exit(f"Polymarket lists no open event on the next Secretary-General; {OUTPUT_FILE} left unchanged.")

    markets, skipped = [], []
    for e in events:
        ev = read_event(e, people)
        if ev["liquidity"] < MIN_LIQUIDITY or not ev["outcomes"]:
            skipped.append({"title": ev["title"], "url": ev["url"], "liquidity": ev["liquidity"], "volume": ev["volume"],
                            "reason": f"only ${ev['liquidity']:,} on its order books (shown from ${MIN_LIQUIDITY:,})"})
            continue
        markets.append(ev)
    markets.sort(key=lambda m: -m["liquidity"])
    if not markets:
        sys.exit(f"No Secretary-General market has ${MIN_LIQUIDITY:,} of liquidity; {OUTPUT_FILE} left unchanged.")

    for ev in markets:
        for o in ev["outcomes"]:
            if o["token_id"]:
                o["history"] = price_history(o["token_id"])

    unmatched = [o["market_name"] for ev in markets for o in ev["outcomes"] if not o["person_id"]]
    at = now_iso()
    main_ev = markets[0]
    snapshots = (prev.get("snapshots") or []) + [{
        "at": at,
        "slug": main_ev["slug"],
        "prices": {(o["person_id"] or o["market_name"]): [o["price"], o["bid"], o["ask"]] for o in main_ev["outcomes"]},
    }]
    out = {
        "_meta": {
            "updated_at": at,
            "sources": [{"name": f"Polymarket: {ev['title']}", "url": ev["url"]} for ev in markets],
            "skipped": skipped,
            "unmatched": unmatched,
            "notes": [
                "Polymarket is a real-money prediction market. A price of 12¢ on a person means traders, on balance, "
                "put roughly a 12% chance on that person becoming Secretary-General.",
                f"Price shown: the midpoint of the best bid and best ask. Where they are more than "
                f"{THIN_SPREAD * 100:.0f} points apart the price is marked thin: few orders, and a small trade can move it.",
                "The market resolves on who is appointed, not on straw polls. It is not a poll of Council members.",
            ],
        },
        "markets": markets,
        "snapshots": snapshots[-MAX_SNAPSHOTS:],
    }
    tmp = OUTPUT_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUTPUT_FILE)
    top = ", ".join(f"{o['name']} {o['price']:.0%}{' (thin)' if o['thin'] else ''}" for o in main_ev["outcomes"][:5])
    log(f"wrote {OUTPUT_FILE}: {len(markets)} market(s), {len(skipped)} skipped; {top}"
        + (f"; unmatched: {', '.join(unmatched)}" if unmatched else ""))


if __name__ == "__main__":
    main()

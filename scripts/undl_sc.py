#!/usr/bin/env python3
"""
Security Council votes from the UN Digital Library (with the site's API key), and their merge
into unsc-votes.json.

  python3 scripts/undl_sc.py          fetch new Council voting records, then merge
  python3 scripts/undl_sc.py --full   fetch the whole history again (first run does this anyway)

unsc-votes.json (scripts/fetch_unsc.py, from the Library's meeting tables) has official tallies
but member-by-member votes only where every member voted alike. The Digital Library's voting
records give each member's vote (MARC 967: $c ISO3, $b P/R permanent or elected, $d Y/N/A,
blank = did not vote) and the totals (996). The merge fills in missing member votes, adds
abstentions and non-participation, checks them against the tallies already held, and adds
Council votes the meeting tables lack (1995 onwards). fetch_unsc.py calls merge() too, so
whichever runs last leaves the file merged.
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from xml.etree import ElementTree

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "site", "server", "data")
CFG = os.path.join(DATA, "undl-config.json")
STORE = os.path.join(DATA, "undl-sc-votes.json")
UNSC = os.path.join(DATA, "unsc-votes.json")
SEARCH = "https://digitallibrary.un.org/search"
NS = {"m": "http://www.loc.gov/MARC21/slim"}
PAGE = 50
log = lambda *a: print(*a, flush=True)  # noqa: E731


def fields(rec):
    out = {}
    for cf in rec.findall("m:controlfield", NS):
        out[cf.get("tag")] = cf.text
    for df in rec.findall("m:datafield", NS):
        out.setdefault(df.get("tag"), []).append({sf.get("code"): (sf.text or "") for sf in df.findall("m:subfield", NS)})
    return out


def first(f, tag, code):
    for d in f.get(tag) or []:
        if d.get(code):
            return d[code]
    return ""


def parse(f):
    votes, members = {}, {}
    for v in f.get("967") or []:
        c = (v.get("c") or "").strip().upper()
        if not c:
            continue
        d = (v.get("d") or "").strip().upper()
        votes[c] = d if d in ("Y", "N", "A") else "X"
        members[c] = "permanent" if v.get("b") == "P" else "elected"
    if not votes:
        return None
    t = (f.get("996") or [{}])[0]
    num = lambda x: int(float(x)) if x not in (None, "") else None  # noqa: E731
    symbol = first(f, "791", "a")
    draft = first(f, "993", "a")
    adopted = symbol.startswith("S/RES/")
    vetoed = (not adopted) and any(votes[c] == "N" and members[c] == "permanent" for c in votes)
    return {
        "undl_id": f.get("001"), "symbol": symbol, "draft": draft, "date": first(f, "992", "a"), "title": first(f, "245", "a"),
        "meeting": first(f, "952", "a"), "agenda": first(f, "991", "c"), "votes": votes, "permanent": sorted(c for c in members if members[c] == "permanent"),
        "tally": {"yes": num(t.get("b")), "no": num(t.get("c")), "abstain": num(t.get("d")), "not_voting": num(t.get("e"))},
        "adopted": adopted, "vetoed": vetoed,
    }


def fetch(full):
    with open(CFG) as fh:
        k = json.load(fh).get("key")
    if not k:
        raise SystemExit("No UN Digital Library API key saved (Admin → Data)")
    try:
        with open(STORE) as fh:
            store = json.load(fh)
    except Exception:  # noqa: BLE001
        store = {"_meta": {}, "records": {}}
    full = full or not store.get("_meta", {}).get("by_year")
    known = {r["undl_id"] for r in store["records"].values()}
    added = 0
    # the search stops paging at about 1,000 results, so ask one year at a time
    this_year = datetime.now(timezone.utc).year
    years = range(1946, this_year + 1) if full else range(this_year - 1, this_year + 1)
    for year in years:
        got = 0
        for page in range(10):
            q = {"cc": "Voting Data", "p": f'981__a:"Security Council" and 992__a:{year}*', "rg": 100, "jrec": 1 + page * 100, "of": "xm", "sf": "latest first", "so": "d"}
            for attempt in range(4):
                try:
                    req = Request(f"{SEARCH}?{urlencode(q)}", headers={"Authorization": f"Token {k}", "User-Agent": "WorldCountryGroups/1.0 (research; voting data)"})
                    with urlopen(req, timeout=120) as r:
                        body = r.read()
                    if not body.lstrip().startswith(b"<?xml"):
                        raise RuntimeError("not XML (the key may have expired)")
                    root = ElementTree.fromstring(body)
                    break
                except Exception as e:  # noqa: BLE001
                    if attempt == 3:
                        raise
                    log(f"  retry: {e}")
                    time.sleep(10 * (attempt + 1))
            recs = root.findall("m:record", NS)
            for rec in recs:
                p = parse(fields(rec))
                if not p or not p["undl_id"]:
                    continue
                key = p["symbol"] or p["draft"] or p["undl_id"]
                if p["undl_id"] not in known:
                    added += 1
                    known.add(p["undl_id"])
                store["records"][key] = p
                got += 1
            time.sleep(2)
            if len(recs) < 100:
                break
        if got:
            log(f"  {year}: {got} voting records")
    store["_meta"] = {"updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "records": len(store["records"]), "by_year": True,
                      "source": "UN Digital Library, Voting Data collection (Security Council), MARC 967/996"}
    with open(STORE + ".tmp", "w") as fh:
        json.dump(store, fh, ensure_ascii=False)
    os.replace(STORE + ".tmp", STORE)
    log(f"Council voting records: {len(store['records'])} stored, {added} new")
    return store


def merge(unsc=None, store=None, write=True):
    """Fill member votes in unsc-votes.json from the Digital Library records; returns a short report."""
    if store is None:
        try:
            with open(STORE) as fh:
                store = json.load(fh)
        except Exception:  # noqa: BLE001
            return {"merged": 0, "note": "no Digital Library Council records yet"}
    own = unsc is None
    if own:
        with open(UNSC) as fh:
            unsc = json.load(fh)
    recs = store.get("records", {})
    by_symbol = {}
    for r in recs.values():
        for s in (r.get("symbol"), r.get("draft")):
            if s:
                by_symbol[s.replace(" ", "")] = r
    filled, checked, mismatches, added = 0, 0, [], 0
    seen = set()
    for res in unsc.get("resolutions", []):
        r = by_symbol.get(res["id"].replace(" ", ""))
        if not r:
            continue
        seen.add(r["undl_id"])
        checked += 1
        t, mine = r["tally"], res.get("tally") or {}
        counted = {k: sum(1 for v in r["votes"].values() if v == c) for k, c in (("yes", "Y"), ("no", "N"), ("abstain", "A"))}
        if mine and any(mine.get(k) is not None and counted[k] != mine.get(k) for k in counted):
            mismatches.append({"id": res["id"], "tally": mine, "library": counted})
            continue  # keep the official tally and leave member votes as they were
        if not res.get("votes_complete") or len(res.get("votes") or {}) < len(r["votes"]):
            res["votes"] = dict(r["votes"])
            res["votes_complete"] = True
            res["votes_source"] = "UN Digital Library"
            filled += 1
        res.setdefault("undl_link", f"https://digitallibrary.un.org/record/{r['undl_id']}")
    # Council votes the meeting tables do not have (same period as the file)
    first_year = min((x["date"][:4] for x in unsc.get("resolutions", []) if x.get("date")), default="1995")
    for r in recs.values():
        if r["undl_id"] in seen or not r.get("date") or r["date"][:4] < first_year:
            continue
        sid = r["symbol"] or r["draft"]
        if not sid or any(x["id"].replace(" ", "") == sid.replace(" ", "") for x in unsc["resolutions"]):
            continue
        counted = {k: sum(1 for v in r["votes"].values() if v == c) for k, c in (("yes", "Y"), ("no", "N"), ("abstain", "A"))}
        unsc["resolutions"].append({"id": sid, "date": r["date"], "title": r.get("agenda") or r["title"], "adopted": r["adopted"], "vetoed": r["vetoed"],
                                    "tally": counted, "votes": r["votes"], "votes_complete": True, "votes_source": "UN Digital Library",
                                    "meeting": r.get("meeting"), "press_release": None, "undl_link": f"https://digitallibrary.un.org/record/{r['undl_id']}"})
        added += 1
    unsc["resolutions"].sort(key=lambda x: x.get("date") or "", reverse=True)
    meta = unsc.setdefault("_meta", {})
    meta["total_resolutions"] = len(unsc["resolutions"])
    meta["member_votes"] = "Per-member votes from the Library's meeting tables where all members voted alike, and from the UN Digital Library voting records otherwise (votes_source)."
    meta["undl_merge"] = {"at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "matched": checked, "filled": filled, "added": added, "tally_mismatches": len(mismatches)}
    if own and write:
        with open(UNSC + ".tmp", "w") as fh:
            json.dump(unsc, fh, indent=2, ensure_ascii=False)
        os.replace(UNSC + ".tmp", UNSC)
    return {"matched": checked, "filled": filled, "added": added, "mismatches": mismatches[:10]}


if __name__ == "__main__":
    st = fetch("--full" in sys.argv)
    rep = merge(store=st)
    log(f"merge: matched {rep['matched']}, member votes filled {rep['filled']}, added {rep['added']}, tally mismatches {len(rep.get('mismatches', []))}")
    for m in rep.get("mismatches", [])[:5]:
        log("  mismatch", m)

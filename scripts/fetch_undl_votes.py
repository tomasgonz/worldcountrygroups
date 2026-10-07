#!/usr/bin/env python3
"""
New General Assembly recorded votes from the UN Digital Library, with the site's API key.

Reads the newest voting file in scripts/data (*ga_voting*.csv[.gz]), asks the Digital Library
(MARCXML search, collection "Voting Data", newest first) for records it does not have yet, checks
each country's vote against the official totals, and writes an updated file in the same format
(YYYY_MM_DD_ga_voting.csv.gz), then asks the site to import it.

MARC fields used: 001 record id, 791 symbol/session, 992 date, 245 title, 952 meeting, 993 draft,
991 agenda/subject, 981 body, 967 votes ($c ISO3, $e name, $d Y/N/A, blank = not voting),
996 totals ($b yes, $c no, $d abstain, $e not voting, $f members).
"""
import csv
import glob
import gzip
import io
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from xml.etree import ElementTree

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "scripts", "data")
CFG = os.path.join(ROOT, "site", "server", "data", "undl-config.json")
STATUS = os.path.join(ROOT, "site", "server", "data", "undl-votes-status.json")
SEARCH = "https://digitallibrary.un.org/search"
NS = {"m": "http://www.loc.gov/MARC21/slim"}
COLS = ["undl_id", "ms_code", "ms_name", "ms_vote", "date", "session", "resolution", "draft", "committee_report", "meeting", "title",
        "agenda_title", "subjects", "vote_note", "total_yes", "total_no", "total_abstentions", "total_non_voting", "total_ms", "undl_link"]
PAGE = 50
MAX_PAGES = 40
log = lambda *a: print(*a, flush=True)  # noqa: E731


def key():
    with open(CFG) as f:
        k = json.load(f).get("key")
    if not k:
        raise SystemExit("No UN Digital Library API key saved (Admin → Data)")
    return k


def fetch_page(k, start):
    q = {"cc": "Voting Data", "rg": PAGE, "jrec": start, "of": "xm", "sf": "latest first", "so": "d"}
    for attempt in range(4):
        try:
            req = Request(f"{SEARCH}?{urlencode(q)}", headers={"Authorization": f"Token {k}", "User-Agent": "WorldCountryGroups/1.0 (research; voting data)"})
            with urlopen(req, timeout=90) as r:
                body = r.read()
                if r.status != 200 or not body.strip().startswith(b"<?xml"):
                    raise RuntimeError(f"HTTP {r.status}, not XML (the key may have expired)")
                return ElementTree.fromstring(body)
        except Exception as e:  # noqa: BLE001
            if attempt == 3:
                raise
            log(f"  retry after error: {e}")
            time.sleep(10 * (attempt + 1))


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


def rows_for(f):
    """CSV rows for one recorded General Assembly vote, or None (Council, without vote, incomplete)."""
    if not any((d.get("a") or "").startswith("General Assembly") for d in f.get("981") or []):
        return None, "not the General Assembly"
    votes = f.get("967") or []
    if not votes:
        return None, "no recorded vote"
    t = (f.get("996") or [{}])[0]
    tot = {k: t.get(c) for k, c in (("yes", "b"), ("no", "c"), ("abstain", "d"), ("absent", "e"), ("members", "f"))}
    counted = {"Y": 0, "N": 0, "A": 0}
    rows = []
    rid = f.get("001")
    title = " ".join(x for x in (first(f, "245", "a"), first(f, "245", "b"), first(f, "245", "c")) if x).strip()
    for v in votes:
        vote = (v.get("d") or "").strip().upper() or "X"
        if vote in counted:
            counted[vote] += 1
        rows.append({
            "undl_id": rid, "ms_code": v.get("c", ""), "ms_name": v.get("e", ""), "ms_vote": vote if vote in ("Y", "N", "A") else "X",
            "date": first(f, "992", "a"), "session": first(f, "791", "c"), "resolution": first(f, "791", "a"), "draft": first(f, "993", "a"),
            "committee_report": "", "meeting": first(f, "952", "a"), "title": title, "agenda_title": first(f, "991", "c"),
            "subjects": "|".join(d.get("d") for d in f.get("991") or [] if d.get("d")), "vote_note": first(f, "590", "a") if first(f, "590", "a") not in ("Vote", "") else "",
            "total_yes": f"{float(tot['yes'])}" if tot["yes"] else "", "total_no": f"{float(tot['no'])}" if tot["no"] else "",
            "total_abstentions": f"{float(tot['abstain'])}" if tot["abstain"] else "", "total_non_voting": f"{float(tot['absent'])}" if tot["absent"] else "",
            "total_ms": f"{float(tot['members'])}" if tot["members"] else "", "undl_link": f"https://digitallibrary.un.org/record/{rid}",
        })
    check = all(tot[k] is None or int(float(tot[k])) == counted[v] for k, v in (("yes", "Y"), ("no", "N"), ("abstain", "A")))
    return rows, ("ok" if check else f"totals differ: record {tot}, counted {counted}")


def main():
    k = key()
    files = sorted(glob.glob(os.path.join(DATA, "*ga_voting*.csv*")))
    if not files:
        raise SystemExit("No base voting file in scripts/data")
    base = files[-1]
    opener = gzip.open if base.endswith(".gz") else open
    with opener(base, "rt", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    have = {r["undl_id"] for r in rows}
    max_id = max(int(r["undl_id"]) for r in rows if r["undl_id"].isdigit())
    log(f"base {os.path.basename(base)}: {len(have)} votes, newest record {max_id}")

    added, skipped, mismatches, sc = [], {}, [], 0
    for page in range(MAX_PAGES):
        root = fetch_page(k, 1 + page * PAGE)
        recs = root.findall("m:record", NS)
        if not recs:
            break
        newer_on_page = 0
        for rec in recs:
            f = fields(rec)
            rid = f.get("001") or ""
            if not rid.isdigit():
                continue
            if int(rid) > max_id:
                newer_on_page += 1
            if rid in have:
                continue
            new_rows, why = rows_for(f)
            if new_rows is None:
                skipped[why] = skipped.get(why, 0) + 1
                if why == "not the General Assembly" and f.get("967"):
                    sc += 1
                continue
            if why != "ok":
                mismatches.append({"id": rid, "symbol": new_rows[0]["resolution"], "detail": why})
            rows.extend(new_rows)
            have.add(rid)
            added.append({"id": rid, "symbol": new_rows[0]["resolution"], "date": new_rows[0]["date"], "title": new_rows[0]["title"][:100], "check": why})
        log(f"  page {page + 1}: {len(recs)} records, {newer_on_page} newer than the base file")
        if newer_on_page == 0:  # sorted newest first: nothing newer beyond this page
            break
        time.sleep(3)

    status = {"checked_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "base": os.path.basename(base), "added": added,
              "mismatches": mismatches, "skipped": skipped, "council_votes_seen": sc}
    if added:
        rows.sort(key=lambda r: (r["date"], r["undl_id"], r["ms_code"]))
        out = os.path.join(DATA, datetime.now(timezone.utc).strftime("%Y_%m_%d") + "_ga_voting.csv.gz")
        tmp = out + ".tmp"
        with gzip.open(tmp, "wt", encoding="utf-8", newline="") as g:
            w = csv.DictWriter(g, fieldnames=COLS)
            w.writeheader()
            for r in rows:
                w.writerow({c: r.get(c, "") for c in COLS})
        os.replace(tmp, out)
        status["written"] = os.path.basename(out)
        log(f"added {len(added)} recorded votes ({len(mismatches)} with totals that differ) → {os.path.basename(out)}")
        # keep the manual download and the two newest generated files
        gen = sorted(p for p in glob.glob(os.path.join(DATA, "*_ga_voting.csv.gz")) if p != files[0])
        for old in gen[:-2]:
            if old not in (out, files[0]):
                os.remove(old)
        r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "refresh_site_data.py"), "votes-import"], capture_output=True, text=True, timeout=1800)
        status["import"] = (r.stdout or r.stderr).strip()[-400:]
        log("import:", status["import"])
    else:
        log("no new recorded votes")
    with open(STATUS + ".tmp", "w") as f:
        json.dump(status, f, indent=1)
    os.replace(STATUS + ".tmp", STATUS)


if __name__ == "__main__":
    main()

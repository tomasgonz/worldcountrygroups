#!/usr/bin/env python3
"""Build site/server/data/conflict-events.json from UCDP public downloads.

Sources (Uppsala Conflict Data Program, https://ucdp.uu.se/downloads/):
  - UCDP Georeferenced Event Dataset (GED) Global, yearly release (e.g. ged261-csv.zip,
    events up to the end of the previous year)
  - UCDP Candidate Events, monthly releases (e.g. GEDEvent_v26_0_8.csv and the merged
    GEDEvent_v26_01_26_06.csv) for the current year

The downloads page is parsed to discover the newest GED zip and all listed candidate CSVs,
so new monthly releases are picked up automatically. Files are cached in
~/.cache/wcg/ucdp/ and only re-downloaded when the remote ETag / Last-Modified changes.
The UCDP API (token required) is not used.

Window: the last 3 full calendar years plus the current year to date. GED is used for
every year it covers; candidate events are used only for later dates. Candidate events
that appear in more than one release are deduplicated by event id (newest release wins).

Note: UCDP codes events in Gaza and the West Bank under Israel (gwno 666). Events whose
adm_1 is "Gaza Strip" or "West Bank" are attributed to Palestine (PSE) here.

Per country (ISO3): events, best-estimate fatalities (plus low/high and civilian deaths),
by UCDP type of violence (state-based, non-state, one-sided), yearly trend, monthly series
for the last 18 months, last-12-month totals, top conflicts and dyads, latest event date.

Stdlib only; streams CSVs (the GED CSV is ~270 MB uncompressed). Output written atomically.
"""

import csv
import io
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import Counter, defaultdict
from datetime import date, datetime, timezone

csv.field_size_limit(10 * 1024 * 1024)

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA = os.environ.get("WCG_SITE_DATA") or os.path.join(ROOT, "site", "server", "data")
OUTPUT = os.path.join(DATA, "conflict-events.json")
CACHE = os.path.join(os.path.expanduser("~"), ".cache", "wcg", "ucdp")
DOWNLOADS_PAGE = "https://ucdp.uu.se/downloads/"
UA = "WorldCountryGroups/1.0 (+https://worldcountrygroups.exe.xyz)"
FULL_YEARS = 3
MONTHS = 18
TOP_N = 5

TYPES = {"1": "state_based", "2": "non_state", "3": "one_sided"}
TYPE_LABELS = {
    "state_based": "State-based conflict",
    "non_state": "Non-state conflict",
    "one_sided": "One-sided violence",
}

# Gleditsch & Ward country codes (as used by UCDP country_id) -> ISO3
GW_TO_ISO3 = {
    2: "USA", 20: "CAN", 31: "BHS", 40: "CUB", 41: "HTI", 42: "DOM", 51: "JAM", 52: "TTO",
    53: "BRB", 54: "DMA", 55: "GRD", 56: "LCA", 57: "VCT", 58: "ATG", 60: "KNA", 70: "MEX",
    80: "BLZ", 90: "GTM", 91: "HND", 92: "SLV", 93: "NIC", 94: "CRI", 95: "PAN", 100: "COL",
    101: "VEN", 110: "GUY", 115: "SUR", 130: "ECU", 135: "PER", 140: "BRA", 145: "BOL",
    150: "PRY", 155: "CHL", 160: "ARG", 165: "URY", 200: "GBR", 205: "IRL", 210: "NLD",
    211: "BEL", 212: "LUX", 220: "FRA", 221: "MCO", 223: "LIE", 225: "CHE", 230: "ESP",
    232: "AND", 235: "PRT", 255: "DEU", 260: "DEU", 265: "DEU", 290: "POL", 305: "AUT",
    310: "HUN", 315: "CZE", 316: "CZE", 317: "SVK", 325: "ITA", 331: "SMR", 338: "MLT",
    339: "ALB", 340: "SRB", 341: "MNE", 343: "MKD", 344: "HRV", 345: "SRB", 346: "BIH",
    347: "XKX", 349: "SVN", 350: "GRC", 352: "CYP", 355: "BGR", 359: "MDA", 360: "ROU",
    365: "RUS", 366: "EST", 367: "LVA", 368: "LTU", 369: "UKR", 370: "BLR", 371: "ARM",
    372: "GEO", 373: "AZE", 375: "FIN", 380: "SWE", 385: "NOR", 390: "DNK", 395: "ISL",
    402: "CPV", 403: "STP", 404: "GNB", 411: "GNQ", 420: "GMB", 432: "MLI", 433: "SEN",
    434: "BEN", 435: "MRT", 436: "NER", 437: "CIV", 438: "GIN", 439: "BFA", 450: "LBR",
    451: "SLE", 452: "GHA", 461: "TGO", 471: "CMR", 475: "NGA", 481: "GAB", 482: "CAF",
    483: "TCD", 484: "COG", 490: "COD", 500: "UGA", 501: "KEN", 510: "TZA", 516: "BDI",
    517: "RWA", 520: "SOM", 522: "DJI", 530: "ETH", 531: "ERI", 540: "AGO", 541: "MOZ",
    551: "ZMB", 552: "ZWE", 553: "MWI", 560: "ZAF", 565: "NAM", 570: "LSO", 571: "BWA",
    572: "SWZ", 580: "MDG", 581: "COM", 590: "MUS", 591: "SYC", 600: "MAR", 615: "DZA",
    616: "TUN", 620: "LBY", 625: "SDN", 626: "SSD", 630: "IRN", 640: "TUR", 645: "IRQ",
    651: "EGY", 652: "SYR", 660: "LBN", 663: "JOR", 666: "ISR", 670: "SAU", 678: "YEM",
    679: "YEM", 680: "YEM", 690: "KWT", 692: "BHR", 694: "QAT", 696: "ARE", 698: "OMN",
    700: "AFG", 701: "TKM", 702: "TJK", 703: "KGZ", 704: "UZB", 705: "KAZ", 710: "CHN",
    712: "MNG", 713: "TWN", 731: "PRK", 732: "KOR", 740: "JPN", 750: "IND", 760: "BTN",
    770: "PAK", 771: "BGD", 775: "MMR", 780: "LKA", 781: "MDV", 790: "NPL", 800: "THA",
    811: "KHM", 812: "LAO", 816: "VNM", 817: "VNM", 820: "MYS", 830: "SGP", 835: "BRN",
    840: "PHL", 850: "IDN", 860: "TLS", 900: "AUS", 910: "PNG", 920: "NZL", 935: "VUT",
    940: "SLB", 946: "KIR", 947: "TUV", 950: "FJI", 955: "TON", 970: "NRU", 983: "MHL",
    986: "PLW", 987: "FSM", 990: "WSM",
}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def http_get(url, headers=None, timeout=120):
    h = {"User-Agent": UA}
    if headers:
        h.update(headers)
    return urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout)


# ---------------------------------------------------------------- discovery + cache

def discover():
    """Return (ged_zip_url, [candidate_csv_urls]) from the downloads page.

    Falls back to the last successful discovery stored in the cache."""
    manifest = os.path.join(CACHE, "manifest.json")
    try:
        with http_get(DOWNLOADS_PAGE, timeout=60) as r:
            html = r.read().decode("utf-8", "replace")
        hrefs = [urllib.parse.urljoin(DOWNLOADS_PAGE, h) for h in re.findall(r'href="([^"]+)"', html)]
        ged = []
        cand = []
        for h in hrefs:
            m = re.search(r"/downloads/ged/ged(\d+)-csv\.zip$", h, re.I)
            if m:
                ged.append((int(m.group(1)), h))
            if re.search(r"/downloads/candidateged/GEDEvent_v[\w.]+\.csv$", h, re.I):
                cand.append(h)
        if not ged:
            raise RuntimeError("no GED csv zip link found on downloads page")
        ged.sort()
        found = {"ged": ged[-1][1], "candidates": sorted(dict.fromkeys(cand)),
                 "discovered": datetime.now(timezone.utc).isoformat(timespec="seconds")}
        with open(manifest, "w") as f:
            json.dump(found, f, indent=1)
        return found["ged"], found["candidates"]
    except Exception as e:
        if os.path.exists(manifest):
            log(f"warning: could not read downloads page ({e}); using last known file list")
            with open(manifest) as f:
                found = json.load(f)
            return found["ged"], found["candidates"]
        raise


def cached(url):
    """Download url into the cache unless the cached copy is current. Returns local path."""
    name = os.path.basename(urllib.parse.urlparse(url).path)
    path = os.path.join(CACHE, name)
    meta_path = path + ".meta.json"
    meta = None
    if os.path.exists(path):
        try:
            with open(meta_path) as f:
                meta = json.load(f)
        except Exception:
            meta = None
        if meta is None:
            # A copy without metadata (e.g. downloaded by hand): adopt it if the size matches.
            try:
                req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=60) as r:
                    if r.headers.get("Content-Length") == str(os.path.getsize(path)):
                        meta = {"etag": r.headers.get("ETag"), "last_modified": r.headers.get("Last-Modified"),
                                "size": os.path.getsize(path)}
                        with open(meta_path, "w") as f:
                            json.dump(meta, f)
                        log(f"{name}: adopted existing cached copy")
                        return path
            except Exception as e:
                log(f"{name}: HEAD failed ({e})")
    headers = {}
    if meta and os.path.exists(path):
        if meta.get("etag"):
            headers["If-None-Match"] = meta["etag"]
        if meta.get("last_modified"):
            headers["If-Modified-Since"] = meta["last_modified"]
    try:
        with http_get(url, headers, timeout=300) as r:
            fd, tmp = tempfile.mkstemp(dir=CACHE, suffix=".part")
            n = 0
            with os.fdopen(fd, "wb") as out:
                while True:
                    chunk = r.read(1 << 20)
                    if not chunk:
                        break
                    out.write(chunk)
                    n += len(chunk)
            os.replace(tmp, path)
            meta = {"etag": r.headers.get("ETag"), "last_modified": r.headers.get("Last-Modified"), "size": n,
                    "fetched": datetime.now(timezone.utc).isoformat(timespec="seconds")}
            with open(meta_path, "w") as f:
                json.dump(meta, f)
            log(f"{name}: downloaded {n:,} bytes")
    except urllib.error.HTTPError as e:
        if e.code == 304:
            log(f"{name}: unchanged")
        elif os.path.exists(path):
            log(f"{name}: download failed ({e}); using cached copy")
        else:
            raise
    except urllib.error.URLError as e:
        if os.path.exists(path):
            log(f"{name}: download failed ({e}); using cached copy")
        else:
            raise
    time.sleep(1)  # one file at a time, gently
    return path


def prune_cache(keep):
    keep = {os.path.basename(k) for k in keep}
    for fn in os.listdir(CACHE):
        base = fn[:-len(".meta.json")] if fn.endswith(".meta.json") else fn
        if (base.lower().endswith(".csv") or base.lower().endswith(".zip")) and base not in keep:
            try:
                os.remove(os.path.join(CACHE, fn))
                log(f"removed stale cache file {fn}")
            except OSError:
                pass


# ---------------------------------------------------------------- reading

def iter_ged(path):
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".csv")]
        if not names:
            raise RuntimeError(f"no CSV inside {path}")
        with z.open(names[0]) as raw:
            yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""))


def iter_csv(path):
    with open(path, encoding="utf-8-sig", newline="", errors="replace") as f:
        yield from csv.DictReader(f)


def to_int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def compact(r):
    """Keep only the fields we aggregate on."""
    cid = to_int(r.get("country_id"))
    iso = GW_TO_ISO3.get(cid)
    adm1 = (r.get("adm_1") or "").lower()
    if cid == 666 and ("gaza" in adm1 or "west bank" in adm1):
        iso = "PSE"
    return (
        iso,
        (r.get("date_start") or "")[:10],
        TYPES.get((r.get("type_of_violence") or "").strip(), "unknown"),
        to_int(r.get("best")),
        to_int(r.get("low")),
        to_int(r.get("high")),
        to_int(r.get("deaths_civilians")),
        (r.get("conflict_new_id") or "").strip(),
        (r.get("conflict_name") or "").strip(),
        (r.get("dyad_new_id") or "").strip(),
        (r.get("dyad_name") or "").strip(),
        r.get("country") or "",
    )


# ---------------------------------------------------------------- aggregation

def month_list(end_ym, n):
    y, m = int(end_ym[:4]), int(end_ym[5:7])
    out = []
    for _ in range(n):
        out.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out[::-1]


def months_between(a, b):
    return (int(b[:4]) - int(a[:4])) * 12 + int(b[5:7]) - int(a[5:7])


def main():
    os.makedirs(CACHE, exist_ok=True)
    today = date.today()
    start_year = today.year - FULL_YEARS
    start_date = f"{start_year}-01-01"

    ged_url, cand_urls = discover()
    log(f"GED: {ged_url}")
    log(f"candidate files: {', '.join(os.path.basename(u) for u in cand_urls) or 'none'}")
    ged_path = cached(ged_url)
    cand_paths = []
    for u in cand_urls:
        try:
            cand_paths.append(cached(u))
        except Exception as e:
            log(f"warning: could not fetch {u}: {e}")
    prune_cache([ged_path] + cand_paths)
    ged_version = re.search(r"ged(\d+)", os.path.basename(ged_url)).group(1)
    ged_version = f"{ged_version[:-1]}.{ged_version[-1]}" if len(ged_version) >= 2 else ged_version

    events = []  # compact tuples
    unmapped = Counter()
    ged_max_year = 0
    n_ged = 0
    for r in iter_ged(ged_path):
        y = to_int(r.get("year"))
        if y > ged_max_year:
            ged_max_year = y
        if y < start_year:
            continue
        e = compact(r)
        if not e[0]:
            unmapped[f"{r.get('country_id')} {e[11]}"] += 1
            continue
        events.append(e + ("ged",))
        n_ged += 1
    log(f"GED {ged_version}: {n_ged:,} events since {start_date}; covers through {ged_max_year}")
    if n_ged < 1000:
        log("error: suspiciously few GED events; not writing output")
        return 1

    # Candidate releases: order oldest -> newest so newer releases override by id.
    def release_key(p):
        nums = [int(x) for x in re.findall(r"\d+", os.path.basename(p))]
        # version first, then the last month covered: merged v26_01_26_06 -> (26, 6),
        # single-month v26_0_8 -> (26, 8)
        return (nums[0] if nums else 0, nums[-1] if len(nums) > 1 else 0)

    cand = {}
    cand_files_used = []
    for p in sorted(cand_paths, key=release_key):
        n = 0
        for r in iter_csv(p):
            status = (r.get("code_status") or "").lower()
            if "delete" in status or "remove" in status:
                continue
            d = (r.get("date_start") or "")[:10]
            if not d or int(d[:4]) <= ged_max_year or d < start_date:
                continue
            eid = r.get("id") or f"{p}:{n}"
            e = compact(r)
            if not e[0]:
                unmapped[f"{r.get('country_id')} {e[11]}"] += 1
                continue
            cand[eid] = e + ("candidate",)
            n += 1
        cand_files_used.append(os.path.basename(p))
        log(f"{os.path.basename(p)}: {n:,} events after GED coverage")
    events.extend(cand.values())
    log(f"candidate events (deduplicated): {len(cand):,}")

    latest = max(e[1] for e in events)
    end_ym = latest[:7]
    months = month_list(end_ym, MONTHS)
    years = list(range(start_year, today.year + 1))
    last12 = set(month_list(end_ym, 12))
    candidate_from = f"{ged_max_year + 1}-01-01" if cand else None

    def blank():
        return {
            "events": 0, "fat": 0, "low": 0, "high": 0, "civ": 0,
            "types": {t: [0, 0] for t in TYPES.values()},
            "years": defaultdict(lambda: [0, 0]),
            "months": defaultdict(lambda: [0, 0]),
            "conf": defaultdict(lambda: {"name": "", "type": "", "events": 0, "fat": 0, "last": ""}),
            "dyad": defaultdict(lambda: {"name": "", "type": "", "events": 0, "fat": 0, "last": ""}),
            "latest": "", "l12": [0, 0], "cand": 0,
        }

    agg = defaultdict(blank)
    glob = blank()
    for (iso, d, typ, best, low, high, civ, cid, cname, did, dname, _cn, src) in events:
        for a in (agg[iso], glob):
            a["events"] += 1
            a["fat"] += best
            a["low"] += low
            a["high"] += high
            a["civ"] += civ
            if typ in a["types"]:
                a["types"][typ][0] += 1
                a["types"][typ][1] += best
            yv = a["years"][int(d[:4])]
            yv[0] += 1
            yv[1] += best
            ym = d[:7]
            if ym in last12:
                a["l12"][0] += 1
                a["l12"][1] += best
            if months_between(months[0], ym) >= 0:
                mv = a["months"][ym]
                mv[0] += 1
                mv[1] += best
            if d > a["latest"]:
                a["latest"] = d
            if src == "candidate":
                a["cand"] += 1
        a = agg[iso]
        for key, ident, name in (("conf", cid, cname), ("dyad", did, dname)):
            if not ident:
                continue
            c = a[key][ident]
            c["name"] = name or c["name"]
            c["type"] = typ
            c["events"] += 1
            c["fat"] += best
            if d > c["last"]:
                c["last"] = d

    def intensity(f12, e12):
        if e12 == 0:
            return "none"
        if f12 >= 1000:
            return "high"
        if f12 >= 25:
            return "medium"
        return "low"

    def tops(dct):
        rows = sorted(dct.items(), key=lambda kv: (-kv[1]["fat"], -kv[1]["events"]))[:TOP_N]
        return [{"id": k, "name": v["name"], "type": v["type"], "events": v["events"],
                 "fatalities": v["fat"], "latest_event": v["last"]} for k, v in rows]

    def series(a):
        return {
            "trend": [{"year": y, "events": a["years"][y][0], "fatalities": a["years"][y][1],
                       **({"partial": True, "through": latest} if str(y) == latest[:4] and latest[5:] < "12-31" else {}),
                       **({"provisional": True} if y > ged_max_year else {})}
                      for y in years if y <= int(latest[:4])],
            "monthly": [{"month": m, "events": a["months"][m][0], "fatalities": a["months"][m][1]} for m in months],
        }

    countries = {}
    for iso, a in sorted(agg.items(), key=lambda kv: -kv[1]["fat"]):
        countries[iso] = {
            "total_events": a["events"],
            "total_fatalities": a["fat"],
            "fatalities_low": a["low"],
            "fatalities_high": a["high"],
            "civilian_deaths": a["civ"],
            "by_type": {t: {"events": a["types"][t][0], "fatalities": a["types"][t][1]} for t in TYPES.values()},
            **series(a),
            "last_12_months": {"events": a["l12"][0], "fatalities": a["l12"][1]},
            "top_conflicts": tops(a["conf"]),
            "top_dyads": tops(a["dyad"]),
            "latest_event_date": a["latest"],
            "provisional_events": a["cand"],
            "conflict_intensity": intensity(a["l12"][1], a["l12"][0]),
        }

    out = {
        "_meta": {
            "last_updated": today.isoformat(),
            "source": f"UCDP GED {ged_version} and monthly candidate events, Uppsala University",
            "source_url": DOWNLOADS_PAGE,
            "period": f"{start_date} to {latest}",
            "period_start": start_date,
            "period_end": latest,
            "ged_version": ged_version,
            "ged_url": ged_url,
            "ged_through": f"{ged_max_year}-12-31",
            "candidate_files": cand_files_used,
            "candidate_from": candidate_from,
            "fatalities": "UCDP best estimate of deaths (sum of 'best'); low/high estimates also given",
            "types": TYPE_LABELS,
            "intensity_rule": "Based on best-estimate fatalities in the last 12 months of data: high >= 1000, medium >= 25, low > 0, none = no events in the last 12 months",
            "notes": "UCDP records organised violence causing at least one death (state-based armed conflict, non-state conflict, one-sided violence against civilians). It does not record protests or riots. Candidate events are provisional and may be revised in the next yearly GED release. Events in Gaza and the West Bank, which UCDP codes under Israel, are attributed to Palestine (PSE).",
            "citation": "Sundberg, Ralph & Erik Melander (2013) Introducing the UCDP Georeferenced Event Dataset, Journal of Peace Research 50(4); Hegre, Croicu, Eck & Hogbladh (2020) Introducing the UCDP Candidate Events Dataset, Research & Politics.",
            "country_count": len(countries),
            "unmapped": dict(unmapped.most_common(20)),
        },
        "global": {
            "total_events": glob["events"],
            "total_fatalities": glob["fat"],
            "civilian_deaths": glob["civ"],
            "by_type": {t: {"events": glob["types"][t][0], "fatalities": glob["types"][t][1]} for t in TYPES.values()},
            **series(glob),
            "last_12_months": {"events": glob["l12"][0], "fatalities": glob["l12"][1]},
            "latest_event_date": latest,
        },
        "countries": countries,
    }

    os.makedirs(DATA, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=DATA, prefix=".conflict-events.", suffix=".tmp")
    with os.fdopen(fd, "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.chmod(tmp, 0o644)
    os.replace(tmp, OUTPUT)
    log(f"wrote {OUTPUT}: {len(countries)} countries, {glob['events']:,} events, "
        f"{glob['fat']:,} fatalities, {out['_meta']['period']}")
    if unmapped:
        log("unmapped country ids:", dict(unmapped.most_common(10)))
    return 0


if __name__ == "__main__":
    sys.exit(main())

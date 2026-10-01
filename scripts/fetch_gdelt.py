#!/usr/bin/env python3
"""Build site/server/data/gdelt-data.json from the GDELT Project.

Mirrors refreshGDELTData() in site/server/utils/data-fetcher.ts (same schema):
  Phase A: last N days of GDELT 1.0 daily event exports -> per-country event mix,
           Goldstein average, CAMEO root-code counts, and bilateral pairs.
  Phase B: 12-month media tone/volume from the GDELT DOC API for the top countries
           (the API allows one request every 5 seconds).

A run that parses no events leaves the existing file untouched.

By default media tone and volume come from the event exports themselves (mention-weighted
tone and mention counts over the same window), so every country is measured the same way.
--doc-tone adds 12-month DOC API series, but that API rate-limits aggressively and
countries it fails for fall back to the event-based figures.

Usage: python3 scripts/fetch_gdelt.py [--days 7] [--doc-tone] [--tone-countries 80]
"""

import argparse
import io
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timedelta, timezone

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "server", "data", "gdelt-data.json")
UA = {"User-Agent": "Mozilla/5.0 worldcountrygroups"}
DOC_DELAY = 6.0  # GDELT DOC API: max one request every 5 seconds

CAMEO_TO_ISO3 = {
    "USS": "RUS", "SUN": "RUS", "YUG": "SRB", "DDR": "DEU", "CSK": "CZE",
    "ROM": "ROU", "ZAR": "COD", "BUR": "MMR", "TMP": "TLS", "SCG": "SRB",
    "ANT": "NLD", "GBD": "GBR", "GBN": "GBR", "GBP": "GBR", "GBS": "GBR",
    "HKG": "CHN", "MAC": "CHN",
}

ISO3_TO_NAME = {
    "USA": "United States", "CHN": "China", "RUS": "Russia", "GBR": "United Kingdom",
    "FRA": "France", "DEU": "Germany", "JPN": "Japan", "IND": "India", "BRA": "Brazil",
    "CAN": "Canada", "AUS": "Australia", "KOR": "South Korea", "ISR": "Israel",
    "IRN": "Iran", "SAU": "Saudi Arabia", "TUR": "Turkey", "UKR": "Ukraine",
    "PAK": "Pakistan", "EGY": "Egypt", "NGA": "Nigeria", "ZAF": "South Africa",
    "MEX": "Mexico", "IDN": "Indonesia", "ARG": "Argentina", "COL": "Colombia",
    "ITA": "Italy", "ESP": "Spain", "NLD": "Netherlands", "POL": "Poland",
    "SWE": "Sweden", "NOR": "Norway", "TWN": "Taiwan", "PRK": "North Korea",
    "IRQ": "Iraq", "SYR": "Syria", "AFG": "Afghanistan", "YEM": "Yemen",
    "LBY": "Libya", "SDN": "Sudan", "ETH": "Ethiopia", "MMR": "Myanmar",
    "VEN": "Venezuela", "CUB": "Cuba", "THA": "Thailand", "VNM": "Vietnam",
    "PHL": "Philippines", "MYS": "Malaysia", "SGP": "Singapore", "QAT": "Qatar",
    "ARE": "United Arab Emirates", "KWT": "Kuwait", "JOR": "Jordan", "LBN": "Lebanon",
    "GRC": "Greece", "BEL": "Belgium", "CHE": "Switzerland", "AUT": "Austria",
    "KEN": "Kenya", "DZA": "Algeria", "MAR": "Morocco", "PRT": "Portugal",
    "ROU": "Romania", "HUN": "Hungary", "CZE": "Czech Republic", "FIN": "Finland",
    "DNK": "Denmark", "IRL": "Ireland", "NZL": "New Zealand", "CHL": "Chile",
    "PER": "Peru", "ECU": "Ecuador", "BOL": "Bolivia", "URY": "Uruguay",
    "PRY": "Paraguay", "GEO": "Georgia", "ARM": "Armenia", "AZE": "Azerbaijan",
    "KAZ": "Kazakhstan", "UZB": "Uzbekistan", "TKM": "Turkmenistan",
}


def resolve_cameo(code):
    if not code or len(code) < 3:
        return None
    up = code[:3].upper()
    if up in CAMEO_TO_ISO3:
        return CAMEO_TO_ISO3[up]
    return up if up.isalpha() else None


def new_country():
    return {"events": 0, "cooperative": 0, "conflictual": 0, "neutral": 0,
            "goldsteinSum": 0.0, "toneSum": 0.0, "mentionsSum": 0, "byCameo": {}}


def new_pair():
    return {"events": 0, "cooperative": 0, "conflictual": 0, "toneSum": 0.0, "mentionsSum": 0}


def process_day(date_str, countries, pairs):
    url = f"https://data.gdeltproject.org/events/{date_str}.export.CSV.zip"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
            blob = r.read()
        zf = zipfile.ZipFile(io.BytesIO(blob))
        raw = zf.read(zf.namelist()[0]).decode("utf-8", "replace")
    except Exception as e:
        print(f"  {date_str}: failed ({e})")
        return False

    n = 0
    for line in raw.split("\n"):
        f = line.split("\t")
        if len(f) < 35:
            continue
        # GDELT 1.0 columns: 7 Actor1CountryCode, 17 Actor2CountryCode, 28 EventRootCode,
        # 30 GoldsteinScale, 31 NumMentions, 34 AvgTone
        iso1, iso2 = resolve_cameo(f[7]), resolve_cameo(f[17])
        root = (f[28] or "")[:2].zfill(2)
        try:
            rn = int(root)
        except ValueError:
            rn = 0
        coop, confl = 1 <= rn <= 10, 11 <= rn <= 20
        try:
            gold = float(f[30])
        except ValueError:
            gold = 0.0
        try:
            mentions = int(f[31])
        except ValueError:
            mentions = 0
        try:
            tone = float(f[34])
        except ValueError:
            tone = 0.0

        for iso in (iso1, iso2):
            if not iso:
                continue
            c = countries.setdefault(iso, new_country())
            c["events"] += 1
            if coop:
                c["cooperative"] += 1
            elif confl:
                c["conflictual"] += 1
            else:
                c["neutral"] += 1
            c["goldsteinSum"] += gold
            c["toneSum"] += tone * mentions
            c["mentionsSum"] += mentions
            c["byCameo"][root] = c["byCameo"].get(root, 0) + 1

        if iso1 and iso2 and iso1 != iso2:
            key = f"{iso1}:{iso2}" if iso1 < iso2 else f"{iso2}:{iso1}"
            p = pairs.setdefault(key, new_pair())
            p["events"] += 1
            if coop:
                p["cooperative"] += 1
            elif confl:
                p["conflictual"] += 1
            p["toneSum"] += tone * mentions
            p["mentionsSum"] += mentions
        n += 1
    print(f"  {date_str}: {n} events")
    return True


def doc_series(name, mode):
    """One DOC API timeline series as [(date, value)], retrying through rate-limit notices."""
    q = urllib.parse.quote(f'"{name}"')
    url = f"https://api.gdeltproject.org/api/v2/doc/doc?query={q}&mode={mode}&timespan=12m&format=json"
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                body = r.read().decode("utf-8", "replace")
        except Exception:
            body = ""
        if body.lstrip().startswith("{"):
            try:
                timeline = json.loads(body).get("timeline") or []
            except Exception:
                return None
            if not timeline:
                return None
            return [(pt.get("date", ""), pt.get("value") or 0) for pt in timeline[0].get("data") or []]
        time.sleep(DOC_DELAY * (attempt + 2))  # rate-limited: back off
    return None


def doc_tone(name):
    """12-month media tone (volume-weighted) and article volume for a country name.

    timelinetone gives the average tone per day; timelinevolraw gives the raw
    article count per day. Both are needed for a weighted tone and volume trend.
    """
    tone = doc_series(name, "timelinetone")
    time.sleep(DOC_DELAY)
    vol = doc_series(name, "timelinevolraw")
    if not tone and not vol:
        return None
    vol_by_date = dict(vol or [])
    tone_sum = weight = 0.0
    for date, t in tone or []:
        w = vol_by_date.get(date, 1) if vol else 1
        tone_sum += t * w
        weight += w
    daily = [v for _, v in (vol or [])]
    buckets = [0] * 12
    size = -(-len(daily) // 12) if daily else 1
    for i, v in enumerate(daily):
        buckets[min(i // size, 11)] += v
    return {
        "avg_tone": tone_sum / weight if weight else None,
        "volume": sum(daily) if vol else None,
        "monthly": buckets if vol else None,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--tone-countries", type=int, default=80)
    ap.add_argument("--doc-tone", action="store_true",
                    help="also fetch 12-month tone/volume from the GDELT DOC API (heavily rate-limited)")
    args = ap.parse_args()

    today = datetime.now(timezone.utc).date()
    countries, pairs, days = {}, {}, 0
    print("Phase A: daily event exports")
    for i in range(1, args.days + 1):
        if process_day((today - timedelta(days=i)).strftime("%Y%m%d"), countries, pairs):
            days += 1

    if not countries:
        sys.exit("No GDELT events parsed; existing gdelt-data.json left untouched.")

    tone = {}
    if args.doc_tone:
        top = sorted(countries.items(), key=lambda kv: -kv[1]["events"])[:args.tone_countries]
        names = [(iso, ISO3_TO_NAME[iso]) for iso, _ in top if iso in ISO3_TO_NAME]
        print(f"Phase B: media tone for {len(names)} countries ({DOC_DELAY}s between requests)")
        for iso, name in names:
            t = doc_tone(name)
            if t:
                tone[iso] = t
            time.sleep(DOC_DELAY)
        print(f"  tone data for {len(tone)} countries")

    out = {}
    for iso, d in countries.items():
        bilateral = []
        for key, p in pairs.items():
            a, b = key.split(":")
            partner = b if a == iso else a if b == iso else None
            if not partner:
                continue
            cc = p["cooperative"] + p["conflictual"]
            bilateral.append({
                "partner": partner, "events": p["events"], "cooperative": p["cooperative"],
                "conflictual": p["conflictual"],
                "avg_tone": p["toneSum"] / p["mentionsSum"] if p["mentionsSum"] else 0,
                "cooperation_ratio": p["cooperative"] / cc if cc else 0.5,
            })
        bilateral.sort(key=lambda x: -x["events"])
        t = tone.get(iso)
        cc = d["cooperative"] + d["conflictual"]
        out[iso] = {
            "media": {
                "avg_tone": t["avg_tone"] if t and t["avg_tone"] is not None
                else (d["toneSum"] / d["mentionsSum"] if d["mentionsSum"] else 0),
                "article_volume": t["volume"] if t and t["volume"] is not None else d["mentionsSum"],
                "monthly_trend": t["monthly"] if t and t["monthly"] is not None else [],
                "volume_period": "Last 12 months" if t and t["volume"] is not None
                else f"Event mentions, last {days} days",
            },
            "events": {
                "total": d["events"], "cooperative": d["cooperative"], "neutral": d["neutral"],
                "conflictual": d["conflictual"],
                "goldstein_avg": d["goldsteinSum"] / d["events"] if d["events"] else 0,
                "cooperation_ratio": d["cooperative"] / cc if cc else 0.5,
                "by_cameo": d["byCameo"],
            },
            "bilateral": bilateral[:10],
        }

    output = {
        "_meta": {
            "last_updated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "GDELT Project",
            "period": f"{days} days ending {today.isoformat()}",
            "country_count": len(out),
        },
        "countries": out,
    }
    tmp = OUTPUT + ".tmp"
    with open(tmp, "w") as f:
        json.dump(output, f, indent=2)
    os.replace(tmp, OUTPUT)
    print(f"Wrote {OUTPUT}: {len(out)} countries, {days} days")


if __name__ == "__main__":
    main()

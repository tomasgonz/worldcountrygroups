#!/usr/bin/env python3
"""Donor tracker: official development assistance (ODA) by donor, from the OECD.

Sources (OECD SDMX API, public, no key):
  - DAC1  (DSD_DAC1@DF_DAC1): total ODA (grant equivalent, current and constant prices),
    ODA/GNI, bilateral vs multilateral, in-donor refugee costs, net ODA. The OECD adds the
    PRELIMINARY figures for the previous year each April, so the newest DAC1 year is
    usually preliminary (headline items only).
  - DAC2A (DSD_DAC2@DF_DAC2A): net ODA disbursements by donor and recipient (top recipients
    per donor, top donors per recipient) and humanitarian aid. Final data only.
  - DAC5  (DSD_DAC1@DF_DAC5): bilateral ODA commitments by sector (top sectors per donor).

Output: site/server/data/donor-tracker.json  (does not touch oecd-oda.json)
Raw downloads are cached under ~/.cache/wcg/oecd/.
"""

import csv
import io
import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA_DIR = os.path.join(ROOT, "site", "server", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "donor-tracker.json")
WORLD_JSON = os.path.join(ROOT, "worldcountrygroups", "data", "groups", "world.json")
CACHE_DIR = os.path.expanduser("~/.cache/wcg/oecd")
CACHE_MAX_AGE = 20 * 3600  # reuse a raw download for this long (seconds)

UA = "WorldCountryGroups/1.0 (+https://worldcountrygroups.exe.xyz)"
API = "https://sdmx.oecd.org/public/rest/data"
DAC1 = "OECD.DCD.FSD,DSD_DAC1@DF_DAC1,"
DAC2A = "OECD.DCD.FSD,DSD_DAC2@DF_DAC2A,"
DAC5 = "OECD.DCD.FSD,DSD_DAC1@DF_DAC5,"
EXPLORER = "https://data-explorer.oecd.org/"

# DAC members (32 countries + EU institutions, coded "EU" here)
DAC_MEMBERS = {
    "AUS", "AUT", "BEL", "CAN", "CZE", "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "ISL",
    "IRL", "ITA", "JPN", "KOR", "LTU", "LUX", "NLD", "NZL", "NOR", "POL", "PRT", "SVK", "SVN",
    "ESP", "SWE", "CHE", "GBR", "USA",
}
EU_CODE = "4EU001"  # OECD code for EU Institutions

# Aggregates that must never be listed as a "donor" of a recipient
AGGREGATE_DONORS = {
    "ALLD", "DAC", "DAC_EC", "G7", "DACEU", "DACEU_EC", "WXDAC", "ALLM", "1UN0", "9OTH0",
    "5RDB0", "5WBG0", "5WB0", "5IMF0", "5AFDB0", "5ASDB0", "5IDB0", "9PLG0", "9PRIV0",
}

# Top-level DAC5 sector groups (no double counting between them)
SECTORS = {
    "110": "Education", "120": "Health", "130": "Population and reproductive health",
    "140": "Water and sanitation", "151": "Government and civil society",
    "152": "Conflict, peace and security", "160": "Other social services",
    "210": "Transport", "220": "Communications", "230": "Energy", "240": "Banking and finance",
    "250": "Business services", "310": "Agriculture, forestry, fishing",
    "320": "Industry, mining, construction", "331": "Trade policy", "332": "Tourism",
    "410": "Environment protection", "430": "Other multisector", "510": "Budget support",
    "520": "Food assistance", "530": "Other commodity aid", "600": "Debt relief",
    "720": "Emergency response", "730": "Reconstruction and rehabilitation",
    "740": "Disaster preparedness", "910": "Donor administrative costs",
    "930": "Refugees in donor countries",
}


def log(*a):
    print(*a, flush=True)


def fetch_csv(name, flow, key, start):
    """Download an SDMX CSV (cached), with retries and backoff. Falls back to a stale cache."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"{name}.csv")
    url = f"{API}/{flow}/{key}?startPeriod={start}&format=csvfile"
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < CACHE_MAX_AGE and "--refresh" not in sys.argv:
        log(f"  {name}: cached")
    else:
        err = None
        for attempt in range(4):
            try:
                r = requests.get(url, timeout=300, headers={"User-Agent": UA, "Accept": "text/csv"})
                if r.status_code == 429 or r.status_code >= 500:
                    raise RuntimeError(f"HTTP {r.status_code}")
                r.raise_for_status()
                if not r.text.startswith("DATAFLOW"):
                    raise RuntimeError("unexpected response (not SDMX CSV)")
                tmp = path + ".tmp"
                with open(tmp, "w") as f:
                    f.write(r.text)
                os.replace(tmp, path)
                log(f"  {name}: {len(r.content) // 1024} KB")
                err = None
                break
            except requests.HTTPError as e:  # 4xx: bad key or no data; retrying will not help
                err = e
                break
            except Exception as e:  # noqa: BLE001
                err = e
                wait = 10 * 2 ** attempt
                log(f"  {name}: attempt {attempt + 1} failed ({e}); retrying in {wait}s")
                time.sleep(wait)
        if err is not None:
            if os.path.exists(path):
                log(f"  {name}: using stale cache after failures")
            else:
                raise RuntimeError(f"{name}: download failed ({err})")
    with open(path) as f:
        rows = list(csv.DictReader(f))
    return rows, url


def fetch_area_names():
    """English names of OECD provider/recipient codes (CL_AREA_ORG), from the DAC2A structure."""
    import html
    import re
    path = os.path.join(CACHE_DIR, "area_names.json")
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < 7 * 86400:
        return json.load(open(path))
    url = "https://sdmx.oecd.org/public/rest/dataflow/OECD.DCD.FSD/DSD_DAC2@DF_DAC2A/latest?references=all"
    try:
        r = requests.get(url, timeout=120, headers={"User-Agent": UA})
        r.raise_for_status()
        x = r.text
        s = x.index('<structure:Codelist id="CL_AREA_ORG"')
        e = x.index("</structure:Codelist>", s)
        names = {}
        for m in re.finditer(r'<structure:Code id="([^"]+)"(.*?)</structure:Code>', x[s:e], re.S):
            n = re.search(r'<common:Name xml:lang="en">([^<]+)', m.group(2))
            if n:
                names[m.group(1)] = html.unescape(n.group(1))
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(names, f)
        os.replace(tmp, path)
        return names
    except Exception as e:  # noqa: BLE001
        log(f"  area names unavailable ({e})")
        return json.load(open(path)) if os.path.exists(path) else {}


def val(r):
    """Observation in USD (UNIT_MULT applied) or None."""
    if not r.get("OBS_VALUE"):
        return None
    v = float(r["OBS_VALUE"])
    if r.get("UNIT_MEASURE") == "USD":
        v *= 10 ** int(r.get("UNIT_MULT") or 0)
    return v


def pct(a, b):
    if a is None or b is None or b <= 0:
        return None
    return round((a - b) / b * 100, 1)


def main():
    world = json.load(open(WORLD_JSON))["countries"]
    iso3s = {c["iso3"] for c in world if c.get("iso3")}
    this_year = datetime.now(timezone.utc).year
    start = this_year - 11  # ~10 years of headline trend
    start2 = this_year - 6  # 5 years of recipient detail

    log("Fetching OECD DAC1 headline series (all providers)...")
    dac1, dac1_url = fetch_csv(
        "dac1_headline", DAC1, "..11010+11002+1010+11015+12000+1820....", start)
    log("Fetching OECD DAC2A net ODA by donor and recipient...")
    dac2a, dac2a_url = fetch_csv("dac2a_206", DAC2A, "..206.USD.V", start2)
    log("Fetching OECD DAC2A humanitarian aid (developing countries total)...")
    hum, _ = fetch_csv("dac2a_dpgc_216", DAC2A, ".DPGC.206+216.USD.V", start2)

    # ---- DAC1 headline ------------------------------------------------------------------
    names = {}
    series = {}  # code -> year -> dict

    def slot(code, y):
        return series.setdefault(code, {}).setdefault(int(y), {})

    for r in dac1:
        d = r["DONOR"]
        if d == EU_CODE:
            code = "EU"
        elif d in iso3s:
            code = d
        else:
            continue
        v = val(r)
        if v is None:
            continue
        m, ft, unit, price, y = r["MEASURE"], r["FLOW_TYPE"], r["UNIT_MEASURE"], r["PRICE_BASE"], r["TIME_PERIOD"]
        s = slot(code, y)
        if m == "11010" and ft == "1160" and unit == "USD":
            s["oda" if price == "V" else "oda_real"] = round(v)
        elif m == "11002" and unit != "USD":
            s["gni_pct"] = round(v, 3)
        elif m == "1010" and ft == "1140" and unit == "USD" and price == "V":
            s["oda_net"] = round(v)
        elif m == "11015" and ft == "1160" and unit == "USD" and price == "V":
            s["bilateral"] = round(v)
        elif m == "12000" and ft == "1160" and unit == "USD" and price == "V":
            s["multilateral"] = round(v)
        elif m == "1820" and unit == "USD" and price == "V" and ft in ("1160", "1140"):
            # grant-equivalent where reported; preliminary years only have net flows
            if ft == "1160" or "refugee" not in s:
                s["refugee"] = round(v)

    # ---- DAC2A ---------------------------------------------------------------------------
    area_names = fetch_area_names()
    world_names = {c["iso3"]: c["name"] for c in world if c.get("iso3")}

    dac2_years = sorted({int(r["TIME_PERIOD"]) for r in dac2a})
    counts = {y: sum(1 for r in dac2a if int(r["TIME_PERIOD"]) == y) for y in dac2_years}
    full = [y for y in dac2_years if counts[y] >= 0.8 * max(counts.values())]
    final_year = full[-1]
    last5 = [y for y in full if y > final_year - 5]

    give = {}   # donor code -> recipient -> year -> usd
    recv = {}   # recipient -> donor code -> year -> usd
    recv_total = {}  # recipient -> year -> usd (all official donors)
    for r in dac2a:
        v = val(r)
        if v is None:
            continue
        d, rc, y = r["DONOR"], r["RECIPIENT"], int(r["TIME_PERIOD"])
        if rc not in iso3s:
            continue
        if d == "ALLD":
            recv_total.setdefault(rc, {})[y] = round(v)
            continue
        if d in AGGREGATE_DONORS or d == rc:
            continue
        code = "EU" if d == EU_CODE else d
        if len(d) == 3 and d.isalpha() and d not in iso3s:
            continue
        give.setdefault(code, {}).setdefault(rc, {})[y] = round(v)
        recv.setdefault(rc, {}).setdefault(code, {})[y] = round(v)

    for r in hum:
        d = r["DONOR"]
        code = "EU" if d == EU_CODE else d
        if code not in series:
            continue
        v = val(r)
        if v is None:
            continue
        s = slot(code, r["TIME_PERIOD"])
        s["humanitarian" if r["MEASURE"] == "216" else "bilateral_to_dev"] = round(v)

    # ---- DAC5 sectors -------------------------------------------------------------------
    sectors_by = {}
    sector_note = None
    try:
        log("Fetching OECD DAC5 bilateral commitments by sector...")
        dac5, _ = fetch_csv("dac5_sectors", DAC5, "." + "+".join(list(SECTORS) + ["1000"]) + ".528.._Z.USD.V",
                            final_year - 1)
        for r in dac5:
            d = r["DONOR"]
            code = "EU" if d == EU_CODE else d
            if code not in series:
                continue
            v = val(r)
            if v is None:
                continue
            sectors_by.setdefault(code, {}).setdefault(int(r["TIME_PERIOD"]), {})[r["SECTOR"]] = v
    except Exception as e:  # noqa: BLE001
        sector_note = f"Sector data unavailable this run ({e})."
        log("  " + sector_note)

    # ---- per donor ----------------------------------------------------------------------
    dac1_years = sorted({y for s in series.values() for y in s})
    prelim_years = [y for y in dac1_years if y > final_year]

    def name_of(code):
        if code == "EU":
            return "EU Institutions"
        return world_names.get(code) or area_names.get(code) or code

    donors = {}
    for code, ys in series.items():
        years = sorted(y for y, s in ys.items() if s.get("oda"))
        if not years:
            continue
        ly = years[-1]
        cur = ys[ly]
        if cur["oda"] < 1e6:
            continue

        def real(y):
            s = ys.get(y) or {}
            return s.get("oda_real") or None

        prev_y = ly - 1 if (ly - 1) in ys and ys[ly - 1].get("oda") else None
        base3_y = ly - 3 if (ly - 3) in ys and ys[ly - 3].get("oda") else None
        latest = {
            "year": ly,
            "preliminary": ly in prelim_years,
            "oda": cur.get("oda"),
            "oda_real": cur.get("oda_real"),
            "gni_pct": cur.get("gni_pct"),
            "prev_year": prev_y,
            "change_1y_pct": pct(real(ly), real(prev_y)) if prev_y else None,
            "change_1y_usd": (real(ly) - real(prev_y)) if prev_y and real(ly) and real(prev_y) else None,
            "base3_year": base3_y,
            "change_3y_pct": pct(real(ly), real(base3_y)) if base3_y else None,
            "change_3y_usd": (real(ly) - real(base3_y)) if base3_y and real(ly) and real(base3_y) else None,
            "gni_pct_prev": (ys.get(prev_y) or {}).get("gni_pct") if prev_y else None,
        }
        oda = cur.get("oda") or 0
        if cur.get("refugee") is not None and oda:
            latest["refugee_share"] = round(cur["refugee"] / oda * 100, 1)
            latest["refugee_usd"] = cur["refugee"]
        if cur.get("bilateral") is not None and cur.get("multilateral") is not None and oda:
            latest["bilateral_share"] = round(cur["bilateral"] / oda * 100, 1)
            latest["multilateral_share"] = round(cur["multilateral"] / oda * 100, 1)
        # humanitarian share of bilateral ODA to developing countries (DAC2A; final years only)
        hy = max((y for y, s in ys.items() if s.get("humanitarian") is not None and s.get("bilateral_to_dev")), default=None)
        if hy:
            latest["humanitarian_share"] = round(ys[hy]["humanitarian"] / ys[hy]["bilateral_to_dev"] * 100, 1)
            latest["humanitarian_usd"] = ys[hy]["humanitarian"]
            latest["humanitarian_year"] = hy

        out_series = []
        for y in sorted(ys):
            s = ys[y]
            if not s.get("oda"):
                continue
            row = {"year": y, "oda": s.get("oda"), "oda_real": s.get("oda_real"), "gni_pct": s.get("gni_pct")}
            for k in ("bilateral", "multilateral", "refugee", "humanitarian", "oda_net"):
                if s.get(k) is not None:
                    row[k] = s[k]
            if y in prelim_years:
                row["preliminary"] = True
            out_series.append(row)

        # top recipients (bilateral net ODA, DAC2A)
        g = give.get(code, {})
        top_latest = sorted(((rc, yv.get(final_year, 0)) for rc, yv in g.items()), key=lambda x: -x[1])
        top_5y = sorted(((rc, sum(v for y, v in yv.items() if y in last5)) for rc, yv in g.items()), key=lambda x: -x[1])
        bil_total = sum(v for _, v in top_latest if v > 0)
        entry = {
            "code": code,
            "name": name_of(code),
            "kind": "eu" if code == "EU" else "country",
            "dac_member": code in DAC_MEMBERS or code == "EU",
            "latest": latest,
            "series": out_series,
            "top_recipients": {
                "year": final_year,
                "total_allocated": bil_total,
                "items": [{"iso3": rc, "name": world_names.get(rc, rc), "usd": v,
                           "prev": g[rc].get(final_year - 1)} for rc, v in top_latest[:10] if v > 0],
            },
            "top_recipients_5y": {
                "years": f"{last5[0]}-{last5[-1]}",
                "items": [{"iso3": rc, "name": world_names.get(rc, rc), "usd": v} for rc, v in top_5y[:10] if v > 0],
            },
        }
        sec = sectors_by.get(code)
        if sec:
            sy = max(sec)
            tot = sec[sy].get("1000") or sum(v for k, v in sec[sy].items() if k != "1000")
            items = sorted(((k, v) for k, v in sec[sy].items() if k in SECTORS and v > 0), key=lambda x: -x[1])
            if tot and items:
                entry["sectors"] = {
                    "year": sy,
                    "basis": "bilateral ODA commitments (DAC5)",
                    "total": round(tot),
                    "items": [{"code": k, "name": SECTORS[k], "usd": round(v), "share": round(v / tot * 100, 1)} for k, v in items[:6]],
                }
        donors[code] = entry

    # ---- rankings, cuts tracker ---------------------------------------------------------
    def rank(key):
        lst = [c for c in donors if donors[c]["latest"].get(key) is not None and donors[c]["kind"] == "country"]
        lst.sort(key=lambda c: -donors[c]["latest"][key])
        for i, c in enumerate(lst):
            donors[c]["latest"]["rank_" + ("volume" if key == "oda" else "gni")] = i + 1
        return lst

    by_volume = rank("oda")
    by_gni = rank("gni_pct")

    def change_rows(key_usd, key_pct, key_from):
        rows = []
        for c, d in donors.items():
            L = d["latest"]
            if L.get(key_usd) is None or L.get(key_pct) is None:
                continue
            rows.append({"code": c, "name": d["name"], "year": L["year"], "from_year": L[key_from],
                         "preliminary": L["preliminary"], "change_usd": round(L[key_usd]),
                         "change_pct": L[key_pct], "oda": L["oda"], "gni_pct": L.get("gni_pct"),
                         "gni_pct_prev": L.get("gni_pct_prev") if key_from == "prev_year" else None})
        return rows

    one = change_rows("change_1y_usd", "change_1y_pct", "prev_year")
    three = change_rows("change_3y_usd", "change_3y_pct", "base3_year")
    material = lambda r: abs(r["change_usd"]) >= 5e6  # noqa: E731
    cuts = sorted([r for r in one if r["change_usd"] < 0 and material(r)], key=lambda r: r["change_usd"])
    increases = sorted([r for r in one if r["change_usd"] > 0 and material(r)], key=lambda r: -r["change_usd"])
    cuts3 = sorted([r for r in three if r["change_usd"] < 0 and material(r)], key=lambda r: r["change_usd"])
    increases3 = sorted([r for r in three if r["change_usd"] > 0 and material(r)], key=lambda r: -r["change_usd"])

    # DAC aggregate (all DAC members)
    dac_total = {}
    for r in dac1:
        if r["DONOR"] == "DAC" and r["MEASURE"] in ("11010", "11002") and r["FLOW_TYPE"] in ("1160",) :
            v = val(r)
            if v is None:
                continue
            k = "gni_pct" if r["MEASURE"] == "11002" else ("oda" if r["PRICE_BASE"] == "V" else "oda_real")
            if r["MEASURE"] == "11002" or r["UNIT_MEASURE"] == "USD":
                dac_total.setdefault(int(r["TIME_PERIOD"]), {})[k] = round(v, 3) if k == "gni_pct" else round(v)
    dac_series = [{"year": y, **dac_total[y], **({"preliminary": True} if y in prelim_years else {})} for y in sorted(dac_total)]

    # ---- recipients ---------------------------------------------------------------------
    recipients = {}
    for rc, by_donor in recv.items():
        lat = sorted(((d, yv.get(final_year, 0)) for d, yv in by_donor.items()), key=lambda x: -x[1])
        five = sorted(((d, sum(v for y, v in yv.items() if y in last5)) for d, yv in by_donor.items()), key=lambda x: -x[1])

        def item(d, v, with_prev=False):
            kind = "country" if (len(d) == 3 and d.isalpha()) else ("eu" if d == "EU" else ("private" if d.startswith("9PRIV") or d.startswith("9PLG") else "multilateral"))
            it = {"code": d, "iso3": d if kind == "country" else None, "name": name_of(d) if kind in ("country", "eu") else area_names.get(d, d),
                  "kind": kind, "usd": v}
            if with_prev:
                it["prev"] = by_donor[d].get(final_year - 1)
            return it
        tot = recv_total.get(rc, {})
        if not lat and not tot:
            continue
        recipients[rc] = {
            "name": world_names.get(rc, rc),
            "year": final_year,
            "total": tot.get(final_year),
            "series": [{"year": y, "usd": tot[y]} for y in sorted(tot)],
            "top_donors": [item(d, v, True) for d, v in lat[:10] if v > 0],
            "top_donors_5y": [item(d, v) for d, v in five[:10] if v > 0],
        }
    ranked = sorted((r for r in recipients if recipients[r].get("total")), key=lambda r: -recipients[r]["total"])
    for i, rc in enumerate(ranked):
        recipients[rc]["rank"] = i + 1

    latest_year = max(dac1_years) if dac1_years else None
    result = {
        "_meta": {
            "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "OECD Development Assistance Committee (DAC1, DAC2A, DAC5) via the OECD SDMX API",
            "source_urls": [dac1_url, dac2a_url, EXPLORER],
            "headline_years": [dac1_years[0], dac1_years[-1]] if dac1_years else None,
            "latest_year": latest_year,
            "preliminary_years": prelim_years,
            "final_year": final_year,
            "recipient_years": f"{last5[0]}-{last5[-1]}",
            "constant_price_year": next((r["year"] for r in dac_series if r.get("oda") and r.get("oda") == r.get("oda_real")), None),
            "price_base": "oda = grant equivalent in current USD; oda_real = constant USD at constant_price_year prices; all changes (cuts/increases) are computed in constant prices",
            "notes": [
                "ODA = official development assistance, grant-equivalent measure (DAC1).",
                f"Figures for {', '.join(map(str, prelim_years)) or 'the newest year'} are PRELIMINARY OECD estimates (published each April) and will be revised; recipient and sector detail is only available up to {final_year}." if prelim_years else f"Latest final year: {final_year}.",
                "Top recipients/donors are net ODA disbursements (DAC2A); top donors of a recipient include multilateral organisations.",
                "Humanitarian share = humanitarian aid / bilateral net ODA to developing countries (DAC2A).",
                "Refugee share = in-donor refugee costs / total ODA.",
                "Sectors = bilateral ODA commitments by sector (DAC5), top 6 groups.",
                "China and several other providers do not report to the OECD and are not covered.",
            ] + ([sector_note] if sector_note else []),
        },
        "dac_total": dac_series,
        "rankings": {"by_volume": by_volume, "by_gni": by_gni},
        "cuts": cuts,
        "increases": increases,
        "cuts_3y": cuts3,
        "increases_3y": increases3,
        "donors": donors,
        "recipients": recipients,
    }

    if len(donors) < 25 or len(recipients) < 100:
        sys.exit(f"Too little data (donors={len(donors)}, recipients={len(recipients)}); {OUTPUT_FILE} left unchanged.")

    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = OUTPUT_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(result, f, separators=(",", ":"), ensure_ascii=False)
    os.replace(tmp, OUTPUT_FILE)
    log(f"Written {OUTPUT_FILE}: {len(donors)} donors (latest {latest_year}, preliminary {prelim_years}), "
        f"{len(recipients)} recipients, {len(cuts)} cuts / {len(increases)} increases")


if __name__ == "__main__":
    main()

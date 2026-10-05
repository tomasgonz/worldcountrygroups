#!/usr/bin/env python3
"""Emerging trading partners tracker: goods trade of every country with the big
emerging economies (and, for comparison, with the traditional partners), from the
IMF International Merchandise Trade Statistics (IMTS, the successor of the Direction
of Trade Statistics, DOTS).

Source: IMF SDMX 2.1 API, dataflow IMF.STA:IMTS (no key needed)
  https://api.imf.org/external/sdmx/2.1/data/IMF.STA,IMTS/<COUNTRY>.<INDICATOR>.<COUNTERPART>.<FREQ>
  key dimensions: COUNTRY (reporter), INDICATOR, COUNTERPART_COUNTRY, FREQUENCY
  indicators: XG_FOB_USD  exports of goods, FOB, US dollars
              MG_CIF_USD  imports of goods, CIF, US dollars (MG_FOB_USD used if CIF is missing)
  counterparts: ISO3 country codes, G001 = World, G998 = European Union
  frequency: A (annual), M (monthly, periods like 2026-M06)
Wildcards work, so all reporters for a set of partners come in a handful of requests
(empty reporter position, '+' to combine codes). OBS_VALUE is in US dollars (units),
despite the SCALE="6" series attribute.

Writes site/server/data/trade-partners.json (atomically):
  {
    "_meta": {...source, years, latest_year, latest_month, partners, notes},
    "partners": [{code, iso3, name, group: "emerging"|"traditional"}],
    "countries": {
      ISO3: {
        name, iso2, latest_year,
        world: {years: {Y: {x, m}}},                  # USD millions
        partners: {CODE: {years: {Y: {x, m}}, share, share_5y, share_10y,
                          change_5y, change_10y, x_share, m_share, growth_5y, yoy}},
        emerging: {share, share_5y, share_10y, change_5y, change_10y,
                   series: [{year, share}], x_share, m_share},
        traditional: {...same},
        top_emerging: CODE, top_partner: CODE, top_partner_share,
        china_export_share, hhi,
        monthly: {months: [...], emerging_share: [...], china_share: [...],
                  ttm: {emerging_share, prev_emerging_share, china_share, prev_china_share}}
      }
    },
    "partner_totals": {CODE: {years: {Y: total_trade_musd}, top_for: [ISO3...]}},
    "shifts": {toward_emerging: [...], away_from_emerging: [...]},
    "comtrade": {m49: {ISO3: code}, hs2: {code: name}}
  }
Raw downloads are cached under ~/.cache/wcg/imf/ (and ~/.cache/wcg/comtrade/) for 20 hours.
On failure the existing output file is left untouched (exit 1).
"""

import hashlib
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

UA = "WorldCountryGroups/1.0 (+https://worldcountrygroups.exe.xyz)"
API = "https://api.imf.org/external/sdmx/2.1/data/IMF.STA,IMTS"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "site", "server", "data", "trade-partners.json")
WORLD_JSON = os.path.join(ROOT, "worldcountrygroups", "data", "groups", "world.json")
CACHE = os.path.join(os.path.expanduser(os.environ.get("HOME", "~")), ".cache", "wcg")
CACHE_TTL = 20 * 3600
PAUSE = 2.0

# ---- Edit these lists to change the tracked partners -------------------------------
# (IMF counterpart code, ISO3 for flags/links or None, display name)
EMERGING = [
    ("CHN", "CHN", "China"),
    ("IND", "IND", "India"),
    ("BRA", "BRA", "Brazil"),
    ("TUR", "TUR", "Türkiye"),
    ("SAU", "SAU", "Saudi Arabia"),
    ("ARE", "ARE", "United Arab Emirates"),
    ("QAT", "QAT", "Qatar"),
    ("RUS", "RUS", "Russia"),
    ("IDN", "IDN", "Indonesia"),
    ("ZAF", "ZAF", "South Africa"),
    ("MEX", "MEX", "Mexico"),
]
TRADITIONAL = [
    ("USA", "USA", "United States"),
    ("EU", "G998", "European Union (EU-27)"),  # code, IMF code, name — see PARTNER_IMF below
    ("JPN", "JPN", "Japan"),
    ("GBR", "GBR", "United Kingdom"),
]
# -----------------------------------------------------------------------------------
WORLD = "G001"
EU_MEMBERS = {"AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN",
              "IRL", "ITA", "LVA", "LTU", "LUX", "MLT", "NLD", "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE"}

# our partner code -> IMF counterpart code
PARTNER_IMF = {c: c for c, _, _ in EMERGING}
PARTNER_IMF.update({"USA": "USA", "EU": "G998", "JPN": "JPN", "GBR": "GBR"})
PARTNER_ISO3 = {c: iso for c, iso, _ in EMERGING}
PARTNER_ISO3.update({"USA": "USA", "EU": None, "JPN": "JPN", "GBR": "GBR"})
PARTNER_NAME = {c: n for c, _, n in EMERGING + TRADITIONAL}
EMERGING_CODES = [c for c, _, _ in EMERGING]
TRAD_CODES = [c for c, _, _ in TRADITIONAL]
IMF_TO_PARTNER = {v: k for k, v in PARTNER_IMF.items()}

ANNUAL_YEARS = 11      # latest year and the 10 before it
MONTHS = 24
MIN_TRADE_SHIFTS = 5000.0  # USD millions of total goods trade (latest year) to enter the shifts ranking

N_REQ = 0


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def fetch(url, kind="imf", timeout=240, retries=4):
    """GET with cache, polite pacing and retries with exponential backoff."""
    global N_REQ
    d = os.path.join(CACHE, kind)
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, hashlib.sha1(url.encode()).hexdigest()[:20] + (".xml" if kind == "imf" else ".json"))
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < CACHE_TTL:
        with open(path, "rb") as f:
            return f.read()
    last = None
    for i in range(retries):
        if N_REQ:
            time.sleep(PAUSE)
        N_REQ += 1
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/xml, application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read()
            tmp = path + ".tmp"
            with open(tmp, "wb") as f:
                f.write(body)
            os.replace(tmp, path)
            return body
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 404:  # SDMX "no results"
                return b""
            wait = 5 * 2 ** i * (3 if e.code == 429 else 1)
        except Exception as e:  # network errors, timeouts
            last = e
            wait = 5 * 2 ** i
        log(f"  retry {i + 1}/{retries} after error: {last}; sleeping {wait}s")
        time.sleep(wait)
    raise RuntimeError(f"failed: {url}: {last}")


def parse_sdmx(body):
    """Yield (reporter, indicator, counterpart, period, value_usd) from StructureSpecificData."""
    if not body:
        return
    root = ET.fromstring(body)
    for s in root.iter():
        if not s.tag.endswith("Series"):
            continue
        rep, ind, cp = s.get("COUNTRY"), s.get("INDICATOR"), s.get("COUNTERPART_COUNTRY")
        for o in s:
            if not o.tag.endswith("Obs"):
                continue
            v = o.get("OBS_VALUE")
            if v in (None, "", "NaN"):
                continue
            try:
                val = float(v)
            except ValueError:
                continue
            if math.isfinite(val):
                yield rep, ind, cp, o.get("TIME_PERIOD"), val


# IMF codes that differ from the ISO3 codes used by the site
IMF_ISO_FIX = {"KOS": "XKX", "WBG": "PSE"}


def is_country(code):
    return code and len(code) == 3 and code.isalpha() and code.isupper()


def collect(freq, start):
    """{reporter: {partner_code_or_WORLD: {period: {'x': usd, 'm_cif': usd, 'm_fob': usd}}}}"""
    data = {}
    imf_codes = [PARTNER_IMF[c] for c in EMERGING_CODES + TRAD_CODES] + [WORLD]
    # chunks of partners keep each response to a few MB
    chunk = 6 if freq == "A" else 3
    for i in range(0, len(imf_codes), chunk):
        part = "+".join(imf_codes[i:i + chunk])
        url = f"{API}/.XG_FOB_USD+MG_CIF_USD+MG_FOB_USD.{part}.{freq}?startPeriod={start}"
        t = time.time()
        body = fetch(url)
        n = 0
        for rep, ind, cp, per, val in parse_sdmx(body):
            if not is_country(rep):
                continue
            rep = IMF_ISO_FIX.get(rep, rep)
            key = "WORLD" if cp == WORLD else IMF_TO_PARTNER.get(cp)
            if not key:
                continue
            slot = {"XG_FOB_USD": "x", "MG_CIF_USD": "m_cif", "MG_FOB_USD": "m_fob"}.get(ind)
            if not slot:
                continue
            data.setdefault(rep, {}).setdefault(key, {}).setdefault(per, {})[slot] = val
            n += 1
        log(f"  {freq} {part}: {len(body) / 1e6:.1f} MB, {n} obs, {time.time() - t:.1f}s")
    return data


def xm(rec):
    """(exports, imports) in USD millions; imports CIF, falling back to FOB."""
    if not rec:
        return None, None
    x = rec.get("x")
    m = rec.get("m_cif", rec.get("m_fob"))
    return (x / 1e6 if x is not None else None), (m / 1e6 if m is not None else None)


def rnd(v, d=1):
    return None if v is None else round(v, d)


def pct(a, b):
    return None if (a is None or not b) else a / b * 100


def load_world():
    with open(WORLD_JSON, encoding="utf-8") as f:
        w = json.load(f)
    return {c["iso3"]: c for c in w.get("countries", []) if c.get("iso3")}


def imf_names():
    """English names of IMTS country codes (fallback for codes not in world.json)."""
    try:
        body = fetch("https://api.imf.org/external/sdmx/2.1/codelist/IMF.STA/CL_IMTS_COUNTRY")
        root = ET.fromstring(body)
        out = {}
        for c in root.iter():
            if c.tag.endswith("}Code"):
                for n in c:
                    if n.tag.endswith("}Name") and n.get("{http://www.w3.org/XML/1998/namespace}lang") == "en":
                        out[c.get("id")] = n.text
        return out
    except Exception as e:
        log(f"  IMF codelist unavailable: {e}")
        return {}


def comtrade_refs():
    """ISO3 -> UN Comtrade numeric code, and HS 2-digit chapter names (for the products endpoint)."""
    out = {"m49": {}, "hs2": {}}
    try:
        rep = json.loads(fetch("https://comtradeapi.un.org/files/v1/app/reference/Reporters.json", kind="comtrade"))
        for r in rep.get("results", []):
            iso = r.get("reporterCodeIsoAlpha3")
            if iso and not r.get("isGroup") and is_country(iso):
                # keep the currently effective code (entryExpiredDate absent)
                if iso not in out["m49"] or not r.get("entryExpiredDate"):
                    out["m49"][iso] = r.get("reporterCode")
        hs = json.loads(fetch("https://comtradeapi.un.org/files/v1/app/reference/HS.json", kind="comtrade").decode("utf-8-sig"))
        for r in hs.get("results", []):
            if r.get("aggrLevel") == 2:
                txt = r.get("text", "")
                out["hs2"][r["id"]] = txt.split(" - ", 1)[1] if " - " in txt else txt
    except Exception as e:
        log(f"  Comtrade reference files unavailable: {e}")
    return out


def main():
    t0 = time.time()
    now = datetime.now(timezone.utc)
    world_ref = load_world()
    names = imf_names()

    log("Annual data...")
    start_year = now.year - ANNUAL_YEARS - 1
    annual = collect("A", start_year)
    log("Monthly data...")
    y, m = now.year, now.month - MONTHS - 4
    while m <= 0:
        m += 12
        y -= 1
    monthly = collect("M", f"{y}-{m:02d}")

    if len(annual) < 100:
        log(f"Only {len(annual)} reporters returned; keeping the existing file.")
        sys.exit(1)

    # latest complete year: the most recent year for which most reporters have a World total
    year_counts = {}
    for rep, d in annual.items():
        for per in d.get("WORLD", {}):
            year_counts[per] = year_counts.get(per, 0) + 1
    good_years = sorted(int(yv) for yv, n in year_counts.items() if n >= 0.6 * len(annual))
    latest = good_years[-1]
    years = [yy for yy in range(latest - ANNUAL_YEARS + 1, latest + 1)]
    y5, y10 = latest - 5, latest - 10

    month_counts = {}
    for rep, d in monthly.items():
        for per in d.get("WORLD", {}):
            month_counts[per] = month_counts.get(per, 0) + 1
    good_months = sorted(p for p, n in month_counts.items() if n >= 0.6 * len(monthly))
    months = good_months[-MONTHS:]
    latest_month = months[-1] if months else None

    countries = {}
    for rep in sorted(annual):
        d = annual[rep]
        if rep == "EU" or "WORLD" not in d:
            continue
        ref = world_ref.get(rep, {})
        imf_code = {v: k for k, v in IMF_ISO_FIX.items()}.get(rep, rep)
        name = ref.get("name") or names.get(imf_code) or rep
        w_years = {}
        for yy in years:
            x, mm = xm(d["WORLD"].get(str(yy)))
            if x is None and mm is None:
                continue
            w_years[str(yy)] = {"x": rnd(x), "m": rnd(mm)}
        if not w_years:
            continue
        rep_latest = max(int(k) for k in w_years)
        if rep_latest < latest - 3:
            continue  # stale reporter

        def tot(rec):
            if not rec:
                return None
            if rec.get("x") is None and rec.get("m") is None:
                return None
            return (rec.get("x") or 0) + (rec.get("m") or 0)

        world_tot = {k: tot(v) for k, v in w_years.items()}

        partners = {}
        for code in EMERGING_CODES + TRAD_CODES:
            if PARTNER_ISO3.get(code) == rep:
                continue
            pd = d.get(code, {})
            p_years = {}
            for yy in years:
                x, mm = xm(pd.get(str(yy)))
                if x is None and mm is None:
                    continue
                p_years[str(yy)] = {"x": rnd(x, 2), "m": rnd(mm, 2)}
            if not p_years:
                continue

            def share(yy, p_years=p_years):
                k = str(yy)
                return pct(tot(p_years.get(k)), world_tot.get(k))

            L = str(rep_latest)
            s_now, s5, s10 = share(rep_latest), share(rep_latest - 5), share(rep_latest - 10)
            t_now, t5 = tot(p_years.get(L)), tot(p_years.get(str(rep_latest - 5)))
            t_prev = tot(p_years.get(str(rep_latest - 1)))
            growth5 = None
            if t_now and t5 and t5 > 0:
                growth5 = ((t_now / t5) ** (1 / 5) - 1) * 100
            yoy = (t_now / t_prev - 1) * 100 if (t_now is not None and t_prev) else None
            lx = (p_years.get(L) or {}).get("x")
            lm = (p_years.get(L) or {}).get("m")
            partners[code] = {
                "years": p_years,
                "total": rnd(t_now, 2),
                "share": rnd(s_now, 2),
                "share_5y": rnd(s5, 2),
                "share_10y": rnd(s10, 2),
                "change_5y": rnd(s_now - s5, 2) if s_now is not None and s5 is not None else None,
                "change_10y": rnd(s_now - s10, 2) if s_now is not None and s10 is not None else None,
                "x_share": rnd(pct(lx, w_years.get(L, {}).get("x")), 2),
                "m_share": rnd(pct(lm, w_years.get(L, {}).get("m")), 2),
                "growth_5y": rnd(growth5, 1),
                "yoy": rnd(yoy, 1),
            }

        def group_block(codes):
            series = []
            for yy in years:
                k = str(yy)
                wt = world_tot.get(k)
                vals = [tot(partners[c]["years"].get(k)) for c in codes if c in partners]
                vals = [v for v in vals if v is not None]
                if wt and vals:
                    series.append({"year": yy, "share": round(sum(vals) / wt * 100, 2), "total": round(sum(vals), 1)})
            by = {s["year"]: s["share"] for s in series}
            L = str(rep_latest)
            sx = sum((partners[c]["years"].get(L) or {}).get("x") or 0 for c in codes if c in partners)
            sm = sum((partners[c]["years"].get(L) or {}).get("m") or 0 for c in codes if c in partners)
            now_s = by.get(rep_latest)
            return {
                "share": now_s,
                "share_5y": by.get(rep_latest - 5),
                "share_10y": by.get(rep_latest - 10),
                "change_5y": rnd(now_s - by[rep_latest - 5], 2) if now_s is not None and rep_latest - 5 in by else None,
                "change_10y": rnd(now_s - by[rep_latest - 10], 2) if now_s is not None and rep_latest - 10 in by else None,
                "x_share": rnd(pct(sx, w_years.get(L, {}).get("x")), 2),
                "m_share": rnd(pct(sm, w_years.get(L, {}).get("m")), 2),
                "series": series,
            }

        emerging = group_block(EMERGING_CODES)
        traditional = group_block(TRAD_CODES)
        em_ranked = sorted((c for c in EMERGING_CODES if c in partners and partners[c]["share"] is not None),
                           key=lambda c: -partners[c]["share"])
        # top partner among individual countries (EU aggregate excluded so the comparison is like for like)
        indiv = sorted((c for c in partners if c != "EU" and partners[c]["share"] is not None),
                       key=lambda c: -partners[c]["share"])
        shares = [partners[c]["share"] / 100 for c in indiv]
        hhi = round(sum(s * s for s in shares) * 10000) if shares else None

        # monthly: emerging & China shares and trailing-12-month comparison
        mon = None
        md = monthly.get(rep)
        if md and "WORLD" in md and months:
            em_s, cn_s, w_m = [], [], []
            sums = {"em": [], "cn": [], "w": []}
            for per in months:
                wx, wm = xm(md["WORLD"].get(per))
                wt = None if (wx is None and wm is None) else (wx or 0) + (wm or 0)
                e = 0.0
                ehas = False
                for c in EMERGING_CODES:
                    if PARTNER_ISO3.get(c) == rep:
                        continue
                    px, pm = xm(md.get(c, {}).get(per))
                    if px is not None or pm is not None:
                        ehas = True
                        e += (px or 0) + (pm or 0)
                cx, cm = xm(md.get("CHN", {}).get(per)) if rep != "CHN" else (None, None)
                c_t = None if (cx is None and cm is None) else (cx or 0) + (cm or 0)
                em_s.append(rnd(pct(e, wt), 2) if ehas else None)
                cn_s.append(rnd(pct(c_t, wt), 2))
                w_m.append(rnd(wt, 1))
                sums["em"].append(e if ehas else None)
                sums["cn"].append(c_t)
                sums["w"].append(wt)

            def ttm(key, sl):
                a = [v for v in sums[key][sl] if v is not None]
                b = [v for v in sums["w"][sl] if v is not None]
                if len(b) < 10 or not a:
                    return None
                return round(sum(a) / sum(b) * 100, 2) if sum(b) else None

            n = len(months)
            last12 = slice(max(0, n - 12), n)
            prev12 = slice(max(0, n - 24), max(0, n - 12))
            if any(v is not None for v in w_m):
                mon = {
                    "emerging_share": em_s, "china_share": cn_s, "world_total": w_m,
                    "ttm": {
                        "emerging_share": ttm("em", last12), "prev_emerging_share": ttm("em", prev12),
                        "china_share": ttm("cn", last12), "prev_china_share": ttm("cn", prev12),
                        "last_month": next((months[i] for i in range(n - 1, -1, -1) if w_m[i] is not None), None),
                    },
                }

        L = str(rep_latest)
        cn = partners.get("CHN")
        countries[rep] = {
            "name": name,
            "iso2": ref.get("iso2"),
            "in_world_list": rep in world_ref,
            "latest_year": rep_latest,
            "world": {"years": w_years, "total": rnd(world_tot.get(L))},
            "partners": partners,
            "emerging": emerging,
            "traditional": traditional,
            "top_emerging": em_ranked[0] if em_ranked else None,
            # largest of the tracked partners (EU aggregate excluded), not necessarily the overall #1
            "top_partner": indiv[0] if indiv else None,
            "top_partner_share": partners[indiv[0]]["share"] if indiv else None,
            "china_export_share": cn["x_share"] if cn else None,
            "china_import_share": cn["m_share"] if cn else None,
            "hhi_tracked": hhi,
            "eu_member": rep in EU_MEMBERS,
            "monthly": mon,
        }

    # partner totals (sum over reporters, as reported/estimated by the reporters)
    partner_totals = {}
    for code in EMERGING_CODES + TRAD_CODES:
        yrs = {}
        for yy in years:
            s = 0.0
            for rep, c in countries.items():
                p = c["partners"].get(code)
                r = p and p["years"].get(str(yy))
                if r:
                    s += (r.get("x") or 0) + (r.get("m") or 0)
            yrs[str(yy)] = round(s, 1)
        top_for = sorted(r for r, c in countries.items() if c["top_partner"] == code)
        top_em_for = sorted(r for r, c in countries.items() if c["top_emerging"] == code)
        partner_totals[code] = {"years": yrs, "top_partner_for": top_for, "top_emerging_for": top_em_for}

    # shifts toward / away from the emerging partners (5-year change, in percentage points)
    cand = []
    for rep, c in countries.items():
        e = c["emerging"]
        if e["change_5y"] is None or (c["world"]["total"] or 0) < MIN_TRADE_SHIFTS or rep in PARTNER_ISO3.values():
            continue
        top_gain = None
        for code in EMERGING_CODES:
            p = c["partners"].get(code)
            if p and p["change_5y"] is not None and (top_gain is None or p["change_5y"] > top_gain[1]):
                top_gain = (code, p["change_5y"])
        cand.append({
            "iso3": rep, "name": c["name"], "iso2": c["iso2"],
            "share": e["share"], "share_5y": e["share_5y"], "change_5y": e["change_5y"], "change_10y": e["change_10y"],
            "traditional_change_5y": c["traditional"]["change_5y"],
            "biggest_gainer": top_gain[0] if top_gain else None,
            "biggest_gainer_change": top_gain[1] if top_gain else None,
            "total_trade": c["world"]["total"],
        })
    toward = sorted(cand, key=lambda r: -r["change_5y"])[:40]
    away = sorted(cand, key=lambda r: r["change_5y"])[:20]

    # meta
    in_world = [r for r in countries if r in world_ref]
    missing = sorted(r for r in world_ref if r not in countries)
    out = {
        "_meta": {
            "source": "IMF International Merchandise Trade Statistics (IMTS, formerly Direction of Trade Statistics)",
            "source_url": "https://data.imf.org/en/datasets/IMF.STA:IMTS",
            "api": API,
            "indicators": {"exports": "XG_FOB_USD", "imports": "MG_CIF_USD (MG_FOB_USD where CIF is missing)"},
            "counterpart_codes": {"world": WORLD, "eu": "G998"},
            "unit": "USD millions (current prices)",
            "last_updated": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "latest_year": latest,
            "first_year": years[0],
            "base_5y": y5,
            "base_10y": y10,
            "latest_month": latest_month,
            "months": months,
            "emerging_codes": EMERGING_CODES,
            "traditional_codes": TRAD_CODES,
            "reporters": len(countries),
            "reporters_in_world_list": len(in_world),
            "missing_from_imf": missing,
            "min_trade_for_shifts_musd": MIN_TRADE_SHIFTS,
            "notes": [
                f"Annual figures run to {latest}, the latest year with near-complete coverage; monthly figures to {latest_month}. Recent periods are revised as countries report.",
                "Total trade = exports (FOB) + imports (CIF). Shares are of the reporter's trade with the world.",
                "IMTS fills gaps with partner-country (mirror) data and IMF staff estimates; every observation is flagged as mixed-type data, so small and non-reporting economies rely heavily on what their partners declare.",
                "The EU-27 is a single counterpart (IMF code G998); for EU members it includes trade with other members.",
                "Goods only: services, and re-exports routed through hubs (e.g. UAE, Netherlands, Singapore, Hong Kong), can distort bilateral patterns.",
            ],
        },
        "partners": [
            {"code": c, "iso3": PARTNER_ISO3[c], "name": PARTNER_NAME[c], "group": "emerging" if c in EMERGING_CODES else "traditional"}
            for c in EMERGING_CODES + TRAD_CODES
        ],
        "countries": countries,
        "partner_totals": partner_totals,
        "shifts": {"toward_emerging": toward, "away_from_emerging": away},
        "comtrade": comtrade_refs(),
    }
    out["_meta"]["runtime_seconds"] = round(time.time() - t0, 1)
    out["_meta"]["requests"] = N_REQ

    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)
    log(f"Wrote {OUT}: {len(countries)} reporters, latest year {latest}, latest month {latest_month}, "
        f"{os.path.getsize(OUT) / 1e6:.1f} MB, {N_REQ} requests, {time.time() - t0:.1f}s")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"ERROR: {e}")
        sys.exit(1)

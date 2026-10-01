#!/usr/bin/env python3
"""Fetch headline SDG indicator values per country from the official UN SDG API.

For each of the 17 goals a single headline series is fetched from
https://unstats.un.org/SDGAPI and the latest available total (non-disaggregated)
value per country is kept. Country codes in the API are M49 numeric, which
coincide with ISO 3166-1 numeric for member states; the mapping to ISO3 comes
from the lukes/ISO-3166 dataset (same source pattern as fetch_visa_data.py).

Output: site/server/data/sdg-progress.json
"""

import csv
import io
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

API_BASE = "https://unstats.un.org/SDGAPI/v1/sdg"
M49_CSV_URL = "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.csv"

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "site", "server", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "sdg-progress.json")
UN_GROUP_FILE = os.path.join(
    os.path.dirname(__file__), "..", "worldcountrygroups", "data", "groups", "un.json"
)

REQUEST_TIMEOUT = 60
PAGE_SIZE = 2000
FLOOR_YEAR = 2015  # don't look for values older than the SDG baseline
USER_AGENT = "WCG-SDGFetcher/1.0"

# One headline series per goal (code -> goal number, short label).
HEADLINE_SERIES = [
    ("1", "SI_POV_DAY1", "Population below international poverty line (%)"),
    ("2", "SN_ITK_DEFC", "Prevalence of undernourishment (%)"),
    ("3", "SH_DYN_MORT", "Under-five mortality rate (per 1,000 live births)"),
    ("4", "SE_TOT_CPLR", "Primary school completion rate (%)"),
    ("5", "SG_GEN_PARL", "Seats held by women in national parliament (%)"),
    ("6", "SH_H2O_SAFE", "Population using safely managed drinking water (%)"),
    ("7", "EG_ACS_ELEC", "Population with access to electricity (%)"),
    ("8", "NY_GDP_PCAP", "Annual growth rate of real GDP per capita (%)"),
    ("9", "NV_IND_MANF", "Manufacturing value added as share of GDP (%)"),
    ("10", "SI_POV_50MI", "Population below 50% of median income (%)"),
    ("11", "EN_ATM_PM25", "Annual mean PM2.5 in urban areas (µg/m³)"),
    ("12", "EN_MAT_DOMCMPC", "Domestic material consumption per capita (tonnes)"),
    ("13", "VC_DSR_MTMP", "Disaster deaths and missing persons (per 100,000)"),
    ("14", "ER_MRN_MPA", "Marine Key Biodiversity Areas protected (%)"),
    ("15", "AG_LND_FRST", "Forest area as share of land area (%)"),
    ("16", "VC_IHR_PSRC", "Intentional homicide victims (per 100,000)"),
    ("17", "IT_USE_ii99", "Individuals using the Internet (%)"),
]

# Dimension values that denote a non-disaggregated total.
TOTAL_DIM_VALUES = {
    "BOTHSEX", "ALLAGE", "ALLAREA", "_T", "TOTAL", "ALLEDU", "ALLSKILL",
    "ALL", "T", "_X",
}
# When a series has no total for a dimension, take this slice instead.
PREFERRED_DIM_VALUES = {
    "Education level": "PRIMAR",
    "Quantile": "_T",
    "Quintile": "_T",
}


def http_get(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        return resp.read()


def load_un_members():
    with open(UN_GROUP_FILE) as f:
        data = json.load(f)
    return {c["iso3"].upper() for c in data["countries"]}


def fetch_m49_to_iso3():
    raw = http_get(M49_CSV_URL).decode("utf-8")
    mapping = {}
    for row in csv.DictReader(io.StringIO(raw)):
        code = row.get("country-code", "").strip()
        iso3 = row.get("alpha-3", "").strip().upper()
        if code and iso3:
            mapping[str(int(code))] = iso3
    return mapping


def parse_value(raw):
    if raw is None:
        return None
    text = str(raw).strip().lstrip("<>~")
    try:
        return round(float(text), 4)
    except ValueError:
        return None


def record_is_total(record, singleton_dims):
    for dim, value in (record.get("dimensions") or {}).items():
        if dim == "Reporting Type":
            continue
        if dim in singleton_dims:
            continue
        if value in TOTAL_DIM_VALUES:
            continue
        if PREFERRED_DIM_VALUES.get(dim) == value:
            continue
        return False
    return True


def fetch_series(series_code, un_members, m49_to_iso3, current_year):
    """Return {iso3: {"year": int, "value": float}} with the latest total per country."""
    results = {}
    singleton_dims = None

    for year in range(current_year, FLOOR_YEAR - 1, -1):
        if len(results) >= len(un_members):
            break
        page = 1
        while True:
            params = urllib.parse.urlencode(
                {"seriesCode": series_code, "timePeriod": year,
                 "page": page, "pageSize": PAGE_SIZE}
            )
            body = json.loads(http_get(f"{API_BASE}/Series/Data?{params}"))

            if singleton_dims is None:
                singleton_dims = {
                    d["id"] for d in body.get("dimensions", [])
                    if len(d.get("codes", [])) == 1
                }

            for record in body.get("data", []):
                iso3 = m49_to_iso3.get(str(record.get("geoAreaCode", "")).strip())
                if not iso3 or iso3 in results or iso3 not in un_members:
                    continue
                if not record_is_total(record, singleton_dims):
                    continue
                value = parse_value(record.get("value"))
                if value is None:
                    continue
                results[iso3] = {"year": year, "value": value}

            if page * PAGE_SIZE >= body.get("totalElements", 0):
                break
            page += 1

    return results


def main():
    print(f"Fetching SDG headline indicators... ({datetime.now(timezone.utc).isoformat()})")

    un_members = load_un_members()
    m49_to_iso3 = fetch_m49_to_iso3()
    current_year = datetime.now(timezone.utc).year
    print(f"  UN members: {len(un_members)}, M49 mappings: {len(m49_to_iso3)}")

    series_meta = {}
    countries = {}

    for goal, code, label in HEADLINE_SERIES:
        try:
            values = fetch_series(code, un_members, m49_to_iso3, current_year)
        except Exception as e:
            print(f"  Goal {goal} ({code}): ERROR - {e}", file=sys.stderr)
            continue

        series_meta[code] = {"goal": int(goal), "description": label}
        for iso3, entry in values.items():
            countries.setdefault(iso3, {})[goal] = {"series": code, **entry}
        print(f"  Goal {goal} ({code}): {len(values)} countries")

    output = {
        "_meta": {
            "generated": datetime.now(timezone.utc).isoformat(),
            "source": "UN Statistics Division SDG API (unstats.un.org/SDGAPI)",
            "floorYear": FLOOR_YEAR,
            "countryCount": len(countries),
        },
        "series": series_meta,
        "countries": countries,
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=1, ensure_ascii=False)
    print(f"Wrote {OUTPUT_FILE}: {len(countries)} countries, {len(series_meta)} series")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Fetch and process SIPRI Arms Transfers Database data.

SIPRI doesn't have a public API with direct programmatic access. This script
works with manually downloaded CSV files from SIPRI's TIV (Trend Indicator Values)
tables: https://www.sipri.org/databases/armstransfers

Usage:
  1. Go to https://www.sipri.org/databases/armstransfers
  2. Download "TIV of arms exports" as CSV -> save as sipri_exports.csv
  3. Download "TIV of arms imports" as CSV -> save as sipri_imports.csv
  4. Place both in the same directory as this script (or set SIPRI_CSV_DIR env var)
  5. Run: python3 fetch_sipri.py

If CSV files are not found, the script generates realistic seed data based on
publicly known SIPRI arms trade rankings and relationships.
"""

import csv
import json
import re
import os
import sys
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "site", "server", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "sipri-arms.json")
CSV_DIR = os.environ.get("SIPRI_CSV_DIR", os.path.dirname(__file__))

YEARS = list(range(2015, 2024))  # 2015-2023

# Country name -> ISO3 mapping for major arms trading nations
NAME_TO_ISO3 = {
    "United States": "USA",
    "Russia": "RUS",
    "France": "FRA",
    "China": "CHN",
    "Germany": "DEU",
    "Italy": "ITA",
    "United Kingdom": "GBR",
    "Spain": "ESP",
    "Israel": "ISR",
    "South Korea": "KOR",
    "Netherlands": "NLD",
    "Turkey": "TUR",
    "Ukraine": "UKR",
    "Sweden": "SWE",
    "Switzerland": "CHE",
    "Canada": "CAN",
    "Australia": "AUS",
    "Norway": "NOR",
    "Brazil": "BRA",
    "South Africa": "ZAF",
    "Japan": "JPN",
    "Poland": "POL",
    "Czech Republic": "CZE",
    "Belarus": "BLR",
    "India": "IND",
    "Saudi Arabia": "SAU",
    "Egypt": "EGY",
    "Qatar": "QAT",
    "UAE": "ARE",
    "United Arab Emirates": "ARE",
    "Pakistan": "PAK",
    "Iraq": "IRQ",
    "Algeria": "DZA",
    "Indonesia": "IDN",
    "Vietnam": "VNM",
    "Bangladesh": "BGD",
    "Thailand": "THA",
    "Singapore": "SGP",
    "Taiwan": "TWN",
    "Morocco": "MAR",
    "Mexico": "MEX",
    "Colombia": "COL",
    "Philippines": "PHL",
    "Kuwait": "KWT",
    "Oman": "OMN",
    "Jordan": "JOR",
    "Nigeria": "NGA",
    "Angola": "AGO",
    "Myanmar": "MMR",
    "Kazakhstan": "KAZ",
    "Azerbaijan": "AZE",
    "Turkmenistan": "TKM",
    "Greece": "GRC",
    "Finland": "FIN",
    "Denmark": "DNK",
    "Romania": "ROU",
    "Peru": "PER",
    "Chile": "CHL",
    "Venezuela": "VEN",
    "Afghanistan": "AFG",
    "Ethiopia": "ETH",
    "Kenya": "KEN",
    "Tanzania": "TZA",
    "Uganda": "UGA",
    "Sudan": "SDN",
    "Libya": "LBY",
    "Tunisia": "TUN",
    "Iran": "IRN",
    "Bahrain": "BHR",
    "Malaysia": "MYS",
    "Sri Lanka": "LKA",
    "Nepal": "NPL",
    "Czechia": "CZE",
    "Korea, South": "KOR",
    "Korea, North": "PRK",
    "North Korea": "PRK",
}


def parse_sipri_csv(filepath):
    """
    Parse a SIPRI TIV table CSV.

    SIPRI CSVs typically have:
    - Row headers = country names
    - Column headers = years
    - Values = TIV figures (empty or 0 means no transfers)
    """
    transfers = {}
    with open(filepath, "r", encoding="utf-8-sig") as f:
        lines = f.readlines()

    if not lines:
        return transfers

    # Find header row with years
    header = None
    header_idx = 0
    for i, line in enumerate(lines):
        parts = [p.strip().strip('"') for p in line.split(",")]
        year_cols = [p for p in parts if p.isdigit() and 2000 <= int(p) <= 2030]
        if len(year_cols) >= 3:
            header = parts
            header_idx = i
            break

    if not header:
        print(f"  Warning: could not find year headers in {filepath}")
        return transfers

    # Map column indices to years
    year_indices = {}
    for j, col in enumerate(header):
        if col.isdigit() and 2000 <= int(col) <= 2030:
            year_indices[j] = int(col)

    # Parse data rows
    for line in lines[header_idx + 1:]:
        parts = [p.strip().strip('"') for p in line.split(",")]
        if not parts or not parts[0]:
            continue

        country_name = parts[0]
        iso3 = NAME_TO_ISO3.get(country_name)
        if not iso3:
            # Try partial matches
            for name, code in NAME_TO_ISO3.items():
                if name.lower() in country_name.lower() or country_name.lower() in name.lower():
                    iso3 = code
                    break

        if not iso3:
            print(f"  Skipping unmapped country: {country_name}")
            continue

        yearly = {}
        for j, year in year_indices.items():
            if year not in YEARS:
                continue
            if j < len(parts):
                val = parts[j].strip()
                if val and val != "0":
                    try:
                        yearly[year] = round(float(val))
                    except ValueError:
                        pass

        if yearly:
            transfers[iso3] = yearly

    return transfers


def generate_seed_data():
    """
    Generate realistic seed data based on publicly known SIPRI arms trade
    rankings and relationships (2015-2023 period).
    """
    print("CSV files not found. Generating seed data from known SIPRI rankings...")

    # Major arms transfer relationships: (supplier, recipient, avg_annual_tiv)
    # Based on publicly available SIPRI data summaries and reports
    known_transfers = [
        # USA exports
        ("USA", "SAU", 3200),
        ("USA", "AUS", 1800),
        ("USA", "QAT", 1500),
        ("USA", "ARE", 1200),
        ("USA", "JPN", 1100),
        ("USA", "KOR", 1000),
        ("USA", "ISR", 900),
        ("USA", "GBR", 850),
        ("USA", "IND", 800),
        ("USA", "TWN", 750),
        ("USA", "IRQ", 700),
        ("USA", "EGY", 650),
        ("USA", "SGP", 600),
        ("USA", "NOR", 500),
        ("USA", "GRC", 450),
        ("USA", "KWT", 400),
        ("USA", "JOR", 350),
        ("USA", "PAK", 300),
        ("USA", "POL", 280),
        ("USA", "NLD", 260),
        ("USA", "DEU", 240),
        ("USA", "BHR", 220),
        ("USA", "MAR", 200),
        ("USA", "PHL", 180),
        ("USA", "IDN", 160),
        ("USA", "TUR", 150),
        ("USA", "CAN", 140),
        ("USA", "COL", 120),
        ("USA", "DNK", 110),
        ("USA", "FIN", 100),

        # Russia exports
        ("RUS", "IND", 3500),
        ("RUS", "CHN", 2800),
        ("RUS", "DZA", 1500),
        ("RUS", "EGY", 1200),
        ("RUS", "VNM", 800),
        ("RUS", "IRQ", 600),
        ("RUS", "TUR", 500),
        ("RUS", "KAZ", 400),
        ("RUS", "BGD", 350),
        ("RUS", "MMR", 300),
        ("RUS", "BLR", 280),
        ("RUS", "AZE", 250),
        ("RUS", "IDN", 230),
        ("RUS", "SYR", 200),
        ("RUS", "IRN", 180),
        ("RUS", "TKM", 160),
        ("RUS", "AGO", 140),
        ("RUS", "ETH", 120),
        ("RUS", "SDN", 100),
        ("RUS", "LBY", 90),
        ("RUS", "PAK", 80),
        ("RUS", "LKA", 70),
        ("RUS", "NGA", 60),

        # France exports
        ("FRA", "EGY", 1800),
        ("FRA", "IND", 1600),
        ("FRA", "QAT", 1400),
        ("FRA", "SAU", 800),
        ("FRA", "ARE", 600),
        ("FRA", "AUS", 500),
        ("FRA", "SGP", 350),
        ("FRA", "GRC", 300),
        ("FRA", "IDN", 280),
        ("FRA", "BRA", 250),
        ("FRA", "MAR", 220),
        ("FRA", "MYS", 200),
        ("FRA", "KWT", 180),
        ("FRA", "PHL", 150),
        ("FRA", "POL", 130),

        # Germany exports
        ("DEU", "KOR", 900),
        ("DEU", "GRC", 600),
        ("DEU", "ISR", 500),
        ("DEU", "EGY", 450),
        ("DEU", "USA", 400),
        ("DEU", "AUS", 350),
        ("DEU", "TUR", 300),
        ("DEU", "IDN", 280),
        ("DEU", "SGP", 250),
        ("DEU", "NOR", 220),
        ("DEU", "GBR", 200),
        ("DEU", "NLD", 180),
        ("DEU", "CHL", 160),
        ("DEU", "IND", 140),
        ("DEU", "POL", 120),

        # China exports
        ("CHN", "PAK", 1500),
        ("CHN", "BGD", 800),
        ("CHN", "MMR", 600),
        ("CHN", "THA", 400),
        ("CHN", "DZA", 350),
        ("CHN", "NGA", 300),
        ("CHN", "IDN", 250),
        ("CHN", "VEN", 200),
        ("CHN", "TZA", 180),
        ("CHN", "KAZ", 160),
        ("CHN", "SDN", 140),
        ("CHN", "IRN", 120),
        ("CHN", "SAU", 100),
        ("CHN", "TKM", 90),
        ("CHN", "ETH", 80),

        # UK exports
        ("GBR", "SAU", 1200),
        ("GBR", "USA", 500),
        ("GBR", "OMN", 400),
        ("GBR", "QAT", 350),
        ("GBR", "IND", 300),
        ("GBR", "KOR", 250),
        ("GBR", "ARE", 200),
        ("GBR", "IDN", 180),
        ("GBR", "THA", 160),
        ("GBR", "BHR", 140),

        # Italy exports
        ("ITA", "TUR", 600),
        ("ITA", "EGY", 500),
        ("ITA", "QAT", 400),
        ("ITA", "KWT", 350),
        ("ITA", "ARE", 300),
        ("ITA", "PAK", 250),
        ("ITA", "USA", 200),
        ("ITA", "ISR", 180),
        ("ITA", "NGA", 160),
        ("ITA", "TKM", 140),

        # Israel exports
        ("ISR", "IND", 800),
        ("ISR", "AZE", 500),
        ("ISR", "SGP", 300),
        ("ISR", "VNM", 250),
        ("ISR", "DEU", 200),
        ("ISR", "PHL", 180),
        ("ISR", "BRA", 150),
        ("ISR", "COL", 120),
        ("ISR", "AUS", 100),

        # South Korea exports
        ("KOR", "IDN", 500),
        ("KOR", "PHL", 350),
        ("KOR", "IND", 300),
        ("KOR", "TUR", 250),
        ("KOR", "IRQ", 200),
        ("KOR", "GBR", 180),
        ("KOR", "POL", 400),
        ("KOR", "THA", 150),
        ("KOR", "PER", 120),
        ("KOR", "NOR", 100),

        # Spain exports
        ("ESP", "AUS", 400),
        ("ESP", "TUR", 350),
        ("ESP", "SAU", 300),
        ("ESP", "EGY", 250),
        ("ESP", "NOR", 200),

        # Netherlands exports
        ("NLD", "IDN", 300),
        ("NLD", "JOR", 250),
        ("NLD", "EGY", 200),
        ("NLD", "USA", 150),

        # Sweden exports
        ("SWE", "ARE", 300),
        ("SWE", "BRA", 250),
        ("SWE", "USA", 200),
        ("SWE", "PAK", 150),
        ("SWE", "THA", 120),

        # Turkey exports
        ("TUR", "AZE", 400),
        ("TUR", "UKR", 300),
        ("TUR", "PAK", 250),
        ("TUR", "QAT", 200),
        ("TUR", "TKM", 180),
        ("TUR", "BGD", 150),
        ("TUR", "NGA", 120),
        ("TUR", "MAR", 100),

        # Ukraine exports
        ("UKR", "THA", 300),
        ("UKR", "CHN", 250),
        ("UKR", "IDN", 200),
        ("UKR", "MMR", 150),

        # Switzerland exports
        ("CHE", "SAU", 200),
        ("CHE", "IND", 180),
        ("CHE", "ARE", 150),
        ("CHE", "BRA", 120),

        # Canada exports
        ("CAN", "SAU", 400),
        ("CAN", "ARE", 200),
        ("CAN", "NZL", 100),

        # Australia exports (small)
        ("AUS", "IDN", 100),
        ("AUS", "USA", 80),
    ]

    import random
    random.seed(42)  # Reproducible

    transfers = []
    for supplier, recipient, avg_tiv in known_transfers:
        years_data = {}
        for year in YEARS:
            # Add realistic year-to-year variation (~25%)
            variation = random.uniform(0.5, 1.5)
            # Gradual trend: some suppliers increase, some decrease
            trend = 1.0
            if supplier == "USA":
                trend = 1.0 + (year - 2019) * 0.02
            elif supplier == "RUS":
                trend = 1.0 - (year - 2019) * 0.03  # declining after 2019
            elif supplier == "FRA":
                trend = 1.0 + (year - 2019) * 0.04  # France increasing
            elif supplier == "CHN":
                trend = 1.0 + (year - 2019) * 0.03
            elif supplier == "KOR":
                trend = 1.0 + (year - 2019) * 0.05  # South Korea rapidly growing
            elif supplier == "TUR":
                trend = 1.0 + (year - 2019) * 0.06  # Turkey rapidly growing

            tiv = max(0, round(avg_tiv * variation * trend))
            if tiv > 0:
                years_data[year] = tiv

        tiv_total = sum(years_data.values())
        if tiv_total > 0:
            transfers.append({
                "supplier": supplier,
                "recipient": recipient,
                "tiv_total": tiv_total,
                "years": {str(y): v for y, v in sorted(years_data.items())}
            })

    return transfers


def build_country_summaries(transfers):
    """Build per-country export/import summaries from transfer records."""
    countries = {}

    # Aggregate exports and imports
    for t in transfers:
        supplier = t["supplier"]
        recipient = t["recipient"]
        tiv = t["tiv_total"]

        # Supplier (exporter) side
        if supplier not in countries:
            countries[supplier] = {
                "total_exports": 0,
                "total_imports": 0,
                "recipients": {},
                "suppliers": {},
            }
        countries[supplier]["total_exports"] += tiv
        countries[supplier]["recipients"][recipient] = (
            countries[supplier]["recipients"].get(recipient, 0) + tiv
        )

        # Recipient (importer) side
        if recipient not in countries:
            countries[recipient] = {
                "total_exports": 0,
                "total_imports": 0,
                "recipients": {},
                "suppliers": {},
            }
        countries[recipient]["total_imports"] += tiv
        countries[recipient]["suppliers"][supplier] = (
            countries[recipient]["suppliers"].get(supplier, 0) + tiv
        )

    # Sort by exports and imports for ranking
    export_ranked = sorted(countries.keys(), key=lambda c: -countries[c]["total_exports"])
    import_ranked = sorted(countries.keys(), key=lambda c: -countries[c]["total_imports"])

    result = {}
    for iso3, data in countries.items():
        top_recipients = sorted(
            [{"iso3": k, "tiv": v} for k, v in data["recipients"].items()],
            key=lambda x: -x["tiv"],
        )[:10]
        top_suppliers = sorted(
            [{"iso3": k, "tiv": v} for k, v in data["suppliers"].items()],
            key=lambda x: -x["tiv"],
        )[:10]

        result[iso3] = {
            "total_exports": data["total_exports"],
            "total_imports": data["total_imports"],
            "top_recipients": top_recipients,
            "top_suppliers": top_suppliers,
            "export_rank": export_ranked.index(iso3) + 1,
            "import_rank": import_ranked.index(iso3) + 1,
        }

    return result


SIPRI_API = "https://atbackend.sipri.org/api/p"
WORLD_JSON = os.path.join(os.path.dirname(__file__), "..", "worldcountrygroups", "data", "groups", "world.json")

# SIPRI country names that differ from our world.json names
SIPRI_ALIASES = {
    "United States": "USA", "Russia": "RUS", "United Kingdom": "GBR", "South Korea": "KOR",
    "North Korea": "PRK", "UAE": "ARE", "United Arab Emirates": "ARE", "Turkiye": "TUR",
    "Turkey": "TUR", "Viet Nam": "VNM", "Vietnam": "VNM", "Iran": "IRN", "Syria": "SYR",
    "Laos": "LAO", "DR Congo": "COD", "Congo": "COG", "Cote d'Ivoire": "CIV",
    "Bosnia-Herzegovina": "BIH", "Brunei": "BRN", "Cabo Verde": "CPV", "Cape Verde": "CPV",
    "Czechia": "CZE", "Czech Republic": "CZE", "Eswatini": "SWZ", "Swaziland": "SWZ",
    "Micronesia": "FSM", "Moldova": "MDA", "Myanmar": "MMR", "North Macedonia": "MKD",
    "Macedonia": "MKD", "Palestine": "PSE", "Taiwan": "TWN", "Tanzania": "TZA",
    "Timor-Leste": "TLS", "East Timor": "TLS", "Bolivia": "BOL", "Venezuela": "VEN",
    "Gambia": "GMB", "Bahamas": "BHS", "Saint Vincent": "VCT", "Sao Tome and Principe": "STP",
    "Netherlands": "NLD", "Kosovo": "XKX", "Trinidad and Tobago": "TTO",
    "Saint Kitts and Nevis": "KNA", "Antigua and Barbuda": "ATG",
    "Egypt": "EGY", "Kyrgyzstan": "KGZ", "eSwatini": "SWZ", "Western Sahara": "ESH",
}


def _post(path, filters):
    import base64
    from urllib.request import Request, urlopen
    body = json.dumps({"filters": filters, "logic": "AND"}).encode()
    req = Request(f"{SIPRI_API}{path}", data=body, method="POST", headers={
        "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 worldcountrygroups",
        "Origin": "https://armstransfers.sipri.org"})
    for attempt in range(3):
        try:
            with urlopen(req, timeout=300) as r:
                return base64.b64decode(json.load(r)["bytes"]).decode("utf-8", "replace")
        except Exception:
            if attempt == 2:
                raise
            import time
            time.sleep(5 * (attempt + 1))


def _get(path):
    from urllib.request import Request, urlopen
    req = Request(f"{SIPRI_API}{path}", headers={"User-Agent": "Mozilla/5.0 worldcountrygroups"})
    with urlopen(req, timeout=120) as r:
        return r.read().decode()


def _tiv_table(csv_text):
    """Parse a SIPRI import/export TIV table into {name: {year: tiv}}."""
    rows = list(csv.reader(csv_text.splitlines()))
    start = next(i for i, r in enumerate(rows) if r and r[0] in ("Recipient", "Exports by", "Supplier"))
    header = rows[start]
    year_cols = [(i, h) for i, h in enumerate(header) if re.fullmatch(r"\d{4}", h.strip())]
    out = {}
    for r in rows[start + 1:]:
        if not r or not r[0].strip() or r[0].strip().lower().startswith("total"):
            continue
        yearly = {}
        for i, y in year_cols:
            v = r[i].strip() if i < len(r) else ""
            if v and v != "?":
                yearly[y] = int(float(v))
        out[r[0].strip()] = yearly
    return out


def fetch_real():
    """Fetch real TIV tables (including bilateral flows) from SIPRI's public API."""
    world = json.load(open(WORLD_JSON))["countries"]
    by_name = {c["name"]: c["iso3"] for c in world}

    def iso(name):
        return SIPRI_ALIASES.get(name) or by_name.get(name) or NAME_TO_ISO3.get(name)

    last = int(_get("/trades/getMaxYear").strip())
    first = last - 10
    base = [
        {"field": "Year range 1", "oldField": "", "condition": "contains", "value1": first, "value2": last, "listData": []},
        {"field": "DeliveryType", "oldField": "", "condition": "", "value1": "delivered", "value2": "", "listData": []},
        {"field": "Status", "oldField": "", "condition": "", "value1": "0", "value2": "", "listData": []},
    ]
    seller = {"field": "orderbyseller", "oldField": "", "condition": "", "value1": "", "value2": "", "listData": []}

    print(f"Fetching SIPRI TIV tables {first}-{last}...")
    imports = _tiv_table(_post("/trades/import-export-csv/", base))
    exports = _tiv_table(_post("/trades/import-export-csv/", base + [seller]))
    print(f"  {len(imports)} recipients, {len(exports)} suppliers")

    entity = {c["Name"]: c["EntityId"] for c in json.loads(_get("/countries/getAllCountriesTrimmed"))}
    transfers, unmatched = [], set()
    for sname, yearly in sorted(exports.items(), key=lambda kv: -sum(kv[1].values())):
        s_iso = iso(sname)
        if not s_iso or sname not in entity:
            unmatched.add(sname)
            continue
        if not sum(yearly.values()):
            continue
        flt = [{"field": "Supplier", "oldField": "", "condition": "contains", "value1": "", "value2": "",
                "listData": [entity[sname]]}] + base
        for rname, ry in _tiv_table(_post("/trades/import-export-csv/", flt)).items():
            r_iso = iso(rname)
            if not r_iso:
                unmatched.add(rname)
                continue
            total = sum(ry.values())
            if total > 0:
                transfers.append({"supplier": s_iso, "recipient": r_iso, "tiv_total": total, "years": ry})
        print(f"  {s_iso}: done")

    countries = build_country_summaries(transfers)
    # Country totals come from the full tables (they include deliveries from/to
    # non-state actors and organisations that are excluded from bilateral flows).
    for name, yearly in imports.items():
        c = iso(name)
        if c:
            countries.setdefault(c, {"total_exports": 0, "total_imports": 0, "top_recipients": [], "top_suppliers": []})
            countries[c]["total_imports"] = sum(yearly.values())
            countries[c]["imports_by_year"] = yearly
        else:
            unmatched.add(name)
    for name, yearly in exports.items():
        c = iso(name)
        if c:
            countries.setdefault(c, {"total_exports": 0, "total_imports": 0, "top_recipients": [], "top_suppliers": []})
            countries[c]["total_exports"] = sum(yearly.values())
            countries[c]["exports_by_year"] = yearly
    exp_rank = sorted(countries, key=lambda c: -countries[c]["total_exports"])
    imp_rank = sorted(countries, key=lambda c: -countries[c]["total_imports"])
    for c in countries:
        countries[c]["export_rank"] = exp_rank.index(c) + 1
        countries[c]["import_rank"] = imp_rank.index(c) + 1

    if unmatched:
        print("  Not mapped to a country (non-state actors, organisations, historic states):")
        print("   ", ", ".join(sorted(unmatched)))
    return transfers, countries, f"{first}-{last}"


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", action="store_true", help="write SYNTHETIC placeholder data (not real SIPRI figures)")
    args = ap.parse_args()

    synthetic = False
    if args.seed:
        print("Generating SYNTHETIC placeholder data (not real SIPRI figures)...")
        transfers = generate_seed_data()
        countries = build_country_summaries(transfers)
        years, synthetic = f"{YEARS[0]}-{YEARS[-1]}", True
    else:
        try:
            transfers, countries, years = fetch_real()
        except Exception as e:
            sys.exit(f"SIPRI fetch failed ({e}); existing {OUTPUT_FILE} left unchanged.")
        if len(transfers) < 100 or len(countries) < 50:
            sys.exit(f"SIPRI fetch returned too little data; existing {OUTPUT_FILE} left unchanged.")

    transfers.sort(key=lambda t: -t["tiv_total"])
    output = {
        "_meta": {
            "updated_at": datetime.now().strftime("%Y-%m-%d"),
            "source": "SYNTHETIC placeholder data (not real SIPRI figures)" if synthetic
                      else "SIPRI Arms Transfers Database (public TIV tables)",
            "url": "https://armstransfers.sipri.org/",
            "years": years,
            "note": "TIV = Trend Indicator Value (volume of major conventional arms, not financial value). "
                    "Bilateral flows cover state suppliers and recipients only.",
            "transfer_count": len(transfers),
            "country_count": len(countries),
            **({"synthetic": True} if synthetic else {}),
        },
        "transfers": transfers,
        "countries": countries,
    }
    tmp = OUTPUT_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(output, f, indent=2)
    os.replace(tmp, OUTPUT_FILE)
    print(f"Wrote {OUTPUT_FILE}: {len(transfers)} transfers, {len(countries)} countries, years {years}")


if __name__ == "__main__":
    main()

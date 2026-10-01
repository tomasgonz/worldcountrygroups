#!/usr/bin/env python3
"""Fetch OECD DAC Official Development Assistance (ODA) data.

Tries the OECD SDMX API first; falls back to generating realistic seed data
based on known ODA flows from the DAC statistics.
"""

import json
import os
import sys
import random
from datetime import datetime, timezone

import requests

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "site", "server", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "oecd-oda.json")

YEARS = [2018, 2019, 2020, 2021, 2022]

# DAC donor countries with approximate total ODA (millions USD, 2018-2022 cumulative)
DAC_DONORS = {
    "USA": {"total_m": 35000, "oda_gni": 0.18},
    "DEU": {"total_m": 25000, "oda_gni": 0.73},
    "GBR": {"total_m": 15000, "oda_gni": 0.51},
    "JPN": {"total_m": 16000, "oda_gni": 0.34},
    "FRA": {"total_m": 14000, "oda_gni": 0.56},
    "SWE": {"total_m": 6000, "oda_gni": 0.99},
    "NOR": {"total_m": 5000, "oda_gni": 1.02},
    "NLD": {"total_m": 5500, "oda_gni": 0.59},
    "CAN": {"total_m": 5500, "oda_gni": 0.27},
    "ITA": {"total_m": 5000, "oda_gni": 0.29},
    "AUS": {"total_m": 3200, "oda_gni": 0.22},
    "CHE": {"total_m": 3500, "oda_gni": 0.46},
    "DNK": {"total_m": 2800, "oda_gni": 0.73},
    "KOR": {"total_m": 2700, "oda_gni": 0.16},
    "ESP": {"total_m": 2500, "oda_gni": 0.22},
    "BEL": {"total_m": 2200, "oda_gni": 0.46},
    "AUT": {"total_m": 1400, "oda_gni": 0.31},
    "FIN": {"total_m": 1200, "oda_gni": 0.47},
    "IRL": {"total_m": 1100, "oda_gni": 0.31},
    "POL": {"total_m": 800, "oda_gni": 0.14},
    "NZL": {"total_m": 600, "oda_gni": 0.28},
    "LUX": {"total_m": 500, "oda_gni": 1.05},
    "PRT": {"total_m": 400, "oda_gni": 0.17},
    "CZE": {"total_m": 350, "oda_gni": 0.14},
    "GRC": {"total_m": 300, "oda_gni": 0.13},
    "SVK": {"total_m": 150, "oda_gni": 0.13},
    "SVN": {"total_m": 100, "oda_gni": 0.19},
    "HUN": {"total_m": 250, "oda_gni": 0.15},
    "ISL": {"total_m": 80, "oda_gni": 0.28},
    "ARE": {"total_m": 4500, "oda_gni": 0.93},
    "SAU": {"total_m": 3500, "oda_gni": 0.42},
    "TUR": {"total_m": 8500, "oda_gni": 1.12},
}

# Recipient countries with approximate total ODA received (millions USD, 2018-2022 cumulative)
# and which donors typically give to them (regional preferences)
RECIPIENTS = {
    "AFG": {"total_m": 5000, "region": "south_asia"},
    "ETH": {"total_m": 4500, "region": "east_africa"},
    "SYR": {"total_m": 4200, "region": "middle_east"},
    "BGD": {"total_m": 4000, "region": "south_asia"},
    "IND": {"total_m": 3800, "region": "south_asia"},
    "COD": {"total_m": 3500, "region": "central_africa"},
    "TZA": {"total_m": 3200, "region": "east_africa"},
    "MOZ": {"total_m": 3000, "region": "east_africa"},
    "NGA": {"total_m": 3500, "region": "west_africa"},
    "KEN": {"total_m": 3000, "region": "east_africa"},
    "UGA": {"total_m": 2500, "region": "east_africa"},
    "PAK": {"total_m": 3000, "region": "south_asia"},
    "YEM": {"total_m": 2800, "region": "middle_east"},
    "JOR": {"total_m": 3500, "region": "middle_east"},
    "IRQ": {"total_m": 2500, "region": "middle_east"},
    "MMR": {"total_m": 1800, "region": "southeast_asia"},
    "VNM": {"total_m": 2000, "region": "southeast_asia"},
    "IDN": {"total_m": 1800, "region": "southeast_asia"},
    "UKR": {"total_m": 2500, "region": "europe"},
    "COL": {"total_m": 1800, "region": "latin_america"},
    "SSD": {"total_m": 2200, "region": "east_africa"},
    "SOM": {"total_m": 2000, "region": "east_africa"},
    "MLI": {"total_m": 1500, "region": "west_africa"},
    "NER": {"total_m": 1400, "region": "west_africa"},
    "BFA": {"total_m": 1300, "region": "west_africa"},
    "SEN": {"total_m": 1200, "region": "west_africa"},
    "GHA": {"total_m": 1500, "region": "west_africa"},
    "CMR": {"total_m": 1000, "region": "central_africa"},
    "TCD": {"total_m": 900, "region": "central_africa"},
    "ZMB": {"total_m": 1100, "region": "east_africa"},
    "MWI": {"total_m": 1200, "region": "east_africa"},
    "ZWE": {"total_m": 800, "region": "east_africa"},
    "MDG": {"total_m": 1000, "region": "east_africa"},
    "RWA": {"total_m": 1200, "region": "east_africa"},
    "BDI": {"total_m": 600, "region": "east_africa"},
    "LBR": {"total_m": 700, "region": "west_africa"},
    "SLE": {"total_m": 700, "region": "west_africa"},
    "GIN": {"total_m": 600, "region": "west_africa"},
    "HTI": {"total_m": 1000, "region": "latin_america"},
    "HND": {"total_m": 700, "region": "latin_america"},
    "GTM": {"total_m": 600, "region": "latin_america"},
    "SLV": {"total_m": 400, "region": "latin_america"},
    "BOL": {"total_m": 600, "region": "latin_america"},
    "PER": {"total_m": 500, "region": "latin_america"},
    "ECU": {"total_m": 400, "region": "latin_america"},
    "PRY": {"total_m": 200, "region": "latin_america"},
    "KHM": {"total_m": 1200, "region": "southeast_asia"},
    "LAO": {"total_m": 700, "region": "southeast_asia"},
    "NPL": {"total_m": 1400, "region": "south_asia"},
    "LKA": {"total_m": 600, "region": "south_asia"},
    "EGY": {"total_m": 2200, "region": "north_africa"},
    "MAR": {"total_m": 1500, "region": "north_africa"},
    "TUN": {"total_m": 600, "region": "north_africa"},
    "LBN": {"total_m": 1800, "region": "middle_east"},
    "PSE": {"total_m": 1500, "region": "middle_east"},
    "GEO": {"total_m": 700, "region": "europe"},
    "MDA": {"total_m": 500, "region": "europe"},
    "TJK": {"total_m": 500, "region": "central_asia"},
    "KGZ": {"total_m": 500, "region": "central_asia"},
    "UZB": {"total_m": 600, "region": "central_asia"},
    "MNG": {"total_m": 500, "region": "east_asia"},
    "PHL": {"total_m": 1200, "region": "southeast_asia"},
    "PNG": {"total_m": 700, "region": "pacific"},
    "FJI": {"total_m": 200, "region": "pacific"},
    "SLB": {"total_m": 250, "region": "pacific"},
    "TLS": {"total_m": 300, "region": "southeast_asia"},
    "AGO": {"total_m": 400, "region": "central_africa"},
    "CIV": {"total_m": 900, "region": "west_africa"},
    "BEN": {"total_m": 700, "region": "west_africa"},
    "TGO": {"total_m": 400, "region": "west_africa"},
    "CAF": {"total_m": 600, "region": "central_africa"},
    "COG": {"total_m": 400, "region": "central_africa"},
    "ERI": {"total_m": 200, "region": "east_africa"},
    "DJI": {"total_m": 250, "region": "east_africa"},
    "LSO": {"total_m": 200, "region": "east_africa"},
    "SWZ": {"total_m": 150, "region": "east_africa"},
    "GMB": {"total_m": 250, "region": "west_africa"},
    "MRT": {"total_m": 400, "region": "west_africa"},
    "NAM": {"total_m": 200, "region": "east_africa"},
    "BWA": {"total_m": 100, "region": "east_africa"},
}

# Donor regional preferences (weights for allocation)
DONOR_REGION_WEIGHTS = {
    "USA": {"south_asia": 3, "middle_east": 4, "east_africa": 2, "west_africa": 1.5, "latin_america": 2, "southeast_asia": 1.5, "europe": 1.5, "central_africa": 1, "central_asia": 1, "north_africa": 1.5, "pacific": 0.5, "east_asia": 0.5},
    "GBR": {"south_asia": 3, "east_africa": 3, "west_africa": 2, "middle_east": 2, "southeast_asia": 1.5, "central_africa": 1, "latin_america": 0.5, "europe": 0.5, "central_asia": 0.5, "north_africa": 1, "pacific": 1, "east_asia": 0.5},
    "FRA": {"west_africa": 4, "central_africa": 3, "north_africa": 3, "middle_east": 2, "southeast_asia": 1.5, "east_africa": 1, "south_asia": 0.5, "latin_america": 0.5, "europe": 1, "central_asia": 0.5, "pacific": 1, "east_asia": 0.5},
    "DEU": {"east_africa": 2, "middle_east": 2, "south_asia": 2, "europe": 2, "central_asia": 1.5, "west_africa": 1.5, "central_africa": 1, "southeast_asia": 1.5, "latin_america": 1, "north_africa": 1, "pacific": 0.5, "east_asia": 0.5},
    "JPN": {"southeast_asia": 4, "south_asia": 3, "east_africa": 2, "east_asia": 2, "pacific": 2, "middle_east": 1.5, "central_asia": 1, "west_africa": 1, "latin_america": 1, "central_africa": 0.5, "europe": 0.5, "north_africa": 0.5},
    "SWE": {"east_africa": 3, "west_africa": 2, "south_asia": 2, "middle_east": 2, "europe": 1.5, "central_africa": 1.5, "southeast_asia": 1, "latin_america": 1, "central_asia": 1, "north_africa": 0.5, "pacific": 0.5, "east_asia": 0.5},
    "NOR": {"east_africa": 3, "south_asia": 2, "middle_east": 2, "west_africa": 1.5, "southeast_asia": 1.5, "central_africa": 1, "latin_america": 1.5, "europe": 1, "central_asia": 0.5, "north_africa": 0.5, "pacific": 0.5, "east_asia": 0.5},
    "NLD": {"east_africa": 3, "west_africa": 2, "middle_east": 2, "south_asia": 1.5, "southeast_asia": 1.5, "central_africa": 1, "latin_america": 1, "europe": 1, "central_asia": 0.5, "north_africa": 0.5, "pacific": 0.5, "east_asia": 0.5},
    "CAN": {"east_africa": 2, "south_asia": 2, "middle_east": 2, "west_africa": 2, "latin_america": 2, "southeast_asia": 1.5, "central_africa": 1, "europe": 1, "central_asia": 0.5, "north_africa": 1, "pacific": 0.5, "east_asia": 0.5},
    "AUS": {"southeast_asia": 4, "pacific": 4, "south_asia": 2, "east_africa": 1, "east_asia": 2, "middle_east": 1, "central_asia": 0.5, "west_africa": 0.5, "central_africa": 0.5, "latin_america": 0.5, "europe": 0.3, "north_africa": 0.3},
    "KOR": {"southeast_asia": 4, "south_asia": 2, "east_africa": 2, "east_asia": 2, "central_asia": 1.5, "middle_east": 1, "west_africa": 1, "central_africa": 0.5, "latin_america": 1, "europe": 0.5, "pacific": 0.5, "north_africa": 0.5},
    "TUR": {"central_asia": 4, "middle_east": 3, "east_africa": 2, "south_asia": 2, "europe": 2, "west_africa": 1, "north_africa": 1.5, "southeast_asia": 0.5, "central_africa": 0.5, "latin_america": 0.3, "pacific": 0.2, "east_asia": 0.3},
    "ARE": {"middle_east": 5, "south_asia": 3, "east_africa": 2, "north_africa": 2, "west_africa": 1, "central_asia": 1, "southeast_asia": 1, "central_africa": 0.5, "latin_america": 0.3, "europe": 0.3, "pacific": 0.2, "east_asia": 0.3},
    "SAU": {"middle_east": 5, "east_africa": 2, "south_asia": 2, "north_africa": 2, "west_africa": 1, "southeast_asia": 1, "central_asia": 1, "central_africa": 0.5, "latin_america": 0.3, "europe": 0.3, "pacific": 0.2, "east_asia": 0.3},
}

# Default balanced weights for donors without specific preferences
DEFAULT_WEIGHTS = {"south_asia": 1.5, "middle_east": 1.5, "east_africa": 1.5, "west_africa": 1.5, "latin_america": 1, "southeast_asia": 1.5, "europe": 1, "central_africa": 1, "central_asia": 1, "north_africa": 1, "pacific": 0.5, "east_asia": 0.5}


def try_fetch_api():
    """Attempt to fetch from the OECD SDMX API."""
    # OECD DAC2a table: bilateral ODA by donor and recipient
    url = (
        "https://sdmx.oecd.org/public/rest/data/"
        "OECD.DCD.FSD,DSD_DAC2@DF_DAC2A/"
        "A..1140+1160.100._T._T._T.D.V.USD?"
        "startPeriod=2018&endPeriod=2022"
        "&dimensionAtObservation=AllDimensions"
    )
    headers = {"Accept": "application/vnd.sdmx.data+json;version=1.0.0-wd"}

    print(f"Attempting OECD SDMX API: {url[:80]}...")
    try:
        resp = requests.get(url, headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        print(f"API returned {len(resp.content)} bytes")
        return data
    except Exception as e:
        print(f"API request failed: {e}")
        return None


def parse_api_response(api_data):
    """Parse SDMX JSON response into our format. Returns None on failure."""
    try:
        datasets = api_data.get("data", {}).get("dataSets", [])
        if not datasets:
            print("No datasets in API response")
            return None
        # SDMX parsing is complex; if we get here the data is available
        # but parsing SDMX JSON format requires dimension mapping
        print("SDMX parsing not fully implemented, falling back to seed data")
        return None
    except Exception as e:
        print(f"Error parsing API response: {e}")
        return None


def distribute_yearly(total_m, years):
    """Distribute a total across years with realistic variation."""
    n = len(years)
    base = total_m / n
    yearly = {}
    remaining = total_m
    for i, year in enumerate(years):
        if i == n - 1:
            yearly[str(year)] = round(remaining * 1_000_000)
        else:
            # Add +/- 15% variation with slight upward trend
            trend = 1.0 + (i - n / 2) * 0.03
            amount = base * trend * random.uniform(0.88, 1.12)
            amount = max(amount, base * 0.5)
            yearly[str(year)] = round(amount * 1_000_000)
            remaining -= amount
    return yearly


def generate_seed_data():
    """Generate realistic ODA flow data based on known DAC statistics."""
    random.seed(42)  # Reproducible

    flows = []
    # Track actuals per donor and per recipient for summary
    donor_given = {d: 0 for d in DAC_DONORS}
    recipient_received = {r: 0 for r in RECIPIENTS}
    donor_to_recipients = {d: {} for d in DAC_DONORS}
    recipient_from_donors = {r: {} for r in RECIPIENTS}

    for donor, donor_info in DAC_DONORS.items():
        donor_total_m = donor_info["total_m"]
        weights = DONOR_REGION_WEIGHTS.get(donor, DEFAULT_WEIGHTS)

        # Calculate weighted allocation across recipients
        recipient_weights = {}
        for recip, recip_info in RECIPIENTS.items():
            region = recip_info["region"]
            w = weights.get(region, 0.5)
            # Weight also by recipient's total need (larger recipients get more)
            need_factor = recip_info["total_m"] / 2000.0
            recipient_weights[recip] = w * need_factor * random.uniform(0.6, 1.4)

        total_weight = sum(recipient_weights.values())

        # Pick top ~15-30 recipients per donor (larger donors have more)
        num_recipients = min(len(RECIPIENTS), max(12, int(donor_total_m / 1200)))
        sorted_recips = sorted(recipient_weights.items(), key=lambda x: -x[1])
        selected = sorted_recips[:num_recipients]

        # Renormalize
        sel_weight = sum(w for _, w in selected)

        for recip, w in selected:
            share = w / sel_weight
            flow_total_m = donor_total_m * share

            # Minimum threshold: skip trivially small flows
            if flow_total_m < 2:
                continue

            yearly = distribute_yearly(flow_total_m, YEARS)
            total_usd = sum(yearly.values())

            flows.append({
                "donor": donor,
                "recipient": recip,
                "total_usd": total_usd,
                "years": yearly,
            })

            donor_given[donor] += total_usd
            recipient_received[recip] += total_usd
            if recip not in donor_to_recipients[donor]:
                donor_to_recipients[donor][recip] = 0
            donor_to_recipients[donor][recip] += total_usd
            if donor not in recipient_from_donors[recip]:
                recipient_from_donors[recip][donor] = 0
            recipient_from_donors[recip][donor] += total_usd

    # Build country summaries
    countries = {}

    # Rank donors by total given
    sorted_donors = sorted(donor_given.items(), key=lambda x: -x[1])
    for rank, (donor, total) in enumerate(sorted_donors, 1):
        top_recips = sorted(
            donor_to_recipients[donor].items(), key=lambda x: -x[1]
        )[:10]
        countries[donor] = {
            "is_donor": True,
            "total_given": total,
            "total_received": 0,
            "top_recipients": [
                {"iso3": r, "total": t} for r, t in top_recips
            ],
            "top_donors": [],
            "oda_gni_ratio": DAC_DONORS[donor]["oda_gni"],
            "donor_rank": rank,
        }

    # Rank recipients by total received
    sorted_recipients = sorted(recipient_received.items(), key=lambda x: -x[1])
    for rank, (recip, total) in enumerate(sorted_recipients, 1):
        if total == 0:
            continue
        top_dons = sorted(
            recipient_from_donors[recip].items(), key=lambda x: -x[1]
        )[:10]
        countries[recip] = {
            "is_donor": False,
            "total_given": 0,
            "total_received": total,
            "top_donors": [
                {"iso3": d, "total": t} for d, t in top_dons
            ],
            "top_recipients": [],
            "recipient_rank": rank,
        }

    return {
        "_meta": {
            "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "OECD DAC",
            "years": "2018-2022",
            "note": "Seed data based on known DAC ODA statistics",
        },
        "flows": flows,
        "countries": countries,
    }


OECD_API = "https://sdmx.oecd.org/public/rest/data"
WORLD_JSON = os.path.join(os.path.dirname(__file__), "..", "worldcountrygroups", "data", "groups", "world.json")
N_YEARS = 5  # aggregate over the latest five years with bilateral data


def _oecd_csv(flow, key, start):
    import csv
    import io
    url = f"{OECD_API}/{flow}/{key}?startPeriod={start}&format=csvfile"
    for attempt in range(3):
        try:
            resp = requests.get(url, timeout=600, headers={"User-Agent": "worldcountrygroups"})
            resp.raise_for_status()
            return list(csv.DictReader(io.StringIO(resp.text)))
        except Exception:
            if attempt == 2:
                raise
            import time
            time.sleep(15 * (attempt + 1))


def fetch_real():
    """Fetch real ODA data from the OECD SDMX API (DAC1 totals + DAC2A bilateral flows)."""
    iso3s = {c["iso3"] for c in json.load(open(WORLD_JSON))["countries"]}
    this_year = datetime.now().year
    start = this_year - 8

    print("Fetching DAC2A net ODA disbursements by donor and recipient...")
    dac2a = _oecd_csv("OECD.DCD.FSD,DSD_DAC2@DF_DAC2A,", "..206.USD.V", start)
    print(f"  {len(dac2a)} rows")
    years_avail = sorted({int(r["TIME_PERIOD"]) for r in dac2a})
    # Use the latest N years that have broad coverage (the newest year is often partial)
    counts = {y: sum(1 for r in dac2a if int(r["TIME_PERIOD"]) == y) for y in years_avail}
    full = [y for y in years_avail if counts[y] >= 0.8 * max(counts.values())]
    years = full[-N_YEARS:]
    ys = {str(y) for y in years}

    def usd(r):
        return float(r["OBS_VALUE"]) * 10 ** int(r["UNIT_MULT"] or 0)

    flows, received = {}, {}
    for r in dac2a:
        if r["TIME_PERIOD"] not in ys or not r["OBS_VALUE"]:
            continue
        d, rc, y = r["DONOR"], r["RECIPIENT"], r["TIME_PERIOD"]
        if rc not in iso3s:
            continue
        if d == "ALLD":  # all official donors, bilateral + multilateral
            received.setdefault(rc, {})[y] = round(usd(r))
        elif d in iso3s and d != rc:
            flows.setdefault((d, rc), {})[y] = round(usd(r))

    print("Fetching DAC1 total ODA and ODA/GNI by donor...")
    total = _oecd_csv("OECD.DCD.FSD,DSD_DAC1@DF_DAC1,", "..11010._Z.1160.USD.V", start)
    ratio = _oecd_csv("OECD.DCD.FSD,DSD_DAC1@DF_DAC1,", "..11002....", start)
    given = {}
    for r in total:
        if r["DONOR"] in iso3s and r["TIME_PERIOD"] in ys and r["OBS_VALUE"]:
            given.setdefault(r["DONOR"], {})[r["TIME_PERIOD"]] = round(usd(r))
    gni = {}
    for r in ratio:
        if r["DONOR"] in iso3s and r["OBS_VALUE"]:
            y = int(r["TIME_PERIOD"])
            if r["DONOR"] not in gni or y > gni[r["DONOR"]][0]:
                gni[r["DONOR"]] = (y, float(r["OBS_VALUE"]))

    flow_list = []
    for (d, rc), by_year in flows.items():
        t = sum(by_year.values())
        if t > 0:
            flow_list.append({"donor": d, "recipient": rc, "total_usd": t, "years": by_year})
    flow_list.sort(key=lambda f: -f["total_usd"])

    countries = {}
    for c in set(given) | set(received) | {f["donor"] for f in flow_list} | {f["recipient"] for f in flow_list}:
        tg = sum(given.get(c, {}).values())
        tr = sum(received.get(c, {}).values())
        countries[c] = {
            "is_donor": c in given and tg > tr,
            "total_given": tg,
            "total_received": max(tr, 0),
            "top_recipients": [{"iso3": f["recipient"], "total": f["total_usd"]} for f in flow_list if f["donor"] == c][:10],
            "top_donors": [{"iso3": f["donor"], "total": f["total_usd"]} for f in flow_list if f["recipient"] == c][:10],
        }
        if given.get(c):
            countries[c]["given_by_year"] = given[c]
        if received.get(c):
            countries[c]["received_by_year"] = received[c]
        if c in gni:
            countries[c]["oda_gni_ratio"] = gni[c][1]
            countries[c]["oda_gni_year"] = gni[c][0]
    donors = sorted((c for c in countries if countries[c]["is_donor"]), key=lambda c: -countries[c]["total_given"])
    recips = sorted((c for c in countries if not countries[c]["is_donor"]), key=lambda c: -countries[c]["total_received"])
    for i, c in enumerate(donors):
        countries[c]["donor_rank"] = i + 1
    for i, c in enumerate(recips):
        countries[c]["recipient_rank"] = i + 1

    return {
        "_meta": {
            "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "OECD DAC (DAC1 total ODA grant equivalent; DAC2A net ODA disbursements by recipient)",
            "url": "https://sdmx.oecd.org/public/rest/data/OECD.DCD.FSD,DSD_DAC2@DF_DAC2A,",
            "years": f"{years[0]}-{years[-1]}",
            "note": "Current USD. total_given = donor's total ODA (incl. multilateral contributions); "
                    "total_received = net ODA from all official donors; flows = bilateral net ODA "
                    "from country donors. oda_gni_ratio is the latest available year (oda_gni_year).",
        },
        "flows": flow_list,
        "countries": countries,
    }


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", action="store_true", help="write SYNTHETIC placeholder data (not real OECD figures)")
    args = ap.parse_args()
    os.makedirs(DATA_DIR, exist_ok=True)

    if args.seed:
        print("Generating SYNTHETIC placeholder data (not real OECD figures)...")
        result = generate_seed_data()
        result["_meta"]["source"] = "SYNTHETIC placeholder data (not real OECD figures)"
        result["_meta"]["synthetic"] = True
    else:
        try:
            result = fetch_real()
        except Exception as e:
            sys.exit(f"OECD fetch failed ({e}); existing {OUTPUT_FILE} left unchanged.")
        if len(result["flows"]) < 500 or len(result["countries"]) < 100:
            sys.exit(f"OECD fetch returned too little data; existing {OUTPUT_FILE} left unchanged.")

    tmp = OUTPUT_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(result, f, indent=2)
    os.replace(tmp, OUTPUT_FILE)

    donors = sum(1 for c in result["countries"].values() if c.get("is_donor"))
    print(f"Written {OUTPUT_FILE}: {len(result['flows'])} flows, {len(result['countries'])} countries "
          f"({donors} donors), years {result['_meta']['years']}")


if __name__ == "__main__":
    main()

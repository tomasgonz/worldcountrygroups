#!/usr/bin/env python3
"""
Fetch and process Correlates of War (COW) Alliance Dataset v4.1.
Source: https://correlatesofwar.org/data-sets/formal-alliances/

Alliance types:
  Type I   = Defense Pact
  Type IIa = Neutrality Pact
  Type IIb = Non-Aggression Pact
  Type III = Entente

COW uses numeric country codes (ccode). This script maps them to ISO3.
If the CSV cannot be downloaded, generates realistic seed data based on
known historical and active alliances.

Output: site/server/data/cow-alliances.json
"""

import csv
import io
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "site", "server", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "cow-alliances.json")

# COW Alliance dataset v4.1 - direct download URL
COW_URL = "https://correlatesofwar.org/wp-content/uploads/version4.1_csv.zip"

# ── COW ccode -> ISO3 mapping ───────────────────────────────────────────
# Covers all major countries and most smaller states referenced in alliance data.
CCODE_TO_ISO3 = {
    338: "MLT", 403: "STP",
    2: "USA", 20: "CAN", 31: "BHS", 40: "CUB", 41: "HTI", 42: "DOM",
    51: "JAM", 52: "TTO", 53: "BRB", 54: "DMA", 55: "GRD", 56: "LCA",
    57: "VCT", 58: "ATG", 60: "KNA", 70: "MEX", 80: "BLZ", 90: "GTM",
    91: "HND", 92: "SLV", 93: "NIC", 94: "CRI", 95: "PAN",
    100: "COL", 101: "VEN", 110: "GUY", 115: "SUR", 130: "ECU",
    135: "PER", 140: "BRA", 145: "BOL", 150: "PRY", 155: "CHL",
    160: "ARG", 165: "URY",
    200: "GBR", 205: "IRL", 210: "NLD", 211: "BEL", 212: "LUX",
    220: "FRA", 225: "CHE", 230: "ESP", 235: "PRT", 240: "HAN",
    245: "BAV", 255: "DEU", 260: "DEU", 265: "DDR",
    290: "POL", 300: "AUT", 305: "AUT", 310: "HUN",
    315: "CZE", 316: "CZE", 317: "SVK",
    325: "ITA", 329: "SAN", 331: "MKD",
    339: "ALB", 341: "MNE", 343: "MKD", 344: "HRV",
    345: "SRB", 346: "BIH", 349: "SVN",
    350: "GRC", 352: "CYP", 355: "BGR", 359: "MDA",
    360: "ROU", 365: "RUS", 366: "EST", 367: "LVA", 368: "LTU",
    369: "UKR", 370: "BLR", 371: "ARM", 372: "GEO", 373: "AZE",
    375: "FIN", 380: "SWE", 385: "NOR", 390: "DNK", 395: "ISL",
    402: "CPV", 404: "GNB", 411: "GIN", 420: "GMB",
    432: "MLI", 433: "SEN", 434: "BEN", 435: "MRT",
    436: "NER", 437: "CIV", 438: "GHA", 439: "BFA",
    450: "LBR", 451: "SLE", 452: "GHA", 461: "TGO",
    471: "CMR", 475: "NGA", 481: "GAB", 482: "CAF",
    483: "TCD", 484: "COG", 490: "COD",
    500: "UGA", 501: "KEN", 510: "TZA", 516: "BDI", 517: "RWA",
    520: "SOM", 522: "DJI", 530: "ETH", 531: "ERI",
    540: "AGO", 541: "MOZ", 551: "ZMB", 552: "ZWE",
    553: "MWI", 560: "ZAF", 565: "NAM", 570: "LSO", 571: "BWA",
    572: "SWZ", 580: "MDG", 581: "COM", 590: "MUS", 591: "SYC",
    600: "MAR", 615: "DZA", 616: "TUN", 620: "LBY", 625: "SDN",
    626: "SSD", 630: "IRN", 640: "TUR", 645: "IRQ",
    651: "EGY", 652: "SYR", 660: "LBN", 663: "JOR",
    666: "ISR", 670: "SAU", 678: "YEM", 679: "YEM",
    690: "KWT", 692: "BHR", 694: "QAT", 696: "ARE",
    698: "OMN",
    700: "AFG", 701: "TKM", 702: "TJK", 703: "KGZ", 704: "UZB",
    705: "KAZ", 710: "CHN", 711: "TWN", 712: "MNG",
    713: "TWN",
    730: "KOR", 731: "PRK", 732: "KOR",
    740: "JPN",
    750: "IND", 760: "PAK", 770: "BGD", 771: "MMR",
    775: "LKA", 780: "NPL", 781: "BTN",
    790: "THA", 800: "KHM", 811: "LAO", 812: "VNM",
    816: "VNM",
    820: "MYS", 830: "SGP", 840: "PHL", 850: "IDN",
    860: "TLS",
    900: "AUS", 910: "PNG", 920: "NZL", 935: "VUT",
    940: "SLB", 946: "KIR", 947: "TON", 950: "FJI", 955: "WSM",
}


# ── Alliance type mapping ───────────────────────────────────────────────
TYPE_MAP = {
    1: "defense",
    2: "neutrality",
    3: "nonaggression",
    4: "entente",
    # For seed data string keys
    "defense": "defense",
    "neutrality": "neutrality",
    "nonaggression": "nonaggression",
    "entente": "entente",
}


def try_download_csv():
    """Attempt to download COW Alliance CSV. Returns list of rows or None."""
    print("Attempting to download COW Alliance dataset v4.1...")
    try:
        req = urllib.request.Request(COW_URL, headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
        })
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()

        # The download is a zip containing CSVs
        import zipfile
        zf = zipfile.ZipFile(io.BytesIO(data))

        # Use the by_member file - it has one row per alliance membership
        # Columns: version4id, ccode, state_name, all_st_day, all_st_month,
        #          all_st_year, all_end_day, all_end_month, all_end_year,
        #          ss_type, mem_st_day, mem_st_month, mem_st_year,
        #          mem_end_day, mem_end_month, mem_end_year,
        #          left_censor, right_censor,
        #          defense, neutrality, nonaggression, entente, version
        member_file = None
        for name in zf.namelist():
            if "by_member" in name and name.endswith(".csv") and "yearly" not in name:
                member_file = name
                break

        if not member_file:
            print("  Could not find alliance_v4.1_by_member.csv in zip archive.")
            return None

        csv_text = zf.read(member_file).decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)
        print(f"  Downloaded {len(rows)} alliance membership records from {member_file}.")
        return rows

    except Exception as e:
        print(f"  Download failed: {e}")
        return None


def try_read_local_csv():
    """Try reading a locally placed CSV file."""
    local_paths = [
        os.path.join(os.path.dirname(__file__), "alliance_v4.1_by_member.csv"),
        os.path.join(os.path.dirname(__file__), "alliance_v4.1_by_dyad.csv"),
        os.path.join(os.path.dirname(__file__), "cow_alliances.csv"),
    ]
    for path in local_paths:
        if os.path.exists(path):
            print(f"  Reading local CSV: {path}")
            with open(path, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                rows = list(reader)
            print(f"  Found {len(rows)} records.")
            return rows
    return None


def determine_alliance_type(row):
    """Determine alliance type from COW boolean columns (defense, neutrality, nonaggression, entente).
    A single alliance can have multiple types; we pick the strongest commitment level."""
    # COW uses 0/1 flags for each type; an alliance can have multiple
    # Priority: defense > nonaggression > neutrality > entente
    if str(row.get("defense", "0")).strip() == "1":
        return "defense"
    if str(row.get("nonaggression", "0")).strip() == "1":
        return "nonaggression"
    if str(row.get("neutrality", "0")).strip() == "1":
        return "neutrality"
    if str(row.get("entente", "0")).strip() == "1":
        return "entente"
    # Fallback: check ss_type string
    ss = str(row.get("ss_type", "")).lower()
    if "defense" in ss:
        return "defense"
    if "non-aggression" in ss or "nonaggression" in ss:
        return "nonaggression"
    if "neutrality" in ss:
        return "neutrality"
    return "entente"


# Names for COW version4id values, each checked against the member list and dates in v4.1.
KNOWN_ALLIANCE_NAMES = {
    "1": "Anglo-Portuguese Alliance",
    "3": "German Confederation",
    "113": "Central American Treaty of Peace and Amity (1923)",
    "189": "Tripartite Pact (Axis)",
    "198": "Act of Chapultepec",
    "199": "Arab League",
    "210": "Rio Treaty (TIAR)",
    "218": "Brussels Treaty / Western European Union",
    "227": "NATO",
    "230": "Arab League Joint Defence Treaty",
    "231": "US-Philippines Mutual Defense Treaty",
    "232": "ANZUS",
    "233": "US-Japan Security Treaty",
    "234": "Balkan Pact (1953)",
    "236": "US-ROK Mutual Defense Treaty",
    "238": "SEATO",
    "239": "Anglo-Egyptian Agreement (1954)",
    "241": "Baghdad Pact / CENTO",
    "243": "Warsaw Pact",
    "266": "African and Malagasy Union Defence Pact",
    "267": "Declaration on the Neutrality of Laos (1962)",
    "271": "Central American Defense Council (CONDECA)",
    "300": "ECOWAS Protocol on Non-Aggression",
    "318": "ECOWAS Protocol on Mutual Assistance in Defence",
    "319": "Organisation of Eastern Caribbean States (OECS)",
    "350": "Collective Security Treaty (Tashkent, later CSTO)",
    "388": "Regional Security System (Eastern Caribbean)",
    "389": "Shanghai Five",
    "398": "ECCAS Mutual Assistance Pact",
    "400": "GCC Joint Defence Agreement",
    "402": "Kabul Declaration on Good-Neighbourly Relations",
    "407": "Great Lakes Pact on Security, Stability and Development",
}
KNOWN_BILATERAL_NAMES = {}


def process_csv_rows(rows):
    """Process COW by_member CSV rows into our alliance format.

    Columns: version4id, ccode, state_name, all_st_year, all_end_year,
             defense (0/1), neutrality (0/1), nonaggression (0/1), entente (0/1)
    """
    # Group rows by alliance ID (version4id)
    alliances_map = {}  # version4id -> { members set, type, start, end, state_names }

    for row in rows:
        aid = str(row.get("version4id", "")).strip()
        ccode_str = str(row.get("ccode", "0")).strip()
        state_name = str(row.get("state_name", "")).strip().strip('"')

        try:
            ccode = int(ccode_str)
        except ValueError:
            continue

        if not aid:
            continue

        # Get alliance start/end years
        start_yr_str = str(row.get("all_st_year", "0")).strip()
        end_yr_str = str(row.get("all_end_year", "")).strip()

        try:
            start_yr = int(start_yr_str) if start_yr_str else 0
        except ValueError:
            start_yr = 0

        try:
            end_yr = int(end_yr_str) if end_yr_str else None
        except ValueError:
            end_yr = None

        # right_censor=1 means alliance is still active (no end date)
        right_censor = str(row.get("right_censor", "0")).strip()
        if right_censor == "1":
            end_yr = None

        iso3 = CCODE_TO_ISO3.get(ccode)

        if aid not in alliances_map:
            atype = determine_alliance_type(row)
            alliances_map[aid] = {
                "members": set(),
                "all_members": set(),
                "state_names": {},
                "type": atype,
                "start_year": start_yr,
                "end_year": end_yr,
            }

        mem_end = str(row.get("mem_end_year", "")).strip()
        if iso3:
            alliances_map[aid]["all_members"].add(iso3)
            if not mem_end:
                alliances_map[aid]["members"].add(iso3)
        if ccode and state_name:
            alliances_map[aid]["state_names"][ccode] = state_name

        # Update end_year: use None (ongoing) if any member has right_censor=1
        if right_censor == "1":
            alliances_map[aid]["end_year"] = None
        elif end_yr is not None:
            existing = alliances_map[aid]["end_year"]
            if existing is not None and end_yr > existing:
                alliances_map[aid]["end_year"] = end_yr

    alliances = []
    for aid, info in sorted(alliances_map.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 0):
        # Ongoing alliances list members still in them at the end of the data;
        # ended alliances list everyone who was ever a member.
        if info["end_year"] is not None or len(info["members"]) < 2:
            info["members"] = info["all_members"]
        if len(info["members"]) < 2:
            continue  # Skip alliances with fewer than 2 mapped members
        name = KNOWN_ALLIANCE_NAMES.get(aid) or KNOWN_BILATERAL_NAMES.get(aid)
        alliances.append({
            "id": f"cow_{aid}",
            "name": name,
            "type": info["type"],
            "start_year": info["start_year"],
            "end_year": info["end_year"],
            "members": sorted(info["members"]),
        })

    return alliances


def generate_seed_data():
    """Generate realistic seed alliance data based on known historical alliances."""
    print("  Generating seed alliance data from known alliances...")

    alliances = []
    aid = 1

    def add(name, atype, start, end, members):
        nonlocal aid
        slug = name.lower().replace(" ", "_").replace("-", "_").replace("(", "").replace(")", "") if name else f"alliance_{aid}"
        alliances.append({
            "id": slug,
            "name": name,
            "type": atype,
            "start_year": start,
            "end_year": end,
            "members": members,
        })
        aid += 1

    # ── NATO (1949-present) ──────────────────────────────────────────
    add("NATO", "defense", 1949, None, [
        "USA", "CAN", "GBR", "FRA", "BEL", "NLD", "LUX", "NOR", "DNK", "ISL", "PRT", "ITA",
        "GRC", "TUR",  # 1952
        "DEU",  # 1955 (West Germany)
        "ESP",  # 1982
        "CZE", "HUN", "POL",  # 1999
        "BGR", "EST", "LVA", "LTU", "ROU", "SVK", "SVN",  # 2004
        "ALB", "HRV",  # 2009
        "MNE",  # 2017
        "MKD",  # 2020
        "FIN",  # 2023
        "SWE",  # 2024
    ])

    # ── Warsaw Pact (1955-1991) ──────────────────────────────────────
    add("Warsaw Pact", "defense", 1955, 1991, [
        "RUS", "POL", "CZE", "HUN", "ROU", "BGR", "ALB", "DDR",
    ])

    # ── ANZUS (1951-present, NZL suspended) ──────────────────────────
    add("ANZUS", "defense", 1951, None, ["USA", "AUS", "NZL"])

    # ── Rio Treaty / TIAR (1947-present) ─────────────────────────────
    add("Rio Treaty", "defense", 1947, None, [
        "USA", "BRA", "ARG", "CHL", "COL", "CRI", "CUB", "DOM", "ECU",
        "SLV", "GTM", "HTI", "HND", "MEX", "NIC", "PAN", "PRY", "PER",
        "URY", "VEN", "TTO", "BHS",
    ])

    # ── SEATO (1954-1977) ────────────────────────────────────────────
    add("SEATO", "defense", 1954, 1977, [
        "USA", "GBR", "FRA", "AUS", "NZL", "PHL", "THA", "PAK",
    ])

    # ── CENTO / Baghdad Pact (1955-1979) ─────────────────────────────
    add("CENTO", "defense", 1955, 1979, [
        "GBR", "TUR", "IRQ", "IRN", "PAK",
    ])

    # ── Japan-US Security Treaty (1951-present) ──────────────────────
    add("US-Japan Security Treaty", "defense", 1951, None, ["USA", "JPN"])

    # ── US-South Korea Mutual Defense (1953-present) ─────────────────
    add("US-ROK Mutual Defense Treaty", "defense", 1953, None, ["USA", "KOR"])

    # ── US-Philippines Mutual Defense (1951-present) ─────────────────
    add("US-Philippines Mutual Defense Treaty", "defense", 1951, None, ["USA", "PHL"])

    # ── US-Taiwan Mutual Defense (1955-1979) ─────────────────────────
    add("US-Taiwan Mutual Defense Treaty", "defense", 1955, 1979, ["USA", "TWN"])

    # ── Franco-German Treaty of Friendship (1963-present) ────────────
    add("Elysee Treaty", "entente", 1963, None, ["FRA", "DEU"])

    # ── Sino-Soviet Treaty (1950-1979) ───────────────────────────────
    add("Sino-Soviet Treaty of Friendship", "defense", 1950, 1979, ["RUS", "CHN"])

    # ── Sino-North Korean Mutual Aid Treaty (1961-present) ───────────
    add("Sino-DPRK Treaty", "defense", 1961, None, ["CHN", "PRK"])

    # ── Soviet-North Korean Treaty (1961-1996) ───────────────────────
    add("Soviet-DPRK Treaty", "defense", 1961, 1996, ["RUS", "PRK"])

    # ── Arab League Collective Security (1950-present) ───────────────
    add("Arab League Collective Defense", "defense", 1950, None, [
        "EGY", "IRQ", "JOR", "LBN", "SAU", "SYR", "YEM", "LBY", "SDN",
        "MAR", "TUN", "KWT", "DZA", "BHR", "QAT", "OMN", "ARE", "MRT",
        "SOM", "DJI",
    ])

    # ── GCC Peninsula Shield Force (1982-present) ────────────────────
    add("GCC Peninsula Shield", "defense", 1982, None, [
        "SAU", "KWT", "BHR", "QAT", "ARE", "OMN",
    ])

    # ── CSTO (2002-present) ──────────────────────────────────────────
    add("CSTO", "defense", 2002, None, [
        "RUS", "BLR", "ARM", "KAZ", "KGZ", "TJK",
    ])

    # ── CIS Collective Security Treaty (1992-2002, then CSTO) ────────
    add("CIS Collective Security Treaty", "defense", 1992, 2002, [
        "RUS", "ARM", "KAZ", "KGZ", "TJK", "UZB", "BLR", "GEO", "AZE",
    ])

    # ── Five Power Defence Arrangements (1971-present) ───────────────
    add("Five Power Defence Arrangements", "defense", 1971, None, [
        "GBR", "AUS", "NZL", "MYS", "SGP",
    ])

    # ── AUKUS (2021-present) ─────────────────────────────────────────
    add("AUKUS", "defense", 2021, None, ["AUS", "GBR", "USA"])

    # ── Franco-African defense agreements ────────────────────────────
    add("France-Senegal Defense Agreement", "defense", 1960, None, ["FRA", "SEN"])
    add("France-Cote dIvoire Defense Agreement", "defense", 1961, None, ["FRA", "CIV"])
    add("France-Gabon Defense Agreement", "defense", 1960, None, ["FRA", "GAB"])
    add("France-Cameroon Defense Agreement", "defense", 1960, None, ["FRA", "CMR"])
    add("France-Djibouti Defense Agreement", "defense", 1977, None, ["FRA", "DJI"])
    add("France-Chad Defense Agreement", "defense", 1976, None, ["FRA", "TCD"])

    # ── UK bilateral defense treaties ────────────────────────────────
    add("UK-Brunei Defense Agreement", "defense", 1962, None, ["GBR", "BRN"])
    add("UK-Kuwait Defense Agreement", "defense", 1961, 1971, ["GBR", "KWT"])
    add("UK-Jordan Defense Treaty", "defense", 1948, None, ["GBR", "JOR"])

    # ── India treaties ───────────────────────────────────────────────
    add("Indo-Soviet Treaty of Peace", "defense", 1971, 1993, ["IND", "RUS"])
    add("Indo-Bhutan Friendship Treaty", "defense", 1949, None, ["IND", "BTN"])
    add("Indo-Nepal Treaty of Peace", "entente", 1950, None, ["IND", "NPL"])

    # ── US bilateral defense agreements ──────────────────────────────
    add("US-Pakistan Mutual Defense", "defense", 1954, 1979, ["USA", "PAK"])
    add("US-Iran Bilateral Defense", "defense", 1959, 1979, ["USA", "IRN"])
    add("US-Israel Strategic Partnership", "entente", 1981, None, ["USA", "ISR"])
    add("US-Egypt Defense Cooperation", "entente", 1979, None, ["USA", "EGY"])
    add("US-Saudi Security Agreement", "entente", 1951, None, ["USA", "SAU"])
    add("US-Thailand Alliance", "defense", 1954, None, ["USA", "THA"])
    add("US-Morocco Defense Agreement", "defense", 2004, None, ["USA", "MAR"])

    # ── African Union / OAU defense clause ───────────────────────────
    add("OAU Mutual Defense", "defense", 1963, 2002, [
        "EGY", "ETH", "GHA", "NGA", "ZAF", "KEN", "TZA", "UGA",
        "SEN", "CIV", "CMR", "DZA", "MAR", "TUN", "LBY", "SDN",
        "AGO", "MOZ", "ZMB", "ZWE", "MLI", "BFA", "NER", "TCD",
        "GAB", "COG", "COD", "MDG", "RWA", "BDI",
    ])

    # ── Non-aggression pacts ─────────────────────────────────────────
    add("Soviet-German Non-Aggression Pact", "nonaggression", 1939, 1941, ["RUS", "DEU"])
    add("Sino-Indian Non-Aggression", "nonaggression", 1954, 1962, ["CHN", "IND"])
    add("Soviet-Japanese Neutrality Pact", "neutrality", 1941, 1945, ["RUS", "JPN"])
    add("Saudi-Iraq Non-Aggression Pact", "nonaggression", 1989, 1990, ["SAU", "IRQ"])
    add("ECOWAS Non-Aggression Protocol", "nonaggression", 1978, None, [
        "NGA", "GHA", "SEN", "CIV", "MLI", "BFA", "NER", "TGO", "BEN",
        "SLE", "LBR", "GIN", "GMB", "GNB", "CPV",
    ])
    add("Turco-Iraqi Non-Aggression", "nonaggression", 1946, 1955, ["TUR", "IRQ"])

    # ── Ententes ─────────────────────────────────────────────────────
    add("Entente Cordiale", "entente", 1904, None, ["GBR", "FRA"])
    add("Franco-Russian Alliance", "defense", 1894, 1917, ["FRA", "RUS"])
    add("Anglo-Japanese Alliance", "defense", 1902, 1923, ["GBR", "JPN"])
    add("Triple Alliance", "defense", 1882, 1915, ["DEU", "AUT", "ITA"])
    add("Balkan Pact 1934", "entente", 1934, 1940, ["GRC", "TUR", "ROU", "SRB"])
    add("Little Entente", "entente", 1920, 1938, ["CZE", "ROU", "SRB"])
    add("Nordic Defense Cooperation", "entente", 2009, None, ["DNK", "FIN", "ISL", "NOR", "SWE"])
    add("Quad Security Dialogue", "entente", 2017, None, ["USA", "JPN", "AUS", "IND"])
    add("Abraham Accords", "entente", 2020, None, ["ISR", "ARE", "BHR", "MAR"])
    add("Camp David Accords", "entente", 1978, None, ["ISR", "EGY"])

    # ── Asian bilateral defense pacts ────────────────────────────────
    add("Australia-Indonesia Defence Cooperation", "entente", 2006, None, ["AUS", "IDN"])
    add("Japan-Australia Security Declaration", "entente", 2007, None, ["JPN", "AUS"])
    add("Japan-India Security Cooperation", "entente", 2008, None, ["JPN", "IND"])
    add("India-France Strategic Partnership", "entente", 1998, None, ["IND", "FRA"])
    add("Russia-China Strategic Partnership", "entente", 2001, None, ["RUS", "CHN"])
    add("Russia-India Strategic Partnership", "entente", 2000, None, ["RUS", "IND"])
    add("Singapore-India Defense Cooperation", "entente", 2003, None, ["SGP", "IND"])
    add("Thailand-China Defense Cooperation", "entente", 2012, None, ["THA", "CHN"])
    add("Pakistan-China Defense Agreement", "defense", 2005, None, ["PAK", "CHN"])
    add("Pakistan-Turkey Strategic Partnership", "entente", 2009, None, ["PAK", "TUR"])

    # ── Latin American defense pacts ─────────────────────────────────
    add("Argentina-Brazil Strategic Alliance", "entente", 1997, None, ["ARG", "BRA"])
    add("Argentina-Chile Peace and Friendship", "entente", 1984, None, ["ARG", "CHL"])
    add("UNASUR Defense Council", "entente", 2008, None, [
        "ARG", "BOL", "BRA", "CHL", "COL", "ECU", "GUY", "PRY", "PER",
        "SUR", "URY", "VEN",
    ])

    # ── European bilateral defense agreements ────────────────────────
    add("Lancaster House Treaties", "defense", 2010, None, ["GBR", "FRA"])
    add("Aachen Treaty", "defense", 2019, None, ["FRA", "DEU"])
    add("UK-Poland Defense Cooperation", "entente", 2017, None, ["GBR", "POL"])
    add("Baltic Defense Cooperation", "entente", 1994, None, ["EST", "LVA", "LTU"])
    add("Visegrad Group Defense Cooperation", "entente", 1991, None, ["CZE", "HUN", "POL", "SVK"])

    # ── Historical alliances (pre-1945) ──────────────────────────────
    add("Anglo-Portuguese Alliance", "defense", 1373, None, ["GBR", "PRT"])
    add("Tripartite Pact", "defense", 1940, 1945, ["DEU", "ITA", "JPN"])
    add("Anti-Comintern Pact", "defense", 1936, 1945, ["DEU", "JPN", "ITA", "HUN", "ESP", "BGR", "ROU", "FIN"])
    add("Allied Powers WW2", "defense", 1942, 1945, [
        "USA", "GBR", "FRA", "RUS", "CHN", "AUS", "CAN", "NZL", "ZAF",
        "BRA", "MEX", "IND",
    ])
    add("Sino-Soviet Non-Aggression", "nonaggression", 1937, 1945, ["CHN", "RUS"])

    # ── Middle East / Africa bilateral ───────────────────────────────
    add("Egypt-Saudi Defense Cooperation", "entente", 2015, None, ["EGY", "SAU"])
    add("Turkey-Azerbaijan Defense Pact", "defense", 2010, None, ["TUR", "AZE"])
    add("Turkey-Qatar Defense Agreement", "defense", 2014, None, ["TUR", "QAT"])
    add("Iran-Syria Defense Agreement", "defense", 2006, None, ["IRN", "SYR"])
    add("Ethiopia-Eritrea Peace Agreement", "entente", 2018, None, ["ETH", "ERI"])
    add("Rwanda-Uganda Defense Cooperation", "defense", 1998, 2000, ["RWA", "UGA"])
    add("South Africa-Mozambique Defense", "entente", 1995, None, ["ZAF", "MOZ"])

    # ── East Asian alliances ─────────────────────────────────────────
    add("Russia-Vietnam Strategic Partnership", "entente", 2012, None, ["RUS", "VNM"])
    add("China-Cambodia Defense Cooperation", "entente", 2010, None, ["CHN", "KHM"])
    add("China-Myanmar Defense Cooperation", "entente", 2011, None, ["CHN", "MMR"])

    print(f"  Generated {len(alliances)} seed alliances.")
    return alliances


def build_country_index(alliances):
    """Build per-country alliance summaries."""
    countries = {}
    current_year = datetime.now().year

    for a in alliances:
        is_active = a["end_year"] is None or a["end_year"] >= current_year
        for member in a["members"]:
            if member not in countries:
                countries[member] = {
                    "total_alliances": 0,
                    "active_alliances": 0,
                    "defense_pacts": 0,
                    "ententes": 0,
                    "non_aggression": 0,
                    "neutrality": 0,
                    "allies": set(),
                    "historical_allies": set(),
                }
            c = countries[member]
            c["total_alliances"] += 1
            if is_active:
                c["active_alliances"] += 1

            if a["type"] == "defense":
                c["defense_pacts"] += 1
            elif a["type"] == "entente":
                c["ententes"] += 1
            elif a["type"] == "nonaggression":
                c["non_aggression"] += 1
            elif a["type"] == "neutrality":
                c["neutrality"] += 1

            # Track allies (other members of this alliance)
            for other in a["members"]:
                if other == member:
                    continue
                if is_active:
                    c["allies"].add(other)
                else:
                    c["historical_allies"].add(other)

    # Convert sets to sorted lists; remove historical allies who are current allies
    for iso3, c in countries.items():
        c["historical_allies"] = sorted(c["historical_allies"] - c["allies"])
        c["allies"] = sorted(c["allies"])

    return countries


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    # Try downloading COW CSV, then local CSV, then seed data
    rows = try_download_csv()
    if rows is None:
        rows = try_read_local_csv()

    synthetic = False
    if "--seed" in sys.argv:
        print("  Writing hand-built placeholder alliance list (not COW data).")
        alliances = generate_seed_data()
        source_note = "Hand-built placeholder list (not Correlates of War data)"
        synthetic = True
    elif rows is not None:
        alliances = process_csv_rows(rows)
        source_note = ("Correlates of War Formal Alliances v4.1 (1816-2012). "
                       "Active = in force at the end of 2012; later changes are not included.")
        if len(alliances) < 200:
            sys.exit(f"COW data looks incomplete ({len(alliances)} alliances); {OUTPUT_FILE} left unchanged.")
    else:
        sys.exit(f"COW download failed; {OUTPUT_FILE} left unchanged. Use --seed for placeholder data.")

    # Name known alliances in CSV-sourced data if missing
    # (seed data already has names)

    countries = build_country_index(alliances)

    output = {
        "_meta": {
            "updated_at": datetime.now().strftime("%Y-%m-%d"),
            "source": source_note,
            "url": "https://correlatesofwar.org/data-sets/formal-alliances/",
            "years": "1816-2012",
            "data_end_year": 2012,
            "total_alliances": len(alliances),
            **({"synthetic": True} if synthetic else {}),
        },
        "alliances": alliances,
        "countries": countries,
    }

    tmp = OUTPUT_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    os.replace(tmp, OUTPUT_FILE)

    print(f"\nOutput written to: {OUTPUT_FILE}")
    print(f"  Total alliances: {len(alliances)}")
    print(f"  Countries with data: {len(countries)}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Fetch submarine cable data from TeleGeography's Submarine Cable Map API.

Produces a country-centric view of submarine cable infrastructure:
- Which cables connect to each country
- How many landing points per country
- Which countries are directly connected via shared cables
- Connectivity rankings

Falls back to realistic seed data if the API is unavailable.

Usage:
    python3 scripts/fetch_submarine_cables.py
"""

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print("requests library not available, will use seed data", file=sys.stderr)
    requests = None

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "site", "server", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "submarine-cables.json")

CABLES_INDEX_URL = "https://www.submarinecablemap.com/api/v3/cable/all.json"
CABLE_DETAIL_URL = "https://www.submarinecablemap.com/api/v3/cable/{cable_id}.json"

# Max concurrent requests for fetching individual cable details
MAX_WORKERS = 10

# Comprehensive mapping of landing point country names to ISO2 codes.
# TeleGeography uses full country names in their landing point data;
# this maps them to standard ISO 3166-1 alpha-2 codes.
COUNTRY_NAME_TO_ISO2 = {
    "afghanistan": "AF", "albania": "AL", "algeria": "DZ", "american samoa": "AS",
    "angola": "AO", "anguilla": "AI", "antigua and barbuda": "AG", "argentina": "AR",
    "aruba": "AW", "australia": "AU", "azerbaijan": "AZ", "bahamas": "BS",
    "bahrain": "BH", "bangladesh": "BD", "barbados": "BB", "belgium": "BE",
    "belize": "BZ", "benin": "BJ", "bermuda": "BM", "bonaire": "BQ",
    "brazil": "BR", "british virgin islands": "VG", "brunei": "BN",
    "bulgaria": "BG", "cabo verde": "CV", "cambodia": "KH", "cameroon": "CM",
    "canada": "CA", "cape verde": "CV", "cayman islands": "KY", "chile": "CL",
    "china": "CN", "colombia": "CO", "comoros": "KM",
    "congo, rep.": "CG", "congo, dem. rep.": "CD",
    "congo (brazzaville)": "CG", "congo (kinshasa)": "CD",
    "congo": "CG", "republic of the congo": "CG",
    "democratic republic of the congo": "CD",
    "costa rica": "CR", "croatia": "HR", "cuba": "CU",
    "curacao": "CW", "cura\u00e7ao": "CW", "cyprus": "CY",
    "denmark": "DK", "djibouti": "DJ",
    "dominica": "DM", "dominican republic": "DO", "east timor": "TL",
    "timor-leste": "TL", "ecuador": "EC", "egypt": "EG", "el salvador": "SV",
    "equatorial guinea": "GQ", "eritrea": "ER", "estonia": "EE", "ethiopia": "ET",
    "falkland islands": "FK", "faroe islands": "FO", "fiji": "FJ",
    "finland": "FI", "france": "FR", "french guiana": "GF",
    "french polynesia": "PF", "gabon": "GA", "gambia": "GM", "georgia": "GE",
    "germany": "DE", "ghana": "GH", "gibraltar": "GI", "greece": "GR",
    "greenland": "GL", "grenada": "GD", "guadeloupe": "GP", "guam": "GU",
    "guatemala": "GT", "guinea": "GN", "guinea-bissau": "GW", "guyana": "GY",
    "haiti": "HT", "honduras": "HN", "hong kong": "HK", "hungary": "HU",
    "iceland": "IS", "india": "IN", "indonesia": "ID", "iran": "IR",
    "iraq": "IQ", "ireland": "IE", "israel": "IL", "italy": "IT",
    "ivory coast": "CI", "c\u00f4te d'ivoire": "CI", "cote d'ivoire": "CI", "jamaica": "JM",
    "japan": "JP", "jordan": "JO", "kazakhstan": "KZ", "kenya": "KE",
    "kiribati": "KI", "kuwait": "KW", "laos": "LA", "latvia": "LV",
    "lebanon": "LB", "liberia": "LR", "libya": "LY", "lithuania": "LT",
    "macau": "MO", "madagascar": "MG", "malaysia": "MY", "maldives": "MV",
    "malta": "MT", "marshall islands": "MH", "martinique": "MQ",
    "mauritania": "MR", "mauritius": "MU", "mayotte": "YT", "mexico": "MX",
    "micronesia": "FM", "montenegro": "ME", "montserrat": "MS", "morocco": "MA",
    "mozambique": "MZ", "myanmar": "MM", "namibia": "NA", "nauru": "NR",
    "netherlands": "NL", "new caledonia": "NC", "new zealand": "NZ",
    "nicaragua": "NI", "nigeria": "NG", "niger": "NE",
    "north korea": "KP", "northern mariana islands": "MP",
    "norway": "NO", "oman": "OM", "pakistan": "PK", "palau": "PW",
    "palestine": "PS", "panama": "PA", "papua new guinea": "PG",
    "peru": "PE", "philippines": "PH", "poland": "PL", "portugal": "PT",
    "puerto rico": "PR", "qatar": "QA", "reunion": "RE", "r\u00e9union": "RE",
    "romania": "RO",
    "russia": "RU", "russian federation": "RU", "rwanda": "RW",
    "saint helena": "SH", "saint kitts and nevis": "KN", "saint lucia": "LC",
    "saint vincent and the grenadines": "VC",
    "st. kitts and nevis": "KN", "st. lucia": "LC",
    "st. vincent and the grenadines": "VC",
    "samoa": "WS", "sao tome and principe": "ST", "s\u00e3o tom\u00e9 and pr\u00edncipe": "ST",
    "saudi arabia": "SA", "senegal": "SN", "serbia": "RS",
    "seychelles": "SC", "sierra leone": "SL", "singapore": "SG",
    "sint maarten": "SX", "slovenia": "SI", "solomon islands": "SB",
    "somalia": "SO", "south africa": "ZA", "south korea": "KR",
    "korea (south)": "KR", "korea (north)": "KP",
    "spain": "ES", "sri lanka": "LK", "sudan": "SD", "south sudan": "SS",
    "suriname": "SR",
    "sweden": "SE", "switzerland": "CH",
    "syria": "SY", "taiwan": "TW", "tanzania": "TZ", "thailand": "TH",
    "the bahamas": "BS", "togo": "TG", "tonga": "TO",
    "trinidad and tobago": "TT", "tunisia": "TN", "turkey": "TR",
    "t\u00fcrkiye": "TR",
    "turkmenistan": "TM", "turks and caicos islands": "TC", "tuvalu": "TV",
    "u.s. virgin islands": "VI", "us virgin islands": "VI",
    "uganda": "UG", "ukraine": "UA",
    "united arab emirates": "AE", "uae": "AE",
    "united kingdom": "GB", "uk": "GB",
    "united states": "US", "usa": "US", "u.s.": "US",
    "uruguay": "UY", "vanuatu": "VU", "venezuela": "VE",
    "vietnam": "VN", "viet nam": "VN",
    "wallis and futuna": "WF",
    "yemen": "YE", "zambia": "ZM", "zimbabwe": "ZW",
    # Territories and special regions
    "ascension island": "SH", "canary islands": "ES", "azores": "PT",
    "madeira": "PT", "reunion island": "RE", "rodrigues": "MU",
    "st. helena": "SH", "tokelau": "TK", "niue": "NU",
    "cook islands": "CK", "norfolk island": "NF",
    "christmas island": "CX", "cocos islands": "CC",
    "cocos (keeling) islands": "CC",
    "svalbard": "SJ",
    "guernsey": "GG", "jersey": "JE", "isle of man": "IM",
    "monaco": "MC", "saint barth\u00e9lemy": "BL",
    "saint martin": "MF", "saint pierre and miquelon": "PM",
    "virgin islands (u.k.)": "VG",
}


def normalize_country_name(name):
    """Normalize a country/territory name for lookup."""
    if not name:
        return None
    return name.strip().lower().replace("\u2019", "'")


def resolve_country_iso2(country_name):
    """Resolve a country name to ISO2 code."""
    if not country_name:
        return None
    normalized = normalize_country_name(country_name)
    if not normalized:
        return None
    if normalized in COUNTRY_NAME_TO_ISO2:
        return COUNTRY_NAME_TO_ISO2[normalized]
    # Try partial matching for territories
    for key, code in COUNTRY_NAME_TO_ISO2.items():
        if key in normalized or normalized in key:
            return code
    return None


def fetch_cable_detail(cable_id):
    """Fetch detail for a single cable from the per-cable API endpoint."""
    url = CABLE_DETAIL_URL.format(cable_id=cable_id)
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return None


def fetch_from_api():
    """Fetch cable data from TeleGeography API.

    The all.json endpoint only returns cable id and name.
    We then fetch each cable's details from its individual endpoint
    to get landing points, owners, length, etc.
    """
    if requests is None:
        return None

    try:
        print("Fetching cable index from TeleGeography API...")
        index_resp = requests.get(CABLES_INDEX_URL, timeout=30)
        index_resp.raise_for_status()
        cable_index = index_resp.json()
        print(f"  Found {len(cable_index)} cables in index")
    except Exception as e:
        print(f"Failed to fetch cable index: {e}", file=sys.stderr)
        return None

    # Fetch detail for each cable using a thread pool
    cable_ids = [c["id"] for c in cable_index]
    cable_details = []
    failed = 0

    print(f"Fetching details for {len(cable_ids)} cables ({MAX_WORKERS} workers)...")
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_cable_detail, cid): cid for cid in cable_ids}
        done_count = 0
        for future in as_completed(futures):
            done_count += 1
            if done_count % 100 == 0:
                print(f"  Progress: {done_count}/{len(cable_ids)}")
            result = future.result()
            if result:
                cable_details.append(result)
            else:
                failed += 1

    print(f"  Fetched {len(cable_details)} cable details ({failed} failed)")
    if not cable_details:
        return None

    return cable_details


def process_api_data(cable_details):
    """Process per-cable API responses into our format."""
    cables = []
    country_cables = {}     # iso2 -> set of cable ids
    country_landing_points = {}  # iso2 -> count of landing points
    country_connections = {}  # iso2 -> set of connected iso2s
    unresolved_countries = set()

    for cable in cable_details:
        cable_id = cable.get("id", "")
        cable_name = cable.get("name", "")
        rfs_year = cable.get("rfs_year") or cable.get("rfs")
        length_raw = cable.get("length", "")
        owners_raw = cable.get("owners", "")

        # Parse owners (API returns comma-separated string)
        if isinstance(owners_raw, list):
            owners = [o.get("name", str(o)) if isinstance(o, dict) else str(o) for o in owners_raw]
        elif isinstance(owners_raw, str) and owners_raw:
            owners = [o.strip() for o in owners_raw.split(",")]
        else:
            owners = []

        # Parse length
        length_km = None
        if length_raw:
            try:
                length_str = str(length_raw).replace(",", "").replace(" km", "").strip()
                length_km = int(float(length_str))
            except (ValueError, TypeError):
                pass

        # Parse RFS year
        try:
            rfs_year = int(rfs_year) if rfs_year else None
        except (ValueError, TypeError):
            rfs_year = None

        # Resolve landing point countries
        # Each cable has landing_points: [{id, name, country, is_tbd}, ...]
        landing_points = cable.get("landing_points", [])
        landing_countries = set()
        country_lp_counts = {}  # iso2 -> count for this cable

        for lp in (landing_points or []):
            country_name = lp.get("country", "")
            iso2 = resolve_country_iso2(country_name)
            if iso2:
                landing_countries.add(iso2)
                country_lp_counts[iso2] = country_lp_counts.get(iso2, 0) + 1
            elif country_name:
                unresolved_countries.add(country_name)

        landing_countries_list = sorted(landing_countries)

        # Build cable entry
        cable_entry = {
            "id": str(cable_id),
            "name": cable_name,
        }
        if rfs_year:
            cable_entry["rfs_year"] = rfs_year
        if length_km:
            cable_entry["length_km"] = length_km
        if owners:
            cable_entry["owners"] = owners
        cable_entry["landing_countries"] = landing_countries_list

        if landing_countries_list:
            cables.append(cable_entry)

        # Update per-country aggregates
        for iso2 in landing_countries:
            if iso2 not in country_cables:
                country_cables[iso2] = set()
                country_landing_points[iso2] = 0
                country_connections[iso2] = set()

            country_cables[iso2].add(cable_id)
            country_landing_points[iso2] += country_lp_counts.get(iso2, 1)

            for other_iso2 in landing_countries:
                if other_iso2 != iso2:
                    country_connections[iso2].add(other_iso2)

    if unresolved_countries:
        print(f"  Warning: could not resolve {len(unresolved_countries)} country names:")
        for name in sorted(unresolved_countries):
            print(f"    - {name}")

    # Build country entries and rank by cable count
    countries = {}
    country_list = []
    for iso2 in country_cables:
        cable_count = len(country_cables[iso2])
        country_list.append((iso2, cable_count))

    country_list.sort(key=lambda x: -x[1])
    for rank, (iso2, cable_count) in enumerate(country_list, 1):
        countries[iso2] = {
            "cable_count": cable_count,
            "landing_points": country_landing_points.get(iso2, 0),
            "connected_countries": sorted(country_connections.get(iso2, set())),
            "connectivity_rank": rank,
        }

    return cables, countries


def generate_seed_data():
    """Generate realistic seed data based on known major submarine cables."""
    print("Generating seed data for submarine cables...")

    cables = [
        {"id": "sea-me-we-3", "name": "SEA-ME-WE 3", "rfs_year": 2000, "length_km": 39000,
         "owners": ["SingTel", "Telekom Malaysia", "VSNL"],
         "landing_countries": ["AU", "BD", "BN", "CN", "DE", "DJ", "EG", "FR", "GB", "GR", "ID",
                               "IN", "IT", "JP", "KR", "LK", "MM", "MY", "OM", "PK", "PT", "SA",
                               "SG", "TR", "AE"]},
        {"id": "sea-me-we-4", "name": "SEA-ME-WE 4", "rfs_year": 2005, "length_km": 20000,
         "owners": ["SingTel", "FLAG Telecom", "Bharti Airtel"],
         "landing_countries": ["AL", "DZ", "BD", "EG", "FR", "IN", "IT", "MY", "PK", "SA", "SG",
                               "TN", "AE"]},
        {"id": "sea-me-we-5", "name": "SEA-ME-WE 5", "rfs_year": 2017, "length_km": 20000,
         "owners": ["China Telecom", "SingTel", "Telekom Malaysia"],
         "landing_countries": ["BD", "DJ", "FR", "ID", "IN", "IT", "KE", "MM", "MY", "OM", "SA",
                               "SG", "LK", "TR", "AE", "YE"]},
        {"id": "sea-me-we-6", "name": "SEA-ME-WE 6", "rfs_year": 2025, "length_km": 19200,
         "owners": ["China Telecom", "Telekom Malaysia", "Telia Carrier"],
         "landing_countries": ["BD", "DJ", "EG", "FR", "DE", "IN", "ID", "MY", "SG", "LK", "TR", "AE"]},
        {"id": "aae-1", "name": "AAE-1", "rfs_year": 2017, "length_km": 25000,
         "owners": ["China Unicom", "Etisalat", "Mobily"],
         "landing_countries": ["CN", "DJ", "EG", "FR", "GR", "HK", "IN", "IT", "JP", "KH", "MY",
                               "MM", "OM", "PK", "QA", "SA", "SG", "TH", "AE", "VN"]},
        {"id": "faster", "name": "FASTER", "rfs_year": 2016, "length_km": 11629,
         "owners": ["Google", "KDDI", "China Telecom", "China Mobile", "SingTel"],
         "landing_countries": ["JP", "TW", "US"]},
        {"id": "aeconnect-1", "name": "AEConnect-1", "rfs_year": 2016, "length_km": 5536,
         "owners": ["Aqua Comms"],
         "landing_countries": ["IE", "US"]},
        {"id": "marea", "name": "MAREA", "rfs_year": 2018, "length_km": 6605,
         "owners": ["Microsoft", "Meta", "Telxius"],
         "landing_countries": ["ES", "US"]},
        {"id": "dunant", "name": "Dunant", "rfs_year": 2020, "length_km": 6400,
         "owners": ["Google"],
         "landing_countries": ["FR", "US"]},
        {"id": "havfrue", "name": "Havfrue/AEC-2", "rfs_year": 2020, "length_km": 7862,
         "owners": ["Aqua Comms", "Google", "Facebook"],
         "landing_countries": ["DK", "IE", "NO", "US"]},
        {"id": "grace-hopper", "name": "Grace Hopper", "rfs_year": 2022, "length_km": 6234,
         "owners": ["Google"],
         "landing_countries": ["ES", "GB", "US"]},
        {"id": "ellalink", "name": "EllaLink", "rfs_year": 2021, "length_km": 6000,
         "owners": ["EllaLink"],
         "landing_countries": ["BR", "CV", "MA", "PT"]},
        {"id": "2africa", "name": "2Africa", "rfs_year": 2024, "length_km": 45000,
         "owners": ["Meta", "China Mobile", "MTN", "Orange", "Vodafone"],
         "landing_countries": ["BH", "CG", "CI", "CM", "DJ", "EG", "ES", "FR", "GA", "GB", "GH",
                               "IN", "IQ", "IT", "JO", "KE", "KW", "MG", "MR", "MZ", "NG", "OM",
                               "PK", "PT", "SA", "SC", "SD", "SN", "SO", "TZ", "AE", "ZA"]},
        {"id": "equiano", "name": "Equiano", "rfs_year": 2023, "length_km": 15000,
         "owners": ["Google"],
         "landing_countries": ["CM", "NG", "PT", "ST", "TG", "ZA", "NA"]},
        {"id": "sacs", "name": "SACS", "rfs_year": 2018, "length_km": 6165,
         "owners": ["Angola Cables"],
         "landing_countries": ["AO", "BR"]},
        {"id": "monet", "name": "Monet", "rfs_year": 2017, "length_km": 10556,
         "owners": ["Google", "Algar Telecom", "Angola Cables"],
         "landing_countries": ["BR", "US"]},
        {"id": "seacom", "name": "SEACOM", "rfs_year": 2009, "length_km": 17000,
         "owners": ["SEACOM"],
         "landing_countries": ["DJ", "EG", "FR", "IN", "KE", "MZ", "TZ", "ZA"]},
        {"id": "eassy", "name": "EASSy", "rfs_year": 2010, "length_km": 10000,
         "owners": ["Multiple African Telecoms"],
         "landing_countries": ["DJ", "KE", "KM", "MG", "MZ", "SO", "TZ", "ZA", "SD"]},
        {"id": "wacs", "name": "WACS", "rfs_year": 2012, "length_km": 14530,
         "owners": ["MTN", "Vodacom", "Togo Telecom"],
         "landing_countries": ["AO", "CM", "CV", "CG", "CI", "GB", "GH", "NA", "NG", "PT", "TG", "ZA"]},
        {"id": "ace", "name": "ACE", "rfs_year": 2012, "length_km": 17000,
         "owners": ["Orange", "Multiple"],
         "landing_countries": ["CI", "CM", "CV", "FR", "GA", "GM", "GN", "GQ", "GW", "LR", "MR",
                               "NG", "PT", "SL", "SN", "ST", "TG", "ZA"]},
        {"id": "sat-3-wasc", "name": "SAT-3/WASC", "rfs_year": 2002, "length_km": 14350,
         "owners": ["Telkom SA", "Multiple"],
         "landing_countries": ["AO", "BJ", "CI", "CM", "ES", "GA", "GH", "NG", "PT", "SN", "ZA"]},
        {"id": "flag-europe-asia", "name": "FLAG Europe-Asia (FEA)", "rfs_year": 1997, "length_km": 28000,
         "owners": ["Global Cloud Xchange"],
         "landing_countries": ["CN", "EG", "ES", "GB", "HK", "IN", "IT", "JP", "KR", "MY", "SA",
                               "TH", "AE"]},
        {"id": "apcn-2", "name": "APCN-2", "rfs_year": 2001, "length_km": 19000,
         "owners": ["Multiple Asia-Pacific Telecoms"],
         "landing_countries": ["CN", "HK", "JP", "KR", "MY", "PH", "SG", "TW"]},
        {"id": "unity", "name": "Unity", "rfs_year": 2010, "length_km": 9620,
         "owners": ["Google", "KDDI", "Bharti Airtel", "Pacnet", "SingTel"],
         "landing_countries": ["JP", "US"]},
        {"id": "southern-cross-cable", "name": "Southern Cross Cable Network", "rfs_year": 2000, "length_km": 28500,
         "owners": ["Spark New Zealand", "Verizon", "Telstra"],
         "landing_countries": ["AU", "FJ", "NZ", "US"]},
        {"id": "hawaiki", "name": "Hawaiki Cable", "rfs_year": 2018, "length_km": 15000,
         "owners": ["Hawaiki Submarine Cable"],
         "landing_countries": ["AS", "AU", "NZ", "US"]},
        {"id": "apg", "name": "Asia Pacific Gateway (APG)", "rfs_year": 2016, "length_km": 10400,
         "owners": ["Multiple Asia-Pacific Telecoms"],
         "landing_countries": ["CN", "HK", "ID", "JP", "KR", "MY", "PH", "SG", "TH", "TW", "VN"]},
        {"id": "jga-south", "name": "JGA South", "rfs_year": 2020, "length_km": 640,
         "owners": ["Google"],
         "landing_countries": ["AU", "GU"]},
        {"id": "sxcn", "name": "Southern Cross NEXT", "rfs_year": 2023, "length_km": 15840,
         "owners": ["Southern Cross Cables"],
         "landing_countries": ["AU", "FJ", "KI", "NZ", "TO", "US"]},
        {"id": "brazil-us", "name": "Brazilian Festoon / GlobeNet", "rfs_year": 2000, "length_km": 22000,
         "owners": ["GlobeNet"],
         "landing_countries": ["BR", "CO", "US", "VE"]},
        {"id": "sam-1", "name": "SAm-1", "rfs_year": 2001, "length_km": 25000,
         "owners": ["Telxius"],
         "landing_countries": ["AR", "BR", "CL", "EC", "GT", "PE", "PR", "US"]},
        {"id": "pccs", "name": "Pan Caribbean Cable System", "rfs_year": 1998, "length_km": 6000,
         "owners": ["Multiple"],
         "landing_countries": ["CO", "CU", "HN", "JM", "PA", "US", "VE"]},
        {"id": "tannat", "name": "Tannat", "rfs_year": 2020, "length_km": 2100,
         "owners": ["Google", "Antel"],
         "landing_countries": ["AR", "BR", "UY"]},
        {"id": "firmina", "name": "Firmina", "rfs_year": 2023, "length_km": 14260,
         "owners": ["Google"],
         "landing_countries": ["AR", "BR", "US", "UY"]},
        {"id": "curie", "name": "Curie", "rfs_year": 2020, "length_km": 10476,
         "owners": ["Google"],
         "landing_countries": ["CL", "PA", "US"]},
        {"id": "japan-guam-australia-south", "name": "Japan-Guam-Australia Cable System (JGA)", "rfs_year": 2020,
         "length_km": 7000,
         "owners": ["Google", "NEC"],
         "landing_countries": ["AU", "GU", "JP"]},
        {"id": "c-lion1", "name": "C-Lion1", "rfs_year": 2016, "length_km": 1200,
         "owners": ["Cinia"],
         "landing_countries": ["DE", "FI"]},
        {"id": "norsea-com-1", "name": "NORSEACom-1", "rfs_year": 2008, "length_km": 1600,
         "owners": ["Bulk Infrastructure"],
         "landing_countries": ["GB", "NO"]},
        {"id": "celtic-norse", "name": "Celtic Norse", "rfs_year": 2002, "length_km": 1500,
         "owners": ["Hibernia Networks"],
         "landing_countries": ["GB", "IE", "IS"]},
        {"id": "hibernia-express", "name": "Hibernia Express", "rfs_year": 2015, "length_km": 4600,
         "owners": ["GTT Communications"],
         "landing_countries": ["CA", "GB", "IE"]},
        {"id": "tata-tgn-atlantic", "name": "TGN-Atlantic", "rfs_year": 2001, "length_km": 13000,
         "owners": ["Tata Communications"],
         "landing_countries": ["FR", "GB", "US"]},
        {"id": "asia-africa-europe-1", "name": "Asia-Africa-Europe-1 (AAE-1)", "rfs_year": 2017, "length_km": 25000,
         "owners": ["Multiple"],
         "landing_countries": ["EG", "FR", "GR", "HK", "IN", "IT", "MY", "OM", "PK", "QA", "SA", "SG",
                               "TH", "AE", "VN"]},
        {"id": "echo", "name": "Echo", "rfs_year": 2024, "length_km": 17000,
         "owners": ["Google", "Meta"],
         "landing_countries": ["GU", "ID", "SG", "US"]},
        {"id": "bifrost", "name": "Bifrost", "rfs_year": 2024, "length_km": 15000,
         "owners": ["Meta", "Keppel", "Telin"],
         "landing_countries": ["GU", "ID", "PH", "SG", "US"]},
        {"id": "indigo-central", "name": "Indigo Central", "rfs_year": 2019, "length_km": 9000,
         "owners": ["Google", "AARNet", "Indosat", "SingTel", "SubPartners"],
         "landing_countries": ["AU", "ID", "SG"]},
        {"id": "peace", "name": "PEACE Cable", "rfs_year": 2022, "length_km": 15000,
         "owners": ["Hengtong Group", "PEACE Cable International"],
         "landing_countries": ["CY", "DJ", "EG", "FR", "KE", "MT", "MV", "PK", "SA", "SG", "ZA"]},
        {"id": "medusa", "name": "MEDUSA", "rfs_year": 2025, "length_km": 8700,
         "owners": ["AFR-IX telecom"],
         "landing_countries": ["DZ", "EG", "ES", "FR", "IT", "MA", "PT", "TN"]},
        {"id": "canalink", "name": "Canalink", "rfs_year": 2024, "length_km": 7200,
         "owners": ["Islalink"],
         "landing_countries": ["ES", "MA", "MR", "SN"]},
    ]

    # Build country data from cables
    country_cables = {}
    country_landing_points = {}
    country_connections = {}

    for cable in cables:
        for iso2 in cable["landing_countries"]:
            if iso2 not in country_cables:
                country_cables[iso2] = set()
                country_landing_points[iso2] = 0
                country_connections[iso2] = set()

            country_cables[iso2].add(cable["id"])
            country_landing_points[iso2] += 1  # approximate

            for other in cable["landing_countries"]:
                if other != iso2:
                    country_connections[iso2].add(other)

    # Build country entries and rank
    countries = {}
    country_list = sorted(country_cables.keys(), key=lambda c: -len(country_cables[c]))
    for rank, iso2 in enumerate(country_list, 1):
        countries[iso2] = {
            "cable_count": len(country_cables[iso2]),
            "landing_points": country_landing_points.get(iso2, 0),
            "connected_countries": sorted(country_connections.get(iso2, set())),
            "connectivity_rank": rank,
        }

    return cables, countries


def main():
    cable_details = fetch_from_api()

    cables, countries = None, None
    source_note = ""

    if cable_details:
        cables, countries = process_api_data(cable_details)
        source_note = "TeleGeography Submarine Cable Map API"

    # If API data yielded no usable cables, use seed data
    if not cables or len(cables) == 0:
        print("API data insufficient, using seed data.", file=sys.stderr)
        cables, countries = generate_seed_data()
        source_note = "TeleGeography Submarine Cable Map (seed data)"

    # Filter out cables with no landing countries
    cables = [c for c in cables if c.get("landing_countries")]

    output = {
        "_meta": {
            "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": source_note,
            "total_cables": len(cables),
            "total_countries": len(countries),
        },
        "cables": sorted(cables, key=lambda c: c.get("name", "")),
        "countries": dict(sorted(countries.items())),
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {OUTPUT_FILE}")
    print(f"  {len(cables)} cables, {len(countries)} countries")

    # Print top 10 most connected countries
    top = sorted(countries.items(), key=lambda x: -x[1]["cable_count"])[:10]
    print("\nTop 10 most connected countries:")
    for iso2, data in top:
        print(f"  {iso2}: {data['cable_count']} cables, {len(data['connected_countries'])} connected countries")


if __name__ == "__main__":
    main()

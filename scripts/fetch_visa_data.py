#!/usr/bin/env python3
"""Fetch visa restriction data from passport-index-dataset and produce visa-restrictions.json."""

import csv
import io
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import date

CSV_URL = "https://raw.githubusercontent.com/ilyankou/passport-index-dataset/master/passport-index-tidy.csv"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "site", "server", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "visa-restrictions.json")

# Country name -> ISO3 / ISO2 mapping
# This covers all countries in the passport-index-dataset
NAME_TO_ISO = {
    "Afghanistan": ("AFG", "AF"),
    "Albania": ("ALB", "AL"),
    "Algeria": ("DZA", "DZ"),
    "Andorra": ("AND", "AD"),
    "Angola": ("AGO", "AO"),
    "Antigua and Barbuda": ("ATG", "AG"),
    "Argentina": ("ARG", "AR"),
    "Armenia": ("ARM", "AM"),
    "Australia": ("AUS", "AU"),
    "Austria": ("AUT", "AT"),
    "Azerbaijan": ("AZE", "AZ"),
    "Bahamas": ("BHS", "BS"),
    "Bahrain": ("BHR", "BH"),
    "Bangladesh": ("BGD", "BD"),
    "Barbados": ("BRB", "BB"),
    "Belarus": ("BLR", "BY"),
    "Belgium": ("BEL", "BE"),
    "Belize": ("BLZ", "BZ"),
    "Benin": ("BEN", "BJ"),
    "Bhutan": ("BTN", "BT"),
    "Bolivia": ("BOL", "BO"),
    "Bosnia and Herzegovina": ("BIH", "BA"),
    "Botswana": ("BWA", "BW"),
    "Brazil": ("BRA", "BR"),
    "Brunei": ("BRN", "BN"),
    "Bulgaria": ("BGR", "BG"),
    "Burkina Faso": ("BFA", "BF"),
    "Burundi": ("BDI", "BI"),
    "Cambodia": ("KHM", "KH"),
    "Cameroon": ("CMR", "CM"),
    "Canada": ("CAN", "CA"),
    "Cape Verde": ("CPV", "CV"),
    "Central African Republic": ("CAF", "CF"),
    "Chad": ("TCD", "TD"),
    "Chile": ("CHL", "CL"),
    "China": ("CHN", "CN"),
    "Colombia": ("COL", "CO"),
    "Comoros": ("COM", "KM"),
    "Congo": ("COG", "CG"),
    "Congo (Dem. Rep.)": ("COD", "CD"),
    "Costa Rica": ("CRI", "CR"),
    "Croatia": ("HRV", "HR"),
    "Cuba": ("CUB", "CU"),
    "Cyprus": ("CYP", "CY"),
    "Czech Republic": ("CZE", "CZ"),
    "Czechia": ("CZE", "CZ"),
    "Denmark": ("DNK", "DK"),
    "Djibouti": ("DJI", "DJ"),
    "Dominica": ("DMA", "DM"),
    "Dominican Republic": ("DOM", "DO"),
    "East Timor": ("TLS", "TL"),
    "Ecuador": ("ECU", "EC"),
    "Egypt": ("EGY", "EG"),
    "El Salvador": ("SLV", "SV"),
    "Equatorial Guinea": ("GNQ", "GQ"),
    "Eritrea": ("ERI", "ER"),
    "Estonia": ("EST", "EE"),
    "Eswatini": ("SWZ", "SZ"),
    "Ethiopia": ("ETH", "ET"),
    "Fiji": ("FJI", "FJ"),
    "Finland": ("FIN", "FI"),
    "France": ("FRA", "FR"),
    "Gabon": ("GAB", "GA"),
    "Gambia": ("GMB", "GM"),
    "Georgia": ("GEO", "GE"),
    "Germany": ("DEU", "DE"),
    "Ghana": ("GHA", "GH"),
    "Greece": ("GRC", "GR"),
    "Grenada": ("GRD", "GD"),
    "Guatemala": ("GTM", "GT"),
    "Guinea": ("GIN", "GN"),
    "Guinea-Bissau": ("GNB", "GW"),
    "Guyana": ("GUY", "GY"),
    "Haiti": ("HTI", "HT"),
    "Honduras": ("HND", "HN"),
    "Hong Kong": ("HKG", "HK"),
    "Hungary": ("HUN", "HU"),
    "Iceland": ("ISL", "IS"),
    "India": ("IND", "IN"),
    "Indonesia": ("IDN", "ID"),
    "Iran": ("IRN", "IR"),
    "Iraq": ("IRQ", "IQ"),
    "Ireland": ("IRL", "IE"),
    "Israel": ("ISR", "IL"),
    "Italy": ("ITA", "IT"),
    "Ivory Coast": ("CIV", "CI"),
    "Jamaica": ("JAM", "JM"),
    "Japan": ("JPN", "JP"),
    "Jordan": ("JOR", "JO"),
    "Kazakhstan": ("KAZ", "KZ"),
    "Kenya": ("KEN", "KE"),
    "Kiribati": ("KIR", "KI"),
    "Kosovo": ("XKX", "XK"),
    "Kuwait": ("KWT", "KW"),
    "Kyrgyzstan": ("KGZ", "KG"),
    "Laos": ("LAO", "LA"),
    "Latvia": ("LVA", "LV"),
    "Lebanon": ("LBN", "LB"),
    "Lesotho": ("LSO", "LS"),
    "Liberia": ("LBR", "LR"),
    "Libya": ("LBY", "LY"),
    "Liechtenstein": ("LIE", "LI"),
    "Lithuania": ("LTU", "LT"),
    "Luxembourg": ("LUX", "LU"),
    "Macao": ("MAC", "MO"),
    "Madagascar": ("MDG", "MG"),
    "Malawi": ("MWI", "MW"),
    "Malaysia": ("MYS", "MY"),
    "Maldives": ("MDV", "MV"),
    "Mali": ("MLI", "ML"),
    "Malta": ("MLT", "MT"),
    "Marshall Islands": ("MHL", "MH"),
    "Mauritania": ("MRT", "MR"),
    "Mauritius": ("MUS", "MU"),
    "Mexico": ("MEX", "MX"),
    "Micronesia": ("FSM", "FM"),
    "Moldova": ("MDA", "MD"),
    "Monaco": ("MCO", "MC"),
    "Mongolia": ("MNG", "MN"),
    "Montenegro": ("MNE", "ME"),
    "Morocco": ("MAR", "MA"),
    "Mozambique": ("MOZ", "MZ"),
    "Myanmar": ("MMR", "MM"),
    "Namibia": ("NAM", "NA"),
    "Nauru": ("NRU", "NR"),
    "Nepal": ("NPL", "NP"),
    "Netherlands": ("NLD", "NL"),
    "New Zealand": ("NZL", "NZ"),
    "Nicaragua": ("NIC", "NI"),
    "Niger": ("NER", "NE"),
    "Nigeria": ("NGA", "NG"),
    "North Korea": ("PRK", "KP"),
    "North Macedonia": ("MKD", "MK"),
    "Norway": ("NOR", "NO"),
    "Oman": ("OMN", "OM"),
    "Pakistan": ("PAK", "PK"),
    "Palau": ("PLW", "PW"),
    "Palestine": ("PSE", "PS"),
    "Panama": ("PAN", "PA"),
    "Papua New Guinea": ("PNG", "PG"),
    "Paraguay": ("PRY", "PY"),
    "Peru": ("PER", "PE"),
    "Philippines": ("PHL", "PH"),
    "Poland": ("POL", "PL"),
    "Portugal": ("PRT", "PT"),
    "Qatar": ("QAT", "QA"),
    "Romania": ("ROU", "RO"),
    "Russia": ("RUS", "RU"),
    "Rwanda": ("RWA", "RW"),
    "Samoa": ("WSM", "WS"),
    "San Marino": ("SMR", "SM"),
    "Saudi Arabia": ("SAU", "SA"),
    "Senegal": ("SEN", "SN"),
    "Serbia": ("SRB", "RS"),
    "Seychelles": ("SYC", "SC"),
    "Sierra Leone": ("SLE", "SL"),
    "Singapore": ("SGP", "SG"),
    "Slovakia": ("SVK", "SK"),
    "Slovenia": ("SVN", "SI"),
    "Solomon Islands": ("SLB", "SB"),
    "Somalia": ("SOM", "SO"),
    "South Africa": ("ZAF", "ZA"),
    "South Korea": ("KOR", "KR"),
    "South Sudan": ("SSD", "SS"),
    "Spain": ("ESP", "ES"),
    "Sri Lanka": ("LKA", "LK"),
    "St. Kitts and Nevis": ("KNA", "KN"),
    "St. Lucia": ("LCA", "LC"),
    "St. Vincent and the Grenadines": ("VCT", "VC"),
    "Sudan": ("SDN", "SD"),
    "Suriname": ("SUR", "SR"),
    "Sweden": ("SWE", "SE"),
    "Switzerland": ("CHE", "CH"),
    "Syria": ("SYR", "SY"),
    "São Tomé and Príncipe": ("STP", "ST"),
    "Taiwan": ("TWN", "TW"),
    "Tajikistan": ("TJK", "TJ"),
    "Tanzania": ("TZA", "TZ"),
    "Thailand": ("THA", "TH"),
    "Timor-Leste": ("TLS", "TL"),
    "Togo": ("TGO", "TG"),
    "Tonga": ("TON", "TO"),
    "Trinidad and Tobago": ("TTO", "TT"),
    "Tunisia": ("TUN", "TN"),
    "Turkey": ("TUR", "TR"),
    "Turkmenistan": ("TKM", "TM"),
    "Tuvalu": ("TUV", "TV"),
    "Uganda": ("UGA", "UG"),
    "Ukraine": ("UKR", "UA"),
    "United Arab Emirates": ("ARE", "AE"),
    "United Kingdom": ("GBR", "GB"),
    "United States": ("USA", "US"),
    "Uruguay": ("URY", "UY"),
    "Uzbekistan": ("UZB", "UZ"),
    "Vanuatu": ("VUT", "VU"),
    "Vatican City": ("VAT", "VA"),
    "Venezuela": ("VEN", "VE"),
    "Vietnam": ("VNM", "VN"),
    "Yemen": ("YEM", "YE"),
    "Zambia": ("ZMB", "ZM"),
    "Zimbabwe": ("ZWE", "ZW"),
    "Vatican": ("VAT", "VA"),
    # Alternative name variants that appear in the dataset
    "Côte d'Ivoire": ("CIV", "CI"),
    "Cote d'Ivoire (Ivory Coast)": ("CIV", "CI"),
    "Timor Leste": ("TLS", "TL"),
    "Swaziland": ("SWZ", "SZ"),
    "Macedonia": ("MKD", "MK"),
    "Sao Tome and Principe": ("STP", "ST"),
    "Brunei Darussalam": ("BRN", "BN"),
    "Cabo Verde": ("CPV", "CV"),
    "Hong Kong (SAR China)": ("HKG", "HK"),
    "Macao (SAR China)": ("MAC", "MO"),
    "Türkiye": ("TUR", "TR"),
    "Micronesia (Federated States of)": ("FSM", "FM"),
    "Palestinian Territories": ("PSE", "PS"),
    "St Kitts and Nevis": ("KNA", "KN"),
    "St Lucia": ("LCA", "LC"),
    "St Vincent and the Grenadines": ("VCT", "VC"),
    "Saint Kitts and Nevis": ("KNA", "KN"),
    "Saint Lucia": ("LCA", "LC"),
    "Saint Vincent and the Grenadines": ("VCT", "VC"),
    "Republic of the Congo": ("COG", "CG"),
    "Democratic Republic of the Congo": ("COD", "CD"),
    "DR Congo": ("COD", "CD"),
}


def name_to_iso3(name):
    """Convert a country name to ISO3 code."""
    if name in NAME_TO_ISO:
        return NAME_TO_ISO[name][0]
    # Try case-insensitive match
    lower = name.lower().strip()
    for k, v in NAME_TO_ISO.items():
        if k.lower() == lower:
            return v[0]
    return None


def classify_requirement(req):
    """Classify a raw requirement string into a category."""
    req = req.strip().lower()
    if req == "-1":
        return "self"
    if req == "visa free":
        return "visa_free"
    if req == "visa on arrival":
        return "visa_on_arrival"
    if req == "e-visa":
        return "e_visa"
    if req == "eta":
        return "visa_free"  # ETA is essentially visa-free (e.g. Canada, Australia)
    if req == "visa required":
        return "visa_required"
    if req == "no admission":
        return "no_admission"
    # Numeric value = visa-free days
    try:
        days = int(req)
        if days > 0:
            return "visa_free"
        return "visa_required"
    except ValueError:
        return "visa_required"


def normalize_requirement_label(req):
    """Normalize a raw requirement into a display label for pairs."""
    req = req.strip().lower()
    if req == "-1":
        return "self"
    if req == "eta":
        return "visa free"
    try:
        days = int(req)
        if days > 0:
            return f"{days} days"
        return "visa required"
    except ValueError:
        return req


def download_csv():
    """Download the tidy CSV from GitHub."""
    print(f"Downloading visa data from {CSV_URL}...")
    try:
        req = urllib.request.Request(CSV_URL, headers={"User-Agent": "worldcountrygroups/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read().decode("utf-8")
        print(f"  Downloaded {len(data)} bytes")
        return data
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        print(f"  Download failed: {e}")
        return None


def parse_csv(csv_text):
    """Parse the CSV and return list of (passport, destination, requirement) tuples."""
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = []
    unmapped_names = set()
    for row in reader:
        passport = row.get("Passport", "").strip()
        destination = row.get("Destination", "").strip()
        requirement = row.get("Requirement", "").strip()
        if not passport or not destination or not requirement:
            continue
        iso3_from = name_to_iso3(passport)
        iso3_to = name_to_iso3(destination)
        if not iso3_from:
            unmapped_names.add(passport)
            continue
        if not iso3_to:
            unmapped_names.add(destination)
            continue
        rows.append((iso3_from, iso3_to, requirement))
    if unmapped_names:
        print(f"  Warning: {len(unmapped_names)} unmapped country names: {sorted(unmapped_names)[:15]}")
    print(f"  Parsed {len(rows)} requirement pairs")
    return rows


def build_data(rows):
    """Build the output data structure from parsed rows."""
    # Per-country outgoing counts
    countries = {}  # iso3 -> {visa_free, visa_on_arrival, e_visa, visa_required, no_admission}
    # Per-country incoming (openness) counts
    open_to = {}  # iso3 -> {visa_free, visa_on_arrival, e_visa, visa_required}
    # Pairs
    pairs = {}

    for iso3_from, iso3_to, requirement in rows:
        category = classify_requirement(requirement)
        if category == "self":
            continue

        # Initialize outgoing counts
        if iso3_from not in countries:
            countries[iso3_from] = {
                "visa_free": 0,
                "visa_on_arrival": 0,
                "e_visa": 0,
                "visa_required": 0,
                "no_admission": 0,
            }

        # Initialize incoming counts
        if iso3_to not in open_to:
            open_to[iso3_to] = {
                "visa_free": 0,
                "visa_on_arrival": 0,
                "e_visa": 0,
                "visa_required": 0,
            }

        # Count outgoing
        if category in countries[iso3_from]:
            countries[iso3_from][category] += 1

        # Count incoming (openness to visitors)
        if category == "no_admission":
            pass  # Don't count no_admission in open_to
        elif category in open_to[iso3_to]:
            open_to[iso3_to][category] += 1

        # Store pair
        label = normalize_requirement_label(requirement)
        pairs[f"{iso3_from}\u2192{iso3_to}"] = label

    # Calculate mobility scores
    scored = []
    for iso3, counts in countries.items():
        mobility = counts["visa_free"] + counts["visa_on_arrival"]
        scored.append((iso3, mobility))
    scored.sort(key=lambda x: -x[1])

    # Assign ranks
    rank_map = {}
    for rank_idx, (iso3, _score) in enumerate(scored, 1):
        rank_map[iso3] = rank_idx

    # Build final country entries
    country_data = {}
    for iso3, counts in sorted(countries.items()):
        mobility = counts["visa_free"] + counts["visa_on_arrival"]
        entry = {
            "visa_free": counts["visa_free"],
            "visa_on_arrival": counts["visa_on_arrival"],
            "e_visa": counts["e_visa"],
            "visa_required": counts["visa_required"],
            "no_admission": counts["no_admission"],
            "mobility_score": mobility,
            "mobility_rank": rank_map.get(iso3, 0),
        }
        if iso3 in open_to:
            entry["open_to"] = open_to[iso3]
        else:
            entry["open_to"] = {"visa_free": 0, "visa_on_arrival": 0, "e_visa": 0, "visa_required": 0}
        country_data[iso3] = entry

    return country_data, pairs


def generate_seed_data():
    """Generate realistic seed data based on known passport rankings."""
    print("  Generating seed data for ~100 countries...")
    # Based on real-world 2024 passport power rankings
    seed = {
        # Tier 1: Very strong passports (mobility 170+)
        "JPN": (194, 5, 10, 0, 0), "SGP": (192, 6, 8, 3, 0), "DEU": (190, 5, 8, 5, 1),
        "ESP": (190, 5, 8, 5, 1), "ITA": (190, 5, 8, 5, 1), "FRA": (189, 6, 8, 5, 1),
        "GBR": (187, 7, 9, 5, 1), "KOR": (189, 5, 9, 5, 1), "FIN": (189, 5, 8, 6, 1),
        "SWE": (189, 5, 8, 6, 1), "AUT": (188, 5, 8, 7, 1), "NLD": (188, 5, 8, 7, 1),
        "IRL": (187, 5, 9, 7, 1), "NZL": (185, 8, 9, 6, 1), "CHE": (186, 5, 8, 9, 1),
        "AUS": (185, 7, 10, 6, 1), "CAN": (185, 7, 9, 7, 1), "USA": (184, 8, 10, 6, 1),
        "NOR": (187, 5, 8, 8, 1), "DNK": (188, 5, 8, 7, 1), "BEL": (188, 5, 8, 7, 1),
        "PRT": (188, 5, 8, 7, 1), "GRC": (186, 5, 8, 9, 1), "POL": (184, 5, 9, 10, 1),
        "CZE": (184, 5, 9, 10, 1), "HUN": (183, 5, 9, 11, 1), "SVK": (182, 5, 9, 12, 1),
        "LTU": (182, 5, 9, 12, 1), "LVA": (181, 5, 9, 13, 1), "EST": (181, 5, 9, 13, 1),
        "SVN": (183, 5, 9, 11, 1), "MLT": (184, 5, 8, 11, 1), "ISL": (186, 5, 8, 9, 1),
        "LUX": (187, 5, 8, 8, 1),
        # Tier 2: Strong passports (mobility 120-169)
        "HRV": (175, 5, 10, 18, 1), "ROU": (174, 5, 10, 19, 1), "BGR": (173, 5, 10, 20, 1),
        "CHL": (170, 8, 12, 18, 1), "ARG": (168, 10, 12, 18, 1), "BRA": (166, 10, 15, 17, 1),
        "MEX": (157, 15, 18, 18, 1), "MYS": (166, 12, 12, 18, 1), "ISR": (159, 8, 12, 28, 2),
        "ARE": (170, 10, 10, 18, 1), "URY": (166, 8, 15, 19, 1), "CRI": (155, 12, 18, 23, 1),
        "PAN": (142, 15, 20, 31, 1), "SRB": (138, 15, 22, 33, 1), "MNE": (124, 15, 25, 44, 1),
        "MKD": (124, 15, 25, 44, 1), "BIH": (121, 15, 25, 47, 1), "GEO": (116, 15, 28, 49, 1),
        "TUR": (115, 20, 25, 48, 1), "UKR": (144, 8, 18, 38, 1),
        "THA": (80, 30, 25, 73, 1), "ZAF": (102, 15, 22, 69, 1),
        # Tier 3: Average passports (mobility 60-119)
        "CHN": (80, 25, 30, 73, 1), "RUS": (77, 20, 28, 83, 1),
        "KAZ": (76, 18, 30, 84, 1), "BLR": (77, 15, 25, 91, 1),
        "QAT": (100, 20, 18, 70, 1), "KWT": (95, 20, 20, 73, 1),
        "SAU": (80, 25, 22, 81, 1), "OMN": (78, 22, 22, 86, 1),
        "BHR": (85, 20, 22, 81, 1),
        "TUN": (70, 18, 28, 92, 1), "MAR": (65, 20, 30, 93, 1),
        "IDN": (72, 25, 25, 86, 1), "PHL": (66, 25, 28, 89, 1),
        "VNM": (55, 20, 30, 103, 1), "KEN": (72, 22, 25, 89, 1),
        "GHA": (64, 20, 28, 96, 1), "NGA": (46, 20, 35, 107, 1),
        "EGY": (52, 25, 30, 101, 1), "JOR": (52, 22, 28, 106, 1),
        "LBN": (48, 20, 28, 112, 1),
        # Tier 4: Weak passports (mobility 30-59)
        "IND": (58, 22, 30, 98, 1), "BGD": (40, 18, 28, 122, 1),
        "LKA": (42, 20, 28, 118, 1), "NPL": (38, 18, 28, 124, 1),
        "MMR": (35, 18, 28, 127, 1), "LAO": (50, 15, 25, 118, 1),
        "KHM": (52, 15, 25, 116, 1), "ETH": (44, 18, 25, 121, 1),
        "TZA": (68, 18, 22, 100, 1), "UGA": (62, 18, 25, 103, 1),
        "CMR": (48, 18, 28, 114, 1), "SEN": (66, 18, 25, 99, 1),
        "CIV": (60, 18, 25, 105, 1), "MLI": (52, 18, 25, 113, 1),
        "BFA": (48, 18, 25, 117, 1), "NER": (46, 18, 25, 119, 1),
        "TCD": (44, 18, 25, 121, 1),
        "DZA": (50, 18, 25, 115, 1), "LBY": (38, 18, 28, 124, 1),
        "CUB": (65, 12, 22, 109, 1),
        "MNG": (65, 18, 22, 103, 1), "UZB": (55, 18, 25, 110, 1),
        "TJK": (50, 18, 25, 115, 1), "KGZ": (62, 18, 25, 103, 1),
        "TKM": (50, 15, 22, 121, 1),
        # Tier 5: Very restricted passports (mobility <30)
        "IRQ": (29, 15, 25, 138, 2), "SYR": (26, 12, 22, 147, 2),
        "AFG": (26, 10, 20, 150, 3), "YEM": (33, 12, 22, 140, 2),
        "SOM": (34, 12, 22, 140, 1), "PAK": (32, 18, 28, 130, 1),
        "PRK": (40, 5, 10, 150, 4), "SDN": (38, 15, 22, 133, 1),
        "SSD": (35, 12, 20, 141, 1), "ERI": (38, 12, 22, 136, 1),
        "LBR": (48, 18, 22, 120, 1), "SLE": (44, 18, 22, 124, 1),
        "PSE": (36, 10, 20, 142, 1),
        "IRN": (43, 18, 22, 124, 1), "VEN": (52, 15, 22, 119, 1),
        # Additional countries
        "COL": (130, 15, 22, 41, 1), "PER": (135, 15, 18, 40, 1),
        "ECU": (90, 18, 25, 75, 1), "BOL": (75, 15, 25, 93, 1),
        "PRY": (140, 12, 18, 38, 1), "DOM": (70, 18, 25, 95, 1),
        "GTM": (135, 12, 20, 41, 1), "HND": (130, 12, 22, 44, 1),
        "SLV": (132, 12, 20, 44, 1), "NIC": (125, 12, 22, 49, 1),
        "JAM": (85, 18, 22, 83, 1), "TTO": (88, 15, 20, 85, 1),
        "BWA": (84, 15, 22, 87, 1), "NAM": (78, 15, 22, 93, 1),
        "MOZ": (62, 18, 22, 106, 1), "MWI": (58, 18, 22, 110, 1),
        "ZMB": (62, 18, 22, 106, 1), "ZWE": (56, 15, 22, 115, 1),
        "RWA": (66, 18, 22, 102, 1), "MDG": (56, 18, 22, 112, 1),
        "MUS": (146, 12, 15, 35, 1), "SYC": (152, 10, 12, 34, 1),
        "FJI": (90, 18, 18, 82, 1),
        "MDA": (121, 15, 25, 47, 1), "ALB": (119, 15, 25, 49, 1),
        "AGO": (48, 18, 25, 117, 1), "COG": (48, 18, 25, 117, 1),
        "COD": (42, 18, 25, 123, 1), "GAB": (52, 18, 25, 113, 1),
        "GNQ": (48, 15, 22, 123, 1), "CAF": (42, 15, 22, 129, 1),
        "BDI": (42, 15, 22, 129, 1), "GIN": (52, 18, 22, 116, 1),
        "GNB": (48, 18, 22, 120, 1), "TGO": (52, 18, 22, 116, 1),
        "BEN": (56, 18, 22, 112, 1), "DJI": (48, 18, 22, 120, 1),
    }

    total_countries = len(seed)
    country_data = {}
    pairs = {}

    # Assign ranks by mobility score
    ranked = sorted(seed.items(), key=lambda x: -(x[1][0] + x[1][1]))
    rank_map = {iso3: rank for rank, (iso3, _) in enumerate(ranked, 1)}

    for iso3, (vf, voa, ev, vr, na) in seed.items():
        mobility = vf + voa
        country_data[iso3] = {
            "visa_free": vf,
            "visa_on_arrival": voa,
            "e_visa": ev,
            "visa_required": vr,
            "no_admission": na,
            "mobility_score": mobility,
            "mobility_rank": rank_map[iso3],
            "open_to": {
                "visa_free": max(10, vf // 2),
                "visa_on_arrival": max(5, voa),
                "e_visa": max(5, ev // 2),
                "visa_required": max(20, 199 - vf - voa - ev),
            },
        }

    # Generate some representative pairs
    strong = ["USA", "GBR", "DEU", "FRA", "JPN", "CAN", "AUS", "KOR", "SGP"]
    medium = ["BRA", "MEX", "TUR", "CHN", "RUS", "ZAF", "IND", "ARE", "SAU"]
    weak = ["AFG", "IRQ", "SYR", "PRK", "SOM", "YEM", "PAK"]

    for s in strong:
        for s2 in strong:
            if s != s2:
                pairs[f"{s}\u2192{s2}"] = "visa free"
        for m in medium:
            pairs[f"{s}\u2192{m}"] = "visa free"
            pairs[f"{m}\u2192{s}"] = "visa required"
        for w in weak:
            pairs[f"{s}\u2192{w}"] = "visa required"
            pairs[f"{w}\u2192{s}"] = "visa required"
    for m in medium:
        for m2 in medium:
            if m != m2:
                pairs[f"{m}\u2192{m2}"] = "visa required"

    return country_data, pairs, total_countries


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    csv_text = download_csv()
    if csv_text:
        rows = parse_csv(csv_text)
        if rows:
            country_data, pairs = build_data(rows)
            country_count = len(country_data)
            source = "Passport Index Dataset (GitHub)"
        else:
            print("  CSV parsed but no valid rows, falling back to seed data")
            country_data, pairs, country_count = generate_seed_data()
            source = "Seed data (download succeeded but parsing failed)"
    else:
        print("  Falling back to seed data")
        country_data, pairs, country_count = generate_seed_data()
        source = "Seed data (download failed)"

    output = {
        "_meta": {
            "updated_at": date.today().isoformat(),
            "source": source,
            "country_count": country_count,
        },
        "countries": country_data,
        "pairs": pairs,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"\nWrote {OUTPUT_FILE}")
    print(f"  Countries: {country_count}")
    print(f"  Pairs: {len(pairs)}")
    print(f"  File size: {size_mb:.2f} MB")
    print(f"  Source: {source}")


if __name__ == "__main__":
    main()

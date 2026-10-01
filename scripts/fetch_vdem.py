#!/usr/bin/env python3
"""Fetch or generate V-Dem (Varieties of Democracy) data.

If a V-Dem CSV file is available locally, reads and processes it.
Otherwise, generates seed data based on publicly known V-Dem scores
for ~120 countries across 2010-2023.

Output: site/server/data/vdem-data.json
"""

import csv
import json
import os
import sys
from datetime import datetime, timezone

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "site", "server", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "vdem-data.json")

# V-Dem indices we track
INDICES = [
    "v2x_polyarchy",       # Electoral Democracy
    "v2x_libdem",          # Liberal Democracy
    "v2x_partipdem",       # Participatory Democracy
    "v2x_delibdem",        # Deliberative Democracy
    "v2x_egaldem",         # Egalitarian Democracy
    "v2x_freexp_altinf",   # Freedom of Expression
    "v2x_frassoc_thick",   # Freedom of Association
    "v2x_suffr",           # Suffrage
    "v2x_elecoff",         # Elected Officials
    "v2x_rule",            # Rule of Law
    "v2x_corr",            # Corruption (higher = more corrupt)
    "v2x_civlib",          # Civil Liberties
]

YEARS = list(range(2010, 2024))

# Country name -> ISO3 mapping
COUNTRY_ISO3 = {
    "Afghanistan": "AFG", "Albania": "ALB", "Algeria": "DZA", "Angola": "AGO",
    "Argentina": "ARG", "Armenia": "ARM", "Australia": "AUS", "Austria": "AUT",
    "Azerbaijan": "AZE", "Bahrain": "BHR", "Bangladesh": "BGD", "Belarus": "BLR",
    "Belgium": "BEL", "Benin": "BEN", "Bolivia": "BOL", "Bosnia and Herzegovina": "BIH",
    "Botswana": "BWA", "Brazil": "BRA", "Bulgaria": "BGR", "Burkina Faso": "BFA",
    "Burundi": "BDI", "Cambodia": "KHM", "Cameroon": "CMR", "Canada": "CAN",
    "Chad": "TCD", "Chile": "CHL", "China": "CHN", "Colombia": "COL",
    "Costa Rica": "CRI", "Croatia": "HRV", "Cuba": "CUB", "Cyprus": "CYP",
    "Czech Republic": "CZE", "Democratic Republic of the Congo": "COD",
    "Denmark": "DNK", "Dominican Republic": "DOM", "Ecuador": "ECU",
    "Egypt": "EGY", "El Salvador": "SLV", "Eritrea": "ERI", "Estonia": "EST",
    "Ethiopia": "ETH", "Finland": "FIN", "France": "FRA", "Gabon": "GAB",
    "Georgia": "GEO", "Germany": "DEU", "Ghana": "GHA", "Greece": "GRC",
    "Guatemala": "GTM", "Guinea": "GIN", "Haiti": "HTI", "Honduras": "HND",
    "Hungary": "HUN", "India": "IND", "Indonesia": "IDN", "Iran": "IRN",
    "Iraq": "IRQ", "Ireland": "IRL", "Israel": "ISR", "Italy": "ITA",
    "Jamaica": "JAM", "Japan": "JPN", "Jordan": "JOR", "Kazakhstan": "KAZ",
    "Kenya": "KEN", "Kuwait": "KWT", "Kyrgyzstan": "KGZ", "Laos": "LAO",
    "Latvia": "LVA", "Lebanon": "LBN", "Liberia": "LBR", "Libya": "LBY",
    "Lithuania": "LTU", "Madagascar": "MDG", "Malawi": "MWI", "Malaysia": "MYS",
    "Mali": "MLI", "Mauritius": "MUS", "Mexico": "MEX", "Moldova": "MDA",
    "Mongolia": "MNG", "Morocco": "MAR", "Mozambique": "MOZ", "Myanmar": "MMR",
    "Namibia": "NAM", "Nepal": "NPL", "Netherlands": "NLD", "New Zealand": "NZL",
    "Nicaragua": "NIC", "Niger": "NER", "Nigeria": "NGA", "North Korea": "PRK",
    "North Macedonia": "MKD", "Norway": "NOR", "Oman": "OMN", "Pakistan": "PAK",
    "Panama": "PAN", "Paraguay": "PRY", "Peru": "PER", "Philippines": "PHL",
    "Poland": "POL", "Portugal": "PRT", "Qatar": "QAT", "Romania": "ROU",
    "Russia": "RUS", "Rwanda": "RWA", "Saudi Arabia": "SAU", "Senegal": "SEN",
    "Serbia": "SRB", "Sierra Leone": "SLE", "Singapore": "SGP",
    "Slovakia": "SVK", "Slovenia": "SVN", "Somalia": "SOM", "South Africa": "ZAF",
    "South Korea": "KOR", "South Sudan": "SSD", "Spain": "ESP", "Sri Lanka": "LKA",
    "Sudan": "SDN", "Sweden": "SWE", "Switzerland": "CHE", "Syria": "SYR",
    "Taiwan": "TWN", "Tajikistan": "TJK", "Tanzania": "TZA", "Thailand": "THA",
    "Togo": "TGO", "Trinidad and Tobago": "TTO", "Tunisia": "TUN", "Turkey": "TUR",
    "Turkmenistan": "TKM", "Uganda": "UGA", "Ukraine": "UKR",
    "United Arab Emirates": "ARE", "United Kingdom": "GBR", "United States": "USA",
    "Uruguay": "URY", "Uzbekistan": "UZB", "Venezuela": "VEN", "Vietnam": "VNM",
    "Yemen": "YEM", "Zambia": "ZMB", "Zimbabwe": "ZWE",
}

# Seed data: baseline 2023 scores based on publicly known V-Dem data.
# Format: (polyarchy, libdem, partipdem, delibdem, egaldem, freexp, frassoc, suffr, elecoff, rule, corr, civlib)
# Sources: V-Dem annual reports, Democracy Report 2024
SEED_2023 = {
    "DNK": (0.93, 0.91, 0.86, 0.94, 0.92, 0.96, 0.95, 1.00, 1.00, 0.97, 0.05, 0.96),
    "SWE": (0.92, 0.90, 0.85, 0.93, 0.91, 0.95, 0.94, 1.00, 1.00, 0.96, 0.06, 0.95),
    "NOR": (0.93, 0.91, 0.87, 0.94, 0.93, 0.96, 0.95, 1.00, 1.00, 0.97, 0.04, 0.96),
    "FIN": (0.92, 0.90, 0.84, 0.92, 0.91, 0.95, 0.94, 1.00, 1.00, 0.96, 0.05, 0.95),
    "CHE": (0.90, 0.89, 0.88, 0.91, 0.88, 0.94, 0.93, 1.00, 1.00, 0.95, 0.06, 0.94),
    "NZL": (0.91, 0.89, 0.82, 0.91, 0.89, 0.95, 0.93, 1.00, 1.00, 0.94, 0.06, 0.95),
    "NLD": (0.91, 0.89, 0.83, 0.91, 0.89, 0.94, 0.93, 1.00, 1.00, 0.94, 0.07, 0.94),
    "DEU": (0.90, 0.88, 0.81, 0.90, 0.88, 0.93, 0.92, 1.00, 1.00, 0.93, 0.08, 0.93),
    "IRL": (0.90, 0.88, 0.80, 0.89, 0.87, 0.93, 0.92, 1.00, 1.00, 0.92, 0.08, 0.93),
    "CAN": (0.89, 0.87, 0.79, 0.89, 0.87, 0.93, 0.91, 1.00, 1.00, 0.92, 0.09, 0.93),
    "AUS": (0.89, 0.87, 0.79, 0.88, 0.86, 0.92, 0.91, 1.00, 1.00, 0.92, 0.09, 0.92),
    "AUT": (0.89, 0.87, 0.80, 0.88, 0.87, 0.92, 0.91, 1.00, 1.00, 0.92, 0.09, 0.92),
    "BEL": (0.89, 0.87, 0.79, 0.88, 0.87, 0.92, 0.91, 1.00, 1.00, 0.91, 0.10, 0.92),
    "EST": (0.88, 0.86, 0.78, 0.87, 0.85, 0.92, 0.90, 1.00, 1.00, 0.91, 0.10, 0.92),
    "CRI": (0.88, 0.85, 0.78, 0.86, 0.83, 0.91, 0.89, 1.00, 1.00, 0.87, 0.14, 0.91),
    "URY": (0.87, 0.85, 0.77, 0.85, 0.82, 0.90, 0.88, 1.00, 1.00, 0.86, 0.15, 0.90),
    "PRT": (0.89, 0.87, 0.78, 0.87, 0.86, 0.92, 0.91, 1.00, 1.00, 0.91, 0.10, 0.92),
    "GBR": (0.86, 0.84, 0.76, 0.85, 0.82, 0.90, 0.88, 1.00, 1.00, 0.89, 0.12, 0.90),
    "FRA": (0.84, 0.82, 0.74, 0.82, 0.80, 0.88, 0.86, 1.00, 1.00, 0.87, 0.14, 0.88),
    "USA": (0.82, 0.79, 0.72, 0.80, 0.75, 0.86, 0.84, 1.00, 1.00, 0.83, 0.18, 0.86),
    "JPN": (0.84, 0.82, 0.72, 0.81, 0.79, 0.87, 0.85, 1.00, 1.00, 0.87, 0.14, 0.87),
    "KOR": (0.84, 0.82, 0.74, 0.82, 0.78, 0.87, 0.85, 1.00, 1.00, 0.85, 0.16, 0.87),
    "TWN": (0.85, 0.83, 0.76, 0.83, 0.80, 0.89, 0.87, 1.00, 1.00, 0.86, 0.13, 0.89),
    "ESP": (0.86, 0.84, 0.75, 0.84, 0.82, 0.89, 0.87, 1.00, 1.00, 0.88, 0.13, 0.89),
    "ITA": (0.84, 0.82, 0.73, 0.81, 0.79, 0.87, 0.85, 1.00, 1.00, 0.84, 0.17, 0.87),
    "GRC": (0.82, 0.80, 0.71, 0.78, 0.77, 0.84, 0.82, 1.00, 1.00, 0.81, 0.20, 0.85),
    "CZE": (0.83, 0.80, 0.73, 0.80, 0.79, 0.86, 0.84, 1.00, 1.00, 0.84, 0.17, 0.86),
    "SVN": (0.86, 0.84, 0.76, 0.84, 0.83, 0.89, 0.87, 1.00, 1.00, 0.88, 0.12, 0.89),
    "SVK": (0.80, 0.77, 0.70, 0.76, 0.76, 0.82, 0.80, 1.00, 1.00, 0.80, 0.22, 0.83),
    "LVA": (0.83, 0.80, 0.72, 0.80, 0.78, 0.86, 0.84, 1.00, 1.00, 0.83, 0.18, 0.86),
    "LTU": (0.84, 0.81, 0.73, 0.81, 0.79, 0.87, 0.85, 1.00, 1.00, 0.84, 0.17, 0.87),
    "CHL": (0.84, 0.81, 0.74, 0.81, 0.76, 0.87, 0.85, 1.00, 1.00, 0.83, 0.18, 0.87),
    "HRV": (0.78, 0.75, 0.68, 0.74, 0.74, 0.80, 0.78, 1.00, 1.00, 0.78, 0.24, 0.81),
    "CYP": (0.83, 0.80, 0.72, 0.80, 0.79, 0.86, 0.84, 1.00, 1.00, 0.84, 0.17, 0.86),
    "ROU": (0.77, 0.74, 0.67, 0.72, 0.72, 0.79, 0.77, 1.00, 1.00, 0.76, 0.26, 0.80),
    "BGR": (0.72, 0.69, 0.63, 0.67, 0.68, 0.74, 0.72, 1.00, 1.00, 0.71, 0.31, 0.76),
    "POL": (0.73, 0.70, 0.65, 0.68, 0.70, 0.74, 0.73, 1.00, 1.00, 0.72, 0.30, 0.76),
    "HUN": (0.58, 0.52, 0.48, 0.46, 0.53, 0.52, 0.50, 1.00, 1.00, 0.56, 0.42, 0.55),
    "ISR": (0.70, 0.65, 0.60, 0.62, 0.55, 0.72, 0.68, 0.94, 1.00, 0.68, 0.28, 0.68),
    "MUS": (0.78, 0.75, 0.68, 0.74, 0.73, 0.80, 0.78, 1.00, 1.00, 0.77, 0.25, 0.80),
    "JAM": (0.76, 0.73, 0.66, 0.71, 0.68, 0.80, 0.77, 1.00, 1.00, 0.71, 0.30, 0.79),
    "TTO": (0.74, 0.71, 0.64, 0.69, 0.66, 0.78, 0.75, 1.00, 1.00, 0.70, 0.31, 0.77),
    "BWA": (0.65, 0.60, 0.55, 0.58, 0.56, 0.68, 0.64, 1.00, 1.00, 0.63, 0.34, 0.67),
    "NAM": (0.66, 0.62, 0.56, 0.60, 0.58, 0.70, 0.66, 1.00, 1.00, 0.64, 0.33, 0.69),
    "GHA": (0.72, 0.68, 0.62, 0.66, 0.64, 0.76, 0.73, 1.00, 1.00, 0.69, 0.30, 0.75),
    "SEN": (0.58, 0.52, 0.48, 0.50, 0.47, 0.60, 0.56, 1.00, 1.00, 0.52, 0.42, 0.58),
    "BEN": (0.54, 0.48, 0.44, 0.46, 0.43, 0.54, 0.50, 1.00, 1.00, 0.48, 0.46, 0.54),
    "ZAF": (0.72, 0.67, 0.62, 0.66, 0.62, 0.76, 0.72, 1.00, 1.00, 0.65, 0.35, 0.74),
    "IND": (0.52, 0.42, 0.40, 0.38, 0.40, 0.40, 0.38, 1.00, 1.00, 0.45, 0.48, 0.42),
    "IDN": (0.57, 0.50, 0.48, 0.48, 0.50, 0.52, 0.50, 1.00, 1.00, 0.50, 0.45, 0.53),
    "BRA": (0.72, 0.68, 0.62, 0.66, 0.62, 0.74, 0.72, 1.00, 1.00, 0.64, 0.34, 0.73),
    "MEX": (0.60, 0.52, 0.50, 0.48, 0.46, 0.54, 0.52, 1.00, 1.00, 0.46, 0.48, 0.55),
    "COL": (0.62, 0.55, 0.52, 0.52, 0.48, 0.62, 0.58, 1.00, 1.00, 0.52, 0.42, 0.60),
    "ARG": (0.74, 0.70, 0.64, 0.68, 0.66, 0.78, 0.76, 1.00, 1.00, 0.68, 0.32, 0.77),
    "PER": (0.62, 0.56, 0.52, 0.52, 0.50, 0.66, 0.62, 1.00, 1.00, 0.52, 0.44, 0.64),
    "ECU": (0.58, 0.50, 0.48, 0.46, 0.46, 0.56, 0.52, 1.00, 1.00, 0.46, 0.48, 0.55),
    "BOL": (0.52, 0.44, 0.42, 0.40, 0.42, 0.46, 0.44, 1.00, 1.00, 0.40, 0.52, 0.47),
    "PRY": (0.54, 0.48, 0.44, 0.44, 0.42, 0.56, 0.52, 1.00, 1.00, 0.44, 0.50, 0.55),
    "PAN": (0.68, 0.63, 0.58, 0.62, 0.58, 0.72, 0.68, 1.00, 1.00, 0.62, 0.36, 0.70),
    "DOM": (0.62, 0.56, 0.52, 0.54, 0.50, 0.64, 0.60, 1.00, 1.00, 0.54, 0.42, 0.63),
    "GTM": (0.48, 0.40, 0.38, 0.36, 0.34, 0.48, 0.44, 1.00, 1.00, 0.36, 0.56, 0.47),
    "HND": (0.44, 0.36, 0.34, 0.32, 0.30, 0.42, 0.38, 1.00, 1.00, 0.32, 0.60, 0.42),
    "SLV": (0.42, 0.34, 0.32, 0.28, 0.28, 0.36, 0.32, 1.00, 1.00, 0.28, 0.60, 0.38),
    "NIC": (0.18, 0.12, 0.10, 0.08, 0.08, 0.14, 0.12, 0.72, 0.60, 0.12, 0.76, 0.15),
    "VEN": (0.22, 0.14, 0.12, 0.10, 0.12, 0.18, 0.16, 0.82, 0.60, 0.12, 0.78, 0.20),
    "CUB": (0.12, 0.06, 0.10, 0.06, 0.10, 0.08, 0.06, 0.90, 0.30, 0.14, 0.70, 0.12),
    "HTI": (0.26, 0.18, 0.16, 0.14, 0.14, 0.28, 0.24, 0.80, 0.40, 0.12, 0.72, 0.26),
    "TUR": (0.32, 0.22, 0.20, 0.18, 0.20, 0.22, 0.20, 1.00, 1.00, 0.24, 0.62, 0.24),
    "RUS": (0.22, 0.12, 0.10, 0.08, 0.10, 0.12, 0.10, 1.00, 0.60, 0.16, 0.72, 0.14),
    "CHN": (0.10, 0.04, 0.08, 0.04, 0.08, 0.06, 0.04, 0.82, 0.20, 0.18, 0.64, 0.08),
    "IRN": (0.22, 0.10, 0.12, 0.08, 0.10, 0.12, 0.10, 0.86, 0.50, 0.14, 0.68, 0.12),
    "EGY": (0.20, 0.10, 0.08, 0.06, 0.08, 0.12, 0.10, 1.00, 0.80, 0.16, 0.66, 0.12),
    "SAU": (0.08, 0.04, 0.04, 0.04, 0.06, 0.06, 0.04, 0.00, 0.20, 0.22, 0.52, 0.08),
    "ARE": (0.10, 0.06, 0.06, 0.06, 0.08, 0.10, 0.08, 0.00, 0.20, 0.30, 0.40, 0.14),
    "QAT": (0.10, 0.06, 0.06, 0.06, 0.08, 0.12, 0.08, 0.24, 0.20, 0.32, 0.38, 0.16),
    "KWT": (0.28, 0.20, 0.18, 0.16, 0.18, 0.32, 0.28, 0.56, 0.60, 0.36, 0.40, 0.32),
    "BHR": (0.12, 0.06, 0.06, 0.04, 0.06, 0.10, 0.08, 0.52, 0.40, 0.18, 0.56, 0.12),
    "OMN": (0.10, 0.06, 0.06, 0.06, 0.06, 0.12, 0.08, 0.30, 0.20, 0.28, 0.44, 0.14),
    "JOR": (0.28, 0.18, 0.16, 0.14, 0.16, 0.26, 0.22, 0.72, 0.60, 0.30, 0.44, 0.26),
    "LBN": (0.38, 0.28, 0.24, 0.22, 0.22, 0.42, 0.38, 0.88, 0.80, 0.22, 0.62, 0.38),
    "IRQ": (0.34, 0.22, 0.18, 0.16, 0.18, 0.30, 0.26, 0.90, 0.80, 0.16, 0.68, 0.28),
    "SYR": (0.06, 0.02, 0.02, 0.02, 0.02, 0.04, 0.02, 0.60, 0.20, 0.04, 0.82, 0.04),
    "YEM": (0.08, 0.04, 0.04, 0.04, 0.04, 0.08, 0.06, 0.48, 0.20, 0.06, 0.80, 0.08),
    "PAK": (0.38, 0.26, 0.24, 0.22, 0.22, 0.34, 0.30, 1.00, 0.80, 0.24, 0.58, 0.32),
    "BGD": (0.32, 0.20, 0.18, 0.16, 0.18, 0.24, 0.22, 1.00, 0.80, 0.18, 0.64, 0.22),
    "LKA": (0.52, 0.44, 0.40, 0.38, 0.38, 0.50, 0.46, 1.00, 1.00, 0.42, 0.48, 0.48),
    "NPL": (0.48, 0.38, 0.36, 0.34, 0.34, 0.48, 0.44, 1.00, 1.00, 0.36, 0.52, 0.46),
    "MYS": (0.52, 0.42, 0.38, 0.38, 0.40, 0.46, 0.42, 1.00, 1.00, 0.48, 0.44, 0.46),
    "SGP": (0.46, 0.38, 0.28, 0.32, 0.40, 0.36, 0.30, 1.00, 1.00, 0.68, 0.14, 0.38),
    "PHL": (0.50, 0.40, 0.38, 0.36, 0.36, 0.46, 0.42, 1.00, 1.00, 0.38, 0.52, 0.44),
    "THA": (0.32, 0.22, 0.20, 0.18, 0.22, 0.26, 0.22, 1.00, 0.80, 0.30, 0.50, 0.26),
    "VNM": (0.10, 0.04, 0.08, 0.04, 0.08, 0.06, 0.04, 0.82, 0.20, 0.18, 0.62, 0.10),
    "KHM": (0.14, 0.06, 0.08, 0.04, 0.06, 0.10, 0.08, 0.82, 0.40, 0.12, 0.70, 0.10),
    "MMR": (0.08, 0.04, 0.04, 0.02, 0.04, 0.06, 0.04, 0.56, 0.20, 0.06, 0.76, 0.06),
    "LAO": (0.08, 0.04, 0.06, 0.04, 0.06, 0.06, 0.04, 0.80, 0.20, 0.14, 0.66, 0.08),
    "MNG": (0.68, 0.62, 0.58, 0.60, 0.58, 0.72, 0.68, 1.00, 1.00, 0.60, 0.38, 0.70),
    "KAZ": (0.14, 0.08, 0.08, 0.06, 0.08, 0.12, 0.10, 0.88, 0.60, 0.20, 0.60, 0.14),
    "UZB": (0.10, 0.06, 0.06, 0.04, 0.06, 0.08, 0.06, 0.82, 0.40, 0.16, 0.64, 0.10),
    "KGZ": (0.34, 0.24, 0.22, 0.20, 0.22, 0.32, 0.28, 0.94, 0.80, 0.24, 0.56, 0.30),
    "TJK": (0.10, 0.06, 0.06, 0.04, 0.06, 0.08, 0.06, 0.86, 0.40, 0.12, 0.68, 0.10),
    "TKM": (0.04, 0.02, 0.02, 0.02, 0.02, 0.04, 0.02, 0.76, 0.20, 0.10, 0.74, 0.04),
    "GEO": (0.52, 0.44, 0.40, 0.38, 0.40, 0.50, 0.46, 1.00, 1.00, 0.46, 0.44, 0.50),
    "ARM": (0.54, 0.46, 0.42, 0.42, 0.42, 0.54, 0.50, 1.00, 1.00, 0.48, 0.42, 0.54),
    "AZE": (0.10, 0.06, 0.06, 0.04, 0.06, 0.08, 0.06, 0.86, 0.40, 0.14, 0.68, 0.10),
    "UKR": (0.56, 0.48, 0.44, 0.42, 0.44, 0.52, 0.48, 1.00, 1.00, 0.42, 0.50, 0.50),
    "BLR": (0.10, 0.06, 0.06, 0.04, 0.06, 0.08, 0.06, 0.86, 0.40, 0.14, 0.68, 0.08),
    "MDA": (0.58, 0.52, 0.48, 0.48, 0.48, 0.60, 0.56, 1.00, 1.00, 0.50, 0.44, 0.58),
    "SRB": (0.48, 0.40, 0.36, 0.34, 0.36, 0.44, 0.40, 1.00, 1.00, 0.40, 0.50, 0.44),
    "BIH": (0.42, 0.34, 0.30, 0.28, 0.30, 0.42, 0.38, 1.00, 1.00, 0.34, 0.54, 0.42),
    "MKD": (0.58, 0.52, 0.48, 0.48, 0.50, 0.60, 0.56, 1.00, 1.00, 0.52, 0.42, 0.60),
    "ALB": (0.52, 0.44, 0.40, 0.38, 0.40, 0.52, 0.48, 1.00, 1.00, 0.42, 0.50, 0.50),
    "NGA": (0.42, 0.32, 0.30, 0.28, 0.26, 0.40, 0.36, 0.92, 0.80, 0.26, 0.60, 0.38),
    "KEN": (0.55, 0.46, 0.42, 0.42, 0.40, 0.56, 0.52, 1.00, 1.00, 0.42, 0.50, 0.54),
    "ETH": (0.28, 0.18, 0.16, 0.14, 0.14, 0.22, 0.18, 0.88, 0.60, 0.16, 0.64, 0.20),
    "TZA": (0.40, 0.30, 0.28, 0.26, 0.28, 0.36, 0.32, 1.00, 0.80, 0.32, 0.52, 0.34),
    "UGA": (0.30, 0.20, 0.18, 0.16, 0.16, 0.26, 0.22, 0.92, 0.80, 0.20, 0.62, 0.24),
    "RWA": (0.18, 0.10, 0.10, 0.08, 0.12, 0.12, 0.10, 0.92, 0.60, 0.28, 0.42, 0.14),
    "MOZ": (0.34, 0.24, 0.22, 0.20, 0.20, 0.32, 0.28, 0.96, 0.80, 0.22, 0.58, 0.30),
    "ZMB": (0.50, 0.42, 0.38, 0.38, 0.36, 0.52, 0.48, 1.00, 1.00, 0.40, 0.50, 0.50),
    "ZWE": (0.24, 0.16, 0.14, 0.12, 0.12, 0.22, 0.18, 0.90, 0.60, 0.14, 0.68, 0.20),
    "MWI": (0.52, 0.44, 0.40, 0.38, 0.38, 0.54, 0.50, 1.00, 1.00, 0.40, 0.50, 0.52),
    "MDG": (0.42, 0.34, 0.30, 0.28, 0.28, 0.44, 0.40, 0.92, 0.80, 0.30, 0.54, 0.42),
    "CMR": (0.20, 0.12, 0.10, 0.08, 0.10, 0.18, 0.14, 0.86, 0.60, 0.14, 0.66, 0.18),
    "TCD": (0.14, 0.08, 0.06, 0.04, 0.06, 0.12, 0.08, 0.80, 0.40, 0.08, 0.74, 0.12),
    "GAB": (0.18, 0.10, 0.08, 0.08, 0.08, 0.16, 0.12, 0.84, 0.60, 0.16, 0.62, 0.16),
    "COD": (0.22, 0.14, 0.12, 0.10, 0.10, 0.22, 0.18, 0.86, 0.60, 0.10, 0.72, 0.20),
    "AGO": (0.18, 0.10, 0.08, 0.08, 0.08, 0.16, 0.12, 0.86, 0.60, 0.14, 0.66, 0.16),
    "SOM": (0.14, 0.08, 0.06, 0.06, 0.06, 0.18, 0.14, 0.48, 0.40, 0.06, 0.78, 0.16),
    "SDN": (0.08, 0.04, 0.04, 0.02, 0.04, 0.08, 0.06, 0.60, 0.20, 0.06, 0.80, 0.08),
    "SSD": (0.08, 0.04, 0.04, 0.02, 0.02, 0.10, 0.06, 0.52, 0.20, 0.04, 0.82, 0.08),
    "LBR": (0.58, 0.50, 0.46, 0.44, 0.42, 0.60, 0.56, 1.00, 1.00, 0.42, 0.50, 0.58),
    "SLE": (0.52, 0.44, 0.40, 0.38, 0.36, 0.52, 0.48, 1.00, 1.00, 0.38, 0.52, 0.50),
    "GIN": (0.28, 0.18, 0.16, 0.14, 0.14, 0.26, 0.22, 0.86, 0.60, 0.16, 0.62, 0.24),
    "MLI": (0.18, 0.12, 0.10, 0.08, 0.10, 0.18, 0.14, 0.80, 0.40, 0.12, 0.66, 0.18),
    "BFA": (0.14, 0.08, 0.08, 0.06, 0.08, 0.14, 0.10, 0.76, 0.40, 0.10, 0.68, 0.14),
    "NER": (0.18, 0.12, 0.10, 0.08, 0.08, 0.18, 0.14, 0.82, 0.40, 0.12, 0.64, 0.18),
    "TGO": (0.26, 0.18, 0.16, 0.14, 0.14, 0.24, 0.20, 0.84, 0.60, 0.18, 0.58, 0.24),
    "BDI": (0.14, 0.08, 0.06, 0.06, 0.06, 0.12, 0.08, 0.80, 0.40, 0.08, 0.72, 0.12),
    "ERI": (0.04, 0.02, 0.02, 0.02, 0.02, 0.04, 0.02, 0.64, 0.20, 0.06, 0.78, 0.04),
    "TUN": (0.38, 0.28, 0.24, 0.22, 0.24, 0.36, 0.32, 1.00, 0.80, 0.30, 0.48, 0.34),
    "MAR": (0.30, 0.20, 0.18, 0.16, 0.18, 0.30, 0.26, 0.88, 0.60, 0.32, 0.44, 0.30),
    "DZA": (0.18, 0.10, 0.08, 0.06, 0.08, 0.14, 0.10, 0.88, 0.60, 0.16, 0.62, 0.14),
    "LBY": (0.12, 0.06, 0.06, 0.04, 0.04, 0.14, 0.10, 0.52, 0.20, 0.06, 0.76, 0.12),
    "AFG": (0.10, 0.04, 0.04, 0.02, 0.02, 0.06, 0.04, 0.40, 0.20, 0.06, 0.78, 0.06),
    "PRK": (0.04, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.70, 0.10, 0.10, 0.72, 0.02),
}

# Trend modifiers: how scores changed 2010->2023. Positive means improvement.
# These capture known democratic backsliding/advancement patterns.
TREND_PROFILES = {
    # Stable high democracies: minimal change
    "stable_high": {"drift": 0.0, "noise": 0.005},
    # Improving: democratic opening or consolidation
    "improving": {"drift": 0.015, "noise": 0.008},
    # Backsliding: democratic erosion
    "backsliding": {"drift": -0.015, "noise": 0.008},
    # Sharp decline
    "sharp_decline": {"drift": -0.03, "noise": 0.01},
    # Unstable: volatile
    "unstable": {"drift": 0.0, "noise": 0.02},
    # Stable low: consistently authoritarian
    "stable_low": {"drift": 0.0, "noise": 0.004},
}

# Assign trend profiles to countries
COUNTRY_TRENDS = {
    # Stable high democracies
    "DNK": "stable_high", "SWE": "stable_high", "NOR": "stable_high", "FIN": "stable_high",
    "CHE": "stable_high", "NZL": "stable_high", "NLD": "stable_high", "DEU": "stable_high",
    "IRL": "stable_high", "CAN": "stable_high", "AUS": "stable_high", "AUT": "stable_high",
    "BEL": "stable_high", "EST": "stable_high", "CRI": "stable_high", "URY": "stable_high",
    "PRT": "stable_high", "JPN": "stable_high", "ESP": "stable_high", "ITA": "stable_high",
    "SVN": "stable_high", "CYP": "stable_high", "LVA": "stable_high", "LTU": "stable_high",
    "CHL": "stable_high", "MUS": "stable_high", "JAM": "stable_high", "TTO": "stable_high",
    # Backsliding democracies
    "USA": "backsliding", "GBR": "backsliding", "FRA": "backsliding",
    "HUN": "sharp_decline", "POL": "backsliding", "TUR": "sharp_decline",
    "IND": "sharp_decline", "BRA": "backsliding", "ISR": "backsliding",
    "SLV": "sharp_decline", "NIC": "sharp_decline", "TUN": "sharp_decline",
    "SEN": "backsliding", "BEN": "backsliding", "BGD": "backsliding",
    "IDN": "backsliding", "MEX": "backsliding", "PHL": "backsliding",
    "SRB": "backsliding", "BIH": "backsliding", "GRC": "backsliding",
    # Improving
    "KOR": "improving", "TWN": "improving", "MDA": "improving",
    "ARM": "improving", "ZMB": "improving", "MWI": "improving",
    "GEO": "improving", "ECU": "unstable", "MKD": "improving",
    "LBR": "improving", "SLE": "improving", "MNG": "improving",
    # Unstable
    "UKR": "unstable", "ETH": "unstable", "IRQ": "unstable",
    "LBN": "unstable", "COL": "unstable", "PER": "unstable",
    "HTI": "unstable", "BOL": "unstable", "PRY": "unstable",
    "KGZ": "unstable", "NPL": "unstable", "LKA": "unstable",
    "GTM": "unstable", "HND": "unstable", "KEN": "unstable",
    "NGA": "unstable", "TZA": "unstable", "MDG": "unstable",
    "MOZ": "unstable", "PAK": "unstable", "THA": "unstable",
    "MYS": "unstable",
    # Stable low / authoritarian
    "CHN": "stable_low", "RUS": "backsliding", "IRN": "stable_low",
    "SAU": "stable_low", "ARE": "stable_low", "QAT": "stable_low",
    "KWT": "stable_low", "BHR": "stable_low", "OMN": "stable_low",
    "EGY": "stable_low", "SYR": "stable_low", "YEM": "stable_low",
    "VEN": "sharp_decline", "CUB": "stable_low", "BLR": "sharp_decline",
    "AZE": "stable_low", "KAZ": "stable_low", "UZB": "stable_low",
    "TJK": "stable_low", "TKM": "stable_low", "VNM": "stable_low",
    "KHM": "sharp_decline", "MMR": "sharp_decline", "LAO": "stable_low",
    "PRK": "stable_low", "AFG": "sharp_decline", "ERI": "stable_low",
    "SDN": "stable_low", "SSD": "stable_low", "SOM": "stable_low",
    "CMR": "stable_low", "TCD": "stable_low", "GAB": "stable_low",
    "COD": "stable_low", "AGO": "stable_low", "LBY": "unstable",
    "DZA": "stable_low", "MAR": "stable_low", "JOR": "stable_low",
    "RWA": "stable_low", "UGA": "stable_low", "ZWE": "stable_low",
    "BDI": "stable_low", "GIN": "unstable", "MLI": "sharp_decline",
    "BFA": "sharp_decline", "NER": "sharp_decline", "TGO": "stable_low",
    "SGP": "stable_low", "BWA": "stable_low", "NAM": "stable_low",
    "GHA": "backsliding", "ZAF": "backsliding", "DOM": "stable_high",
    "PAN": "stable_high", "ARG": "stable_high", "SVK": "backsliding",
    "BGR": "backsliding", "ROU": "backsliding",
    "HRV": "stable_high",
    "CZE": "stable_high", "ALB": "improving",
}


def clamp(val, lo=0.0, hi=1.0):
    return max(lo, min(hi, val))


def generate_seed_data():
    """Generate realistic V-Dem data for ~120 countries, 2010-2023."""
    import random
    random.seed(42)  # Reproducible

    countries = {}
    for iso3, scores_2023 in SEED_2023.items():
        profile_name = COUNTRY_TRENDS.get(iso3, "stable_low")
        profile = TREND_PROFILES[profile_name]
        drift_per_year = profile["drift"]
        noise = profile["noise"]

        trend = []
        for year in YEARS:
            years_from_2023 = year - 2023  # Negative for past years
            year_scores = {}
            for i, idx_name in enumerate(INDICES):
                base = scores_2023[i]
                # Project backwards from 2023: reverse the drift direction
                offset = -drift_per_year * years_from_2023
                # Corruption index: backsliding means corruption increases
                if idx_name == "v2x_corr":
                    offset = drift_per_year * years_from_2023
                # Suffrage and elected officials are more stable
                if idx_name in ("v2x_suffr", "v2x_elecoff"):
                    offset *= 0.3
                    year_noise = random.gauss(0, noise * 0.2)
                else:
                    year_noise = random.gauss(0, noise)
                val = clamp(base + offset + year_noise)
                year_scores[idx_name] = round(val, 3)
            trend.append({"year": year, **year_scores})

        latest = trend[-1].copy()  # 2023
        countries[iso3] = {
            "latest": latest,
            "trend": trend,
        }

    return countries


def try_read_csv(csv_path):
    """Attempt to read an actual V-Dem CSV and extract relevant data."""
    if not os.path.exists(csv_path):
        return None

    print(f"Reading V-Dem CSV from {csv_path}...")
    countries = {}

    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                year = int(row.get("year", 0))
                if year < 2010 or year > 2023:
                    continue

                country_name = row.get("country_name", "")
                iso3 = row.get("country_text_id", "")

                if not iso3 or len(iso3) != 3:
                    # Try mapping from name
                    iso3 = COUNTRY_ISO3.get(country_name, "")
                if not iso3:
                    continue

                iso3 = iso3.upper()
                if iso3 not in countries:
                    countries[iso3] = {"trend": []}

                year_data = {"year": year}
                for idx in INDICES:
                    val = row.get(idx, "")
                    if val:
                        try:
                            year_data[idx] = round(float(val), 3)
                        except ValueError:
                            pass

                # Only add if we got at least some indices
                if len(year_data) > 1:
                    countries[iso3]["trend"].append(year_data)

        # Sort trends and pick latest
        for iso3, data in countries.items():
            data["trend"].sort(key=lambda x: x["year"])
            if data["trend"]:
                data["latest"] = data["trend"][-1].copy()

        print(f"Read data for {len(countries)} countries from CSV.")
        return countries if len(countries) > 10 else None

    except Exception as e:
        print(f"Error reading CSV: {e}")
        return None


# Our World in Data republishes the official V-Dem country-year estimates.
# Chart slug -> V-Dem index. v2x_suffr and v2x_elecoff are not published by OWID.
OWID_CHARTS = {
    "v2x_polyarchy": "electoral-democracy-index",
    "v2x_libdem": "liberal-democracy-index",
    "v2x_partipdem": "participatory-democracy-index",
    "v2x_delibdem": "deliberative-democracy-index-vdem",
    "v2x_egaldem": "egalitarian-democracy-index-vdem",
    "v2x_freexp_altinf": "freedom-of-expression-index",
    "v2x_frassoc_thick": "freedom-of-association-index",
    "v2x_rule": "rule-of-law-index",
    "v2x_corr": "political-corruption-index",
    "v2x_civlib": "human-rights-index-vdem",
}
OWID_FIRST_YEAR = 2010


def fetch_owid():
    """Download real V-Dem indices via Our World in Data. Returns (countries, last_year)."""
    import io
    from urllib.request import Request, urlopen
    values = {}  # iso3 -> year -> {index: value}
    for idx, slug in OWID_CHARTS.items():
        url = f"https://ourworldindata.org/grapher/{slug}.csv?v=1&csvType=full&useColumnShortNames=true"
        req = Request(url, headers={"User-Agent": "Mozilla/5.0 worldcountrygroups"})
        with urlopen(req, timeout=120) as r:
            rows = list(csv.reader(io.StringIO(r.read().decode("utf-8"))))
        print(f"  {idx}: {len(rows) - 1} rows")
        for row in rows[1:]:
            _, code, year, val = row[0], row[1], row[2], row[3]
            if not code or code.startswith("OWID") or len(code) != 3 or val == "":
                continue
            year = int(year)
            if year < OWID_FIRST_YEAR:
                continue
            values.setdefault(code, {}).setdefault(year, {})[idx] = round(float(val), 3)

    countries, last_year = {}, 0
    for iso3, by_year in values.items():
        trend = []
        for year in sorted(by_year):
            scores = by_year[year]
            if "v2x_polyarchy" not in scores:
                continue
            trend.append({"year": year, **{i: scores.get(i) for i in INDICES}})
        if trend:
            countries[iso3] = {"latest": dict(trend[-1]), "trend": trend}
            last_year = max(last_year, trend[-1]["year"])
    return countries, last_year


def main():
    # Try to find a V-Dem CSV file
    csv_paths = [
        os.path.join(os.path.dirname(__file__), "V-Dem-CY-Full+Others-v14.csv"),
        os.path.join(os.path.dirname(__file__), "vdem.csv"),
        os.path.join(os.path.dirname(__file__), "V-Dem-CY-Core-v14.csv"),
        os.path.expanduser("~/Downloads/V-Dem-CY-Full+Others-v14.csv"),
    ]

    countries = None
    source, years = "V-Dem v14", "2010-2023"
    if "--seed" not in sys.argv:
        try:
            print("Fetching V-Dem indices from Our World in Data...")
            countries, last_year = fetch_owid()
            source = "V-Dem v16 via Our World in Data (v2x_suffr and v2x_elecoff not available)"
            years = f"{OWID_FIRST_YEAR}-{last_year}"
        except Exception as e:
            print(f"OWID fetch failed: {e}")
            countries = None
    for path in ([] if countries else csv_paths):
        countries = try_read_csv(path)
        if countries:
            print(f"Using real V-Dem data from: {path}")
            break

    if not countries and "--seed" not in sys.argv:
        sys.exit("No real V-Dem data available. Re-run with --seed to write synthetic placeholder data.")
    if not countries:
        print("Generating SYNTHETIC seed data (not real V-Dem scores)...")
        source = "SYNTHETIC placeholder data (not real V-Dem scores)"
        countries = generate_seed_data()
        print(f"Generated seed data for {len(countries)} countries.")

    output = {
        "_meta": {
            "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": source,
            "description": "Varieties of Democracy indices",
            "years": years,
            "country_count": len(countries),
            "indices": {
                "v2x_polyarchy": "Electoral Democracy Index",
                "v2x_libdem": "Liberal Democracy Index",
                "v2x_partipdem": "Participatory Democracy Index",
                "v2x_delibdem": "Deliberative Democracy Index",
                "v2x_egaldem": "Egalitarian Democracy Index",
                "v2x_freexp_altinf": "Freedom of Expression and Alternative Sources of Information",
                "v2x_frassoc_thick": "Freedom of Association (thick)",
                "v2x_suffr": "Share of Population with Suffrage",
                "v2x_elecoff": "Elected Officials Index",
                "v2x_rule": "Rule of Law Index",
                "v2x_corr": "Political Corruption Index (higher = more corrupt)",
                "v2x_civlib": "Civil Liberties Index",
            },
        },
        "countries": countries,
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Wrote {OUTPUT_FILE} ({len(countries)} countries, {os.path.getsize(OUTPUT_FILE)} bytes)")


if __name__ == "__main__":
    main()

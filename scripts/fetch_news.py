#!/usr/bin/env python3
"""Fetch diplomatic news from configurable sources.

Reads source list from site/server/data/news-config.json.
Supports RSS, Atom, GDELT JSON API, and the state.gov sitemap scraper.
Tags articles with country ISO3 codes.

Output: site/server/data/news-feed.json
"""

import gzip
import hashlib
import json
import os
import re
import time
import sys
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.request import urlopen, Request
import urllib.parse
from xml.etree import ElementTree

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "site", "server", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "news-feed.json")
STATS_FILE = os.path.join(DATA_DIR, "country-stats.json")
CONFIG_FILE = os.path.join(DATA_DIR, "news-config.json")

MAX_ARTICLES = 1600
REQUEST_TIMEOUT = 30

# Manual aliases for country name matching
ALIASES = {
    "US": "USA", "U.S.": "USA", "America": "USA", "United States of America": "USA",
    "UK": "GBR", "U.K.": "GBR", "Britain": "GBR", "Great Britain": "GBR",
    "Russia": "RUS", "Russian Federation": "RUS",
    "China": "CHN", "People's Republic of China": "CHN", "PRC": "CHN",
    "Iran": "IRN", "Islamic Republic of Iran": "IRN",
    "Syria": "SYR", "Syrian Arab Republic": "SYR",
    "North Korea": "PRK", "DPRK": "PRK",
    "South Korea": "KOR", "Republic of Korea": "KOR",
    "Taiwan": "TWN",
    "Venezuela": "VEN", "Bolivarian Republic of Venezuela": "VEN",
    "Bolivia": "BOL", "Plurinational State of Bolivia": "BOL",
    "Tanzania": "TZA", "United Republic of Tanzania": "TZA",
    "Congo": "COD", "DRC": "COD", "DR Congo": "COD",
    "Ivory Coast": "CIV", "Cote d'Ivoire": "CIV",
    "Myanmar": "MMR", "Burma": "MMR",
    "Palestine": "PSE", "Palestinian": "PSE", "Gaza": "PSE", "West Bank": "PSE",
    "Israel": "ISR", "Israeli": "ISR",
    "Ukraine": "UKR", "Ukrainian": "UKR",
    "Yemen": "YEM", "Yemeni": "YEM",
    "Libya": "LBY", "Libyan": "LBY",
    "Somalia": "SOM", "Somali": "SOM",
    "Sudan": "SDN", "Sudanese": "SDN",
    "South Sudan": "SSD",
    "Ethiopia": "ETH", "Ethiopian": "ETH",
    "Afghanistan": "AFG", "Afghan": "AFG",
    "Iraq": "IRQ", "Iraqi": "IRQ",
    "Lebanon": "LBN", "Lebanese": "LBN",
    "Saudi Arabia": "SAU", "Saudi": "SAU",
    "UAE": "ARE", "Emirati": "ARE",
    "Turkey": "TUR", "Türkiye": "TUR", "Turkish": "TUR",
    "Egypt": "EGY", "Egyptian": "EGY",
    "Morocco": "MAR", "Moroccan": "MAR",
    "Algeria": "DZA", "Algerian": "DZA",
    "Tunisia": "TUN", "Tunisian": "TUN",
    "Pakistan": "PAK", "Pakistani": "PAK",
    "India": "IND", "Indian": "IND",
    "Japan": "JPN", "Japanese": "JPN",
    "Germany": "DEU", "German": "DEU",
    "France": "FRA", "French": "FRA",
    "Brazil": "BRA", "Brazilian": "BRA",
    "Mexico": "MEX", "Mexican": "MEX",
    "Nigeria": "NGA", "Nigerian": "NGA",
    "Kenya": "KEN", "Kenyan": "KEN",
    "South Africa": "ZAF",
    "Colombia": "COL", "Colombian": "COL",
    "Mali": "MLI", "Malian": "MLI",
    "Niger": "NER", "Nigerien": "NER",
    "Burkina Faso": "BFA",
    "Cameroon": "CMR", "Cameroonian": "CMR",
    "Chad": "TCD", "Chadian": "TCD",
    "Mozambique": "MOZ", "Mozambican": "MOZ",
    "Haiti": "HTI", "Haitian": "HTI",
    "Cuba": "CUB", "Cuban": "CUB",
}

# Common names the World Bank list writes differently (added to ALIASES)
ALIASES.update({
    "Kyrgyzstan": "KGZ", "Hong Kong": "HKG", "Laos": "LAO", "Lao PDR": "LAO", "Czechia": "CZE", "Czech Republic": "CZE",
    "Slovakia": "SVK", "Slovak Republic": "SVK", "Gambia": "GMB", "Bahamas": "BHS", "Micronesia": "FSM",
    "Saint Kitts and Nevis": "KNA", "St Kitts": "KNA", "Saint Vincent and the Grenadines": "VCT", "Saint Lucia": "LCA",
    "Brunei": "BRN", "Cape Verde": "CPV", "Cabo Verde": "CPV", "Eswatini": "SWZ", "Swaziland": "SWZ",
    "Timor-Leste": "TLS", "East Timor": "TLS", "North Macedonia": "MKD", "Moldova": "MDA", "Yemen": "YEM",
    "Vietnam": "VNM", "Viet Nam": "VNM", "Trinidad and Tobago": "TTO", "Sao Tome": "STP", "São Tomé": "STP",
    "Republic of Congo": "COG", "Congo-Brazzaville": "COG", "Micronesian": "FSM", "Palestine": "PSE",
})

SHORT_NAMES = {"US", "UK", "UAE", "DRC", "PRC", "DPRK", "U.S.", "U.K."}


# ---------------------------------------------------------------------------
# Phase 1 metadata: UN bodies, source tier/type, country flags
# ---------------------------------------------------------------------------

# Each entry: (regex, body_tag). Patterns must require word boundaries for
# acronyms so we don't false-match "ICJ" inside a longer word.
UN_BODY_PATTERNS = [
    (re.compile(r"\b(Security Council|UNSC)\b", re.IGNORECASE),         "UNSC"),
    (re.compile(r"\b(General Assembly|UNGA)\b", re.IGNORECASE),         "UNGA"),
    (re.compile(r"\bHuman Rights Council\b|\bHRC\b"),                    "HRC"),
    (re.compile(r"\bECOSOC\b|\bEconomic and Social Council\b", re.IGNORECASE), "ECOSOC"),
    (re.compile(r"\bInternational Court of Justice\b|\bICJ\b"),          "ICJ"),
    (re.compile(r"\bInternational Criminal Court\b|\bICC\b"),            "ICC"),
    (re.compile(r"\bSecretary[- ]General\b|\bSecretariat\b|\bGuterres\b", re.IGNORECASE), "SG"),
    (re.compile(r"\bUNHCR\b|\bUN Refugee Agency\b", re.IGNORECASE),      "UNHCR"),
    (re.compile(r"\bUNICEF\b", re.IGNORECASE),                           "UNICEF"),
    (re.compile(r"\bUNRWA\b", re.IGNORECASE),                            "UNRWA"),
    (re.compile(r"\bOCHA\b|\bHumanitarian Affairs\b", re.IGNORECASE),    "OCHA"),
    (re.compile(r"\bWHO\b|\bWorld Health Organization\b"),                "WHO"),
    (re.compile(r"\bWFP\b|\bWorld Food Programme\b", re.IGNORECASE),     "WFP"),
    (re.compile(r"\bFAO\b|\bFood and Agriculture Organization\b", re.IGNORECASE), "FAO"),
    (re.compile(r"\bUNDP\b|\bUN Development Programme\b", re.IGNORECASE),"UNDP"),
    (re.compile(r"\bUNESCO\b", re.IGNORECASE),                           "UNESCO"),
    (re.compile(r"\bIAEA\b|\bInternational Atomic Energy Agency\b", re.IGNORECASE), "IAEA"),
    (re.compile(r"\bILO\b|\bInternational Labour Organization\b", re.IGNORECASE), "ILO"),
    (re.compile(r"\bOHCHR\b|\bHigh Commissioner for Human Rights\b", re.IGNORECASE), "OHCHR"),
    (re.compile(r"\bIOM\b|\bInternational Organization for Migration\b", re.IGNORECASE), "IOM"),
    (re.compile(r"\bUNCTAD\b", re.IGNORECASE),                           "UNCTAD"),
    (re.compile(r"\bDPPA\b|\bPolitical and Peacebuilding Affairs\b", re.IGNORECASE), "DPPA"),
    (re.compile(r"\bUN Peacekeep|\bpeacekeeping\b|\bMINUSMA\b|\bMONUSCO\b|\bUNIFIL\b|\bUNAMA\b|\bUNAMI\b", re.IGNORECASE), "PEACEKEEPING"),
    (re.compile(r"\bWTO\b|\bWorld Trade Organization\b", re.IGNORECASE), "WTO"),
    (re.compile(r"\bIMF\b|\bInternational Monetary Fund\b", re.IGNORECASE), "IMF"),
    (re.compile(r"\bWorld Bank\b|\bIBRD\b"),                              "WORLD_BANK"),
    # Reform / governance / budget / development buckets — added per UN-staff request
    (re.compile(r"\bUN ?80\b|\bPact for the Future\b|\bSummit of the Future\b|\bUN reform\b", re.IGNORECASE), "UN80_REFORM"),
    (re.compile(r"\bFifth Committee\b|\bACABQ\b|\bregular budget\b|\bscale of assessments\b|\bpeacekeeping budget\b|\bprogramme budget\b", re.IGNORECASE), "FIFTH_COMMITTEE"),
    (re.compile(r"\b(Sustainable Development Goals?|SDGs?|HLPF|High[- ]Level Political Forum)\b"), "SDGS"),
    (re.compile(r"\bFinancing for Development\b|\bFfD\b|\bMonterrey Consensus\b|\bAddis Ababa Action Agenda\b"), "FFD"),
]


def extract_un_body_tags(text):
    if not text:
        return []
    tags = []
    for pat, name in UN_BODY_PATTERNS:
        if pat.search(text):
            tags.append(name)
    return tags


# Per-source tier (1=most authoritative) and semantic type.
# tier:  1 official-UN/IO, 2 government/MFA, 3 specialist analysis, 4 wire, 5 aggregator
# type:  official | mfa | think-tank | specialist-media | wire | aggregator | regional-news | regional-org
TIER_TYPE_MAP = {
    "un-news":             {"tier": 1, "type": "official"},
    "un-sdg":              {"tier": 1, "type": "official"},
    "passblue":            {"tier": 3, "type": "specialist-media"},
    "gdelt":               {"tier": 5, "type": "aggregator"},
    "uk-fcdo":             {"tier": 2, "type": "mfa"},
    "al-jazeera":          {"tier": 4, "type": "wire"},
    "the-diplomat":        {"tier": 3, "type": "specialist-media"},
    "crisis-group":        {"tier": 3, "type": "think-tank"},
    "global-voices":       {"tier": 4, "type": "wire"},
    "africanews":          {"tier": 4, "type": "regional-news"},
    "islands-business":    {"tier": 4, "type": "regional-news"},
    "adb-news":            {"tier": 1, "type": "official"},
    "france24":            {"tier": 4, "type": "wire"},
    "dw-news":             {"tier": 4, "type": "wire"},
    "google-news-diplomacy":{"tier": 5, "type": "aggregator"},
    "us-state-dept":       {"tier": 2, "type": "official"},
    "tass":                {"tier": 2, "type": "official"},
    "ecfr":                {"tier": 3, "type": "think-tank"},
    "atlantic-council":    {"tier": 3, "type": "think-tank"},
    "foreign-policy":      {"tier": 3, "type": "specialist-media"},
    "mercopress":          {"tier": 4, "type": "regional-news"},
    "the-new-humanitarian":{"tier": 3, "type": "specialist-media"},
    "reuters-un":          {"tier": 4, "type": "wire"},
    "ap-un":               {"tier": 4, "type": "wire"},
    "geneva-solutions":    {"tier": 3, "type": "specialist-media"},
    "un-reform":           {"tier": 5, "type": "aggregator"},
    "un-budget":           {"tier": 5, "type": "aggregator"},
    "un-development":      {"tier": 5, "type": "aggregator"},
    "oas":                 {"tier": 3, "type": "regional-org"},
    "arab-league":         {"tier": 3, "type": "regional-org"},
    "osce":                {"tier": 3, "type": "regional-org"},
    "sco":                 {"tier": 3, "type": "regional-org"},
    "celac":               {"tier": 3, "type": "regional-org"},
    "oic":                 {"tier": 3, "type": "regional-org"},
}


# Who runs the outlet, shown next to the source so readers can weigh it.
# Only set where ownership is a material fact (state-run or state-funded media).
SOURCE_OWNERSHIP = {
    "tass": "state-run (Russia)",
    "al-jazeera": "state-funded (Qatar)",
}

TIER_TYPE_MAP.update({
    "whats-in-blue":          {"tier": 3, "type": "specialist-media"},
    "ipi-global-observatory": {"tier": 3, "type": "think-tank"},
    "just-security":          {"tier": 3, "type": "specialist-media"},
    "war-on-the-rocks":       {"tier": 3, "type": "specialist-media"},
    "lowy-interpreter":       {"tier": 3, "type": "think-tank"},
    "south-centre":           {"tier": 3, "type": "think-tank"},
    "un-news-peace":          {"tier": 1, "type": "official"},
    "un-news-humanitarian":   {"tier": 1, "type": "official"},
    "un-news-migrants":       {"tier": 1, "type": "official"},
    "un-news-middle-east":    {"tier": 1, "type": "official"},
    "un-news-asia-pacific":   {"tier": 1, "type": "official"},
    "eu-commission":          {"tier": 2, "type": "official"},
    "consilium":              {"tier": 2, "type": "official"},
    "ecowas":                 {"tier": 3, "type": "regional-org"},
    "allafrica":              {"tier": 4, "type": "regional-news"},
    "daily-maverick":         {"tier": 4, "type": "regional-news"},
    "premium-times":          {"tier": 4, "type": "regional-news"},
    "buenos-aires-times":     {"tier": 4, "type": "regional-news"},
    "mexico-news-daily":      {"tier": 4, "type": "regional-news"},
    "caribbean-news-global":  {"tier": 4, "type": "regional-news"},
    "rnz-pacific":            {"tier": 4, "type": "regional-news"},
    "scmp-world":             {"tier": 4, "type": "regional-news"},
    "dawn":                   {"tier": 4, "type": "regional-news"},
    "straits-times-world":    {"tier": 4, "type": "regional-news"},
    "the-hindu-intl":         {"tier": 4, "type": "regional-news"},
    "nikkei-asia":            {"tier": 4, "type": "regional-news"},
    "al-monitor":             {"tier": 3, "type": "specialist-media"},
    "politico-eu":            {"tier": 4, "type": "regional-news"},
    "bbc-world":              {"tier": 4, "type": "wire"},
    "guardian-world":         {"tier": 4, "type": "wire"},
    "gnews-unhcr":            {"tier": 5, "type": "aggregator"},
    "gnews-wfp":              {"tier": 5, "type": "aggregator"},
    "gnews-unicef":           {"tier": 5, "type": "aggregator"},
    "gnews-who":              {"tier": 5, "type": "aggregator"},
    "gnews-african-union":    {"tier": 5, "type": "aggregator"},
    "gnews-caricom":          {"tier": 5, "type": "aggregator"},
    "gnews-pacific-forum":    {"tier": 5, "type": "aggregator"},
    "gnews-sids":             {"tier": 5, "type": "aggregator"},
    "gnews-un-sg":            {"tier": 5, "type": "aggregator"},
    "gnews-un-pga":           {"tier": 5, "type": "aggregator"},
    "reliefweb":              {"tier": 1, "type": "official"},
})


def load_country_flags():
    """Load site/server/data/country-flags.json. Returns a dict mapping
    iso3 country code -> list of flag names (e.g. 'is_p5', 'is_unsc_current')."""
    flags_file = os.path.join(DATA_DIR, "country-flags.json")
    if not os.path.exists(flags_file):
        return {}
    try:
        with open(flags_file, "r") as f:
            raw = json.load(f)
    except Exception:
        return {}
    out = {}
    for key, val in raw.items():
        if key.startswith("_") or not isinstance(val, list):
            continue
        for iso3 in val:
            out.setdefault(iso3, []).append(key)
    return out


def compute_country_flags(country_iso3_list, flags_lookup):
    if not country_iso3_list or not flags_lookup:
        return []
    flags = set()
    for iso3 in country_iso3_list:
        for f in flags_lookup.get(iso3, []):
            flags.add(f)
    return sorted(flags)


# ---- shared clean-up for search-based sources -------------------------------
# Navigation and service pages that site-restricted news searches sometimes return
NAV_JUNK = re.compile(
    r"^(contact( us)?|service charter|helpline|photo album|portal kemlu|test_\d+|home|about( us)?|sitemap|"
    r"consular services?|visa requirements?.*|embassy of .*|embajada (en|del?) .*|consulado .*|"
    r"ministry of foreign affairs( of [a-z ]+)?|major tourist attractions)\b",
    re.IGNORECASE)


# Service and archive pages, recognisable anywhere in the title
NAV_JUNK_ANY = re.compile(
    r"\b(press releases? archive|archives?\b.*\d{4}$|notices?\b -|procedure and requirement|e-passport|passport services?|"
    r"visa (application|requirements?|information)|consular (section|services?|information)|embassy'?s activities|"
    r"recruitment|tenders?\b|vacanc(y|ies)|office hours|public holidays?|portal kemlu|목록)",
    re.IGNORECASE)


def clean_search_items(items, source):
    """Tidy items from a source: strip Google News' ' - Site' title suffix and drop navigation pages."""
    url = source.get("url", "")
    exclude = re.compile(source["excludeTitle"], re.IGNORECASE) if source.get("excludeTitle") else None
    out = []
    for it in items:
        t = it.get("title") or ""
        if "news.google.com" in url and " - " in t:
            head, tail = t.rsplit(" - ", 1)
            if len(tail) <= 80 and len(head) >= 12:
                t = head.strip()
        it["title"] = t
        if NAV_JUNK.match(t) or NAV_JUNK_ANY.search(t) or (exclude and exclude.search(t)) or len(t) < 12:
            continue
        if "news.google.com" in url and len(t.split()) < 4:
            continue  # bare page names ("PTRI New York", "Wellington")
        out.append(it)
    return out


def apply_source_meta(sources, tier_map, ownership=None):
    """Sources may declare their own tier, type and ownership in the config."""
    for s in sources:
        if s.get("sourceType"):
            tier_map[s["id"]] = {"tier": int(s.get("tier", 2)), "type": s["sourceType"]}
        if ownership is not None and s.get("ownership"):
            ownership[s["id"]] = s["ownership"]


# ---- automatic gap filling -------------------------------------------------
GAP_NAMES = {"KGZ": "Kyrgyzstan", "LAO": "Laos", "SVK": "Slovakia", "COG": "\"Republic of Congo\" OR Brazzaville",
             "FSM": "\"Federated States of Micronesia\"", "KNA": "\"St Kitts and Nevis\" OR \"Saint Kitts and Nevis\"",
             "VCT": "\"St Vincent and the Grenadines\" OR \"Saint Vincent and the Grenadines\"", "GMB": "\"The Gambia\" OR Gambian",
             "STP": "\"Sao Tome and Principe\" OR \"São Tomé and Príncipe\"", "TTO": "\"Trinidad and Tobago\"",
             "LCA": "\"St Lucia\" OR \"Saint Lucia\"", "SMR": "\"Republic of San Marino\" OR \"San Marino government\"",
             "GRD": "Grenada", "MNG": "Mongolia OR Ulaanbaatar", "SLV": "\"El Salvador\" Bukele OR \"Salvadoran\""}
GAP_TERMS = '(government OR president OR "prime minister" OR minister OR parliament OR election OR "United Nations") -football -soccer -score -cricket -"live stream"'


def fill_coverage_gaps(patterns, max_countries=25):
    """Search individually for UN member states that had no statements or news in the last 30 days
    (from the latest data-health check), so quiet countries still get covered."""
    try:
        with open(os.path.join(DATA_DIR, "data-health.json")) as f:
            gaps = (json.load(f).get("coverage") or {}).get("none") or []
    except Exception:
        return []
    out = []
    for g in gaps[:max_countries]:
        iso3, name = g.get("iso3"), GAP_NAMES.get(g.get("iso3"), g.get("name", ""))
        if not iso3 or not name:
            continue
        q = (f"({name})" if " OR " in name else f'"{name}"') + f" {GAP_TERMS} when:30d"
        url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": q, "hl": "en-US", "gl": "US", "ceid": "US:en"})
        time.sleep(1.0)
        try:
            items = clean_search_items(fetch_rss(url, "coverage-gap", patterns), {"url": url})[:8]
        except Exception as e:
            print(f"  Coverage gap {name}: ERROR - {e}", file=sys.stderr)
            continue
        out.extend(items)  # tagged by the normal country matcher, so namesakes don't count
        print(f"  Coverage gap {name}: {len(items)} articles")
    return out


def enrich_article(article, *, now_iso, country_flags_lookup, existing=None):
    """Add Phase 1 metadata fields to an article record (modifies and returns it).

    existing: the previous version of the article from the prior fetch, if any.
              Used to preserve firstSeenAt across re-fetches.
    """
    sid = article.get("source", "")
    tier_type = TIER_TYPE_MAP.get(sid, {"tier": 5, "type": "wire"})

    article["language"] = article.get("language", "en")
    article["sourceTier"] = tier_type["tier"]
    article["sourceType"] = tier_type["type"]
    if sid in SOURCE_OWNERSHIP:
        article["sourceOwnership"] = SOURCE_OWNERSHIP[sid]
    else:
        article.pop("sourceOwnership", None)

    text = f"{article.get('title','')} {article.get('description','')}"
    article["unBodyTags"] = extract_un_body_tags(text)

    article["countryFlags"] = compute_country_flags(article.get("countries", []), country_flags_lookup)

    # sourceUpdatedAt mirrors publishedAt for now; Phase 2 will distinguish them.
    article["sourceUpdatedAt"] = article.get("publishedAt", now_iso)

    # firstSeenAt: preserve existing if we've seen this article before.
    if existing and existing.get("firstSeenAt"):
        article["firstSeenAt"] = existing["firstSeenAt"]
    else:
        article["firstSeenAt"] = article.get("firstSeenAt") or now_iso

    return article


def build_country_map():
    """Build name->ISO3 lookup from country-stats.json + aliases."""
    mapping = dict(ALIASES)
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "worldcountrygroups", "data", "groups", "world.json")) as f:
            for c in json.load(f).get("countries", []):
                if c.get("name") and c.get("iso3"):
                    mapping.setdefault(c["name"], c["iso3"])
    except Exception:
        pass
    if os.path.exists(STATS_FILE):
        try:
            with open(STATS_FILE, "r") as f:
                stats = json.load(f)
            for iso2, info in stats.items():
                if iso2.startswith("_"):
                    continue
                name = info.get("name", "")
                iso3 = info.get("iso3", "")
                if name and iso3:
                    mapping[name] = iso3
        except Exception as e:
            print(f"Warning: could not read country-stats.json: {e}", file=sys.stderr)
    return mapping


def compile_country_patterns(mapping):
    """Build compiled regex patterns for each country name."""
    patterns = []
    for name, iso3 in mapping.items():
        if name in SHORT_NAMES or len(name) <= 3:
            pat = re.compile(r'\b' + re.escape(name) + r'\b', re.IGNORECASE)
        else:
            pat = re.compile(re.escape(name), re.IGNORECASE)
        patterns.append((pat, iso3))
    patterns.sort(key=lambda x: -len(x[0].pattern))
    return patterns


def tag_countries(text, patterns):
    """Return set of ISO3 codes found in text."""
    if not text:
        return set()
    found = set()
    for pat, iso3 in patterns:
        if pat.search(text):
            found.add(iso3)
    return found


def make_id(title, url):
    """Generate a stable article ID."""
    key = f"{title}|{url}"
    return hashlib.md5(key.encode()).hexdigest()[:12]


def parse_rss_date(date_str):
    """Parse an RSS/Atom date string to ISO format; "" when it can't be read
    (the caller then treats the item as undated instead of stamping it "now")."""
    if not date_str:
        return ""
    try:
        return parsedate_to_datetime(date_str).isoformat()
    except Exception:
        pass
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00")).isoformat()
    except Exception:
        pass
    # e.g. Crisis Group: "Friday, September 25, 2026 - 15:56" (assumed UTC), also in French
    fr = {"lundi": "Monday", "mardi": "Tuesday", "mercredi": "Wednesday", "jeudi": "Thursday", "vendredi": "Friday",
          "samedi": "Saturday", "dimanche": "Sunday", "janvier": "January", "février": "February", "fevrier": "February",
          "mars": "March", "avril": "April", "mai": "May", "juin": "June", "juillet": "July", "août": "August",
          "aout": "August", "septembre": "September", "octobre": "October", "novembre": "November", "décembre": "December",
          "decembre": "December"}
    date_str = re.sub(r"[A-Za-zÀ-ÿ]+", lambda m: fr.get(m.group(0).lower(), m.group(0)), date_str)
    for fmt in ("%A, %B %d, %Y - %H:%M", "%B %d, %Y - %H:%M", "%d %B %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).replace(tzinfo=timezone.utc).isoformat()
        except Exception:
            continue
    return ""


def detect_topics(title, description):
    """Detect broad topic categories from text."""
    text = f"{title} {description}".lower()
    topics = []
    topic_keywords = {
        "peace-and-security": ["peace", "security", "conflict", "ceasefire", "war", "military", "weapon", "arms", "terrorism", "peacekeep"],
        "human-rights": ["human rights", "rights", "discrimination", "refugee", "migrant", "asylum", "torture", "detention", "freedom"],
        "climate-environment": ["climate", "environment", "carbon", "emission", "biodiversity", "pollution", "sustainable", "green"],
        "humanitarian": ["humanitarian", "aid", "crisis", "famine", "drought", "flood", "disaster", "relief", "hunger"],
        "development": ["development", "poverty", "economic", "trade", "sdg", "infrastructure", "education", "health"],
        "governance": ["governance", "democracy", "election", "corruption", "reform", "rule of law", "institution"],
        "sanctions": ["sanction", "embargo", "restriction", "ban", "blacklist", "penalty"],
        "nuclear": ["nuclear", "atomic", "nonproliferation", "iaea", "uranium", "enrichment"],
        "diplomacy": ["diplomat", "treaty", "agreement", "summit", "negotiation", "bilateral", "multilateral", "ambassador"],
    }
    for topic, keywords in topic_keywords.items():
        if any(kw in text for kw in keywords):
            topics.append(topic)
    return topics[:3] if topics else ["general"]


BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
)


def fetch_url(url, accept=None, user_agent="WCG-NewsFetcher/1.0"):
    """Fetch URL content with timeout and user agent. Handles gzip responses."""
    headers = {
        "User-Agent": user_agent,
        "Accept-Encoding": "gzip, identity",
    }
    if accept:
        headers["Accept"] = accept
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            raw = resp.read()
            # Decompress gzip if needed
            encoding = resp.headers.get("Content-Encoding", "")
            if encoding == "gzip" or raw[:2] == b'\x1f\x8b':
                try:
                    raw = gzip.decompress(raw)
                except Exception:
                    pass
            return raw
    except Exception as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        return None


def fetch_rss(url, source_id, patterns, user_agent="WCG-NewsFetcher/1.0"):
    """Fetch and parse an RSS or Atom feed. Works for both formats."""
    articles = []
    data = fetch_url(url, user_agent=user_agent)
    if not data:
        raise Exception(f"Failed to fetch {url}")

    try:
        root = ElementTree.fromstring(data)
    except ElementTree.ParseError as e:
        raise Exception(f"XML parse error: {e}")

    # Detect namespaces from root tag
    ns = {}
    tag = root.tag
    is_rdf = False
    if tag.startswith('{'):
        root_ns = tag.split('}')[0].strip('{')
        if 'rdf' in root_ns.lower():
            is_rdf = True
        elif 'Atom' in root_ns or 'atom' in root_ns:
            ns['atom'] = root_ns

    # Try RSS 2.0 items first
    items = list(root.iter("item"))

    # Try RDF/RSS 1.0 namespaced items
    if not items and is_rdf:
        rss10_ns = 'http://purl.org/rss/1.0/'
        items = root.findall(f"{{{rss10_ns}}}item")
        if items:
            ns['rss10'] = rss10_ns

    # Try Atom entries
    is_atom = False
    if not items:
        if ns.get('atom'):
            items = root.findall(f"{{{ns['atom']}}}entry")
        else:
            items = list(root.iter("entry"))
        is_atom = bool(items)

    dc_ns = 'http://purl.org/dc/elements/1.1/'

    for item in items:
        if is_atom and ns.get('atom'):
            ans = ns['atom']
            title = (item.findtext(f"{{{ans}}}title") or "").strip()
            # Atom links are in <link> elements with href attribute
            link_el = item.find(f"{{{ans}}}link[@rel='alternate']")
            if link_el is None:
                link_el = item.find(f"{{{ans}}}link")
            link = (link_el.get("href", "") if link_el is not None else "").strip()
            desc = (item.findtext(f"{{{ans}}}summary") or item.findtext(f"{{{ans}}}content") or "").strip()
            pub_date = (item.findtext(f"{{{ans}}}updated") or item.findtext(f"{{{ans}}}published") or "").strip()
        elif is_atom:
            title = (item.findtext("title") or "").strip()
            link_el = item.find("link[@rel='alternate']")
            if link_el is None:
                link_el = item.find("link")
            link = (link_el.get("href", "") if link_el is not None else "").strip()
            desc = (item.findtext("summary") or item.findtext("content") or "").strip()
            pub_date = (item.findtext("updated") or item.findtext("published") or "").strip()
        elif ns.get('rss10'):
            rns = ns['rss10']
            title = (item.findtext(f"{{{rns}}}title") or "").strip()
            link = (item.findtext(f"{{{rns}}}link") or "").strip()
            desc = (item.findtext(f"{{{rns}}}description") or "").strip()
            pub_date = (item.findtext(f"{{{dc_ns}}}date") or "").strip()
        else:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            desc = (item.findtext("description") or "").strip()
            pub_date = (item.findtext("pubDate") or "").strip()
            if not pub_date:
                # some RSS feeds (e.g. Council of the EU) date items with an Atom element
                pub_date = (item.findtext("{http://www.w3.org/2005/Atom}updated")
                            or item.findtext("{http://www.w3.org/2005/Atom}published")
                            or item.findtext("{http://purl.org/dc/elements/1.1/}date") or "").strip()

        # Strip HTML tags from description
        desc = re.sub(r"<[^>]+>", "", desc).strip()

        if not title or not link:
            continue

        text = f"{title} {desc}"
        countries = tag_countries(text, patterns)

        articles.append({
            "id": make_id(title, link),
            "title": title,
            "description": desc[:300],
            "url": link,
            "source": source_id,
            "publishedAt": parse_rss_date(pub_date),
            "_noDate": not parse_rss_date(pub_date),
            "countries": sorted(countries),
            "topics": detect_topics(title, desc),
        })

    return articles



def fetch_reliefweb(source, patterns, limit=40):
    """Latest ReliefWeb reports through the v2 API. Needs an appname that ReliefWeb
    has pre-approved (required since November 2025); set it in Admin -> News Sources."""
    appname = (source.get("appname") or "").strip()
    if not appname:
        raise Exception("No approved ReliefWeb appname set (Admin > News Sources > ReliefWeb)")
    params = [("appname", appname), ("limit", str(limit)), ("sort[]", "date.created:desc"),
              ("profile", "list")]
    for f in ("title", "url_alias", "date.created", "country.iso3", "primary_country.iso3",
              "source.shortname", "format.name", "theme.name"):
        params.append(("fields[include][]", f))
    url = source.get("url") or "https://api.reliefweb.int/v2/reports"
    from urllib.parse import urlencode
    data = fetch_url(f"{url}?{urlencode(params)}", accept="application/json")
    if not data:
        raise Exception("ReliefWeb API returned nothing")
    payload = json.loads(data)
    if payload.get("error"):
        raise Exception(payload["error"].get("message", "ReliefWeb API error"))
    out = []
    for row in payload.get("data", []):
        f = row.get("fields", {})
        title = (f.get("title") or "").strip()
        link = f.get("url_alias") or f.get("url") or f"https://reliefweb.int/node/{row.get('id')}"
        if not title:
            continue
        countries = {c.get("iso3", "").upper() for c in f.get("country", []) if c.get("iso3")}
        countries |= tag_countries(title, patterns)
        srcs = ", ".join(x.get("shortname", "") for x in f.get("source", [])[:2] if x.get("shortname"))
        fmt = ", ".join(x.get("name", "") for x in f.get("format", [])[:1])
        out.append({
            "id": make_id(title, link),
            "title": title,
            "description": " · ".join(x for x in (fmt, srcs) if x),
            "url": link,
            "source": source["id"],
            "publishedAt": parse_rss_date((f.get("date") or {}).get("created", "")) or datetime.now(timezone.utc).isoformat(),
            "countries": sorted(c for c in countries if c),
            "topics": detect_topics(title, " ".join(t.get("name", "") for t in f.get("theme", []))),
        })
    return out


def fetch_gdelt(url, source_id, patterns):
    """Fetch articles from GDELT DOC API."""
    articles = []
    data = fetch_url(url, accept="application/json")
    if not data:
        raise Exception("Failed to fetch GDELT API")

    try:
        result = json.loads(data)
    except json.JSONDecodeError as e:
        raise Exception(f"JSON parse error: {e}")

    for item in result.get("articles", []):
        title = (item.get("title") or "").strip()
        article_url = (item.get("url") or "").strip()
        seendate = item.get("seendate", "")

        if not title or not article_url:
            continue

        try:
            dt = datetime.strptime(seendate, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
            published = dt.isoformat()
        except Exception:
            published = datetime.now(timezone.utc).isoformat()

        domain = item.get("domain", "")
        text = f"{title} {domain}"
        countries = tag_countries(text, patterns)

        articles.append({
            "id": make_id(title, article_url),
            "title": title,
            "description": "",
            "url": article_url,
            "source": source_id,
            "publishedAt": published,
            "countries": sorted(countries),
            "topics": detect_topics(title, ""),
        })

    return articles


_OG_TITLE_RE = re.compile(
    r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
_OG_DESC_RE = re.compile(
    r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)


def _html_unescape(s):
    return (
        s.replace("&amp;", "&")
         .replace("&lt;", "<")
         .replace("&gt;", ">")
         .replace("&quot;", '"')
         .replace("&#039;", "'")
         .replace("&#8217;", "’")
         .replace("&hellip;", "…")
    )


def fetch_state_dept(sitemap_index_url, source_id, patterns, limit=20):
    """Scrape recent state.gov press releases via their WordPress sitemap.

    state.gov has discontinued usable press-release RSS feeds; the press-releases
    page is JS-rendered. The press_release sitemap is paginated; the highest-
    numbered sub-sitemap holds the newest URLs. For each recent URL we pull
    og:title + og:description from the page itself.
    """
    articles = []
    index_xml = fetch_url(sitemap_index_url, user_agent=BROWSER_UA)
    if not index_xml:
        raise Exception(f"Failed to fetch sitemap index {sitemap_index_url}")

    # Find all state_press_release sub-sitemaps. WordPress paginates these by age,
    # but the index's <lastmod> values are often identical, so we can't reliably
    # pick "the newest one" — instead, read all of them and sort URLs by lastmod.
    sub_pat = re.compile(
        r"<loc>(https://www\.state\.gov/state_press_release-sitemap\d*\.xml)</loc>",
        re.IGNORECASE,
    )
    sub_urls = sub_pat.findall(index_xml.decode("utf-8", errors="replace"))
    if not sub_urls:
        raise Exception("No state_press_release-sitemap in index")

    url_pat = re.compile(
        r"<url>\s*<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>",
        re.IGNORECASE,
    )
    entries = []
    for sub_url in sub_urls:
        sub_xml = fetch_url(sub_url, user_agent=BROWSER_UA)
        if not sub_xml:
            continue
        entries.extend(url_pat.findall(sub_xml.decode("utf-8", errors="replace")))
    if not entries:
        raise Exception("No press release URLs found in sub-sitemaps")
    entries.sort(key=lambda x: x[1], reverse=True)
    entries = entries[:limit]

    for page_url, lastmod in entries:
        html = fetch_url(page_url, user_agent=BROWSER_UA)
        if not html:
            continue
        text = html.decode("utf-8", errors="replace")
        title_m = _OG_TITLE_RE.search(text)
        desc_m = _OG_DESC_RE.search(text)
        if not title_m:
            continue
        title = _html_unescape(title_m.group(1)).strip()
        # Strip " - United States Department of State" suffix WordPress adds
        title = re.sub(r"\s*-\s*United States Department of State\s*$", "", title)
        desc = _html_unescape(desc_m.group(1)).strip() if desc_m else ""

        try:
            dt = datetime.fromisoformat(lastmod.replace("Z", "+00:00"))
            published = dt.isoformat()
        except Exception:
            published = datetime.now(timezone.utc).isoformat()

        countries = tag_countries(f"{title} {desc}", patterns)
        articles.append({
            "id": make_id(title, page_url),
            "title": title,
            "description": desc[:300],
            "url": page_url,
            "source": source_id,
            "publishedAt": published,
            "countries": sorted(countries),
            "topics": detect_topics(title, desc),
        })

    return articles


def fetch_news_sitemap(sitemap_index_url, source_id, patterns, limit=30):
    """Fetch a news source whose sitemap embeds <news:title> / <news:publication_date>.

    The index points to monthly sub-sitemaps like /sitemap/YYYY-MM.xml. We pick
    the latest (current month, or latest available), parse the inline news
    metadata directly — no per-article fetch needed because titles live in the
    sitemap. Works for Geneva Solutions and other Google News Sitemap publishers.
    """
    articles = []
    index_xml = fetch_url(sitemap_index_url, user_agent=BROWSER_UA)
    if not index_xml:
        raise Exception(f"Failed to fetch sitemap index {sitemap_index_url}")

    sub_pat = re.compile(r"<loc>(\S+/sitemap/\d{4}-\d{2}\.xml)</loc>", re.IGNORECASE)
    sub_urls = sub_pat.findall(index_xml.decode("utf-8", errors="replace"))
    if not sub_urls:
        raise Exception("No monthly sub-sitemaps found in index")
    # Latest by name (YYYY-MM sorts correctly as string)
    sub_urls.sort()
    newest = sub_urls[-1]

    sub_xml = fetch_url(newest, user_agent=BROWSER_UA)
    if not sub_xml:
        raise Exception(f"Failed to fetch {newest}")

    # Each <url> block has <loc>, <news:news> with <news:publication_date> and <news:title>
    url_pat = re.compile(
        r"<url>(.*?)</url>",
        re.IGNORECASE | re.DOTALL,
    )
    loc_pat = re.compile(r"<loc>([^<]+)</loc>", re.IGNORECASE)
    title_pat = re.compile(r"<news:title>\s*([^<]+?)\s*</news:title>", re.IGNORECASE)
    pubdate_pat = re.compile(r"<news:publication_date>([^<]+)</news:publication_date>", re.IGNORECASE)
    lastmod_pat = re.compile(r"<lastmod>([^<]+)</lastmod>", re.IGNORECASE)
    keywords_pat = re.compile(r"<news:keywords>\s*([^<]+?)\s*</news:keywords>", re.IGNORECASE)

    blocks = url_pat.findall(sub_xml.decode("utf-8", errors="replace"))
    entries = []
    for b in blocks:
        loc_m = loc_pat.search(b)
        if not loc_m:
            continue
        title_m = title_pat.search(b)
        pubdate_m = pubdate_pat.search(b) or lastmod_pat.search(b)
        keywords_m = keywords_pat.search(b)
        entries.append({
            "url": loc_m.group(1),
            "title": title_m.group(1) if title_m else "",
            "date": pubdate_m.group(1) if pubdate_m else "",
            "keywords": keywords_m.group(1) if keywords_m else "",
        })

    # Newest first
    entries.sort(key=lambda e: e["date"], reverse=True)
    entries = entries[:limit]

    for e in entries:
        try:
            dt = datetime.fromisoformat(e["date"].replace("Z", "+00:00"))
            published = dt.isoformat()
        except Exception:
            published = datetime.now(timezone.utc).isoformat()

        title = _html_unescape(e["title"]).strip()
        desc = e["keywords"]
        # Google News Sitemap spec only includes <news:news> for items <48h old.
        # For older items, fetch the page to extract og:title / og:description.
        if not title:
            html = fetch_url(e["url"], user_agent=BROWSER_UA)
            if html:
                text = html.decode("utf-8", errors="replace")
                tm = _OG_TITLE_RE.search(text)
                if tm:
                    title = _html_unescape(tm.group(1)).strip()
                    title = re.sub(r"\s*[-|]\s*Geneva Solutions\s*$", "", title)
                dm = _OG_DESC_RE.search(text)
                if dm and not desc:
                    desc = _html_unescape(dm.group(1)).strip()
        if not title:
            continue

        countries = tag_countries(f"{title} {desc}", patterns)
        articles.append({
            "id": make_id(title, e["url"]),
            "title": title,
            "description": desc[:300],
            "url": e["url"],
            "source": source_id,
            "publishedAt": published,
            "countries": sorted(countries),
            "topics": detect_topics(title, desc),
        })

    return articles


def load_news_config():
    """Load news source configuration from JSON file."""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: could not read news-config.json: {e}", file=sys.stderr)
    return None


def save_news_config(config):
    """Save news source configuration back to JSON file."""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def update_source_status(config, source_id, article_count=0, error=None):
    """Update lastFetch / lastError / articleCount for a source in the config."""
    for source in config.get("sources", []):
        if source["id"] == source_id:
            source["lastFetch"] = datetime.now(timezone.utc).isoformat()
            source["lastError"] = error
            source["articleCount"] = article_count
            break



def to_utc_iso(value, fallback):
    """Normalise any ISO timestamp to UTC so string comparisons sort correctly."""
    try:
        dt = datetime.fromisoformat((value or "").replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return fallback


def cap_per_source(items, max_total, share=0.08, overrides=None, floor=15):
    """Keep newest-first items, but no source may exceed `share` of the feed
    (at least `floor` items); `overrides` sets explicit per-source limits.
    Stops one high-volume outlet from crowding out everyone else."""
    overrides = overrides or {}
    default_cap = max(floor, int(max_total * share))
    counts, out = {}, []
    for it in items:
        src = it.get("source", "")
        cap = overrides.get(src, default_cap)
        if counts.get(src, 0) >= cap:
            continue
        counts[src] = counts.get(src, 0) + 1
        out.append(it)
        if len(out) >= max_total:
            break
    return out


def main():
    print(f"Fetching diplomatic news... ({datetime.now(timezone.utc).isoformat()})")

    country_map = build_country_map()
    patterns = compile_country_patterns(country_map)
    print(f"  Country patterns: {len(patterns)}")

    # Load config
    config = load_news_config()
    if config and config.get("sources"):
        sources = [s for s in config["sources"] if s.get("enabled", True)]
        apply_source_meta(config["sources"], TIER_TYPE_MAP, SOURCE_OWNERSHIP)
        max_articles = config.get("maxArticles", MAX_ARTICLES)
        print(f"  Config loaded: {len(sources)} enabled sources (of {len(config['sources'])} total)")
    else:
        print("  No config found, using defaults")
        sources = []
        max_articles = MAX_ARTICLES
        config = None

    # Fetch from all sources
    all_articles = []

    if sources:
        for source in sources:
            if "news.google.com" in source.get("url", ""):
                time.sleep(1.0)  # be gentle with the news search service
            sid = source["id"]
            stype = source.get("type", "rss")
            url = source["url"]
            name = source.get("name", sid)

            ua_pref = source.get("userAgent")
            ua = BROWSER_UA if ua_pref == "browser" else (ua_pref or "WCG-NewsFetcher/1.0")

            try:
                if stype == "json-api":
                    articles = fetch_gdelt(url, sid, patterns)
                elif stype == "state-sitemap":
                    articles = fetch_state_dept(url, sid, patterns)
                elif stype == "news-sitemap":
                    articles = fetch_news_sitemap(url, sid, patterns)
                elif stype == "reliefweb-api":
                    articles = fetch_reliefweb(source, patterns)
                else:
                    articles = fetch_rss(url, sid, patterns, user_agent=ua)

                articles = clean_search_items(articles, source)
                all_articles.extend(articles)
                print(f"  {name}: {len(articles)} articles")

                if config:
                    update_source_status(config, sid, article_count=len(articles))

            except Exception as e:
                err_msg = str(e)
                print(f"  {name}: ERROR - {err_msg}", file=sys.stderr)
                if config:
                    update_source_status(config, sid, error=err_msg)
        all_articles.extend(fill_coverage_gaps(patterns))
    else:
        # Fallback to hardcoded sources if no config
        from urllib.request import urlopen  # noqa: already imported

        UN_NEWS_RSS = "https://news.un.org/feed/subscribe/en/news/all/rss.xml"
        PASSBLUE_RSS = "https://www.passblue.com/feed/"
        GDELT_URL = (
            "https://api.gdeltproject.org/api/v2/doc/doc"
            "?query=diplomacy+OR+%22united+nations%22+OR+sanctions+OR+treaty"
            "&mode=ArtList&maxrecords=50&format=json&timespan=24h"
        )

        try:
            all_articles.extend(fetch_rss(UN_NEWS_RSS, "un-news", patterns))
        except Exception as e:
            print(f"  UN News: ERROR - {e}", file=sys.stderr)
        try:
            all_articles.extend(fetch_rss(PASSBLUE_RSS, "passblue", patterns))
        except Exception as e:
            print(f"  PassBlue: ERROR - {e}", file=sys.stderr)
        try:
            all_articles.extend(fetch_gdelt(GDELT_URL, "gdelt", patterns))
        except Exception as e:
            print(f"  GDELT: ERROR - {e}", file=sys.stderr)

    # Save updated config with lastFetch/lastError/articleCount
    if config:
        save_news_config(config)

    # Load existing data for merge
    existing_by_id = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r") as f:
                existing = json.load(f)
            for a in existing.get("articles", []):
                existing_by_id[a["id"]] = a
        except Exception:
            pass

    # Phase 1 metadata enrichment: load lookups, then enrich each article.
    country_flags_lookup = load_country_flags()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Deduplicate: new articles override existing, but preserve firstSeenAt
    now_dt = datetime.now(timezone.utc)
    for a in all_articles:
        existing = existing_by_id.get(a["id"])
        # Undated items (e.g. Nikkei Asia) would be re-stamped "now" on every run and
        # sit on top forever: keep the time we first saw them instead.
        if a.pop("_noDate", False):
            a["publishedAt"] = (existing or {}).get("publishedAt") or now_iso
            a["dateEstimated"] = True
        # Feeds that mislabel local time as UTC (e.g. Daily Maverick) can be hours ahead
        try:
            pdt = datetime.fromisoformat(a.get("publishedAt", "").replace("Z", "+00:00"))
            if pdt.tzinfo is None:
                pdt = pdt.replace(tzinfo=timezone.utc)
            if (pdt - now_dt).total_seconds() > 300:
                a["publishedAt"] = now_iso
        except Exception:
            pass
        enrich_article(a, now_iso=now_iso, country_flags_lookup=country_flags_lookup, existing=existing)
        existing_by_id[a["id"]] = a

    # Backfill metadata on items that weren't re-fetched this run (so we don't have
    # mixed-schema records in the file).
    for a in existing_by_id.values():
        if "sourceTier" not in a:
            enrich_article(a, now_iso=now_iso, country_flags_lookup=country_flags_lookup, existing=a)

    # Sort by date desc, keep max. Parse to tz-aware datetime so sources in
    # different timezones compare on real instant, not raw ISO string.
    _epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)

    def _sort_key(article):
        s = article.get("publishedAt", "")
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return _epoch

    merged = sorted(existing_by_id.values(), key=_sort_key, reverse=True)
    share = (config or {}).get("maxSourceShare", 0.08)
    overrides = {src["id"]: src["maxItems"] for src in (config or {}).get("sources", []) if src.get("maxItems")}
    merged = cap_per_source(merged, max_articles, share=share, overrides=overrides)
    for item in merged:
        item["publishedAt"] = to_utc_iso(item.get("publishedAt"), item.get("publishedAt"))
    # ownership labels apply to every kept item, including ones fetched in earlier runs
    for a in merged:
        if a.get("source") in SOURCE_OWNERSHIP:
            a["sourceOwnership"] = SOURCE_OWNERSHIP[a["source"]]
        else:
            a.pop("sourceOwnership", None)

    # Count unique countries covered
    all_countries = set()
    sources_seen = set()
    for a in merged:
        all_countries.update(a.get("countries", []))
        sources_seen.add(a.get("source", ""))

    output = {
        "_meta": {
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "sources": sorted(sources_seen),
            "article_count": len(merged),
            "country_coverage": len(all_countries),
        },
        "articles": merged,
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"  Total: {len(merged)} articles, {len(all_countries)} countries covered")
    print(f"  Written to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Fetch diplomatic statements from UN missions and official UN sources.

Reads source list from site/server/data/statements-config.json.
Supports RSS, Atom, and HTML scraping (using stdlib html.parser).
Classifies statement types and extracts speaker names.

Output: site/server/data/statements-feed.json
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
from html.parser import HTMLParser
from urllib.request import urlopen, Request
from xml.etree import ElementTree

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "site", "server", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "statements-feed.json")
STATS_FILE = os.path.join(DATA_DIR, "country-stats.json")
CONFIG_FILE = os.path.join(DATA_DIR, "statements-config.json")

MAX_STATEMENTS = 1500
REQUEST_TIMEOUT = 30

# ---------------------------------------------------------------------------
# Country tagging (reused from fetch_news.py)
# ---------------------------------------------------------------------------

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
    "Venezuela": "VEN", "Bolivia": "BOL",
    "Tanzania": "TZA", "Congo": "COD", "DRC": "COD", "DR Congo": "COD",
    "Myanmar": "MMR", "Burma": "MMR",
    "Palestine": "PSE", "Palestinian": "PSE", "Gaza": "PSE", "West Bank": "PSE",
    "Israel": "ISR", "Israeli": "ISR",
    "Ukraine": "UKR", "Ukrainian": "UKR",
    "Yemen": "YEM", "Libya": "LBY", "Somalia": "SOM", "Sudan": "SDN",
    "South Sudan": "SSD", "Ethiopia": "ETH", "Afghanistan": "AFG",
    "Iraq": "IRQ", "Lebanon": "LBN", "Saudi Arabia": "SAU",
    "UAE": "ARE", "Turkey": "TUR", "Türkiye": "TUR",
    "Egypt": "EGY", "Morocco": "MAR", "Algeria": "DZA",
    "Tunisia": "TUN", "Pakistan": "PAK", "India": "IND",
    "Japan": "JPN", "Germany": "DEU", "France": "FRA",
    "Brazil": "BRA", "Mexico": "MEX", "Nigeria": "NGA",
    "Kenya": "KEN", "South Africa": "ZAF", "Colombia": "COL",
    "Mali": "MLI", "Niger": "NER", "Burkina Faso": "BFA",
    "Cameroon": "CMR", "Chad": "TCD", "Mozambique": "MOZ",
    "Haiti": "HTI", "Cuba": "CUB",
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
# (Duplicated from fetch_news.py to avoid coupling. Keep in sync.)
# ---------------------------------------------------------------------------

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
    (re.compile(r"\bUN ?80\b|\bPact for the Future\b|\bSummit of the Future\b|\bUN reform\b", re.IGNORECASE), "UN80_REFORM"),
    (re.compile(r"\bFifth Committee\b|\bACABQ\b|\bregular budget\b|\bscale of assessments\b|\bpeacekeeping budget\b|\bprogramme budget\b", re.IGNORECASE), "FIFTH_COMMITTEE"),
    (re.compile(r"\b(Sustainable Development Goals?|SDGs?|HLPF|High[- ]Level Political Forum)\b"), "SDGS"),
    (re.compile(r"\bFinancing for Development\b|\bFfD\b|\bMonterrey Consensus\b|\bAddis Ababa Action Agenda\b"), "FFD"),
]


def extract_un_body_tags(text):
    if not text:
        return []
    return [name for pat, name in UN_BODY_PATTERNS if pat.search(text)]


TIER_TYPE_MAP = {
    "usa-un-mission":            {"tier": 2, "type": "mission"},
    "uk-un-mission":             {"tier": 2, "type": "mission"},
    "france-un-mission":         {"tier": 2, "type": "mission"},
    "russia-un-mission":         {"tier": 2, "type": "mission"},
    "china-mfa":                 {"tier": 2, "type": "mfa"},
    "germany-foreign-office":    {"tier": 2, "type": "mfa"},
    "france-mfa":                {"tier": 2, "type": "mfa"},
    "india-un-mission":          {"tier": 2, "type": "mission"},
    "brazil-un-mission":         {"tier": 2, "type": "mission"},
    "south-africa-un-mission":   {"tier": 2, "type": "mission"},
    "kenya-un-mission":          {"tier": 2, "type": "mission"},
    "ungeneva-press":            {"tier": 1, "type": "official"},
    "ungeneva-meetings":         {"tier": 1, "type": "official"},
    "un-press-releases":         {"tier": 1, "type": "official"},
    "un-sg":                     {"tier": 1, "type": "official"},
    "un-press-archive":          {"tier": 1, "type": "official"},
    "who":                       {"tier": 1, "type": "official"},
    "iaea":                      {"tier": 1, "type": "official"},
    "wto":                       {"tier": 1, "type": "official"},
    "african-union":             {"tier": 1, "type": "regional-org"},
    "asean":                     {"tier": 1, "type": "regional-org"},
    "uzbekistan-un-mission":     {"tier": 2, "type": "mission"},
    "pakistan-un-mission":       {"tier": 2, "type": "mission"},
    "un-webtv-schedule":         {"tier": 1, "type": "meeting"},
    "un-pga":                    {"tier": 1, "type": "official"},
    "ohchr":                     {"tier": 1, "type": "official"},
    "icj":                       {"tier": 1, "type": "official"},
    "ocha-reliefweb":            {"tier": 1, "type": "official"},
    "dppa":                      {"tier": 1, "type": "official"},
    "icc":                       {"tier": 1, "type": "official"},
    "un-spokesperson":           {"tier": 1, "type": "official"},
}


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


def load_country_flags():
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


def enrich_statement(stmt, *, now_iso, country_flags_lookup, existing=None):
    sid = stmt.get("source", "")
    tier_type = TIER_TYPE_MAP.get(sid, {"tier": 3, "type": "specialist-media"})

    stmt["language"] = stmt.get("language", "en")
    stmt["sourceTier"] = tier_type["tier"]
    stmt["sourceType"] = tier_type["type"]

    text = f"{stmt.get('title','')} {stmt.get('excerpt','')}"
    stmt["unBodyTags"] = extract_un_body_tags(text)

    # Statements may carry a single 'country' field AND a 'countries' list; combine.
    countries = list(stmt.get("countries", []) or [])
    if stmt.get("country") and stmt["country"] not in countries:
        countries.append(stmt["country"])
    stmt["countryFlags"] = compute_country_flags(countries, country_flags_lookup)

    stmt["sourceUpdatedAt"] = stmt.get("publishedAt", now_iso)

    if existing and existing.get("firstSeenAt"):
        stmt["firstSeenAt"] = existing["firstSeenAt"]
    else:
        stmt["firstSeenAt"] = stmt.get("firstSeenAt") or now_iso

    return stmt


def build_country_map():
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
    if not text:
        return set()
    found = set()
    for pat, iso3 in patterns:
        if pat.search(text):
            found.add(iso3)
    return found


# ---------------------------------------------------------------------------
# Statement-specific helpers
# ---------------------------------------------------------------------------

STATEMENT_TYPE_KEYWORDS = {
    "press-release": ["press release", "press statement", "media note", "media statement", "readout", "communiqué", "communique", "press briefing"],
    "remarks": ["remarks", "address", "speech", "intervention", "delivered by", "keynote", "opening statement", "closing statement", "oral statement", "press conference", "briefing"],
    "vote-explanation": ["explanation of vote", "vote explanation", "eov", "voting"],
    "letter": ["letter to", "letter from", "open letter", "correspondence", "letter dated"],
    "statement": ["statement by", "statement of", "joint statement", "statement on", "official statement", "statement at", "statement –", "statement -", "statement to", "declaration"],
}


def classify_statement_type(title):
    lower = title.lower()
    for stype, keywords in STATEMENT_TYPE_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return stype
    return "other"


TITLE_PREFIXES = [
    "Deputy Permanent Representative",
    "Permanent Representative",
    "Ambassador", "Amb.",
    "Secretary-General", "Secretary General",
    "Foreign Minister", "Minister",
    "President", "H.E.", "Dr.", "Mr.", "Ms.", "Mrs.",
]

# Stopwords that end a name (prepositions/articles commonly following names in titles)
NAME_STOPS = {"at", "on", "in", "to", "for", "during", "of", "the", "prior", "and", "his", "her", "with",
              "interview", "remarks", "statement", "speech", "address", "briefing", "meeting", "session",
              "conversation", "call", "visit", "regarding", "concerning", "about", "before", "after"}


def extract_speaker(title):
    """Extract speaker name from statement titles like 'Statement by Ambassador X Y at...'"""
    # Find the name portion after known title patterns
    patterns = [
        r'(?:Statement|Remarks|Address|Speech)\s+by\s+',
        r'(?:Ambassador|Amb\.)\s+',
        r'(?:Deputy\s+)?Permanent\s+Representative\s+',
        r'(?:Foreign\s+)?Minister\s+',
        r'Secretary[- ]General\s+',
        r'M\.\s+',  # French style: M. Jean-Noël Barrot
    ]

    for pat_str in patterns:
        m = re.search(pat_str, title, re.IGNORECASE)
        if not m:
            continue
        rest = title[m.end():]

        # Skip title prefixes (e.g., "H.E. Ambassador" after "Statement by")
        for prefix in TITLE_PREFIXES:
            if rest.lower().startswith(prefix.lower()):
                rest = rest[len(prefix):].lstrip()

        # Extract capitalized name words, stopping at lowercase stopwords
        words = rest.split()
        name_parts = []
        for w in words:
            # Clean punctuation and possessives
            clean = w.rstrip(",;:")
            clean = re.sub(r"['\u2019]s$", "", clean)
            if not clean:
                break
            # Stop at lowercase words that aren't part of names (de, van, etc. are ok)
            if clean.lower() in NAME_STOPS:
                break
            # Stop at words that look like non-name context
            if clean[0].islower() and clean.lower() not in ("de", "van", "von", "di", "le", "la", "el", "al"):
                break
            # Accept capitalized words, hyphenated names, or name particles
            if clean[0].isupper() or clean.lower() in ("de", "van", "von", "di", "le", "la", "el", "al"):
                name_parts.append(clean)
            else:
                break
            if len(name_parts) >= 4:
                break

        if len(name_parts) >= 2:
            name = " ".join(name_parts)
            # Clean trailing possessive
            name = re.sub(r"['']s$", "", name)
            return name

    return ""


# Topic detection (same keywords as fetch_news.py)
TOPIC_KEYWORDS = {
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


def detect_topics(title, excerpt):
    text = f"{title} {excerpt}".lower()
    topics = []
    for topic, keywords in TOPIC_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            topics.append(topic)
    return topics[:3] if topics else ["general"]


# ---------------------------------------------------------------------------
# Shared fetch / parse helpers
# ---------------------------------------------------------------------------

def make_id(title, url):
    key = f"{title}|{url}"
    return hashlib.md5(key.encode()).hexdigest()[:12]


def parse_date(date_str):
    if not date_str:
        return datetime.now(timezone.utc).isoformat()
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.isoformat()
    except Exception:
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.isoformat()
        except Exception:
            return datetime.now(timezone.utc).isoformat()


def fetch_url(url, accept=None):
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
    }
    if accept:
        headers["Accept"] = accept
    else:
        headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            raw = resp.read()
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


def strip_html(text):
    return re.sub(r"<[^>]+>", "", text).strip()


# ---------------------------------------------------------------------------
# RSS / Atom parsing (same approach as fetch_news.py)
# ---------------------------------------------------------------------------

def fetch_rss(url, source_id, source_country, patterns):
    statements = []
    data = fetch_url(url)
    if not data:
        raise Exception(f"Failed to fetch {url}")

    try:
        root = ElementTree.fromstring(data)
    except ElementTree.ParseError as e:
        raise Exception(f"XML parse error: {e}")

    ns = {}
    tag = root.tag
    is_rdf = False
    if tag.startswith('{'):
        root_ns = tag.split('}')[0].strip('{')
        if 'rdf' in root_ns.lower():
            is_rdf = True
        elif 'Atom' in root_ns or 'atom' in root_ns:
            ns['atom'] = root_ns

    items = list(root.iter("item"))

    if not items and is_rdf:
        rss10_ns = 'http://purl.org/rss/1.0/'
        items = root.findall(f"{{{rss10_ns}}}item")
        if items:
            ns['rss10'] = rss10_ns

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

        desc = strip_html(desc)

        if not title or not link:
            continue

        text = f"{title} {desc}"
        countries = tag_countries(text, patterns)
        if source_country:
            countries.add(source_country)

        statements.append({
            "id": make_id(title, link),
            "title": title,
            "url": link,
            "source": source_id,
            "country": source_country,
            "countries": sorted(countries),
            "publishedAt": parse_date(pub_date),
            "speaker": extract_speaker(title),
            "type": classify_statement_type(title),
            "excerpt": desc[:400],
            "topics": detect_topics(title, desc),
        })

    return statements


# ---------------------------------------------------------------------------
# HTML scraping using stdlib html.parser
# ---------------------------------------------------------------------------

class SimpleSelector:
    """Parse a simple CSS-like selector: tag, .class, #id, tag.class

    Also supports descendant selectors like '.parent a' — in that case,
    only the *last* part is used for matching (the ancestor context is
    handled by ListExtractor already scoping the HTML fragment).
    """

    def __init__(self, selector):
        self.tag = None
        self.cls = None
        self.id = None

        # For descendant/child selectors, use only the last part
        # e.g. ".parent > div" or ".parent div" -> just use "div"
        parts = re.split(r'\s+>\s+|\s+', selector.strip()) if selector.strip() else ['']
        s = parts[-1]
        if '#' in s:
            parts = s.split('#', 1)
            self.tag = parts[0] or None
            self.id = parts[1]
        elif '.' in s:
            parts = s.split('.', 1)
            self.tag = parts[0] or None
            self.cls = parts[1]
        else:
            self.tag = s or None

    def matches(self, tag, attrs):
        attrs_dict = dict(attrs)
        if self.tag and self.tag != tag:
            return False
        if self.id and attrs_dict.get('id') != self.id:
            return False
        if self.cls:
            classes = attrs_dict.get('class', '').split()
            if self.cls not in classes:
                return False
        return True


class ListExtractor(HTMLParser):
    """Extract list items from HTML matching a CSS selector."""

    def __init__(self, list_selector_str):
        super().__init__()
        self.selector = SimpleSelector(list_selector_str)
        self.items = []
        self._capturing = False
        self._depth = 0
        self._current_html = ""

    def handle_starttag(self, tag, attrs):
        if self._capturing:
            self._depth += 1
            self._current_html += self._reconstruct_tag(tag, attrs)
        elif self.selector.matches(tag, attrs):
            self._capturing = True
            self._depth = 1
            self._current_html = ""

    def handle_endtag(self, tag):
        if self._capturing:
            self._depth -= 1
            if self._depth <= 0:
                self.items.append(self._current_html)
                self._capturing = False
                self._current_html = ""
            else:
                self._current_html += f"</{tag}>"

    def handle_data(self, data):
        if self._capturing:
            self._current_html += data

    def _reconstruct_tag(self, tag, attrs):
        attr_str = ""
        for k, v in attrs:
            if v is not None:
                attr_str += f' {k}="{v}"'
            else:
                attr_str += f' {k}'
        return f"<{tag}{attr_str}>"


class ItemParser(HTMLParser):
    """Parse a single list item to extract title, link, date, excerpt."""

    def __init__(self, title_sel_str, link_sel_str, date_sel_str=None, excerpt_sel_str=None):
        super().__init__()
        self.title_sel = SimpleSelector(title_sel_str) if title_sel_str else None
        self.link_sel = SimpleSelector(link_sel_str) if link_sel_str else None
        self.date_sel = SimpleSelector(date_sel_str) if date_sel_str else None
        self.excerpt_sel = SimpleSelector(excerpt_sel_str) if excerpt_sel_str else None

        self.title = ""
        self.link = ""
        self.date = ""
        self.excerpt = ""
        self._all_text = ""

        self._capture_title = False
        self._capture_date = False
        self._capture_excerpt = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        # Extract link href
        if self.link_sel and self.link_sel.matches(tag, attrs) and not self.link:
            href = attrs_dict.get('href', '')
            if href:
                self.link = href

        # Also grab href from <a> tags for title links
        if tag == 'a' and not self.link:
            href = attrs_dict.get('href', '')
            if href:
                self.link = href

        if self.title_sel and self.title_sel.matches(tag, attrs):
            self._capture_title = True
        if self.date_sel and self.date_sel.matches(tag, attrs):
            self._capture_date = True
        if self.excerpt_sel and self.excerpt_sel.matches(tag, attrs):
            self._capture_excerpt = True

    def handle_endtag(self, tag):
        self._capture_title = False
        self._capture_date = False
        self._capture_excerpt = False

    def handle_data(self, data):
        text = data.strip()
        if text:
            self._all_text += " " + text
        if self._capture_title and text:
            self.title = (self.title + " " + text).strip()
        if self._capture_date and text:
            self.date = (self.date + " " + text).strip()
        if self._capture_excerpt and text:
            self.excerpt = (self.excerpt + " " + text).strip()

    def get_result(self):
        title = self.title.strip() or self._all_text.strip()[:200]
        return {
            "title": title,
            "link": self.link.strip(),
            "date": self.date.strip(),
            "excerpt": self.excerpt.strip() or self._all_text.strip()[:400],
        }


class LinkExtractor(HTMLParser):
    """Extract all links with their text and surrounding date divs from a scoped HTML region."""

    def __init__(self, scope_selector_str=None):
        super().__init__()
        self.scope_sel = SimpleSelector(scope_selector_str) if scope_selector_str else None
        self.links = []  # list of {title, href, date_text}
        self._in_scope = not bool(scope_selector_str)  # if no scope, everything is in scope
        self._scope_depth = 0
        self._in_link = False
        self._current_href = ""
        self._current_text = ""
        self._last_text = ""

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if self.scope_sel and not self._in_scope:
            if self.scope_sel.matches(tag, attrs):
                self._in_scope = True
                self._scope_depth = 1
            return
        if self.scope_sel and self._in_scope:
            self._scope_depth += 1

        if tag == 'a' and self._in_scope:
            href = attrs_dict.get('href', '')
            if href:
                self._in_link = True
                self._current_href = href
                self._current_text = ""

    def handle_endtag(self, tag):
        if self._in_link and tag == 'a':
            self._in_link = False
            text = self._current_text.strip()
            if text and len(text) > 10 and self._current_href:
                self.links.append({
                    'title': text,
                    'href': self._current_href,
                    'date_text': '',
                })
            self._last_text = ""
        if self.scope_sel and self._in_scope:
            self._scope_depth -= 1
            if self._scope_depth <= 0:
                self._in_scope = False

    def handle_data(self, data):
        text = data.strip()
        if self._in_link:
            self._current_text += " " + text if self._current_text else text
        elif self._in_scope and text and self.links:
            # Capture date text that follows a link
            if not self.links[-1]['date_text']:
                self.links[-1]['date_text'] = text


def fetch_html_scrape(url, source_id, source_country, scrape_config, patterns):
    """Scrape statements from HTML pages."""
    statements = []
    data = fetch_url(url, accept="text/html")
    if not data:
        raise Exception(f"Failed to fetch {url}")

    try:
        html = data.decode("utf-8", errors="replace")
    except Exception:
        html = data.decode("latin-1", errors="replace")

    list_sel = scrape_config.get("listSelector", "li")
    title_sel = scrape_config.get("titleSelector", "a")
    link_sel = scrape_config.get("linkSelector", "a")
    date_sel = scrape_config.get("dateSelector")
    excerpt_sel = scrape_config.get("excerptSelector")
    base_url = scrape_config.get("baseUrl", "").rstrip("/")
    # If set, only accept links whose path starts with this prefix.
    # Bypasses the default "looks like an article" heuristic — useful for
    # Drupal-style slug URLs that don't end in .html or contain a year path.
    article_url_prefix = scrape_config.get("articleUrlPrefix")

    # Try the LinkExtractor approach first for pages where items are
    # links inside a scoped container (e.g. .list_box, .news-text__item)
    use_link_extractor = list_sel and title_sel == 'a' and link_sel == 'a'

    if use_link_extractor:
        extractor = LinkExtractor(list_sel)
        try:
            extractor.feed(html)
        except Exception as e:
            print(f"  HTML parse warning for {url}: {e}", file=sys.stderr)

        seen_urls = set()
        for item in extractor.links[:50]:
            title = item['title']
            link = item['href']

            if not title or len(title) < 10:
                continue

            # Drupal teaser templates emit both a headline anchor and a
            # "Read more about X" anchor pointing at the same URL. Skip the
            # noisier prefixed variant; the clean one was captured first.
            if title.lower().startswith("read more about "):
                continue

            # Dedup by URL within a single source/page fetch
            if link in seen_urls:
                continue

            if article_url_prefix:
                # Explicit prefix mode: only accept links starting with the prefix.
                if not link or not link.startswith(article_url_prefix):
                    continue
            else:
                # Default heuristic: skip navigation links (no file extension or 4+ digit path).
                if link and not link.endswith('.html') and not link.endswith('.htm') and '?' not in link:
                    if link.endswith('/') or not re.search(r'/\d{4,}', link):
                        continue

            # Resolve relative URLs
            if link and not link.startswith("http"):
                if link.startswith("./"):
                    link = base_url + "/" + link[2:]
                elif link.startswith("/"):
                    # Extract domain from base_url
                    domain = "/".join(base_url.split("/")[:3])
                    link = domain + link
                elif base_url:
                    link = base_url + "/" + link

            if not link:
                continue

            if link in seen_urls:
                continue
            seen_urls.add(link)

            countries = tag_countries(title, patterns)
            if source_country:
                countries.add(source_country)

            statements.append({
                "id": make_id(title, link),
                "title": title,
                "url": link,
                "source": source_id,
                "country": source_country,
                "countries": sorted(countries),
                "publishedAt": parse_date(item['date_text']),
                "speaker": extract_speaker(title),
                "type": classify_statement_type(title),
                "excerpt": title[:400],
                "topics": detect_topics(title, ""),
            })

        if statements:
            return statements

    # Fallback: original ListExtractor + ItemParser approach
    extractor = ListExtractor(list_sel)
    try:
        extractor.feed(html)
    except Exception as e:
        print(f"  HTML parse warning for {url}: {e}", file=sys.stderr)

    for item_html in extractor.items[:50]:
        parser = ItemParser(title_sel, link_sel, date_sel, excerpt_sel)
        try:
            parser.feed(item_html)
        except Exception:
            continue

        result = parser.get_result()
        title = result["title"]
        link = result["link"]

        if not title or len(title) < 5:
            continue

        # Resolve relative URLs
        if link and not link.startswith("http"):
            if link.startswith("/"):
                link = base_url + link
            elif base_url:
                link = base_url + "/" + link

        if not link:
            continue

        text = f"{title} {result['excerpt']}"
        countries = tag_countries(text, patterns)
        if source_country:
            countries.add(source_country)

        statements.append({
            "id": make_id(title, link),
            "title": title,
            "url": link,
            "source": source_id,
            "country": source_country,
            "countries": sorted(countries),
            "publishedAt": parse_date(result["date"]),
            "speaker": extract_speaker(title),
            "type": classify_statement_type(title),
            "excerpt": result["excerpt"][:400],
            "topics": detect_topics(title, result["excerpt"]),
        })

    return statements


# ---------------------------------------------------------------------------
# Regex-pair scraper for sites where the CSS-selector LinkExtractor fails
# (e.g. Tailwind "clickable card" patterns where the anchor has no text and
# the title lives in a sibling element).
# ---------------------------------------------------------------------------

def fetch_html_regex(url, source_id, source_country, scrape_config, patterns):
    """Extract (url, title) pairs from a page using a configured regex.

    scrapeConfig fields:
      regex:           pattern with two capture groups: (link, title). Required.
      regexFlags:      "DOTALL", "IGNORECASE", or "DOTALL|IGNORECASE" (optional)
      baseUrl:         absolute base for relative links
      datePattern:     optional regex to extract date from each link's path; result is parsed as YYYYMMDD
      datePatternFormat: format of the captured date (default "MMDDYYYY")
    """
    statements = []
    data = fetch_url(url, accept="text/html")
    if not data:
        raise Exception(f"Failed to fetch {url}")
    try:
        html = data.decode("utf-8", errors="replace")
    except Exception:
        html = data.decode("latin-1", errors="replace")

    pattern_str = scrape_config.get("regex")
    if not pattern_str:
        raise Exception("html-regex scraper requires a 'regex' in scrapeConfig")

    flags = 0
    for f in (scrape_config.get("regexFlags") or "").split("|"):
        f = f.strip().upper()
        if f == "DOTALL": flags |= re.DOTALL
        elif f == "IGNORECASE": flags |= re.IGNORECASE
        elif f == "MULTILINE": flags |= re.MULTILINE

    pat = re.compile(pattern_str, flags)
    base_url = scrape_config.get("baseUrl", "").rstrip("/")
    date_pat = scrape_config.get("datePattern")
    date_fmt = scrape_config.get("datePatternFormat", "MMDDYYYY")
    domain = "/".join(base_url.split("/")[:3]) if base_url else ""

    seen_urls = set()
    for m in pat.finditer(html):
        link = m.group(1).strip()
        title = m.group(2).strip()
        if not link or not title or len(title) < 10:
            continue

        # Resolve relative
        if not link.startswith("http"):
            if link.startswith("/") and domain:
                link = domain + link
            elif base_url:
                link = base_url + "/" + link.lstrip("/")

        if link in seen_urls:
            continue
        seen_urls.add(link)

        # Extract date from URL if pattern provided
        published = ""
        if date_pat:
            dm = re.search(date_pat, link)
            if dm:
                raw = dm.group(1) if dm.lastindex else dm.group(0)
                try:
                    if date_fmt == "MMDDYYYY" and len(raw) == 8:
                        mm, dd, yyyy = raw[:2], raw[2:4], raw[4:]
                        published = f"{yyyy}-{mm}-{dd}T00:00:00+00:00"
                    elif date_fmt == "YYYYMMDD" and len(raw) == 8:
                        published = f"{raw[:4]}-{raw[4:6]}-{raw[6:]}T00:00:00+00:00"
                except Exception:
                    pass
        if not published:
            published = datetime.now(timezone.utc).isoformat()

        countries = tag_countries(title, patterns)
        if source_country:
            countries.add(source_country)

        statements.append({
            "id": make_id(title, link),
            "title": title,
            "url": link,
            "source": source_id,
            "country": source_country,
            "countries": sorted(countries),
            "publishedAt": published,
            "speaker": extract_speaker(title),
            "type": classify_statement_type(title),
            "excerpt": "",
            "topics": detect_topics(title, ""),
        })

    return statements


# ---------------------------------------------------------------------------
# UN Web TV schedule scraper — daily list of meetings happening at UN HQ
# ---------------------------------------------------------------------------

def fetch_webtv_schedule(base_url, source_id, source_country, patterns):
    """Scrape today's UN Web TV schedule. Each meeting becomes a statement-like
    record with title, asset URL, category, and time of day.

    base_url should be the schedule root, e.g. https://webtv.un.org/en/schedule
    We append /YYYY-MM-DD (NY local) automatically.
    """
    from datetime import timedelta
    from zoneinfo import ZoneInfo
    today = datetime.now(ZoneInfo("America/New_York"))
    statements = _fetch_webtv_day(base_url, today, source_id, source_country, patterns)
    # Tomorrow's schedule is usually published in advance; it's a bonus, so don't fail on it
    try:
        statements += _fetch_webtv_day(base_url, today + timedelta(days=1), source_id, source_country, patterns)
    except Exception as e:
        print(f"    (tomorrow's schedule unavailable: {e})")
    return statements


def _fetch_webtv_day(base_url, now_ny, source_id, source_country, patterns):
    """Scrape one day of the UN Web TV schedule (now_ny is a NY-local datetime on that day)."""
    date_str = now_ny.strftime("%Y-%m-%d")
    url = f"{base_url.rstrip('/')}/{date_str}"

    statements = []
    data = fetch_url(url, accept="text/html")
    if not data:
        raise Exception(f"Failed to fetch {url}")
    html = data.decode("utf-8", errors="replace")

    # Each meeting row contains:
    #  - <span data-hours>HH</span> <span data-minutes>MM</span> <span data-int>am|pm</span>
    #  - <a href="/en/asset/...">
    #  - <h6 class="text-primary">Category</h6>
    #  - <div class="field__item">Title</div> inside media-asset__title
    # We split on row delimiters and parse each.
    row_pat = re.compile(
        r'data-hours[^>]*>([^<]+)</span>'        # hour
        r'.*?'
        r'data-minutes[^>]*>([^<]+)</span>'      # minute
        r'.*?'
        r'data-int[^>]*>([^<]+)</span>'          # am/pm
        r'.*?'
        r'<a[^>]+href="(/en/asset/[^"]+)"'       # asset URL (first occurrence — image link)
        r'.*?'
        r'<h6[^>]+class="[^"]*text-primary[^"]*"[^>]*>([^<]+)</h6>'  # category
        r'.*?'
        r'<div class="field__item">([^<]+)</div>',  # title
        re.DOTALL,
    )

    seen_urls = set()
    import html as _html_lib
    for m in row_pat.finditer(html):
        hh, mm, ampm, asset_url, category, title = m.groups()
        title = _html_lib.unescape(title).strip()
        category = _html_lib.unescape(category).strip()
        if not title or len(title) < 5:
            continue

        full_url = "https://webtv.un.org" + asset_url
        if full_url in seen_urls:
            continue
        seen_urls.add(full_url)

        # Build NY-local datetime
        try:
            hour = int(hh)
            minute = int(mm)
            if ampm.lower() == "pm" and hour < 12:
                hour += 12
            elif ampm.lower() == "am" and hour == 12:
                hour = 0
            dt = now_ny.replace(hour=hour, minute=minute, second=0, microsecond=0)
            published = dt.isoformat()
        except Exception:
            published = now_ny.isoformat()

        countries = tag_countries(title, patterns)
        if source_country:
            countries.add(source_country)

        statements.append({
            "id": make_id(title, full_url),
            "title": title,
            "url": full_url,
            "source": source_id,
            "country": source_country,
            "countries": sorted(countries),
            "publishedAt": published,
            "speaker": "",
            "type": category,  # e.g. "Press Conferences", "Security Council"
            "excerpt": f"{category} — {date_str}",
            "topics": detect_topics(title, ""),
        })

    return statements


# ---------------------------------------------------------------------------
# press.un.org sitemap archive
# ---------------------------------------------------------------------------

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
        s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
         .replace("&quot;", '"').replace("&#039;", "'").replace("&#8217;", "’")
         .replace("&hellip;", "…")
    )


def fetch_press_sitemap(sitemap_url, source_id, source_country, patterns, limit=30):
    """Scrape recent press.un.org releases via their Drupal Simple Sitemap.

    page=1 holds the newest 20k URLs sorted desc by lastmod. We take the top N
    and pull og:title/og:description from each landing page.
    """
    statements = []
    xml = fetch_url(sitemap_url)
    if not xml:
        raise Exception(f"Failed to fetch {sitemap_url}")

    # Drupal Simple Sitemap puts <xhtml:link> alternates between <loc> and <lastmod>,
    # so allow arbitrary content between them.
    url_pat = re.compile(
        r"<url>\s*<loc>([^<]+)</loc>.*?<lastmod>([^<]+)</lastmod>",
        re.IGNORECASE | re.DOTALL,
    )
    entries = url_pat.findall(xml.decode("utf-8", errors="replace"))
    if not entries:
        raise Exception("No URLs found in sitemap")
    # Skip the language root entries (/en, /fr) and only keep blog-style detail pages
    entries = [(u, d) for u, d in entries if "/en/" in u and u != "https://press.un.org/en"]
    entries.sort(key=lambda x: x[1], reverse=True)
    entries = entries[:limit]

    for page_url, lastmod in entries:
        html = fetch_url(page_url)
        if not html:
            continue
        text = html.decode("utf-8", errors="replace")
        title_m = _OG_TITLE_RE.search(text)
        if not title_m:
            continue
        title = _html_unescape(title_m.group(1)).strip()
        desc_m = _OG_DESC_RE.search(text)
        desc = _html_unescape(desc_m.group(1)).strip() if desc_m else ""

        try:
            dt = datetime.fromisoformat(lastmod.replace("Z", "+00:00"))
            published = dt.isoformat()
        except Exception:
            published = datetime.now(timezone.utc).isoformat()

        countries = tag_countries(f"{title} {desc}", patterns)
        statements.append({
            "id": make_id(title, page_url),
            "title": title,
            "url": page_url,
            "source": source_id,
            "country": source_country,
            "countries": sorted(countries),
            "publishedAt": published,
            "speaker": extract_speaker(title),
            "type": classify_statement_type(title),
            "excerpt": desc[:300],
            "topics": detect_topics(title, desc),
        })

    return statements


# ---------------------------------------------------------------------------
# Config load/save
# ---------------------------------------------------------------------------

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: could not read statements-config.json: {e}", file=sys.stderr)
    return None


def save_config(config):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def update_source_status(config, source_id, statement_count=0, error=None):
    for source in config.get("sources", []):
        if source["id"] == source_id:
            source["lastFetch"] = datetime.now(timezone.utc).isoformat()
            source["lastError"] = error
            source["statementCount"] = statement_count
            break


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


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


def current_ga_session():
    """General Assembly session number (a new session opens each September)."""
    now = datetime.now(timezone.utc)
    return now.year - 1945 - (1 if now.month < 9 else 0)


def main():
    print(f"Fetching diplomatic statements... ({datetime.now(timezone.utc).isoformat()})")

    country_map = build_country_map()
    patterns = compile_country_patterns(country_map)
    print(f"  Country patterns: {len(patterns)}")

    config = load_config()
    if config and config.get("sources"):
        sources = [s for s in config["sources"] if s.get("enabled", True)]
        max_statements = config.get("maxStatements", MAX_STATEMENTS)
        print(f"  Config loaded: {len(sources)} enabled sources (of {len(config['sources'])} total)")
        apply_source_meta(config["sources"], TIER_TYPE_MAP)
    else:
        print("  No config found — run the Nuxt server once to generate defaults")
        return

    all_statements = []

    for source in sources:
        if "news.google.com" in source.get("url", ""):
            time.sleep(1.0)  # be gentle with the news search service
        sid = source["id"]
        if "/pga/" in source.get("url", ""):
            # the PGA site moves to /pga/<session>/ every September
            source["url"] = re.sub(r"/pga/\d+/", f"/pga/{current_ga_session()}/", source["url"])
        stype = source.get("type", "rss")
        url = source["url"]
        name = source.get("name", sid)
        source_country = source.get("country", "")

        try:
            if stype == "html-scrape":
                scrape_cfg = source.get("scrapeConfig", {})
                if not scrape_cfg:
                    print(f"  {name}: SKIP — no scrapeConfig", file=sys.stderr)
                    update_source_status(config, sid, error="No scrapeConfig")
                    continue
                stmts = fetch_html_scrape(url, sid, source_country, scrape_cfg, patterns)
            elif stype == "press-sitemap":
                stmts = fetch_press_sitemap(url, sid, source_country, patterns)
            elif stype == "html-regex":
                scrape_cfg = source.get("scrapeConfig", {})
                stmts = fetch_html_regex(url, sid, source_country, scrape_cfg, patterns)
            elif stype == "webtv-schedule":
                stmts = fetch_webtv_schedule(url, sid, source_country, patterns)
            else:
                stmts = fetch_rss(url, sid, source_country, patterns)

            stmts = clean_search_items(stmts, source)
            all_statements.extend(stmts)
            print(f"  {name}: {len(stmts)} statements")
            update_source_status(config, sid, statement_count=len(stmts))

        except Exception as e:
            err_msg = str(e)
            print(f"  {name}: ERROR - {err_msg}", file=sys.stderr)
            update_source_status(config, sid, error=err_msg)

    # Save updated config
    save_config(config)

    # Merge with existing
    existing_by_id = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r") as f:
                existing = json.load(f)
            for s in existing.get("statements", []):
                existing_by_id[s["id"]] = s
        except Exception:
            pass

    country_flags_lookup = load_country_flags()
    now_iso = datetime.now(timezone.utc).isoformat()

    for s in all_statements:
        existing = existing_by_id.get(s["id"])
        enrich_statement(s, now_iso=now_iso, country_flags_lookup=country_flags_lookup, existing=existing)
        existing_by_id[s["id"]] = s

    # Backfill metadata on items not re-fetched this run.
    for s in existing_by_id.values():
        if "sourceTier" not in s:
            enrich_statement(s, now_iso=now_iso, country_flags_lookup=country_flags_lookup, existing=s)

    # Sort by date desc; parse to tz-aware datetime so sources in different
    # timezones compare on real instant, not raw ISO string.
    _epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)

    def _sort_key(s):
        v = s.get("publishedAt", "")
        try:
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return _epoch

    merged = sorted(existing_by_id.values(), key=_sort_key, reverse=True)
    share = config.get("maxSourceShare", 0.10)
    overrides = {src["id"]: src["maxItems"] for src in config.get("sources", []) if src.get("maxItems")}
    merged = cap_per_source(merged, max_statements, share=share, overrides=overrides)
    for item in merged:
        item["publishedAt"] = to_utc_iso(item.get("publishedAt"), item.get("publishedAt"))

    all_countries = set()
    sources_seen = set()
    for s in merged:
        all_countries.update(s.get("countries", []))
        if s.get("country"):
            all_countries.add(s["country"])
        sources_seen.add(s.get("source", ""))

    output = {
        "_meta": {
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "sources": sorted(sources_seen),
            "statement_count": len(merged),
            "country_coverage": len(all_countries),
        },
        "statements": merged,
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"  Total: {len(merged)} statements, {len(all_countries)} countries covered")
    print(f"  Written to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()

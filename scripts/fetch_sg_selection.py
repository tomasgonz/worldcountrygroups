#!/usr/bin/env python3
"""UN Secretary-General selection tracker (2025-2026 process).

Builds site/server/data/sg-selection.json from live sources (stdlib only):

  * Official UN page "Selection and Appointment of the Next Secretary-General"
    (https://www.un.org/en/sg-selection-and-appointment): nominees, nominating states,
    joint letters, vision statements, CVs, disclosures, withdrawals, dialogue dates and
    webcasts, process letters. THIS IS THE AUTHORITY for who is an official candidate.
  * Wikipedia "2026 United Nations Secretary-General selection" (MediaWiki API):
    Security Council straw poll table (leaked results; cited to 1 for 8 Billion / Reuters),
    prior experience, and the "expressed interest" / "speculated" names.
  * 1 for 8 Billion (candidates page and straw-poll index): nationality, current role,
    rumoured / ruled-out names, list of straw polls held.
  * Security Council Report (What's in Blue feed): straw-poll briefings (ballot format,
    i.e. whether colour-coded) and the monthly programme-of-work outlook.
  * PassBlue (WordPress search feed) and Google News RSS: news, poll corroboration and
    how often "also mentioned" names appear in coverage.
  * Wikidata / Wikimedia Commons: photos and citizenship for names without other data.
  * The site's own archive.db: news/statements already collected by the site.

"Also mentioned" names are people discussed in coverage as possible candidates. They are
NOT official nominees and are kept in a separate list.

The output is written atomically. If the official page cannot be read or parsed, the
previous file is left untouched and the script exits 1. Secondary sources that fail fall
back to the values from the previous run (recorded in _meta.source_status).
"""

import html
import json
import os
import re
import sqlite3
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA_DIR = os.path.join(ROOT, "site", "server", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "sg-selection.json")
ARCHIVE_DB = os.path.join(DATA_DIR, "archive.db")
PEOPLE_FILE = os.path.join(DATA_DIR, "people-index.json")
GROUPS_DIR = os.path.join(ROOT, "worldcountrygroups", "data", "groups")

UA = "WorldCountryGroups/1.0 (+https://worldcountrygroups.exe.xyz)"
WINDOW_DAYS = 60

OFFICIAL_URL = "https://www.un.org/en/sg-selection-and-appointment"
WP_TITLE = "2026 United Nations Secretary-General selection"
WP_URL = "https://en.wikipedia.org/wiki/" + WP_TITLE.replace(" ", "_")
WP_API = "https://en.wikipedia.org/w/api.php"
WD_API = "https://www.wikidata.org/w/api.php"
F8_CANDIDATES = "https://1for8billion.org/candidates-and-speculation"
F8_POLLS = "https://1for8billion.org/straw-polls-2026"
SCR_FEED = "https://www.securitycouncilreport.org/whatsinblue/feed"
SCR_SG_FEED = "https://www.securitycouncilreport.org/whatsinblue/tag/appointment-of-the-secretary-general/feed"
PASSBLUE_SEARCH = "https://passblue.com/feed/?s=" + urllib.parse.quote("secretary-general")
PASSBLUE_POLLS = "https://passblue.com/feed/?s=" + urllib.parse.quote("straw poll")

# Process documents read when this tracker was built (2026-10-05). They are static
# official letters; the facts below are quoted from them, with their URLs.
JOINT_LETTER_URL = "https://www.un.org/sg/sites/default/files/document/2025-11/pga-psc-joint-letter-2025-2026.pdf"
PSC_LETTER_URL = "https://www.un.org/pga/wp-content/uploads/sites/110/2026/05/260529_PSC-letter-to-the-PGA.pdf"
RES_79_327_URL = "https://undocs.org/en/A/RES/79/327"
CURATED_EVENTS = [
    {"date": "2025-09-05", "kind": "process", "title": "General Assembly adopts resolution 79/327 setting out the selection process",
     "url": RES_79_327_URL},
    {"date": "2026-05-29", "kind": "process",
     "title": "Security Council President informs the PGA that the Council intends to start considering candidacies between 24 and 30 July 2026",
     "url": PSC_LETTER_URL},
    {"date": "2026-12-31", "kind": "milestone", "title": "António Guterres's second term ends",
     "url": "https://www.un.org/pga/80-latest-elect/sg-selection/"},
    {"date": "2027-01-01", "kind": "milestone", "title": "Next Secretary-General takes office",
     "url": F8_CANDIDATES},
]
NOMINATION_WINDOW = {
    "opened": "2025-11-25",
    "closes": None,
    "note": ("No deadline: the joint letter invites nominations by one Member State or a group of Member States "
             "(each may nominate only one candidate), and the Security Council President's letter of 29 May 2026 says "
             "candidates may be presented 'at any stage of the process'. A nominating state may withdraw a candidate "
             "at any time and nominate another."),
    "sources": [{"name": "PGA/PSC joint letter, 25 November 2025", "url": JOINT_LETTER_URL},
                {"name": "Letter from the President of the Security Council, 29 May 2026", "url": PSC_LETTER_URL}],
}
JOINT_LETTER_NOTES = [
    {"text": ("The joint letter notes 'with regret that no woman has ever held the position of Secretary-General' and "
              "encourages Member States to strongly consider nominating women; it also notes 'the importance of regional diversity'."),
     "url": JOINT_LETTER_URL},
    {"text": ("Under an unwritten rotation among the regional groups, coverage widely regards a candidate from the Latin American "
              "and Caribbean Group (GRULAC) as favoured this time."),
     "url": WP_URL},
]

REGION_FILES = [("ag", "AG", "African Group"), ("ap", "APG", "Asia-Pacific Group"),
                ("eeg", "EEG", "Eastern European Group"),
                ("grulac", "GRULAC", "Latin American and Caribbean Group"),
                ("weog", "WEOG", "Western European and Others Group")]
COUNTRY_ALIASES = {
    "the maldives": "MDV", "turkiye": "TUR", "republic of turkiye": "TUR", "uae": "ARE",
    "united states of america": "USA", "usa": "USA", "us": "USA", "uk": "GBR", "britain": "GBR",
    "russia": "RUS", "south korea": "KOR", "republic of korea": "KOR", "north korea": "PRK",
    "bolivia (plurinational state of)": "BOL", "dr congo": "COD", "drc": "COD",
    "democratic republic of the congo": "COD", "ivory coast": "CIV", "cote d'ivoire": "CIV",
    "vietnam": "VNM", "viet nam": "VNM", "iran": "IRN", "syria": "SYR", "venezuela": "VEN",
    "tanzania": "TZA", "laos": "LAO", "moldova": "MDA", "czechia": "CZE", "czech republic": "CZE",
}

MONTHS = {m: i for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august",
                                      "september", "october", "november", "december"], 1)}

# ---------------------------------------------------------------------------- helpers

_last_host_hit = {}
source_status = {}


def log(*a):
    print(*a, flush=True)


def fetch(url, accept="text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5", tries=3, timeout=40):
    """GET with retries and a polite per-host delay. Returns bytes; raises on failure."""
    host = urllib.parse.urlsplit(url).netloc
    last = None
    for attempt in range(tries):
        wait = 1.0 - (time.time() - _last_host_hit.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        _last_host_hit[host] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept, "Accept-Language": "en"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = e
            if e.code not in (429, 500, 502, 503, 504):
                break  # 4xx (incl. bot checks): do not retry, do not work around
        except Exception as e:  # noqa: BLE001
            last = e
        time.sleep(3 * 2 ** attempt)
    raise RuntimeError(f"{url}: {last}")


def fetch_json(url):
    return json.loads(fetch(url, accept="application/json").decode("utf-8"))


def strip(s):
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s or "", flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s).replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+([.,;:!?)\]])", r"\1", s)
    return re.sub(r"([(\[])\s+", r"\1", s).strip()


def fold(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.lower().replace("-", " ").replace("’", "'")).strip()


def ordinal(n):
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", fold(s)).strip("-")


def parse_day(text, default_year=None):
    """'17 August 2026' / '20 August' / '2026-08-17' -> 'YYYY-MM-DD' or None."""
    if not text:
        return None
    t = text.strip()
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", t)
    if m:
        return m.group(0)
    m = re.search(r"(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})", t)
    if m and m.group(2).lower() in MONTHS:
        return f"{int(m.group(3)):04d}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
    m = re.search(r"([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})", t)
    if m and m.group(1).lower() in MONTHS:
        return f"{int(m.group(3)):04d}-{MONTHS[m.group(1).lower()]:02d}-{int(m.group(2)):02d}"
    m = re.search(r"(\d{1,2})\s+([A-Za-z]+)", t)
    if m and default_year and m.group(2).lower() in MONTHS:
        return f"{default_year:04d}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
    return None


def iso_utc(s):
    if not s:
        return None
    try:
        dt = parsedate_to_datetime(s)
    except Exception:  # noqa: BLE001
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:  # noqa: BLE001
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def same_person(a, b):
    """Same first name and a shared later name token (handles 'A-Baki'/'Baki', middle names)."""
    ta, tb = fold(a).replace(".", "").split(), fold(b).replace(".", "").split()
    if not ta or not tb or ta[0] != tb[0]:
        return False
    return bool({t for t in ta[1:] if len(t) >= 3} & {t for t in tb[1:] if len(t) >= 3})


def name_patterns(name):
    """Regexes that identify a person in a headline (folded text)."""
    toks = fold(name).replace(".", "").split()
    rest = [t for t in toks[1:] if len(t) >= 3]
    pats = []
    if len(rest) >= 2:
        pats.append(r"\b" + r"[\s-]".join(map(re.escape, rest)) + r"\b")
    for t in rest:
        pats.append(r"\b" + re.escape(t) + r"\b")
    return pats


# ---------------------------------------------------------------------------- countries

class Countries:
    def __init__(self):
        self.by_name, self.iso2, self.name, self.region = {}, {}, {}, {}
        with open(os.path.join(GROUPS_DIR, "un.json"), encoding="utf-8") as f:
            for c in json.load(f)["countries"]:
                self.by_name[fold(c["name"])] = c["iso3"]
                self.iso2[c["iso3"]] = c["iso2"]
                self.name[c["iso3"]] = c["name"]
        for fname, code, label in REGION_FILES:  # later files win (Turkey/Israel -> WEOG)
            try:
                with open(os.path.join(GROUPS_DIR, fname + ".json"), encoding="utf-8") as f:
                    for c in json.load(f)["countries"]:
                        if c.get("iso3"):
                            self.region[c["iso3"]] = (code, label)
            except OSError:
                pass
        self.by_name.update(COUNTRY_ALIASES)

    def resolve(self, text):
        q = fold(text).strip(" .,;:()")
        if not q:
            return None
        if q in self.by_name:
            return self.by_name[q]
        q2 = re.sub(r"^the ", "", q)
        if q2 in self.by_name:
            return self.by_name[q2]
        for n, iso in self.by_name.items():
            if len(n) > 4 and (n.startswith(q2 + ",") or n.startswith(q2 + " (")):
                return iso
        return None

    def split_list(self, text):
        """'Chile, Brazil, and Mexico' -> ['CHL','BRA','MEX'] (unresolved names dropped)."""
        whole = self.resolve(text or "")
        if whole:
            return [whole]
        out = []
        for part in re.split(r",\s*", text or ""):
            part = re.sub(r"^and\s+", "", part.strip())
            iso = self.resolve(part)
            if iso:
                out.append(iso)
                continue
            # 'Brazil and Mexico' but not 'Antigua and Barbuda' (resolved above)
            bits = part.split(" and ")
            for k in range(1, len(bits)):
                a, b = self.resolve(" and ".join(bits[:k])), self.resolve(" and ".join(bits[k:]))
                if a and b:
                    out += [a, b]
                    break
            else:
                out += [i for i in (self.resolve(b) for b in bits) if i]
        return out


# ---------------------------------------------------------------------------- official page

def parse_official(raw):
    t = raw
    nom_start = t.find("Nomination of candidates")
    dlg_start = t.find("Webcast Interactive Dialogues")
    if nom_start < 0:
        raise RuntimeError("official page: nominations section not found")
    nom = t[nom_start:dlg_start if dlg_start > nom_start else len(t)]
    text_all = strip(t)

    candidates = []
    chunks = re.split(r'<h4[^>]*class="topmargin-sm"[^>]*>', nom)[1:]
    for ch in chunks:
        head_html, _, body = ch.partition("</h4>")
        head = strip(head_html)
        m = re.match(r"(.+?)\s*\(nominated\s+([^;)]+)(?:;\s*withdrawn\s+([^)]+))?\)", head)
        if not m:
            continue
        cand = {"official_name": m.group(1).strip(), "nomination_date": parse_day(m.group(2)),
                "withdrawn_heading": parse_day(m.group(3)) if m.group(3) else None,
                "letter_url": None, "letter_symbol": None, "nominators_text": None,
                "vision_statement_url": None, "vision_statement_other": [], "cv_url": None, "disclosure_url": None,
                "withdrawals": [], "gender": None, "photo_official": None}
        pm = re.search(r'<a href="([^"]+\.(?:jpe?g|png|JPE?G|PNG))"[^>]*>\s*<img', body)
        if pm and "placeholder" not in pm.group(1):
            cand["photo_official"] = pm.group(1)
        for li in re.findall(r"<li>(.*?)</li>", body, re.S):
            href = re.search(r'href="([^"]+)"', li)
            href = href.group(1).strip() if href else None
            txt = strip(li)
            low = txt.lower()
            sym = re.search(r"\[\s*([AS]/[^\]]+?)\s*\]", txt)
            sym = sym.group(1).strip() if sym else None
            if "withdrawal of nomination" in low:
                bm = re.search(r"\bby (.+?) on (\d{1,2} \w+ \d{4})", txt)
                cand["withdrawals"].append({"by_text": bm.group(1) if bm else None,
                                            "date": parse_day(bm.group(2)) if bm else None,
                                            "url": href, "symbol": sym})
            elif "joint letter regarding the nomination" in low:
                bm = re.search(r"\)?\s+by (.+?) on (\d{1,2} \w+ \d{4})", txt)
                cand["letter_url"] = href
                cand["letter_symbol"] = sym
                if bm:
                    cand["nominators_text"] = bm.group(1)
                    cand["nomination_date"] = cand["nomination_date"] or parse_day(bm.group(2))
            elif "vision statement" in low:
                cand["vision_statement_url"] = cand["vision_statement_url"] or href
                for a in re.findall(r'href="([^"]+)"[^>]*>([^<]+)</a>', li)[1:]:
                    cand["vision_statement_other"].append({"label": strip(a[1]), "url": a[0]})
            elif re.search(r"\bcv\b|curriculum", low):
                cand["cv_url"] = cand["cv_url"] or href
            elif "financing" in low or "disclosure" in low:
                cand["disclosure_url"] = cand["disclosure_url"] or href
            if cand["gender"] is None:
                if re.match(r"(Ms|Mrs)\.?\s", txt):
                    cand["gender"] = "female"
                elif re.match(r"Mr\.?\s", txt):
                    cand["gender"] = "male"
        candidates.append(cand)
    if not candidates:
        raise RuntimeError("official page: no candidates parsed")

    # Dialogues: "<h4>Name – 20 August, 10 a.m. (EDT)</h4> ... <iframe src=...entry_id=...>"
    dialogues = []
    if dlg_start > 0:
        dlg = t[dlg_start:]
        stop = dlg.find("Communication between the Security Council")
        dlg = dlg[:stop if stop > 0 else len(dlg)]
        years = [int(y) for y in re.findall(r"\b(20\d\d)\b", strip(dlg))]
        year = max(years) if years else None
        parts = re.split(r"<h4[^>]*>", dlg)[1:]
        for p in parts:
            head_html, _, rest = p.partition("</h4>")
            head = strip(head_html)
            m = re.match(r"(.+?)\s+[–—-]\s+(\d{1,2}\s+\w+)(?:,\s*(.+))?$", head)
            if not m:
                continue
            src = re.search(r'<iframe[^>]+src="\s*([^"]+)"', rest)
            webcast = None
            if src:
                u = html.unescape(src.group(1)).strip()
                em = re.search(r"entry_id=([\w]+)", u)
                base = u.split("?")[0]
                webcast = f"{base}?iframeembed=true&entry_id={em.group(1)}" if em else u
            dialogues.append({"name": m.group(1).strip(), "date": parse_day(m.group(2), year),
                              "time": (m.group(3) or "").strip() or None, "webcast_url": webcast})

    # Process documents: links whose text ends with a "(D Month YYYY)" date
    documents = []
    seen = set()
    for href, inner in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', t, re.S):
        txt = strip(inner)
        dm = re.search(r"\((\d{1,2} \w+ \d{4})\)\s*$", txt)
        if not dm or not re.search(r"letter", txt, re.I) or href in seen:
            continue
        seen.add(href)
        documents.append({"date": parse_day(dm.group(1)), "title": txt[:dm.start()].strip(), "url": href})

    proc = {"launched": None, "town_hall": None, "handover": None}
    m = re.search(r"published on (\d{1,2} \w+ \d{4}), formally initiated", text_all)
    jl = re.search(r'href="([^"]*joint-letter[^"]*\.pdf)"[^>]*>\s*joint letter of the President', t)
    ref = re.search(r"also published as (A/\d+/\d+\s*-\s*S/\d{4}/\d+)", text_all)
    if m:
        proc["launched"] = {"date": parse_day(m.group(1)), "ref": ref.group(1).replace(" ", "") if ref else None,
                            "url": jl.group(1) if jl else JOINT_LETTER_URL}
    m = re.search(r"Town Hall[^.]*?took place on (?:\w+day, )?(\d{1,2} \w+ \d{4})", text_all, re.I)
    if m:
        proc["town_hall"] = {"date": parse_day(m.group(1)), "title": "UN Town Hall: The Next Secretary-General (General Assembly Hall)",
                             "url": OFFICIAL_URL}
    m = re.search(r"conducted the process until the end of the (\d+)\w* session on (\d{1,2} \w+ \d{4})\. In a letter to Member States dated (\d{1,2} \w+ \d{4}) \[\s*(A/\d+/\d+)\s*\].*?successor, H\.E\. (?:Mr|Ms)\. ([^,]+), President of the (\d+)\w* General Assembly", text_all)
    if m:
        proc["handover"] = {"session_end": parse_day(m.group(2)), "letter_date": parse_day(m.group(3)), "symbol": m.group(4),
                            "successor": m.group(5).strip(), "successor_session": int(m.group(6)),
                            "url": f"https://undocs.org/en/{m.group(4)}"}
    m = re.search(r"President of the General Assembly, H\.E\. (?:Ms|Mr)\. ([^,]+), conducted", text_all)
    if m and proc["handover"]:
        proc["handover"]["outgoing"] = m.group(1).strip()
    m = re.search(r"interactive dialogues are held with the nominated candidates[^.]*\.", text_all)
    proc["dialogue_summary"] = None
    m2 = re.search(r"On ([^.]*?), interactive dialogues are held with the nominated candidates and broadcast live on UN WebTV", text_all)
    if m2:
        proc["dialogue_summary"] = f"Webcast interactive dialogues in the General Assembly on {m2.group(1)}."
    return candidates, dialogues, documents, proc


# ---------------------------------------------------------------------------- Wikipedia

def wp_parse():
    q = urllib.parse.urlencode({"action": "parse", "page": WP_TITLE, "prop": "text|revid", "format": "json",
                                "redirects": 1, "formatversion": 2})
    d = fetch_json(f"{WP_API}?{q}")
    p = d.get("parse") or {}
    if not p.get("text"):
        raise RuntimeError("wikipedia: empty parse")
    return p["text"], p.get("revid")


def wp_refs(t):
    """cite_note id -> {url, text, date} (first external link of each reference)."""
    out = {}
    for m in re.finditer(r'<li id="(cite(?:_|&#95;)note-[^"]+)">(.*?)</li>', t, re.S):
        body = m.group(2)
        urls = [u for u in re.findall(r'href="(https?://[^"]+)"', body)
                if "wikipedia.org" not in u and "wikidata" not in u and "doi.org" not in u]
        # prefer the original over the web.archive.org copy
        orig = [u for u in urls if "web.archive.org" not in u]
        txt = strip(body)
        out[html.unescape(m.group(1))] = {"url": (orig or urls or [None])[0], "text": txt[:300], "date": parse_day(txt)}
    return out


def cell_refs(cell_html):
    return re.findall(r'href="#(cite_note-[^"]+)"', cell_html)


def wp_tables(t):
    return re.findall(r'<table class="wikitable[^"]*"[^>]*>(.*?)</table>', t, re.S)


def wp_rows(table):
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S):
        cells = re.findall(r"<(t[hd])([^>]*)>(.*?)(?=<t[hd][ >]|$)", tr, re.S)
        rows.append([{"tag": c[0], "attrs": c[1], "html": c[2]} for c in cells])
    return rows


def parse_wp_candidates(t, refs):
    out = []
    for table in wp_tables(t):
        rows = wp_rows(table)
        if not rows:
            continue
        hdr = [strip(c["html"]).lower() for c in rows[0]]
        if "candidate" not in hdr or "nominator" not in hdr:
            continue
        ix = {h: i for i, h in enumerate(hdr)}
        for r in rows[1:]:
            if len(r) < len(hdr) - 1:
                continue
            cell = lambda k: r[ix[k]]["html"] if k in ix and ix[k] < len(r) else ""  # noqa: E731
            c_html = cell("candidate")
            link = re.search(r'<a href="/wiki/([^"]+)"[^>]*>([^<]+)</a>', c_html)
            name = strip(link.group(2)) if link else strip(c_html)
            country = re.search(r"\(([^)]+)\)", strip(c_html))
            photo_file = re.search(r'href="/wiki/File:([^"]+)"', cell("photo"))
            prev = [strip(x) for x in re.split(r"<br\s*/?>|</li>", re.sub(r"<sup.*?</sup>", "", cell("prior experience"), flags=re.S))]
            out.append({
                "name": name,
                "wiki_title": urllib.parse.unquote(link.group(1)).replace("_", " ") if link else None,
                "country_text": country.group(1) if country else None,
                "nominator_text": strip(re.sub(r"<br\s*/?>", ", ", re.sub(r"<sup.*?</sup>", "", cell("nominator"), flags=re.S))),
                "nominated": parse_day(strip(cell("nominated"))),
                "withdrew": parse_day(strip(cell("withdrew"))) if "withdrew" in ix else None,
                "region": strip(cell("regional group")) or None,
                "previous_roles": [p for p in prev if p],
                "photo_file": urllib.parse.unquote(photo_file.group(1)) if photo_file else None,
                "refs": [refs[i]["url"] for i in cell_refs(cell("citations")) if i in refs and refs[i]["url"]],
            })
    return out


def parse_wp_polls(t, refs):
    table = None
    for m in re.finditer(r'<table class="wikitable[^"]*"[^>]*>(.*?)</table>', t, re.S):
        if "straw poll" in m.group(1).lower()[:600]:
            table = m.group(1)
            after = t[m.end():m.end() + 4000]
            break
    if not table:
        return [], {}
    # legend: colour -> meaning (only used if the P5 colour coding appears in the cells)
    legend = {}
    for lm in re.finditer(r"background(?:-color)?:\s*([#\w]+)[^>]*>(?:\s*<[^>]+>)*[^<]*</[^>]+>\s*(?:<[^>]+>\s*)*([^<]{0,160})", after):
        txt = lm.group(2).lower()
        if "encourag" in txt:
            legend[lm.group(1).lower()] = "p5_encourage"
        elif "discourag" in txt:
            legend[lm.group(1).lower()] = "p5_discourage"
    rows = wp_rows(table)
    if len(rows) < 3:
        return [], legend
    polls = []
    for c in rows[0][1:]:
        txt = strip(re.sub(r"<sup.*?</sup>", "", c["html"], flags=re.S))
        polls.append({"label": txt, "date_text": txt, "refs": [refs[i] for i in cell_refs(c["html"]) if i in refs]})
    results = [[] for _ in polls]
    coloured = [False for _ in polls]
    for r in rows[2:]:
        if not r:
            continue
        nm = re.search(r'<a href="/wiki/[^"]+"[^>]*title="([^"]+)"[^>]*>([^<]+)</a>\s*$', r[0]["html"].strip())
        name_cell = strip(r[0]["html"])
        name = strip(nm.group(2)) if nm else name_cell
        flag_alt = re.search(r'<img alt="([^"]+)"', r[0]["html"])
        cells = []
        for c in r[1:]:
            span = re.search(r'colspan="(\d+)"', c["attrs"])
            n = int(span.group(1)) if span else 1
            bg = re.search(r"background(?:-color)?:\s*([#\w]+)", c["attrs"])
            for _ in range(n):
                cells.append({"text": strip(c["html"]), "bg": bg.group(1).lower() if bg else None, "span": n})
        for pi in range(len(polls)):
            trip = cells[pi * 3:pi * 3 + 3]
            if len(trip) < 3:
                continue
            nums = []
            for c in trip:
                mm = re.match(r"^\s*(\d{1,2})\s*$", c["text"])
                nums.append(int(mm.group(1)) if mm else None)
            if None in nums:
                continue  # withdrawn / not yet nominated
            row = {"candidate": name, "country_text": flag_alt.group(1) if flag_alt else None,
                   "encourage": nums[0], "discourage": nums[1], "no_opinion": nums[2],
                   "p5_encourage": None, "p5_discourage": None}
            for c in trip:
                if c["bg"] and c["bg"] in legend:
                    row[legend[c["bg"]]] = True
                    coloured[pi] = True
            results[pi].append(row)
    out = []
    for pi, p in enumerate(polls):
        out.append({"label": p["label"], "refs": p["refs"], "results": results[pi], "wp_coloured": coloured[pi]})
    return out, legend


def parse_wp_mentions(t, refs):
    """'Expressed interest' list items and the 'Speculated' paragraph."""
    out = []
    i, j = t.find('id="Expressed_interest"'), t.find('id="Speculated"')
    k = t.find('<h2', j) if j > 0 else -1
    if i > 0 and j > i:
        for li in re.findall(r"<li>(.*?)</li>", t[i:j], re.S):
            a = re.search(r'<a [^>]*title="([^"]+?)(?: \(page does not exist\))?"[^>]*>([^<]+)</a>', li)
            if not a:
                continue
            text = strip(re.sub(r"<sup.*?</sup>", "", li, flags=re.S))
            name = strip(a.group(2))
            why = text[len(name):].lstrip(" ,") if text.startswith(name) else text
            why = why[:1].upper() + why[1:]
            if len(why) > 240:  # keep it to one line: whole sentences up to ~240 chars
                cut = [mm.end() for mm in re.finditer(r"[.;](?=\s)", why) if mm.end() <= 240]
                why = why[:cut[-1]] if cut else why[:237] + "…"
            out.append({"name": name, "wiki_title": None if "redlink" in li[:300] else a.group(1),
                        "status": "expressed_interest", "why": why,
                        "evidence": [refs[r] for r in cell_refs(li) if r in refs and refs[r]["url"]]})
    if j > 0:
        seg = t[j:k if k > j else j + 6000]
        para = re.search(r"<p>(.*?)</p>", seg, re.S)
        if para:
            ptxt = strip(re.sub(r"<sup.*?</sup>", "", para.group(1), flags=re.S))
            ev = [refs[r] for r in cell_refs(para.group(1)) if r in refs and refs[r]["url"]]
            for a in re.finditer(r'<a href="/wiki/([^"]+)"[^>]*title="([^"]+)"[^>]*>([^<]+)</a>', para.group(1)):
                name = strip(a.group(3))
                ruled = re.search(re.escape(name.split()[-1]) + r"[^.]*ruled themselves out|" + re.escape(name.split()[-1]) + r"[^.]*ruled (?:himself|herself) out", ptxt)
                out.append({"name": name, "wiki_title": a.group(2), "status": "ruled_out" if ruled else "speculated",
                            "why": "Named in press speculation about possible candidates (Wikipedia summary of coverage)" + (
                                "; has ruled themselves out" if ruled else ""),
                            "evidence": ev[:4]})
    return out


def wp_page_info(titles):
    """title -> {wikidata, description, thumb, page_url} via the query API (50 at a time)."""
    info = {}
    titles = [x for x in dict.fromkeys(titles) if x]
    for i in range(0, len(titles), 40):
        q = urllib.parse.urlencode({"action": "query", "titles": "|".join(titles[i:i + 40]), "prop": "pageimages|pageprops|description",
                                    "piprop": "thumbnail|name", "pithumbsize": 320, "ppprop": "wikibase_item",
                                    "redirects": 1, "format": "json", "formatversion": 2})
        d = fetch_json(f"{WP_API}?{q}")
        alias = {}
        for r in (d.get("query", {}).get("normalized") or []) + (d.get("query", {}).get("redirects") or []):
            alias[r["to"]] = alias.get(r["from"], r["from"])
        for p in d.get("query", {}).get("pages", []):
            if p.get("missing"):
                continue
            rec = {"wikidata": (p.get("pageprops") or {}).get("wikibase_item"), "description": p.get("description"),
                   "thumb": (p.get("thumbnail") or {}).get("source"), "image": p.get("pageimage"),
                   "page_url": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(p["title"].replace(" ", "_"))}
            info[p["title"]] = rec
            src = alias.get(p["title"])
            while src:
                info[src] = rec
                src = alias.get(src) if alias.get(src) != src else None
    return info


def commons_thumbs(files):
    """File name -> 320px thumbnail URL on upload.wikimedia.org."""
    out = {}
    files = [f for f in dict.fromkeys(files) if f]
    for i in range(0, len(files), 40):
        q = urllib.parse.urlencode({"action": "query", "titles": "|".join("File:" + f for f in files[i:i + 40]),
                                    "prop": "imageinfo", "iiprop": "url", "iiurlwidth": 320, "format": "json", "formatversion": 2})
        d = fetch_json(f"{WP_API}?{q}")
        norm = {n["to"]: n["from"] for n in d.get("query", {}).get("normalized", [])}
        for p in d.get("query", {}).get("pages", []):
            ii = (p.get("imageinfo") or [{}])[0]
            if ii.get("thumburl"):
                key = norm.get(p["title"], p["title"])
                out[key[5:] if key.startswith("File:") else key] = {"thumb": ii["thumburl"], "page": ii.get("descriptionurl")}
    return out


def wikidata_citizenship(qids, countries):
    """QID -> [iso3] from P27 (country of citizenship)."""
    qids = [q for q in dict.fromkeys(qids) if q]
    if not qids:
        return {}
    person_c = {}
    for i in range(0, len(qids), 40):
        q = urllib.parse.urlencode({"action": "wbgetentities", "ids": "|".join(qids[i:i + 40]), "props": "claims", "format": "json"})
        d = fetch_json(f"{WD_API}?{q}")
        for qid, ent in d.get("entities", {}).items():
            vals = []
            for cl in ent.get("claims", {}).get("P27", []):
                if cl.get("rank") == "deprecated":
                    continue
                v = cl.get("mainsnak", {}).get("datavalue", {}).get("value", {})
                if isinstance(v, dict) and v.get("id"):
                    vals.append(v["id"])
            person_c[qid] = vals
    cq = sorted({c for v in person_c.values() for c in v})
    iso = {}
    for i in range(0, len(cq), 40):
        q = urllib.parse.urlencode({"action": "wbgetentities", "ids": "|".join(cq[i:i + 40]), "props": "claims", "format": "json"})
        d = fetch_json(f"{WD_API}?{q}")
        for qid, ent in d.get("entities", {}).items():
            for cl in ent.get("claims", {}).get("P298", []):
                v = cl.get("mainsnak", {}).get("datavalue", {}).get("value")
                if isinstance(v, str) and v in countries.name:
                    iso[qid] = v
                    break
    return {p: [iso[c] for c in v if c in iso] for p, v in person_c.items()}


# ---------------------------------------------------------------------------- 1 for 8 Billion

def parse_f8_candidates(raw):
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", raw, flags=re.S)
    section = None
    out = []
    pat = re.compile(r'<h([12])[^>]*>(.*?)</h\1>|<div class="image-title sqs-dynamic-text"\s*>(.*?)</div>\s*</div>\s*'
                     r'(?:<div class="image-subtitle-wrapper"[^>]*>\s*<div class="image-subtitle sqs-dynamic-text"\s*>(.*?)</div>)?', re.S)
    for m in pat.finditer(t):
        if m.group(2) is not None:
            section = strip(m.group(2)).lower()
            continue
        name = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", m.group(3)))).strip()
        sub = m.group(4) or ""
        fields = {}
        for p in re.findall(r"<p[^>]*>(.*?)</p>", sub, re.S):
            km = re.match(r"\s*<strong>\s*([^<:]+?)\s*:?\s*</strong>\s*:?\s*(.*)$", p, re.S)
            if km:
                key = strip(km.group(1)).rstrip(":").lower()
                val = strip(km.group(2)).lstrip(": ")
                link = re.search(r'href="([^"]+)"', km.group(2))
                fields[key] = val
                if link:
                    fields[key + "_url"] = link.group(1)
        if name and section:
            out.append({"name": name, "section": section, **fields})
    return out


def parse_f8_polls(raw):
    out = []
    for m in re.finditer(r"Results of Security Council straw poll (\d+)\s*\|\s*(\d{1,2} \w+ \d{4})", strip(raw)):
        out.append({"n": int(m.group(1)), "date": parse_day(m.group(2))})
    note = re.search(r"Note:\s*([^.]*withdr[^.]*\.)", strip(raw))
    return sorted({p["n"]: p for p in out}.values(), key=lambda p: p["n"]), (note.group(1) if note else None)


# ---------------------------------------------------------------------------- feeds / news

SG_CTX = re.compile(r"secretary[- ]general|sec-gen|\bU\.?N\.?(?:'s)? (?:bid|candidacy|candidate|ambitions?|succession|race|gambit)|"
                    r"lead (?:the )?U\.?N\.?\b|replace Guterres|\bU\.?N\.? chief|\bUN'?s? (?:top job|top post|leadership)|top U\.?N\.? (?:job|post)|"
                    r"lead(?:er of)? the (?:U\.?N\.?|United Nations)|straw poll|head of the U\.?N\.?|next U\.?N\.? (?:head|leader)|"
                    r"Guterres'?s? successor|succe\w+ Guterres|secretaria general|secretario general|secrétaire général", re.I)
RACE = re.compile(r"\b(race|candida\w*|nominat\w*|straw poll|poll\b|bid|contender|front-?runner|succe\w+|selection|select\w*|"
                  r"campaign\w*|withdr\w*|quits?|exits?|endors\w*|backs?|vision|vie|vying|running|run for|to lead|lead the|"
                  r"top job|top post|veto|shortlist|hopefuls?|next (?:U\.?N\.? )?(?:secretary|chief|leader|head)|town hall|"
                  r"interactive dialogue|first woman|first female|woman to lead|female head|carrera|candidat\w*|ambitions?|gambit|rising|falling|"
                  r"leading|leads|ahead|deadlock|rifts?|survey)\b", re.I)
OTHER_ORGS = re.compile(r"\b(OSCE|NATO|OPEC|ASEAN|OAS|OECD|Commonwealth|Interpol|IMO|ITU|WMO|CARICOM|SADC|ECOWAS|SICA|"
                        r"Arab League|OIC|GCC|BIMSTEC|SAARC|AALCO|ICAO|UNCTAD Secretary-General Rebeca Grynspan (?:said|says|warns))\b", re.I)
UN_WORD = re.compile(r"\bU\.?N\.?\b|United Nations|Naciones Unidas|ONU\b", re.I)


def is_race_item(text):
    if not SG_CTX.search(text) or not RACE.search(text):
        return False
    if OTHER_ORGS.search(text) and not UN_WORD.search(text):
        return False
    return True


def gnews_url(q):
    return ("https://news.google.com/rss/search?q=" + urllib.parse.quote(f"{q} when:{WINDOW_DAYS}d")
            + "&hl=en-US&gl=US&ceid=US:en")


def parse_rss(data):
    out = []
    root = ElementTree.fromstring(data)
    for el in root.iter():
        if el.tag.rsplit("}", 1)[-1] not in ("item", "entry"):
            continue
        rec = {"title": "", "url": "", "date": None, "outlet": None, "summary": ""}
        for ch in el:
            n = ch.tag.rsplit("}", 1)[-1]
            txt = (ch.text or "").strip()
            if n == "title":
                rec["title"] = strip(txt)
            elif n == "link":
                rec["url"] = rec["url"] or ch.get("href") or txt
            elif n in ("pubDate", "published", "updated") and not rec["date"]:
                rec["date"] = iso_utc(txt)
            elif n == "source":
                rec["outlet"] = strip(txt) or None
            elif n in ("description", "summary", "encoded") and not rec["summary"]:
                rec["summary"] = strip(txt)[:600]
        if rec["title"] and rec["url"]:
            if rec["outlet"] and rec["title"].endswith(" - " + rec["outlet"]):
                rec["title"] = rec["title"][: -len(rec["outlet"]) - 3].strip()
            out.append(rec)
    return out


def norm_title(t):
    return re.sub(r"[^a-z0-9]+", "", fold(t))[:80]


def archive_items(since_day):
    """Race-related items already in the site's archive (read-only)."""
    if not os.path.exists(ARCHIVE_DB):
        return []
    out = []
    con = sqlite3.connect(f"file:{ARCHIVE_DB}?mode=ro", uri=True, timeout=10)
    try:
        rows = con.execute(
            "SELECT kind, outlet, title, summary, url, published_at, day FROM items WHERE day >= ? AND url <> '' AND "
            "(title LIKE '%ecretary%eneral%' OR title LIKE '%UN chief%' OR title LIKE '%U.N. chief%' OR title LIKE '%straw poll%' "
            " OR summary LIKE '%straw poll%' OR summary LIKE '%next Secretary-General%')", (since_day,)).fetchall()
    finally:
        con.close()
    for kind, outlet, title, summary, url, pub, day in rows:
        if not is_race_item(title or ""):
            continue
        out.append({"title": strip(title), "url": url, "outlet": outlet, "date": iso_utc(pub) or (day + "T00:00:00Z"),
                    "summary": strip(summary or "")[:400], "via": "archive", "kind": kind})
    return out


# ---------------------------------------------------------------------------- main build

def load_previous():
    try:
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def try_source(key, fn, *a):
    try:
        r = fn(*a)
        source_status[key] = "ok"
        return r
    except Exception as e:  # noqa: BLE001
        source_status[key] = f"failed: {str(e)[:200]}"
        log(f"  ! {key}: {e}")
        return None


def main():
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    since = (now - timedelta(days=WINDOW_DAYS)).date().isoformat()
    prev = load_previous() or {}
    countries = Countries()

    # 1) Official page (required)
    log("official UN page …")
    try:
        off_raw = fetch(OFFICIAL_URL).decode("utf-8", "replace")
        off_cands, off_dialogues, off_docs, off_proc = parse_official(off_raw)
        source_status["un_official"] = "ok"
    except Exception as e:  # noqa: BLE001
        log(f"FAILED: official page: {e}")
        sys.exit(f"Official UN selection page could not be read; {OUTPUT_FILE} left unchanged.")
    log(f"  {len(off_cands)} nominations, {len(off_dialogues)} dialogues, {len(off_docs)} documents")

    # 2) Wikipedia
    log("wikipedia …")
    wp = try_source("wikipedia", wp_parse)
    wp_cands, wp_polls, wp_mentions, revid, legend = [], [], [], None, {}
    if wp:
        wp_html, revid = wp
        refs = wp_refs(wp_html)
        wp_cands = parse_wp_candidates(wp_html, refs)
        wp_polls, legend = parse_wp_polls(wp_html, refs)
        wp_mentions = parse_wp_mentions(wp_html, refs)
        log(f"  {len(wp_cands)} candidates, {len(wp_polls)} polls, {len(wp_mentions)} mentioned names (rev {revid})")

    # 3) 1 for 8 Billion
    log("1 for 8 Billion …")
    f8 = try_source("1for8billion_candidates", lambda: parse_f8_candidates(fetch(F8_CANDIDATES).decode("utf-8", "replace"))) or []
    f8p = try_source("1for8billion_polls", lambda: parse_f8_polls(fetch(F8_POLLS).decode("utf-8", "replace")))
    f8_polls, f8_note = f8p if f8p else ([], None)
    log(f"  {len(f8)} cards, {len(f8_polls)} polls listed")

    # 4) Security Council Report feed (+ straw-poll briefings, programme of work)
    log("Security Council Report …")
    scr_items = try_source("scr_whats_in_blue", lambda: parse_rss(fetch(SCR_FEED, accept="application/rss+xml"))) or []
    scr_sg = try_source("scr_sg_tag", lambda: parse_rss(fetch(SCR_SG_FEED, accept="application/rss+xml"))) or []
    scr_polls, scr_outlook = {}, None
    ordw = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6, "seventh": 7, "eighth": 8, "ninth": 9, "tenth": 10,
            "eleventh": 11, "twelfth": 12}
    for it in scr_sg:
        tl = it["title"].lower()
        nm = re.search(r"\b(" + "|".join(ordw) + r"|\d+(?:st|nd|rd|th))\b(?:\s+[\w-]+){0,3}?\s+straw poll", tl)
        if not nm or "secretary-general" not in tl:
            continue
        n = ordw.get(nm.group(1)) or int(re.sub(r"\D", "", nm.group(1)))
        rec = {"url": it["url"], "title": it["title"], "date": (it["date"] or "")[:10], "colour_coded": None, "scheduled": None}
        prev_poll = next((x for x in ((prev.get("process") or {}).get("straw_polls") or []) if x.get("n") == n and x.get("scr_url") == it["url"]), None)
        if prev_poll and prev_poll.get("scr_colour_coded") is not None and prev_poll.get("scr_scheduled"):
            rec["colour_coded"] = prev_poll["scr_colour_coded"]
            rec["scheduled"] = prev_poll["scr_scheduled"]
        else:
            try:
                body = strip(fetch(it["url"]).decode("utf-8", "replace"))
                # the day of the vote: "Tomorrow morning (7 October)", "This afternoon (7 October)", "on 7 October"
                md = re.search(r"(?:Tomorrow|Today|This (?:morning|afternoon)|Tomorrow (?:morning|afternoon))[^(]{0,20}\((\d{1,2} [A-Z][a-z]+)\)", body) \
                    or re.search(r"straw poll[^.]{0,80}?\bon (\d{1,2} [A-Z][a-z]+)", body)
                if md:
                    try:
                        y = int(rec["date"][:4]) if rec["date"] else now.year
                        rec["scheduled"] = datetime.strptime(f"{md.group(1)} {y}", "%d %B %Y").date().isoformat()
                    except ValueError:
                        pass
                if re.search(r"no difference between the ballots|same ballots?|identical ballots|yet to begin using colou?r-coded|no distinction between the ballots", body, re.I):
                    rec["colour_coded"] = False
                elif re.search(r"(?:first|will use|using|be used)[^.]{0,80}colou?r-coded ballots|colou?r-coded ballots[^.]{0,60}(?:will be|are expected to be|were) used", body, re.I):
                    rec["colour_coded"] = True
            except Exception as e:  # noqa: BLE001
                log(f"  ! SCR article: {e}")
        scr_polls[n] = rec
    for it in scr_items:
        if "programme of work" in it["title"].lower():
            try:
                body = strip(fetch(it["url"]).decode("utf-8", "replace"))
                sents = [x.strip() for x in re.split(r"(?<=[.”])\s+(?=[A-Z])", body)
                         if re.search(r"straw poll|next Secretary-General|new Secretary-General|colou?r-coded", x)]
                if sents:
                    scr_outlook = {"text": " ".join(sents[:3])[:700], "url": it["url"], "date": (it["date"] or "")[:10], "source": "Security Council Report"}
            except Exception as e:  # noqa: BLE001
                log(f"  ! SCR programme: {e}")
            break
    log(f"  {len(scr_polls)} straw-poll briefings")

    # 5) News (Google News RSS, PassBlue search, archive)
    log("news …")
    news_raw = []

    def gather(q, tag):
        items = try_source(f"gnews:{tag}", lambda: parse_rss(fetch(gnews_url(q), accept="application/rss+xml")))
        for it in items or []:
            it["via"] = "google-news"
            it["q"] = tag
            news_raw.append(it)
        return items or []

    general_q = [
        '"secretary-general" ("straw poll" OR candidate OR candidates OR race) "United Nations"',
        '"next UN secretary-general" OR "next U.N. secretary-general"',
        '"UN chief" race candidates',
        '"Security Council" "straw poll" secretary-general',
    ]
    for i, q in enumerate(general_q):
        gather(q, f"general-{i + 1}")
    for key, url in (("passblue_search", PASSBLUE_SEARCH), ("passblue_polls", PASSBLUE_POLLS)):
        items = try_source(key, lambda u=url: parse_rss(fetch(u, accept="application/rss+xml")))
        for it in items or []:
            it["via"] = "passblue"
            it["outlet"] = "PassBlue"
            news_raw.append(it)
    for it in scr_sg + scr_items:
        news_raw.append(dict(it, via="scr", outlet="Security Council Report: What's in Blue"))
    arch = try_source("archive_db", archive_items, since) or []
    news_raw.extend(arch)

    # ------------------------------------------------------------------ candidates
    people = []
    try:
        with open(PEOPLE_FILE, encoding="utf-8") as f:
            people = json.load(f).get("people", [])
    except (OSError, ValueError):
        pass

    def people_slug(names, wiki_title=None):
        for p in people:
            if wiki_title and p.get("wikipedia") and fold(p["wikipedia"]) == fold(wiki_title):
                return p["slug"]
        for p in people:
            pn = [p.get("name", "")] + list(p.get("aliases") or [])
            if any(fold(a) == fold(b) for a in pn for b in names if a and b):
                return p["slug"]
        return None

    def find(lst, name, key="name"):
        for x in lst:
            if same_person(x[key], name):
                return x
        return None

    dlg_by = {d["name"]: d for d in off_dialogues}
    wp_titles = [c["wiki_title"] for c in wp_cands if c.get("wiki_title")] + [m["wiki_title"] for m in wp_mentions if m.get("wiki_title")]
    page_info = try_source("wikipedia_pageinfo", wp_page_info, wp_titles) or {}
    thumbs = try_source("wikimedia_commons", commons_thumbs, [c["photo_file"] for c in wp_cands if c.get("photo_file")]) or {}

    candidates = []
    discrepancies = []
    for oc in off_cands:
        wpc = find(wp_cands, oc["official_name"])
        f8c = find([x for x in f8 if "candidate" in x["section"] and ("official" in x["section"] or "withdrawn" in x["section"])], oc["official_name"])
        dlg = next((d for n, d in dlg_by.items() if same_person(n, oc["official_name"])), None)
        short = (f8c or {}).get("name") or oc["official_name"]
        cid = slugify(short)
        sources = [{"name": "UN: Selection and Appointment of the Next Secretary-General", "url": OFFICIAL_URL}]
        if oc["letter_url"]:
            sources.append({"name": f"Joint letter on the nomination ({oc['letter_symbol'] or 'PGA/PSC'})", "url": oc["letter_url"]})

        # nationality: 1 for 8 Billion "Country:" -> Wikipedia "(Country)" -> Wikidata
        nat = None
        nat_src = None
        if f8c and f8c.get("country"):
            nat = countries.resolve(re.split(r"\s*/\s*", f8c["country"])[0])
            nat_src = F8_CANDIDATES
        if not nat and wpc and wpc.get("country_text"):
            nat = countries.resolve(re.split(r"\s*/\s*", wpc["country_text"])[0])
            nat_src = WP_URL
        info = page_info.get((wpc or {}).get("wiki_title") or "", {}) if wpc else {}
        if f8c:
            sources.append({"name": "1 for 8 Billion: candidates and speculation", "url": F8_CANDIDATES})
        if wpc:
            sources.append({"name": "Wikipedia: 2026 United Nations Secretary-General selection", "url": WP_URL})

        nominators = countries.split_list(oc["nominators_text"] or "")
        withdrawals = []
        withdrawn_by = set()
        for w in oc["withdrawals"]:
            by = countries.split_list(w["by_text"] or "")
            withdrawn_by.update(by)
            withdrawals.append({"date": w["date"], "by": by, "url": w["url"], "symbol": w["symbol"]})
            if w["url"]:
                sources.append({"name": f"Joint letter on the withdrawal ({w['symbol'] or 'PGA/PSC'})", "url": w["url"]})
        withdrawn = bool(oc["withdrawn_heading"]) or (nominators and set(nominators) <= withdrawn_by)
        withdrawal_date = oc["withdrawn_heading"] or (max((w["date"] for w in withdrawals if w["date"]), default=None) if withdrawn else None)
        announced = None
        if withdrawn and f8c:
            am = re.search(r"withdr\w+ (?:from the selection process )?on (\d{1,2} \w+ \d{4})", f8c.get("section", "") + " " + (f8_note or ""))
            if am and same_person(oc["official_name"], (f8_note or "")[:60]):
                announced = parse_day(am.group(1))
            sm = re.search(r"announced withdrawal on (\d{1,2} \w+ \d{4})", f8c.get("section", ""))
            if sm:
                announced = parse_day(sm.group(1))
        region = countries.region.get(nat) if nat else None

        prev_roles = (wpc or {}).get("previous_roles") or []
        # Photo: the article's lead image; the table image only if its file name names the person
        photo = info.get("thumb")
        pf = (wpc or {}).get("photo_file")
        if pf and pf in thumbs and any(t in fold(pf.replace("_", " ")).split() for t in fold(oc["official_name"]).split()[1:] if len(t) >= 4):
            photo = thumbs[pf]["thumb"]
        slug = people_slug([oc["official_name"], short] + ([wpc["name"]] if wpc else []), (wpc or {}).get("wiki_title"))

        if wpc and wpc.get("nominated") and oc["nomination_date"] and wpc["nominated"] != oc["nomination_date"]:
            discrepancies.append(f"{short}: nomination date {oc['nomination_date']} on the UN page vs {wpc['nominated']} on Wikipedia (UN page used)")
        if f8c and f8c.get("nominated") and parse_day(f8c["nominated"]) not in (None, oc["nomination_date"]):
            discrepancies.append(f"{short}: nomination date {oc['nomination_date']} on the UN page vs {parse_day(f8c['nominated'])} on 1 for 8 Billion (UN page used)")
        if wpc and withdrawn and wpc.get("withdrew") and withdrawal_date and wpc["withdrew"] != withdrawal_date:
            discrepancies.append(f"{short}: withdrawal {withdrawal_date} per UN joint letter vs {wpc['withdrew']} on Wikipedia (UN letter used)")

        candidates.append({
            "id": cid,
            "name": short,
            "official_name": oc["official_name"],
            "slug": slug,
            "nationality": nat,
            "nationality_iso2": countries.iso2.get(nat) if nat else None,
            "nationality_name": countries.name.get(nat) if nat else ((f8c or {}).get("country") or (wpc or {}).get("country_text")),
            "nationality_note": (f8c or {}).get("country") if f8c and "/" in (f8c.get("country") or "") else None,
            "nationality_source": nat_src,
            "nominated_by": nominators,
            "nominated_by_names": [countries.name.get(i, i) for i in nominators],
            "nominated_by_iso2": [countries.iso2.get(i) for i in nominators],
            "nomination_date": oc["nomination_date"],
            "status": "withdrawn" if withdrawn else "nominated",
            "withdrawal_date": withdrawal_date,
            "withdrawal_announced": announced,
            "withdrawals": withdrawals,
            "gender": oc["gender"],
            "region_group": region[1] if region else (wpc or {}).get("region"),
            "region_group_code": region[0] if region else None,
            "current_role": (f8c or {}).get("role") or info.get("description"),
            "current_role_source": F8_CANDIDATES if (f8c or {}).get("role") else (WP_URL if info.get("description") else None),
            "previous_roles": prev_roles,
            "vision_statement_url": oc["vision_statement_url"],
            "vision_statement_other": oc["vision_statement_other"],
            "cv_url": oc["cv_url"],
            "disclosure_url": oc["disclosure_url"],
            "letter_url": oc["letter_url"],
            "letter_symbol": oc["letter_symbol"],
            "dialogue_date": (dlg or {}).get("date"),
            "dialogue_time": (dlg or {}).get("time"),
            "webcast_url": (dlg or {}).get("webcast_url"),
            "photo": photo,
            "photo_official": oc["photo_official"],
            "wikipedia_url": info.get("page_url") or ((f"https://en.wikipedia.org/wiki/{urllib.parse.quote(wpc['wiki_title'].replace(' ', '_'))}") if wpc and wpc.get("wiki_title") else None),
            "news_count_60d": 0,
            "sources": sources + [{"name": "Wikipedia citation", "url": u} for u in (wpc or {}).get("refs", [])[:3]],
            "_wiki_title": (wpc or {}).get("wiki_title"),
        })

    # Selected? Only if the official page itself says so (recommendation / appointment).
    off_text = strip(off_raw)
    for c in candidates:
        last = c["official_name"].split()[-1]
        if re.search(r"(?:recommend(?:ed|s|ing)|appoint(?:ed|s|ing))[^.]{0,120}" + re.escape(last) + r"[^.]{0,80}Secretary-General", off_text) and \
                re.search(r"resolution", off_text[max(0, off_text.find(last) - 400):off_text.find(last) + 400]):
            c["status"] = "selected"

    # ------------------------------------------------------------------ straw polls
    def match_cand(name):
        for c in candidates:
            if same_person(c["official_name"], name) or same_person(c["name"], name):
                return c
        return None

    polls = []
    year = int(today[:4])
    for i, p in enumerate(wp_polls):
        date = parse_day(p["label"], year)
        n = i + 1
        f8m = next((x for x in f8_polls if x["date"] == date), None)
        if f8m:
            n = f8m["n"]
        results = []
        for r in p["results"]:
            c = match_cand(r["candidate"])
            results.append({"candidate": c["name"] if c else r["candidate"], "candidate_id": c["id"] if c else slugify(r["candidate"]),
                            "encourage": r["encourage"], "discourage": r["discourage"], "no_opinion": r["no_opinion"],
                            "p5_encourage": r["p5_encourage"], "p5_discourage": r["p5_discourage"]})
        results.sort(key=lambda r: (-r["encourage"], r["discourage"]))
        scr = scr_polls.get(n)
        if not scr:
            pp = next((x for x in (prev.get("process", {}).get("straw_polls") or []) if x.get("n") == n and x.get("scr_url")), None)
            scr = {"url": pp["scr_url"], "colour_coded": pp.get("scr_colour_coded")} if pp else None
        scr_cc = (scr or {}).get("colour_coded")
        srcs = [{"name": r["text"][:120], "url": r["url"]} for r in p["refs"] if r.get("url")]
        srcs.append({"name": "Wikipedia straw poll table", "url": WP_URL})
        if f8m:
            srcs.append({"name": "1 for 8 Billion: UN Security Council straw polls", "url": F8_POLLS})
        scr_url = (scr or {}).get("url")
        if scr_url:
            srcs.append({"name": "Security Council Report: What's in Blue", "url": scr_url})
        total = sum(r["encourage"] + r["discourage"] + r["no_opinion"] for r in results)
        polls.append({
            "n": n, "date": date,
            "colour_coded": bool(p["wp_coloured"] or scr_cc is True),
            "ballot_note": ("Identical ballots for all 15 members: P5 votes cannot be told apart (Security Council Report)"
                            if scr_cc is False or not p["wp_coloured"] else "Colour-coded ballots: P5 votes are distinguishable"),
            "candidates_voted": len(results),
            "ballots_cast": total,
            "results": results,
            "source_url": (srcs[0]["url"] if srcs else WP_URL),
            "sources": srcs,
            "scr_url": scr_url,
            "scr_colour_coded": scr_cc,
            "results_official": False,
        })
    # Polls listed by 1 for 8 Billion but not yet in the Wikipedia table
    have = {p["date"] for p in polls}
    for fp in f8_polls:
        if fp["date"] not in have:
            polls.append({"n": fp["n"], "date": fp["date"], "colour_coded": bool((scr_polls.get(fp["n"]) or {}).get("colour_coded")),
                          "ballot_note": "Results not yet transcribed from the published image", "candidates_voted": None,
                          "ballots_cast": None, "results": [], "source_url": F8_POLLS,
                          "sources": [{"name": "1 for 8 Billion: UN Security Council straw polls", "url": F8_POLLS}],
                          "scr_url": (scr_polls.get(fp["n"]) or {}).get("url"), "results_official": False})
    for n, s in scr_polls.items():  # announced/held per SCR, not in either list
        if not any(p["n"] == n for p in polls) and s.get("date") and s["date"] <= today:
            when = s.get("scheduled") or s["date"]
            polls.append({"n": n, "date": when, "colour_coded": bool(s.get("colour_coded")),
                          "ballot_note": "Expected; results are not released officially and usually leak within hours" if when > today else "Results not yet public (they usually leak within hours of the vote)",
                          "scr_scheduled": s.get("scheduled"), "scr_colour_coded": s.get("colour_coded"),
                          "candidates_voted": None, "ballots_cast": None, "results": [], "source_url": s["url"],
                          "sources": [{"name": "Security Council Report: What's in Blue", "url": s["url"]}], "scr_url": s["url"], "results_official": False})
    if not polls and prev.get("process", {}).get("straw_polls"):
        polls = prev["process"]["straw_polls"]
        source_status["straw_polls"] = "kept from previous run"
    polls.sort(key=lambda p: (p["date"] or "", p["n"]))
    for p in polls:
        p["status"] = "results" if p.get("results") else ("expected" if (p.get("date") or "") > today else "held")
    if wp_polls and f8_polls and len(wp_polls) != len(f8_polls):
        discrepancies.append(f"Wikipedia table has {len(wp_polls)} straw polls; 1 for 8 Billion lists {len(f8_polls)}")

    for c in candidates:
        hist = []
        for p in polls:
            r = next((r for r in p["results"] if r["candidate_id"] == c["id"]), None)
            if r:
                hist.append({"n": p["n"], "date": p["date"], "encourage": r["encourage"], "discourage": r["discourage"], "no_opinion": r["no_opinion"]})
        c["poll_history"] = hist
        c["latest_poll"] = hist[-1] if hist else None

    # ------------------------------------------------------------------ also mentioned
    nominee_names = [c["official_name"] for c in candidates] + [c["name"] for c in candidates]
    mentioned = {}
    for m in wp_mentions:
        if any(same_person(m["name"], n) for n in nominee_names):
            continue
        key = slugify(m["name"])
        mentioned[key] = {"name": m["name"], "status": m["status"], "why": m["why"], "wiki_title": m.get("wiki_title"),
                          "role": None, "iso3": None, "evidence": [{"title": e["text"][:160], "url": e["url"], "date": e["date"]} for e in m["evidence"]],
                          "listed_by": ["Wikipedia"]}
    for x in f8:
        sec = x["section"]
        if not ("rumoured" in sec or "likely" in sec or "ruled out" in sec):
            continue
        if any(same_person(x["name"], n) for n in nominee_names):
            continue
        key = next((k for k, v in mentioned.items() if same_person(v["name"], x["name"])), slugify(x["name"]))
        rec = mentioned.setdefault(key, {"name": x["name"], "status": None, "why": None, "wiki_title": None, "role": None,
                                         "iso3": None, "evidence": [], "listed_by": []})
        status = "ruled_out" if "ruled out" in sec else ("likely" if "likely" in sec else "rumoured")
        if rec["status"] in (None, "speculated") or status == "ruled_out":
            rec["status"] = status
        rec["role"] = x.get("role") or rec["role"]
        if x.get("country"):
            rec["iso3"] = rec["iso3"] or countries.resolve(re.split(r"\s*/\s*", x["country"])[0])
            rec["country_text"] = x["country"]
        reason = x.get("reason ruled out")
        label = {"rumoured": "Listed as a rumoured potential candidate by 1 for 8 Billion",
                 "likely": "Listed as a likely candidate by 1 for 8 Billion",
                 "ruled_out": "Listed as ruled out by 1 for 8 Billion"}[status]
        src_name = x.get("source") or x.get("original source")
        why = label + (f" (source: {src_name})" if src_name else "") + (f": {reason}" if reason else "")
        if status == "ruled_out" or not rec["why"] or rec["why"].startswith("Named in press speculation"):
            rec["why"] = why
        u = x.get("source_url") or x.get("original source_url")
        if u:
            rec["evidence"].append({"title": f"{src_name or 'Source'} (via 1 for 8 Billion)", "url": u, "date": None})
        rec["evidence"].append({"title": "1 for 8 Billion: candidates and speculation", "url": F8_CANDIDATES, "date": None})
        if "1 for 8 Billion" not in rec["listed_by"]:
            rec["listed_by"].append("1 for 8 Billion")

    # role / nationality from Wikipedia + Wikidata where 1 for 8 Billion has none
    more_titles = [m["wiki_title"] for m in mentioned.values() if m.get("wiki_title") and m["wiki_title"] not in page_info]
    more_titles += [m["name"] for m in mentioned.values() if not m.get("wiki_title") and m["name"] not in page_info]
    if more_titles:
        page_info.update(try_source("wikipedia_pageinfo_mentions", wp_page_info, more_titles) or {})
    qids = []
    for m in mentioned.values():
        inf = page_info.get(m.get("wiki_title") or m["name"]) or {}
        m["_qid"] = inf.get("wikidata")
        if not m["role"] and inf.get("description"):
            m["role"] = inf["description"][:1].upper() + inf["description"][1:]
        m["wikipedia_url"] = inf.get("page_url")
        if not m["iso3"] and m["_qid"]:
            qids.append(m["_qid"])
    for m in mentioned.values():
        if not m["iso3"] and m.get("why"):
            cm = re.search(r"\b(?:[Oo]f|[Ff]rom) ((?:the )?[A-Z][\w'-]+(?: [A-Z][\w'-]+){0,3})", m["why"])
            iso = countries.resolve(cm.group(1)) if cm else None
            if iso:
                m["iso3"] = iso
                m["iso3_source"] = WP_URL
    cit = try_source("wikidata", wikidata_citizenship, qids, countries) or {}
    for m in mentioned.values():
        if not m["iso3"] and m.get("_qid") and cit.get(m["_qid"]):
            m["iso3"] = cit[m["_qid"]][0]
            m["iso3_source"] = f"https://www.wikidata.org/wiki/{m['_qid']}"

    # news per nominee and per mentioned name
    for c in candidates:
        last = c["name"].split()[-1]
        gather(f'"{c["name"]}" ("secretary-general" OR "UN chief")' if len(c["name"].split()) <= 3 else f'"{last}" "secretary-general"', f"cand:{c['id']}")
    for key, m in mentioned.items():
        nm = re.sub(r"\s+[A-Z]\.\s+", " ", m["name"])
        gather(f'"{nm}" ("secretary-general" OR "UN chief")', f"mention:{key}")

    cand_pats = {c["id"]: [re.compile(p) for p in name_patterns(c["official_name"]) + name_patterns(c["name"])] for c in candidates}
    ment_pats = {k: [re.compile(p) for p in name_patterns(m["name"])[:1] or [re.escape(fold(m["name"]))]] for k, m in mentioned.items()}

    def who(text, pats):
        f = fold(text)
        return [k for k, ps in pats.items() if any(p.search(f) for p in ps)]

    # dedupe and keep race items from the window. An item found by a quoted-name query
    # mentions that person (Google matched the name in the article), so it is credited to them.
    seen, news = {}, []
    for it in sorted(news_raw, key=lambda x: (x.get("via") != "archive", x.get("via") == "google-news")):
        if not it.get("date") or it["date"][:10] < since or it["date"][:10] > today:
            continue
        q = it.get("q") or ""
        qkind, _, qid = q.partition(":")
        text = it["title"] + " " + (it.get("summary", "") if it.get("via") in ("passblue", "archive", "scr") else "")
        ok = is_race_item(it["title"]) or (it.get("via") in ("passblue", "scr", "archive") and is_race_item(text))
        if not ok and qkind in ("cand", "mention"):
            pats = cand_pats.get(qid) if qkind == "cand" else ment_pats.get(qid)
            ok = bool(pats) and any(p.search(fold(it["title"])) for p in pats) and bool(SG_CTX.search(it["title"]) or RACE.search(it["title"]))
        if not ok:
            continue
        k = norm_title(it["title"])
        if k in seen:
            if qkind in ("cand", "mention"):
                seen[k]["_q"].add(q)
            continue
        it["_q"] = {q} if qkind in ("cand", "mention") else set()
        seen[k] = it
        news.append(it)
    news.sort(key=lambda x: x["date"], reverse=True)

    out_news = []
    for it in news:
        text = it["title"] + " " + (it.get("summary") or "")[:300]
        cm = who(it["title"], cand_pats) or (who(text, cand_pats) if it.get("via") in ("passblue", "archive", "scr") else [])
        mm = who(it["title"], ment_pats)
        for q in it["_q"]:
            kind, _, qid = q.partition(":")
            if kind == "cand" and qid not in cm:
                cm.append(qid)
            if kind == "mention" and qid not in mm:
                mm.append(qid)
        out_news.append({"title": it["title"], "url": it["url"], "outlet": it.get("outlet"), "date": it["date"],
                         "candidates_mentioned": cm, "also_mentioned": mm,
                         "in_headline": who(it["title"], cand_pats) + who(it["title"], ment_pats), "via": it.get("via")})
    out_news = out_news[:400]
    for c in candidates:
        c["news_count_60d"] = sum(1 for n in out_news if c["id"] in n["candidates_mentioned"])

    also = []
    for key, m in mentioned.items():
        hits = [n for n in out_news if key in n["also_mentioned"]]
        ev = m["evidence"] + [{"title": f"{h['title']} ({h['outlet'] or 'news'})", "url": h["url"], "date": h["date"][:10]} for h in hits[:5]]
        dedup, seen_u = [], set()
        for e in ev:
            if e["url"] and e["url"] not in seen_u:
                seen_u.add(e["url"])
                dedup.append(e)
        dates = sorted(e["date"] for e in dedup if e.get("date"))
        also.append({
            "name": m["name"], "id": key,
            "slug": people_slug([m["name"]], m.get("wiki_title")),
            "role": m["role"], "iso3": m["iso3"], "iso2": countries.iso2.get(m["iso3"]) if m["iso3"] else None,
            "status": m["status"], "why": m["why"], "listed_by": m["listed_by"],
            "evidence": dedup[:8], "mention_count_60d": len(hits),
            "latest_mention": hits[0]["date"][:10] if hits else None,
            "first_mentioned": dates[0] if dates else None,
            "wikipedia_url": m.get("wikipedia_url"),
        })
    order = {"likely": 0, "expressed_interest": 1, "rumoured": 2, "speculated": 3, "ruled_out": 4}
    also.sort(key=lambda a: (order.get(a["status"], 5), -a["mention_count_60d"], a["name"]))

    # ------------------------------------------------------------------ process + timeline
    launched = off_proc.get("launched") or {"date": "2025-11-25", "ref": "A/80/544-S/2025/765", "url": JOINT_LETTER_URL}
    dialogues = [{"date": c["dialogue_date"], "time": c["dialogue_time"], "candidate": c["name"], "candidate_id": c["id"],
                  "webcast_url": c["webcast_url"], "source_url": OFFICIAL_URL} for c in candidates if c["dialogue_date"]]
    dialogues.sort(key=lambda d: d["date"])

    timeline = []

    def ev(date, kind, title, url, cid=None, detail=None):
        if date:
            timeline.append({"date": date, "kind": kind, "title": title, "url": url, "candidate_id": cid, "detail": detail,
                             "upcoming": date > today})

    for e in CURATED_EVENTS:
        ev(e["date"], e["kind"], e["title"], e["url"])
    ev(launched["date"], "process", "Joint letter of the Presidents of the General Assembly and Security Council launches the process", launched["url"],
       detail=launched.get("ref"))
    for c in candidates:
        ev(c["nomination_date"], "nomination", f"{c['name']} nominated by {', '.join(c['nominated_by_names']) or 'a Member State'}", c["letter_url"] or OFFICIAL_URL, c["id"])
        for w in c["withdrawals"]:
            full = c["status"] == "withdrawn" and w["date"] == c["withdrawal_date"]
            ev(w["date"], "withdrawal",
               (f"{c['name']} withdrawn" if full else f"{', '.join(countries.name.get(i, i) for i in w['by'])} withdraws its nomination of {c['name']}"),
               w["url"] or OFFICIAL_URL, c["id"], w.get("symbol"))
        if c["withdrawal_announced"] and c["withdrawal_announced"] != c["withdrawal_date"]:
            ev(c["withdrawal_announced"], "withdrawal", f"{c['name']} announces withdrawal from the race", F8_CANDIDATES, c["id"])
    for d in dialogues:
        ev(d["date"], "dialogue", f"General Assembly interactive dialogue with {d['candidate']}", d["webcast_url"] or OFFICIAL_URL, d["candidate_id"], d["time"])
    if off_proc.get("town_hall"):
        th = off_proc["town_hall"]
        ev(th["date"], "process", th["title"], th["url"])
    for p in polls:
        lead = p["results"][0] if p["results"] else None
        ev(p["date"], "straw_poll", f"Security Council straw poll {p['n']}" + (" (colour-coded)" if p["colour_coded"] else ""),
           p["source_url"], None, (f"Most 'encourage' votes: {lead['candidate']} ({lead['encourage']} encourage, {lead['discourage']} discourage)" if lead else None))
    h = off_proc.get("handover")
    if h:
        ev(h["letter_date"], "process", f"Outgoing PGA{(' ' + h['outgoing']) if h.get('outgoing') else ''} hands the process over to her successor ({h['symbol']})", h["url"])
        ev(h["session_end"], "process", f"80th session ends; {h['successor']}, President of the {ordinal(h['successor_session'])} General Assembly, takes over the process", OFFICIAL_URL)
    if scr_outlook:
        ev(scr_outlook["date"], "process", "Security Council presidency outlook for the month", scr_outlook["url"], None, scr_outlook["text"][:300])
    timeline.sort(key=lambda e: (e["date"], e["kind"]))

    active = [c for c in candidates if c["status"] == "nominated"]
    women = sum(1 for c in active if c["gender"] == "female")
    regions = {}
    for c in active:
        regions[c["region_group"] or "Unknown"] = regions.get(c["region_group"] or "Unknown", 0) + 1
    gr_notes = [
        {"text": f"{women} of {len(active)} active nominees are women; no woman has ever been Secretary-General.", "url": OFFICIAL_URL},
        {"text": "Active nominees by regional group: " + ", ".join(f"{k} {v}" for k, v in sorted(regions.items(), key=lambda kv: -kv[1])), "url": OFFICIAL_URL},
    ] + JOINT_LETTER_NOTES

    expected = {
        "term_ends": "2026-12-31", "takes_office": "2027-01-01",
        "recommendation": None, "appointment": None,
        "outlook": scr_outlook or (prev.get("process", {}).get("expected_appointment") or {}).get("outlook"),
        "note": ("The Security Council recommends a candidate by resolution adopted in a private meeting; the General Assembly then appoints. "
                 "No date had been set when this was compiled; in 2006 and 2016 the final, colour-coded straw polls were held in early October."),
        "sources": [{"name": "Security Council Report: Fourth straw poll briefing", "url": "https://www.securitycouncilreport.org/whatsinblue/2026/09/fourth-security-council-straw-poll-on-un-secretary-general-candidates.php"},
                    {"name": "PGA/PSC joint letter, 25 November 2025", "url": JOINT_LETTER_URL}],
    }

    latest_poll = next((p for p in reversed(polls) if p["results"]), polls[-1] if polls else None)
    status_line = f"{len(active)} official candidate{'s' if len(active) != 1 else ''}"
    if any(c["status"] == "withdrawn" for c in candidates):
        status_line += f" ({sum(1 for c in candidates if c['status'] == 'withdrawn')} withdrawn)"
    if latest_poll:
        status_line += f" · straw poll {latest_poll['n']} on {latest_poll['date']}"
    sel = next((c for c in candidates if c["status"] == "selected"), None)
    if sel:
        status_line = f"{sel['name']} selected · " + status_line

    for c in candidates:
        c.pop("_wiki_title", None)

    sources = [
        {"name": "United Nations: Selection and Appointment of the Next Secretary-General", "url": OFFICIAL_URL},
        {"name": "PGA/PSC joint letter launching the process (A/80/544-S/2025/765)", "url": launched["url"]},
        {"name": "Letter from the President of the Security Council, 29 May 2026", "url": PSC_LETTER_URL},
        {"name": f"Wikipedia: {WP_TITLE}" + (f" (revision {revid})" if revid else ""), "url": WP_URL + (f"?oldid={revid}" if revid else "")},
        {"name": "1 for 8 Billion: candidates and speculation", "url": F8_CANDIDATES},
        {"name": "1 for 8 Billion: UN Security Council straw polls", "url": F8_POLLS},
        {"name": "Security Council Report: What's in Blue", "url": "https://www.securitycouncilreport.org/whatsinblue"},
        {"name": "PassBlue", "url": "https://passblue.com/"},
        {"name": "Google News RSS searches", "url": "https://news.google.com/"},
        {"name": "Wikidata / Wikimedia Commons (photos, citizenship)", "url": "https://www.wikidata.org/"},
    ]
    out = {
        "_meta": {
            "updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "status_line": status_line,
            "sources": sources,
            "source_status": source_status,
            "discrepancies": discrepancies,
            "notes": [
                "Official nominees, nominating states, letters, vision statements, CVs, dialogue dates and webcasts come from the UN page; that page is authoritative where sources disagree.",
                "Straw poll results are NOT published by the Security Council. Figures are the leaked tallies reported by 1 for 8 Billion, PassBlue, Reuters and others, as tabulated on Wikipedia.",
                "Until ballots are colour-coded, a 'discourage' vote cannot be attributed to a permanent member (possible veto).",
                "'Also mentioned' people are names discussed in coverage or by trackers as possible candidates. They are NOT official candidates unless nominated by a Member State.",
                "News: last 60 days from Google News, PassBlue, Security Council Report and the site's archive; counts are of distinct headlines.",
            ],
            "window_days": WINDOW_DAYS,
        },
        "process": {
            "launched": launched,
            "nomination_window": NOMINATION_WINDOW,
            "dialogue_summary": off_proc.get("dialogue_summary"),
            "dialogues": dialogues,
            "town_hall": off_proc.get("town_hall"),
            "handover": off_proc.get("handover"),
            "straw_polls": polls,
            "gender_and_region_notes": gr_notes,
            "expected_appointment": expected,
            "documents": sorted(off_docs, key=lambda d: d["date"] or ""),
            "timeline": timeline,
        },
        "candidates": sorted(candidates, key=lambda c: (c["status"] != "selected", c["status"] != "nominated",
                                                        -((c["latest_poll"] or {}).get("encourage") or -1), c["name"])),
        "also_mentioned": also,
        "news": out_news,
    }

    # sanity checks before replacing the file
    if not out["candidates"]:
        sys.exit("No candidates; not writing.")
    prev_polls = len((prev.get("process") or {}).get("straw_polls") or [])
    if len(polls) < prev_polls:
        log(f"  ! straw polls dropped from {prev_polls} to {len(polls)}; keeping previous poll list")
        out["process"]["straw_polls"] = prev["process"]["straw_polls"]
        source_status["straw_polls"] = "kept from previous run (fewer parsed)"

    tmp = OUTPUT_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    os.replace(tmp, OUTPUT_FILE)
    log(f"wrote {OUTPUT_FILE}: {status_line}; {len(out['also_mentioned'])} also mentioned; {len(out_news)} news items")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        log(f"FAILED: {e}")
        sys.exit(1)

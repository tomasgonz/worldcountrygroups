#!/usr/bin/env python3
"""UN election trackers: Security Council non-permanent seats and the President of the
General Assembly (PGA).

Sources (no keys, polite UA, no bot-check bypassing):
  - Wikipedia via the MediaWiki parse API: "<year> United Nations Security Council election"
    (candidates, results by round, elected members) and "President of the United Nations
    General Assembly" (list of presidents, rotation, contested elections).
  - Official UN PGA site (https://www.un.org/pga/<session>/): cross-checks the current PGA
    and the election page of the latest PGA election; probed for the next election page.
  - Security Council Report "What's in Blue" election preview (cross-check of candidates).
  - site/server/data/unsc-history.json (read only): current composition and term ends.

Output: site/server/data/un-elections.json  (atomic write; the previous file is kept if
the fetch fails; exit code 1 on failure).
Country terms served per member are NOT duplicated here: the API derives them from
unsc-history.json plus the members elected in the latest election.
"""

import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA_DIR = os.path.join(ROOT, "site", "server", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "un-elections.json")
UNSC_HISTORY = os.path.join(DATA_DIR, "unsc-history.json")
PEOPLE_INDEX = os.path.join(DATA_DIR, "people-index.json")
GROUPS_DIR = os.path.join(ROOT, "worldcountrygroups", "data", "groups")

UA = "WorldCountryGroups/1.0 (+https://worldcountrygroups.exe.xyz)"
WIKI_API = "https://en.wikipedia.org/w/api.php"
WIKI = "https://en.wikipedia.org/wiki/"
HISTORY_YEARS = 11  # elections listed in the history table (latest included)

GROUPS = {  # code -> (label, groups file)
    "AG": ("African Group", "ag.json"),
    "APG": ("Asia-Pacific Group", "ap.json"),
    "EEG": ("Eastern European Group", "eeg.json"),
    "GRULAC": ("Latin American and Caribbean Group", "grulac.json"),
    "WEOG": ("Western European and Others Group", "weog.json"),
}
GROUP_ORDER = ["AG", "APG", "EEG", "GRULAC", "WEOG"]

NAME_ALIASES = {
    "democratic republic of the congo": "COD", "dr congo": "COD", "republic of the congo": "COG",
    "congo": "COG", "ivory coast": "CIV", "cote d'ivoire": "CIV", "côte d'ivoire": "CIV",
    "south korea": "KOR", "republic of korea": "KOR", "north korea": "PRK", "russia": "RUS",
    "soviet union": "RUS", "ussr": "RUS", "united states": "USA", "united kingdom": "GBR",
    "iran": "IRN", "syria": "SYR", "laos": "LAO", "vietnam": "VNM", "viet nam": "VNM",
    "bolivia": "BOL", "venezuela": "VEN", "tanzania": "TZA", "moldova": "MDA",
    "czech republic": "CZE", "czechia": "CZE", "czechoslovakia": "CZE", "turkey": "TUR",
    "türkiye": "TUR", "turkiye": "TUR", "the gambia": "GMB", "gambia": "GMB",
    "the bahamas": "BHS", "bahamas": "BHS", "fyr macedonia": "MKD", "north macedonia": "MKD",
    "macedonia": "MKD", "yugoslavia": "SRB", "serbia and montenegro": "SRB", "east timor": "TLS",
    "timor-leste": "TLS", "cape verde": "CPV", "cabo verde": "CPV", "eswatini": "SWZ",
    "swaziland": "SWZ", "brunei": "BRN", "micronesia": "FSM", "palestine": "PSE",
    "state of palestine": "PSE", "zaire": "COD", "burma": "MMR", "myanmar": "MMR",
    "ceylon": "LKA", "united arab republic": "EGY", "byelorussian ssr": "BLR",
    "ukrainian ssr": "UKR", "kyrgyzstan": "KGZ", "slovakia": "SVK",
    "federated states of micronesia": "FSM", "saint kitts and nevis": "KNA",
    "saint vincent and the grenadines": "VCT", "saint lucia": "LCA", "sao tome and principe": "STP",
    "são tomé and príncipe": "STP", "east germany": "DEU", "west germany": "DEU", "germany": "DEU",
    "united republic of tanzania": "TZA", "federal republic of germany": "DEU",
    "venezuela": "VEN",
}

PRETTY = {  # registry (World Bank style) names that read badly in UI
    "COD": "Democratic Republic of the Congo", "COG": "Republic of the Congo", "KOR": "Republic of Korea",
    "PRK": "DPR Korea", "KGZ": "Kyrgyzstan", "RUS": "Russian Federation", "VCT": "Saint Vincent and the Grenadines",
    "KNA": "Saint Kitts and Nevis", "LCA": "Saint Lucia", "IRN": "Iran", "EGY": "Egypt", "VEN": "Venezuela",
    "GMB": "Gambia", "BHS": "Bahamas", "YEM": "Yemen", "SYR": "Syria", "LAO": "Laos", "SVK": "Slovakia",
    "TUR": "Türkiye", "CIV": "Côte d'Ivoire", "FSM": "Micronesia", "MKD": "North Macedonia", "VNM": "Viet Nam",
    "GBR": "United Kingdom", "USA": "United States",
}
NO_ISO = {"german democratic republic"}  # former states without a current code
ORD_UNITS = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6, "seventh": 7,
             "eighth": 8, "ninth": 9, "tenth": 10, "eleventh": 11, "twelfth": 12, "thirteenth": 13,
             "fourteenth": 14, "fifteenth": 15, "sixteenth": 16, "seventeenth": 17, "eighteenth": 18,
             "nineteenth": 19}
ORD_TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70,
            "eighty": 80, "ninety": 90, "twentieth": 20, "thirtieth": 30, "fortieth": 40,
            "fiftieth": 50, "sixtieth": 60, "seventieth": 70, "eightieth": 80, "ninetieth": 90}
NUM_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}

SOURCES = []  # {title, url, section}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def add_source(title, url, section):
    if not any(s["url"] == url and s["section"] == section for s in SOURCES):
        SOURCES.append({"title": title, "url": url, "section": section})


# ---------------------------------------------------------------- fetching

def http_get(url, tries=3, accept="text/html,application/json"):
    """Return (status, text). Never retries 4xx; a 202/403/429 bot check is reported, not bypassed."""
    last = None
    for i in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                body = r.read().decode("utf-8", errors="replace")
                return r.status, body
        except urllib.error.HTTPError as e:
            if 400 <= e.code < 500 and e.code != 429:
                return e.code, ""
            last = e
        except Exception as e:  # network
            last = e
        time.sleep(2 * (i + 1))
    log(f"  fetch failed {url}: {last}")
    return 0, ""


def wiki_parse(page):
    """Rendered HTML of a Wikipedia page, or None if it does not exist."""
    q = urllib.parse.urlencode({"action": "parse", "page": page, "prop": "text", "format": "json",
                                "formatversion": "2", "redirects": "1"})
    status, body = http_get(f"{WIKI_API}?{q}", accept="application/json")
    time.sleep(0.7)
    if status != 200 or not body:
        raise RuntimeError(f"Wikipedia API failed for {page} (HTTP {status})")
    d = json.loads(body)
    if d.get("error"):
        if d["error"].get("code") == "missingtitle":
            return None
        raise RuntimeError(f"Wikipedia API error for {page}: {d['error']}")
    return d["parse"]["text"]


# ---------------------------------------------------------------- html helpers

def clean(s):
    s = re.sub(r"<(style|script)\b.*?</\1>", "", s, flags=re.S)
    s = re.sub(r"<sup\b.*?</sup>", "", s, flags=re.S)
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def links(s):
    """Wiki link titles (text) in an html fragment, skipping file/flag links."""
    out = []
    for href, txt in re.findall(r'<a [^>]*href="/wiki/([^"#]+)"[^>]*>(.*?)</a>', s, flags=re.S):
        if href.startswith(("File:", "Help:", "Template")):
            continue
        out.append(clean(txt))
    return out


def cite_ids(s):
    return re.findall(r'href="#(cite_note-[^"]+)"', s.replace("&#95;", "_"))


def references(page_html):
    refs = {}
    for rid, body in re.findall(r'<li id="(cite&#95;note-[^"]+|cite_note-[^"]+)">(.*?)</li>', page_html, flags=re.S):
        rid = rid.replace("&#95;", "_")
        m = re.search(r'<span class="reference-text">(.*)', body, flags=re.S)
        txt = clean(m.group(1) if m else body)
        url = None
        um = re.search(r'class="external[^"]*" href="([^"]+)"', body)
        if um:
            url = html.unescape(um.group(1))
        refs[rid] = {"text": txt[:300], "url": url}
    return refs


def sections(page_html):
    """Split a parsed page into [(level, id, title, html)]."""
    parts = re.split(r'(<h[23] id="[^"]+"[^>]*>.*?</h[23]>)', page_html, flags=re.S)
    out = [(1, "_lead", "", parts[0])]
    for i in range(1, len(parts), 2):
        m = re.match(r'<h([23]) id="([^"]+)"[^>]*>(.*?)</h[23]>', parts[i], flags=re.S)
        out.append((int(m.group(1)), m.group(2), clean(m.group(3)), parts[i + 1] if i + 1 < len(parts) else ""))
    return out


def table_rows(table_html):
    rows = []
    for tr in re.findall(r"<tr\b.*?</tr>", table_html, flags=re.S):
        cells = re.findall(r"<t([hd])\b([^>]*)>(.*?)(?=<t[hd]\b|</tr>)", tr, flags=re.S)
        rows.append([(kind, attrs, body) for kind, attrs, body in cells])
    return rows


def to_int(s):
    s = clean(s).replace(",", "")
    m = re.match(r"^(\d+)", s)
    return int(m.group(1)) if m else None


# ---------------------------------------------------------------- countries / groups

class Countries:
    def __init__(self):
        world = json.load(open(os.path.join(GROUPS_DIR, "world.json")))
        self.names = {}
        self.by_iso3 = {}
        for c in world["countries"]:
            if c.get("iso3"):
                self.names[c["name"].lower()] = c["iso3"]
                self.by_iso3[c["iso3"]] = c
        self.group = {}
        self.unknown = set()
        for code, (_, fn) in GROUPS.items():
            for c in json.load(open(os.path.join(GROUPS_DIR, fn)))["countries"]:
                iso = c.get("iso3") or self.iso3(c.get("name", ""))
                if iso:
                    self.group.setdefault(iso, code)
        # Electoral conventions: Turkey votes with WEOG, Israel sits in WEOG, Kiribati in APG.
        self.group["TUR"] = "WEOG"
        self.group.setdefault("ISR", "WEOG")
        self.group.setdefault("USA", "WEOG")  # observer of WEOG, counted there for elections
        self.unknown = set()

    def iso3(self, name):
        n = re.sub(r"\s+", " ", (name or "").replace(" ", " ")).strip().lower()
        n = re.sub(r"^the ", "", n) if n not in self.names else n
        if n in self.names:
            return self.names[n]
        if n in NAME_ALIASES:
            return NAME_ALIASES[n]
        if n in NO_ISO:
            return None
        n2 = re.sub(r"\s*\(.*?\)", "", n).strip()
        if n2 != n and n2:
            return self.iso3(n2)
        for k, v in self.names.items():
            if k.startswith(n) or n.startswith(k):
                return v
        self.unknown.add(name)
        return None

    def name(self, iso3, fallback=None):
        """Display name: the source's own spelling when given, else a readable registry name."""
        if fallback and iso3:
            return re.sub(r"\s+", " ", fallback.replace("\u00a0", " ")).strip()
        if iso3 in PRETTY:
            return PRETTY[iso3]
        c = self.by_iso3.get(iso3)
        return c["name"] if c else fallback

    def iso2(self, iso3):
        c = self.by_iso3.get(iso3)
        return c.get("iso2") if c else None


def group_from_label(label):
    l = (label or "").lower()
    if "african" in l or l in ("africa", "ag"):
        return "AG"
    if "asia" in l or "pacific" in l:
        return "APG"
    if "eastern europ" in l or l == "eeg":
        return "EEG"
    if "latin" in l or "caribbean" in l or "grulac" in l or l == "las":
        return "GRULAC"
    if "western europ" in l or "weog" in l:
        return "WEOG"
    return None


# ---------------------------------------------------------------- Security Council

def parse_seats(lead_html):
    seats = {}
    for li in re.findall(r"<li>(.*?)</li>", lead_html, flags=re.S):
        t = clean(li)
        m = re.match(r"(One|Two|Three)\s+for\s+the\s+([^.]+)", t, flags=re.I)
        if m:
            g = group_from_label(m.group(2))
            if g:
                seats[g] = seats.get(g, 0) + NUM_WORDS[m.group(1).lower()]
    return seats


def parse_infobox(page_html, C):
    """{'Outgoing members': [...], 'Elected members': [...], 'Unsuccessful candidates': [...]}."""
    out = {}
    for blk in re.findall(r'<div class="ib-body-election-block">(.*?)(?=<div class="ib-body-election-block">|</td>)', page_html, flags=re.S):
        tm = re.search(r'ib-body-election-block-title">(.*?)</div>', blk, flags=re.S)
        if not tm:
            continue
        title = clean(tm.group(1))
        items = []
        for it in re.findall(r'<div class="ib-body-election-item">(.*?)</div>', blk, flags=re.S):
            ls = links(it)
            if not ls:
                continue
            nm = ls[0]
            iso = C.iso3(nm)
            g = group_from_label(ls[1]) if len(ls) > 1 else None
            items.append({"iso3": iso, "name": C.name(iso, nm), "group": g or C.group.get(iso)})
        out[title] = items
    # older infoboxes put unsuccessful candidates in a separate cell list
    m = re.search(r"Unsuccessful candidates</div>(.*?)</table>", page_html, flags=re.S) or \
        re.search(r"Unsuccessful candidates(.*?)</td></tr>", page_html, flags=re.S)
    if m and "Unsuccessful candidates" not in out:
        items = []
        for nm in links(m.group(1)):
            iso = C.iso3(nm)
            if iso:
                items.append({"iso3": iso, "name": C.name(iso, nm), "group": C.group.get(iso)})
        out["Unsuccessful candidates"] = items
    return out


def parse_candidates(secs, refs, C):
    """Candidates section: h3 per regional group with a <ul> of countries."""
    cands = {}
    in_cands = False
    for level, sid, title, body in secs:
        if level == 2:
            in_cands = sid.startswith("Candidates")
            if in_cands and "<ul" in body:  # flat list without sub-headings
                pass
            continue
        if not in_cands or level != 3:
            continue
        g = group_from_label(title)
        if not g:
            continue
        for li in re.findall(r"<li\b[^>]*>(.*?)</li>", body, flags=re.S):
            ls = links(li)
            if not ls:
                continue
            iso = C.iso3(ls[0])
            if not iso:
                continue
            notes = [refs[r] for r in cite_ids(li) if r in refs]
            extra = clean(re.sub(r'<a [^>]*>.*?</a>', '', li, count=1, flags=re.S))
            note = extra.strip(" ,;:-–—") or None
            cands.setdefault(g, []).append({
                "iso3": iso, "name": C.name(iso, ls[0]), "group": C.group.get(iso) or g,
                "note": note, "withdrawn": bool(note and re.search(r"withdr", note, re.I)),
                "refs": [{"text": n["text"], "url": n["url"]} for n in notes][:3],
            })
    return cands


def parse_results(secs, C):
    """Every wikitable that has a 'required majority' row → one ballot block."""
    blocks = []
    in_res = False
    for level, sid, title, body in secs:
        if level == 2:
            in_res = sid.lower().startswith("result")
        if not in_res:
            continue
        for tbl in re.findall(r'<table class="wikitable.*?</table>', body, flags=re.S):
            if "required majority" not in tbl:
                continue
            rows = table_rows(tbl)
            label = title
            cap = clean(rows[0][0][2]) if rows and rows[0] else ""
            if cap:
                label = re.sub(r"\s*election results\s*$", "", cap, flags=re.I) or title
            rounds_hdr = []
            stats = {}
            votes = []
            for r in rows[1:]:
                if not r:
                    continue
                first = clean(r[0][2])
                vals = [c[2] for c in r[1:]]
                if first.lower() in ("member", "candidate", "country") or any(re.match(r"round", clean(v), re.I) for v in vals):
                    rounds_hdr = [clean(v) for v in vals]
                    continue
                key = first.lower()
                if key in ("valid ballots", "invalid ballots", "abstentions", "present and voting",
                           "required majority", "absent", "number of members voting"):
                    stats[key] = [to_int(v) for v in vals]
                    continue
                ls = links(r[0][2])
                nm = ls[0] if ls else first
                iso = C.iso3(nm)
                votes.append({"iso3": iso, "name": C.name(iso, nm), "group": C.group.get(iso) if iso else None,
                              "votes": [to_int(v) for v in vals]})
            n = max([len(rounds_hdr)] + [len(v["votes"]) for v in votes] + [len(x) for x in stats.values()] + [0])
            rounds = []
            for i in range(n):
                def st(k):
                    a = stats.get(k) or []
                    return a[i] if i < len(a) else None
                rv = [{"iso3": v["iso3"], "name": v["name"], "group": v["group"], "votes": v["votes"][i] if i < len(v["votes"]) else None}
                      for v in votes]
                rv = [x for x in rv if x["votes"] is not None]
                rounds.append({
                    "round": i + 1,
                    "label": rounds_hdr[i] if i < len(rounds_hdr) else f"Round {i + 1}",
                    "valid_ballots": st("valid ballots"), "invalid_ballots": st("invalid ballots"),
                    "abstentions": st("abstentions"), "present_and_voting": st("present and voting"),
                    "required_majority": st("required majority"),
                    "votes": sorted(rv, key=lambda x: -(x["votes"] or 0)),
                })
            groups = sorted({v["group"] for v in votes if v["group"]}, key=GROUP_ORDER.index)
            blocks.append({"label": label, "groups": groups, "rounds": rounds})
    return blocks


def election_date(lead_html, year):
    t = clean(lead_html)
    m = re.search(r"(?:held|will be held) on ([0-9]{1,2}(?: and [0-9]{1,2})? [A-Z][a-z]+(?: \d{4})?)", t)
    if not m:
        return None
    s = m.group(1)
    if not re.search(r"\d{4}$", s):
        s += f" {year}"
    return s


def iso_date(s):
    if not s:
        return None
    m = re.match(r"(\d{1,2})(?: and \d{1,2})? ([A-Z][a-z]+) (\d{4})", s)
    if not m:
        return None
    try:
        return datetime.strptime(f"{m.group(1)} {m.group(2)} {m.group(3)}", "%d %B %Y").strftime("%Y-%m-%d")
    except ValueError:
        return None


def sc_election(year, C, terms):
    page = f"{year}_United_Nations_Security_Council_election"
    h = wiki_parse(page)
    if h is None:
        return None
    url = WIKI + page
    secs = sections(h)
    refs = references(h)
    lead = "".join(b for lvl, sid, t, b in secs if sid == "_lead")
    seats = parse_seats(lead)
    ib = parse_infobox(h, C)
    cands = parse_candidates(secs, refs, C)
    blocks = parse_results(secs, C)
    elected = ib.get("Elected members") or []
    if not elected and blocks:  # derive winners: reached the required majority in some round
        seen = set()
        for b in blocks:
            for r in b["rounds"]:
                for v in r["votes"]:
                    if r["required_majority"] and v["votes"] is not None and v["votes"] >= r["required_majority"] and v["iso3"] not in seen:
                        seen.add(v["iso3"])
                        elected.append({"iso3": v["iso3"], "name": v["name"], "group": v["group"]})
    # cross-check with unsc-history.json (terms starting the following January)
    hist_starts = {iso for iso, ts in terms.items() for a, b in ts if a in (year + 1, year + 2) and a <= year + 2}
    for e in elected:
        e["in_unsc_history"] = e["iso3"] in hist_starts if hist_starts else None
    # unsuccessful: declared candidates on the ballot who were not elected (infobox as fallback)
    elected_isos = {e["iso3"] for e in elected}
    unsuccessful, seen_u = [], set()
    cand_all = {c["iso3"] for g in cands.values() for c in g}
    for b in blocks:
        for r in b["rounds"]:
            for v in r["votes"]:
                seated_later = any(t[0] in (year + 1, year + 2) for t in terms.get(v["iso3"] or "", []))  # e.g. 2016 split term
                if v["iso3"] in cand_all and v["iso3"] not in elected_isos and not seated_later and (v["votes"] or 0) >= 5 and v["iso3"] not in seen_u:
                    seen_u.add(v["iso3"])
                    unsuccessful.append({"iso3": v["iso3"], "name": v["name"], "group": v["group"]})
    if not unsuccessful:
        unsuccessful = [u for u in (ib.get("Unsuccessful candidates") or []) if u["iso3"] not in elected_isos]
    cand_isos = {c["iso3"] for g in cands.values() for c in g}
    # flag declared candidates in result rows, add result-only candidates
    for b in blocks:
        for r in b["rounds"]:
            for v in r["votes"]:
                v["declared"] = v["iso3"] in cand_isos
    # contested: more serious candidates than seats. For a held election, a candidate counts only if it
    # received votes as a declared candidate (drops withdrawals and stale listings); else the candidate list.
    contested = {}
    on_ballot = {}
    for b in blocks:
        for r in b["rounds"]:
            for v in r["votes"]:
                if v.get("declared") and (v["votes"] or 0) >= 5 and v["group"]:
                    on_ballot.setdefault(v["group"], set()).add(v["iso3"])
    for g in set(list(seats.keys()) + list(cands.keys())):
        if not seats.get(g):
            continue
        if blocks:
            contested[g] = len(on_ballot.get(g, ())) > seats[g]
        else:
            contested[g] = len([c for c in cands.get(g, []) if not c["withdrawn"]]) > seats[g]
    # rounds per group (sum of rounds in every block that includes candidates of that group)
    rounds_by_group = {}
    for b in blocks:
        for g in b["groups"]:
            declared_rows = any(v.get("declared") and v["group"] == g for r in b["rounds"] for v in r["votes"])
            if declared_rows or not cand_isos:
                rounds_by_group[g] = rounds_by_group.get(g, 0) + sum(
                    1 for r in b["rounds"] if any(v["group"] == g and v.get("declared", True) for v in r["votes"]))
    date_s = election_date(lead, year)
    outgoing = ib.get("Outgoing members") or []
    return {
        "year": year,
        "term": f"{year + 1}–{year + 2}",
        "date": iso_date(date_s), "date_text": date_s,
        "seats": {g: seats[g] for g in GROUP_ORDER if g in seats},
        "candidates": {g: cands[g] for g in GROUP_ORDER if g in cands},
        "contested": {g: contested[g] for g in GROUP_ORDER if g in contested},
        "outgoing": outgoing,
        "elected": elected,
        "unsuccessful": unsuccessful,
        "ballots": blocks,
        "rounds_by_group": {g: rounds_by_group[g] for g in GROUP_ORDER if g in rounds_by_group},
        "source": url,
        "_held": bool(blocks) or bool(ib.get("Elected members")),
    }


def scr_crosscheck(year, election):
    """Security Council Report 'What's in Blue' preview: confirm candidate names appear."""
    url = f"https://www.securitycouncilreport.org/whatsinblue/{year}/06/security-council-elections-{year}.php"
    status, body = http_get(url, tries=1)
    if status != 200 or not body:
        return {"url": url, "status": status, "checked": False}
    text = clean(body)
    names = [c["name"] for g in election["candidates"].values() for c in g]
    missing = [n for n in names if n and n.split(" ")[0] not in text]
    add_source(f"Security Council Report: Security Council Elections {year}", url, "security_council.latest_election")
    return {"url": url, "status": status, "checked": True, "candidates_confirmed": not missing, "not_found": missing}


def composition(terms, permanent, C, year):
    members = []
    for iso in permanent:
        members.append({"iso3": iso, "name": C.name(iso), "iso2": C.iso2(iso), "permanent": True,
                        "group": C.group.get(iso), "term_start": None, "term_end": None})
    for iso, ts in terms.items():
        for a, b in ts:
            if a <= year <= b:
                members.append({"iso3": iso, "name": C.name(iso), "iso2": C.iso2(iso), "permanent": False,
                                "group": C.group.get(iso), "term_start": a, "term_end": b})
    members.sort(key=lambda m: (not m["permanent"], GROUP_ORDER.index(m["group"]) if m["group"] in GROUP_ORDER else 9, m["name"]))
    return members


# ---------------------------------------------------------------- PGA

def ordinal_to_int(words):
    w = words.lower().replace("–", "-").strip()
    parts = w.split("-")
    if len(parts) == 2 and parts[0] in ORD_TENS and parts[1] in ORD_UNITS:
        return ORD_TENS[parts[0]] + ORD_UNITS[parts[1]]
    if w in ORD_UNITS:
        return ORD_UNITS[w]
    if w in ORD_TENS:
        return ORD_TENS[w]
    return None


def parse_pga(C, people):
    page = "President_of_the_United_Nations_General_Assembly"
    h = wiki_parse(page)
    if h is None:
        raise RuntimeError("PGA Wikipedia page missing")
    url = WIKI + page
    add_source("Wikipedia: President of the United Nations General Assembly", url, "pga")
    lst = []
    for tbl in re.findall(r'<table class="wikitable.*?</table>', h, flags=re.S):
        if "Year elected" not in tbl:
            continue
        for r in table_rows(tbl):
            cells = [c for c in r]
            if len(cells) < 6 or cells[0][0] == "h":
                continue
            yr = to_int(cells[0][2])
            if not yr:
                continue
            name_html = cells[2][2]
            nl = links(name_html)
            name = nl[0] if nl else clean(re.sub(r"\(.*?\)", "", clean(name_html)))
            name = re.sub(r"\((born|\d).*$", "", name).strip()
            ctry = clean(cells[3][2])
            iso = C.iso3(ctry)
            region_raw = clean(cells[4][2])
            g = group_from_label(region_raw)
            if region_raw.upper() in ("WES", "COS", "EAS", "MES", "LAS", "EES", "AFR"):
                g = None  # pre-1963 informal regions
            sess_txt = clean(cells[5][2])
            m = re.match(r"([A-Za-z]+(?:-[a-z]+)?)", sess_txt)
            regular = None
            if m and not re.match(r"[A-Za-z-]+ (emergency )?special", sess_txt[:40]):
                regular = ordinal_to_int(m.group(1))
            lst.append({
                "year": yr, "session": regular, "sessions_text": sess_txt,
                "name": name, "country": C.name(iso, ctry) if iso else ctry, "iso3": iso, "iso2": C.iso2(iso) if iso else None,
                "region_raw": region_raw, "group": g or (C.group.get(iso) if iso else None), "group_derived": g is None,
            })
    if len(lst) < 70:
        raise RuntimeError(f"PGA list too short ({len(lst)})")
    # contested elections from the rotation paragraph
    rot_txt = ""
    for level, sid, title, body in sections(h):
        if sid.startswith("Rotation"):
            rot_txt = clean(body)
    contested = []
    for m in re.finditer(r"(?:in|In) (\w+ )?(\d{4}),? when ([^.;]+?) of ([A-Z][\w ]+?) (?:defeated|beat) ([^.;]+?) of ([A-Z][\w ]+?)(?: by)? (\d+) (?:votes )?to (\d+)", rot_txt):
        contested.append({"year": int(m.group(2)), "winner": m.group(3).strip(), "winner_country": m.group(4).strip(),
                          "runner_up": m.group(5).strip(), "runner_up_country": m.group(6).strip(),
                          "votes_winner": int(m.group(7)), "votes_runner_up": int(m.group(8))})
    for p in lst:
        c = next((x for x in contested if x["year"] == p["year"]), None)
        p["contested"] = bool(c)
        if c:
            p["vote"] = c
    # people links
    by_name = {}
    for pp in people.get("people", []):
        by_name.setdefault(pp["name"].lower(), pp)
    for p in lst:
        pp = by_name.get(p["name"].lower())
        if pp and pp.get("slug"):
            p["person_slug"] = pp["slug"]

    regular = [p for p in lst if p["session"]]
    regular.sort(key=lambda p: p["session"])
    cur = regular[-1]
    # rotation: the modern 5-group cycle — session s is held by the group of session s-5
    by_sess = {p["session"]: p for p in regular}
    nxt_session = cur["session"] + 1
    prev5 = by_sess.get(nxt_session - 5)
    next_group = prev5["group"] if prev5 and not prev5["group_derived"] else None
    rotation = []
    for s in range(cur["session"] - 4, cur["session"] + 6):
        ref = by_sess.get(s) or by_sess.get(s - 5) or by_sess.get(s - 10)
        held = by_sess.get(s)
        rotation.append({"session": s, "year": 1945 + s, "group": ref["group"] if ref else None,
                         "president": held["name"] if held else None, "country": held["country"] if held else None,
                         "iso3": held["iso3"] if held else None, "status": "past" if s < cur["session"] else ("current" if s == cur["session"] else "upcoming")})
    return lst, cur, nxt_session, next_group, rotation, rot_txt


def ordsuf(n):
    return {1: "st", 2: "nd", 3: "rd"}.get(n % 10 if n % 100 not in (11, 12, 13) else 0, "th")


def pga_official(session, cur):
    """Cross-check the current PGA on https://www.un.org/pga/<session>/ and the election page."""
    out = {"verified": False}
    url = f"https://www.un.org/pga/{session}/"
    status, body = http_get(url, tries=2)
    if status == 200 and body:
        text = clean(body)
        surname = cur["name"].split()[-1]
        out["verified"] = surname in text
        out["official_url"] = url
        m = re.search(r"elected President of the [a-z-]+ session on (\d{1,2} [A-Z][a-z]+ \d{4})", text)
        if m:
            out["elected_on"] = iso_date(m.group(1))
        add_source(f"UN: Office of the President of the General Assembly ({session}{ordsuf(session)} session)", url, "pga.current")
    ep = f"https://www.un.org/pga/{session - 1}/election-of-the-president-of-the-united-nations-general-assembly-at-its-{session}{ordsuf(session)}-session/"
    status, body = http_get(ep, tries=2)
    if status == 200 and body:
        text = clean(body)
        out["election_url"] = ep
        m = re.search(r"session on \w+day, (\d{1,2} [A-Z][a-z]+ \d{4})", text)
        if m:
            out["elected_on"] = out.get("elected_on") or iso_date(m.group(1))
        cands = re.findall(r"H\.E\. (?:Mr\.|Ms\.|Mrs\.|Dr\.) ([A-Z][\w.\- ]+?) ((?:People’s Republic of |Republic of |Kingdom of |State of )?[A-Z][a-z]+(?: [A-Z][a-z]+)*) Bio", text)
        out["candidates"] = [{"name": n.strip(), "country": c.strip()} for n, c in cands]
        add_source(f"UN: Election of the President of the General Assembly at its {session}{ordsuf(session)} session", ep, "pga.current")
    return out


def pga_next_official(next_session):
    """Probe the official PGA site for the next election page; never guess candidates."""
    cur = next_session - 1
    suffix = ordsuf(next_session)
    tried = []
    for url in (f"https://www.un.org/pga/{cur}/election-of-the-president-of-the-united-nations-general-assembly-at-its-{next_session}{suffix}-session/",
                f"https://www.un.org/pga/{cur}/pga{next_session}election/"):
        status, body = http_get(url, tries=1)
        tried.append({"url": url, "status": status})
        if status == 200 and body:
            text = clean(body)
            cands = re.findall(r"H\.E\. (?:Mr\.|Ms\.|Mrs\.|Dr\.) ([A-Z][\w.\- ]+?) ((?:Republic of |Kingdom of |State of )?[A-Z][a-z]+(?: [A-Z][a-z]+)*) Bio", text)
            add_source(f"UN: Election of the President of the General Assembly at its {next_session}{suffix} session", url, "pga.next")
            return {"url": url, "candidates": [{"name": n.strip(), "country": c.strip()} for n, c in cands], "tried": tried}
    return {"url": None, "candidates": [], "tried": tried}


# ---------------------------------------------------------------- main

def build():
    C = Countries()
    hist = json.load(open(UNSC_HISTORY))
    terms = hist["terms"]
    permanent = hist.get("permanent", ["CHN", "FRA", "RUS", "GBR", "USA"])
    try:
        people = json.load(open(PEOPLE_INDEX))
    except Exception:
        people = {"people": []}
    now = datetime.now(timezone.utc)
    this_year = now.year
    notes = []

    # --- Security Council elections: walk back from next year until we have enough held elections
    elections = {}
    for y in range(this_year + 1, this_year - HISTORY_YEARS - 1, -1):
        e = sc_election(y, C, terms)
        if e:
            elections[y] = e
            add_source(f"Wikipedia: {y} United Nations Security Council election", e["source"], "security_council")
    held = sorted([y for y, e in elections.items() if e["_held"]], reverse=True)
    if not held:
        raise RuntimeError("no Security Council election results parsed")
    latest_y = held[0]
    latest = elections[latest_y]
    if len(latest["elected"]) < 4 or not latest["ballots"]:
        raise RuntimeError(f"latest SC election {latest_y} parsed badly: {len(latest['elected'])} elected, {len(latest['ballots'])} ballots")
    latest["scr_check"] = scr_crosscheck(latest_y, latest)
    nxt = elections.get(latest_y + 1)
    if nxt is None:
        notes.append(f"No Wikipedia page yet for the {latest_y + 1} Security Council election")
    else:
        nxt.pop("ballots", None)
        nxt["status"] = "upcoming"
        nxt["date_note"] = nxt["date_text"] or f"June {latest_y + 1} (expected; the GA usually votes in early June)"
        nxt["verified"] = False
        nxt["verification_note"] = ("Candidacies are announced years ahead and change; listed as recorded on Wikipedia "
                                    "with the citation given there. Not confirmed by UN sources.")
        for g in GROUP_ORDER:
            if nxt["seats"].get(g) and not nxt["candidates"].get(g):
                nxt["contested"][g] = None
    # Arab swing seat note (informal 1967 understanding)
    swing = ("By informal agreement one seat alternates between the African and Asia-Pacific Groups for an Arab state "
             "(the 'Arab swing seat').")
    for y in held[:HISTORY_YEARS]:
        e = elections[y]
        if len(e["elected"]) < 4:
            notes.append(f"{y}: only {len(e['elected'])} elected members parsed")

    history = []
    for y in held[:HISTORY_YEARS]:
        e = elections[y]
        history.append({
            "year": y, "term": e["term"], "date": e["date"], "seats": e["seats"],
            "elected": [{"iso3": x["iso3"], "name": x["name"], "group": x["group"]} for x in e["elected"]],
            "unsuccessful": [{"iso3": x["iso3"], "name": x["name"], "group": x["group"]} for x in e["unsuccessful"]],
            "contested_groups": [g for g, v in e["contested"].items() if v],
            "rounds_by_group": e["rounds_by_group"],
            "max_rounds": max(e["rounds_by_group"].values() or [0]),
            "source": e["source"],
        })

    latest_out = {k: v for k, v in latest.items() if not k.startswith("_")}
    latest_out["status"] = "held"
    latest_out["verified"] = bool(latest_out["scr_check"].get("candidates_confirmed")) and all(e.get("in_unsc_history") is not False for e in latest_out["elected"])
    nxt_out = {k: v for k, v in (nxt or {}).items() if not k.startswith("_")} if nxt else None

    comp = composition(terms, permanent, C, this_year)
    if sum(1 for m in comp if not m["permanent"]) != 10:
        notes.append(f"Composition for {this_year} has {sum(1 for m in comp if not m['permanent'])} elected members in unsc-history.json")
    incoming = [{"iso3": x["iso3"], "name": x["name"], "iso2": C.iso2(x["iso3"]), "group": x["group"],
                 "term_start": latest_y + 1, "term_end": latest_y + 2} for x in latest["elected"]]
    add_source("unsc-history.json (UN Security Council official records; site data)", "https://www.un.org/securitycouncil/content/current-members", "security_council.composition")

    # --- PGA
    lst, cur, nxt_session, next_group, rotation, rot_txt = parse_pga(C, people)
    off = pga_official(cur["session"], cur)
    nxt_off = pga_next_official(nxt_session)
    current = dict(cur)
    current.update({
        "term": f"September {1945 + cur['session']} – September {1946 + cur['session']}",
        "official_url": off.get("official_url"), "verified_official": off.get("verified", False),
        "elected_on": off.get("elected_on"), "election_url": off.get("election_url"),
        "election_candidates": off.get("candidates") or None,
    })
    if not current["verified_official"]:
        notes.append(f"Current PGA ({cur['name']}) could not be confirmed on the official un.org/pga/{cur['session']}/ site")
    next_pga = {
        "session": nxt_session, "year": 1945 + nxt_session,
        "group": next_group, "group_label": GROUPS[next_group][0] if next_group else None,
        "rule": "The presidency rotates annually among the five regional groups; the group whose turn it is normally agrees on one candidate.",
        "election_expected": f"early June {1945 + nxt_session} (rule 30: at least three months before the session opens)",
        "session_opens_expected": None,
        "candidates": nxt_off["candidates"],
        "candidates_source": nxt_off["url"],
        "candidates_note": None if nxt_off["candidates"] else
            f"No candidates listed on the official PGA site as of {now.strftime('%Y-%m-%d')} (checked: " + ", ".join(t["url"] for t in nxt_off["tried"]) + ").",
        "verified": bool(nxt_off["url"]),
    }
    eeg_rule = "Every five years in the years ending in 2 and 7, the Eastern European Group" if next_group == "EEG" else None
    if eeg_rule:
        next_pga["rule_detail"] = "The Eastern European Group holds the presidency in years ending in 2 and 7."

    out = {
        "_meta": {
            "updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sources": SOURCES,
            "notes": notes + [
                swing,
                "Results, candidates and winners are parsed from Wikipedia election pages; the latest election is cross-checked "
                "against Security Council Report and unsc-history.json (see verified flags).",
                "Groups follow UN electoral practice: Türkiye votes with WEOG, Israel sits in WEOG, the USA is a WEOG observer.",
                "Other GA elections (ECOSOC, Human Rights Council) are not tracked yet.",
            ],
            "unmatched_countries": sorted(C.unknown),
        },
        "groups": {g: GROUPS[g][0] for g in GROUP_ORDER},
        "security_council": {
            "year": this_year,
            "composition": comp,
            "incoming": incoming,
            "latest_election": latest_out,
            "next_election": nxt_out,
            "history": history,
        },
        "pga": {
            "current": current,
            "next": next_pga,
            "rotation": rotation,
            "contested_text": rot_txt[:1200],
            "list": sorted(lst, key=lambda p: (p["year"], p["session"] or 0)),
        },
    }
    add_iso2(out, C)
    return out


def add_iso2(node, C):
    """Give every country record an iso2 (for flags)."""
    if isinstance(node, dict):
        if node.get("iso3") and "iso2" not in node:
            node["iso2"] = C.iso2(node["iso3"])
        for v in node.values():
            add_iso2(v, C)
    elif isinstance(node, list):
        for v in node:
            add_iso2(v, C)


def main():
    try:
        out = build()
    except Exception as e:
        log(f"ERROR: {e}; keeping previous {os.path.basename(OUTPUT_FILE)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    tmp = OUTPUT_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    os.replace(tmp, OUTPUT_FILE)
    sc = out["security_council"]
    le = sc["latest_election"]
    log(f"Wrote {OUTPUT_FILE}: SC latest {le['year']} elected {[e['name'] for e in le['elected']]}; "
        f"history {len(sc['history'])}; PGA list {len(out['pga']['list'])}; current {out['pga']['current']['name']}; "
        f"next PGA group {out['pga']['next']['group']}")


if __name__ == "__main__":
    main()

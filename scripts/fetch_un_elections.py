#!/usr/bin/env python3
"""UN election trackers: Security Council non-permanent seats, the President of the General
Assembly (PGA), the Human Rights Council (hrc), ECOSOC (ecosoc) and the International Court of
Justice (icj).

Sources (no keys, polite UA, no bot-check bypassing):
  - Wikipedia via the MediaWiki parse API: "<year> United Nations Security Council election"
    (candidates, results by round, elected members) and "President of the United Nations
    General Assembly" (list of presidents, rotation, contested elections).
  - Official UN PGA site (https://www.un.org/pga/<session>/): cross-checks the current PGA
    and the election page of the latest PGA election; probed for the next election page.
  - Security Council Report "What's in Blue" election preview (cross-check of candidates).
  - site/server/data/unsc-history.json (read only): current composition and term ends.
  - HRC: OHCHR membership by regional group (official), the GA "Elections and appointments" page per
    session (https://www.un.org/en/ga/<session>/meetings/elections/hrc.shtml: candidates, seats,
    winners) and ISHR's #HRCelections<year> campaign page (election date, final vote tally).
  - ECOSOC: Wikipedia current-members table (terms) cross-checked with the UN Dag Hammarskjöld
    Library membership-by-year list; the latest June election is recorded in ECOSOC_ELECTIONS
    (press reports; press.un.org has a bot check) and cross-checked live.
  - ICJ: https://www.icj-cij.org/current-members (judges, roles, term starts -> term ends), Wikipedia
    "<year> International Court of Justice judges election" (GA and Security Council rounds), and
    ICJ_NEXT_CANDIDATES / ICJ_BY_ELECTIONS (sourced, cross-checked) until official pages exist.

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
    "venezuela": "VEN", "republic of moldova": "MDA", "lao people's democratic republic": "LAO",
    "iran (islamic republic of)": "IRN", "syrian arab republic": "SYR", "united states of america": "USA",
    "korea": "KOR", "south korea": "KOR", "the netherlands": "NLD", "britain": "GBR",
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
        n = re.sub(r"\s+", " ", (name or "").replace(" ", " ").replace("’", "'")).strip().lower()
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
    for fmt in ("%d %B %Y", "%d %b %Y"):
        try:
            return datetime.strptime(f"{m.group(1)} {m.group(2)} {m.group(3)}", fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
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


# ---------------------------------------------------------------- shared (HRC / ECOSOC / ICJ)

GA_MEMBERS = 193
GA_ABS_MAJORITY = GA_MEMBERS // 2 + 1   # 97: "majority of the members of the General Assembly"
SC_ABS_MAJORITY = 8                    # ICJ Statute art. 10: absolute majority of the 15 Council members


def page_text(h):
    return clean(h or "")


def country(C, name, group=None):
    """Country record from a free-text name (official UN spellings accepted)."""
    nm = re.sub(r"\s*\*+\s*$", "", re.sub(r"\s+", " ", (name or "").replace(" ", " "))).strip()
    nm = re.sub(r"^(the|and) ", "", nm, flags=re.I)
    iso = C.iso3(nm)
    return {"iso3": iso, "name": C.name(iso) if iso in PRETTY else (nm or C.name(iso)), "group": group or C.group.get(iso)}


def split_names(s):
    """'A, B, United Kingdom of Great Britain and Northern Ireland, and C' -> names (commas only; 'and' joins the last)."""
    parts = [re.sub(r"^and\s+", "", x.strip()) for x in s.strip().rstrip(".").split(",")]
    if len(parts) == 1 and " and " in parts[0]:
        parts = parts[0].split(" and ")
    return [x for x in parts if x]


def by_group(items):
    out = {}
    for it in items:
        if it.get("group"):
            out.setdefault(it["group"], []).append(it)
    return {g: out[g] for g in GROUP_ORDER if g in out}


# ---------------------------------------------------------------- Human Rights Council

HRC_SEATS = {"AG": 13, "APG": 13, "EEG": 6, "GRULAC": 8, "WEOG": 7}
OHCHR_BY_GROUP = "https://www.ohchr.org/en/hr-bodies/hrc/members-by-group"
OHCHR_ELECTIONS = "https://www.ohchr.org/en/hr-bodies/hrc/hrc-elections"


def hrc_members(C):
    """Official current membership (OHCHR, by regional group, with the year each term expires)."""
    status, body = http_get(OHCHR_BY_GROUP, tries=2)
    if status != 200 or not body:
        raise RuntimeError(f"OHCHR membership page unavailable (HTTP {status})")
    t = page_text(body)
    ym = re.search(r"Membership of the Human Rights Council, 1 January - 31 December (\d{4})", t)
    i = t.find("TERM EXPIRES IN")
    j = t.find("second consecutive term", i)
    seg = t[i + len("TERM EXPIRES IN"): j if j > 0 else None]
    parts = re.split(r"(AFRICAN|ASIA-PACIFIC|EASTERN EUROPEAN|LATIN AMERICAN AND CARIBBEAN|WESTERN EUROPEAN AND OTHER) STATES \((\d+)\)", seg)
    members = []
    for k in range(1, len(parts) - 2, 3):
        g = group_from_label(parts[k].lower() if parts[k] != "ASIA-PACIFIC" else "asia")
        for nm, star, yr in re.findall(r"\s*(.+?)(\*?)\s*\((\d{4})\)", parts[k + 2]):
            c = country(C, nm, g)
            c.update({"term_end": int(yr), "second_term": bool(star)})
            members.append(c)
    if len(members) != 47:
        raise RuntimeError(f"HRC membership parsed {len(members)} members, expected 47")
    add_source("OHCHR: Membership of the Human Rights Council by regional group", OHCHR_BY_GROUP, "hrc.members")
    return (int(ym.group(1)) if ym else None), members


def hrc_ga_page(session, C):
    """GA 'Elections and appointments' page for the HRC election held during a session (None if absent)."""
    url = f"https://www.un.org/en/ga/{session}/meetings/elections/hrc.shtml"
    status, body = http_get(url, tries=2)
    if status != 200 or "Human Rights Council" not in body:
        return None
    t = page_text(body)
    out = {"session": session, "url": url}
    dm = re.search(r"Election of the Human Rights Council: (\S+ [A-Z][a-z]+ \d{4})", t)
    out["date_text"] = dm.group(1) if dm else None
    out["date"] = iso_date(out["date_text"]) if dm else None
    tm = re.search(r"Candidates to the election for the term (\d{4})\s*[-–]\s*(\d{4})", t)
    if not tm:
        return None
    out["term_start"], out["term_end"] = int(tm.group(1)), int(tm.group(2))
    em = re.search(r"On (\d{1,2} [A-Z][a-z]+ \d{4}), the General Assembly elected the following (\d+) members for a three-year term (?:of office )?beginning on 1 January (\d{4}): (.+?)(?= In accordance| Member States who)", t)
    out["elected"] = []
    if em and int(em.group(3)) == out["term_start"]:
        out["held_on"] = iso_date(em.group(1))
        out["elected"] = [country(C, n) for n in split_names(em.group(4))]
    # candidates table: one column per regional group, header "<Group> (N vacant seats)"
    hi = body.find("Candidates to the election")
    tbl = re.search(r"<table.*?</table>", body[hi:], flags=re.S)
    notes = {}
    for num, txt in re.findall(r"<sup>\s*(\d+)(?:&nbsp;|\s)*</sup>\s*([^<]+)", body[hi:hi + (tbl.end() if tbl else 0) + 1500]):
        if "endorsed" in txt.lower():
            notes[num] = clean(txt)
    seats, cands, cols = {}, {}, []
    if tbl:
        rows = table_rows(tbl.group(0))
        for kind, attrs, cell in (rows[0] if rows else []):
            lab = clean(cell)
            g = group_from_label(lab)
            sm = re.search(r"\((\d+) vacant seats?\)", lab)
            cols.append(g)
            if g and sm:
                seats[g] = int(sm.group(1))
        for r in rows[1:]:
            for ci, (kind, attrs, cell) in enumerate(r):
                g = cols[ci] if ci < len(cols) else None
                sups = re.findall(r"<sup>\s*(\d+)\s*</sup>", cell)
                pledge = re.search(r'href="([^"]+)"[^>]*>\s*\[(A/[^\]]+)\]', cell)
                nm = clean(re.sub(r"<sup>.*?</sup>|<a\b.*?</a>", "", cell, flags=re.S))
                if not nm or not g:
                    continue
                c = country(C, nm, g)
                c["endorsed_by_group"] = any("endorsed" in notes.get(x, "").lower() for x in sups)
                c["pledge"] = {"symbol": pledge.group(2), "url": html.unescape(pledge.group(1))} if pledge else None
                cands.setdefault(g, []).append(c)
    out["seats"] = {g: seats[g] for g in GROUP_ORDER if g in seats}
    out["candidates"] = {g: cands[g] for g in GROUP_ORDER if g in cands}
    out["held"] = bool(out["elected"])
    # current members table ("Name (YYYY) *": asterisk = second consecutive term)
    mi = body.find("List of current members")
    mt = re.search(r"<table.*?</table>", body[mi:], flags=re.S) if mi > 0 else None
    out["second_term"] = set()
    if mt:
        for m in re.finditer(r"([^<>()]+?(?:\([^()]*\))?)\s*\((\d{4})\)\s*\*", clean(re.sub(r"</t[dh]>", " | ", mt.group(0))).replace("|", "\n")):
            c = country(C, m.group(1).strip(" |"))
            if c["iso3"]:
                out["second_term"].add(c["iso3"])
    out["second_term"] = sorted(out["second_term"])
    return out


def ishr_campaign(year, C):
    """ISHR #HRCelections<year> campaign page: election date, candidate lists and (after the vote) the vote tally."""
    url = f"https://ishr.ch/campaigns/hrcelections{year}/"
    status, body = http_get(url, tries=2)
    if status != 200 or not body:
        return {"url": url, "status": status, "checked": False}
    t = page_text(body)
    out = {"url": url, "status": status, "checked": True, "votes": {}}
    dm = re.search(r"(?:will happen|took place|was held|will be held) on (\d{1,2} [A-Z][a-z]+ \d{4})", t)
    out["date"] = iso_date(dm.group(1)) if dm else None
    ti = t.find("final tally")
    if ti > 0:
        seg = t[ti: t.find("Who is running", ti) if t.find("Who is running", ti) > 0 else ti + 1500]
        for m in re.finditer(r"(?:[,:]\s*|\band\s+|\)\s*)(?:the\s+)?([A-Z][^(),:]*?)\s*\((\d{2,3})(?: votes)?\)", seg):
            c = country(C, m.group(1))
            if c["iso3"]:
                out["votes"][c["iso3"]] = int(m.group(2))
    return out


def members_year_next(year_members, today):
    return (year_members or today.year) + 1


def hrc_section(C, today):
    year_members, members = hrc_members(C)
    cur_session = today.year - 1945 if today.month >= 9 else today.year - 1946
    pages = []
    for s in (cur_session + 1, cur_session, cur_session - 1, cur_session - 2):
        p = hrc_ga_page(s, C)
        if p:
            pages.append(p)
    if not pages:
        raise RuntimeError("no GA Human Rights Council election page found")
    pages.sort(key=lambda p: -p["term_start"])
    latest_p = next((p for p in pages if p["held"]), None)
    if not latest_p:
        raise RuntimeError("no held HRC election found on GA pages")
    nxt_p = next((p for p in pages if p["term_start"] == latest_p["term_start"] + 1), None)
    member_iso = {m["iso3"]: m for m in members}
    # OHCHR flags only some second terms; the GA page of the current cycle marks all of them
    ga_cur = next((p for p in pages if p["term_start"] == members_year_next(year_members, today)), None) or pages[0]
    for m in members:
        m["second_term"] = m["second_term"] or m["iso3"] in ga_cur.get("second_term", set())

    def race(p, ishr, held):
        cands = p["candidates"]
        elected_iso = {e["iso3"] for e in p["elected"]}
        results = []
        for g in GROUP_ORDER:
            for c in cands.get(g, []):
                r = dict(c)
                r["votes"] = ishr.get("votes", {}).get(c["iso3"]) if held else None
                r["elected"] = c["iso3"] in elected_iso if held else None
                m = member_iso.get(c["iso3"])
                r["incumbent"] = bool(m) and m["term_end"] == p["term_start"] - 1
                results.append(r)
        contested = {g: len(cands.get(g, [])) > n for g, n in p["seats"].items()}
        return results, contested

    # ---- latest
    y = latest_p["term_start"] - 1
    ishr = ishr_campaign(y, C)
    results, contested = race(latest_p, ishr, True)
    add_source(f"UN General Assembly: Human Rights Council election {y} ({latest_p['session']}th session)", latest_p["url"], "hrc.latest_election")
    if ishr.get("votes"):
        add_source(f"ISHR #HRCelections{y}: final vote tally", ishr["url"], "hrc.latest_election")
    unsuccessful = [r for r in results if r["elected"] is False]
    second = [m["name"] for m in members if m["second_term"] and m["iso3"] in {e["iso3"] for e in latest_p["elected"]} and m["term_end"] == latest_p["term_end"]]
    notable = []
    n_c, n_s = len(results), sum(latest_p["seats"].values())
    if not any(contested.values()):
        notable.append(f"Every regional group ran a clean slate: {n_c} candidates for {n_s} seats, so the vote was uncontested.")
    else:
        for g, v in contested.items():
            if v:
                notable.append(f"{GROUPS[g][0]}: contested, {len(latest_p['candidates'].get(g, []))} candidates for {latest_p['seats'][g]} seat(s).")
    for u in unsuccessful:
        notable.append(f"{u['name']} failed to win a seat" + (f" ({u['votes']} votes)" if u.get("votes") else "") + ".")
    voted = [r for r in results if r.get("votes")]
    if voted:
        lo = min(voted, key=lambda r: r["votes"])
        hi = max(voted, key=lambda r: r["votes"])
        notable.append(f"Most votes: {hi['name']} ({hi['votes']}); fewest among those elected: {lo['name']} ({lo['votes']}), against {GA_ABS_MAJORITY} needed.")
    if second:
        notable.append("Re-elected for a second consecutive term (not eligible again in " + str(latest_p["term_end"] + 1) + "): " + ", ".join(second) + ".")
    tally_ok = bool(voted) and len(voted) == len(latest_p["elected"])
    latest = {
        "year": y, "term": f"{latest_p['term_start']}–{latest_p['term_end']}",
        "date": latest_p.get("held_on") or latest_p["date"], "date_text": latest_p["date_text"],
        "seats": latest_p["seats"], "candidates": latest_p["candidates"], "contested": contested,
        "results": results, "elected": latest_p["elected"], "unsuccessful": unsuccessful,
        "required_majority": GA_ABS_MAJORITY, "majority_rule": f"Absolute majority of the {GA_MEMBERS} members of the General Assembly ({GA_ABS_MAJORITY} votes), secret ballot, one round per seat until filled.",
        "notable": notable, "source": latest_p["url"],
        "votes_source": ishr["url"] if ishr.get("votes") else None,
        "verified": True,
        "verification_note": None if tally_ok else "Vote counts not available from the parsed sources; winners are from the official GA page.",
        "votes_note": "Winners and candidates: official GA page. Vote counts: ISHR's published final tally (civil-society source; the official record is the GA plenary verbatim record).",
    }

    # ---- next
    ny = y + 1
    ishr_n = ishr_campaign(ny, C)
    outgoing = [m for m in members if m["term_end"] == ny]
    if nxt_p:
        add_source(f"UN General Assembly: Human Rights Council election {ny} ({nxt_p['session']}th session)", nxt_p["url"], "hrc.next_election")
        if ishr_n.get("checked"):
            add_source(f"ISHR #HRCelections{ny}: candidates and election date", ishr_n["url"], "hrc.next_election")
        results_n, contested_n = race(nxt_p, {}, False)
        for r in results_n:
            m = member_iso.get(r["iso3"])
            r["incumbent"] = bool(m) and m["term_end"] == ny
        date = nxt_p["date"] or ishr_n.get("date")
        nn = sum(len(v) for v in nxt_p["candidates"].values())
        notable_n = []
        if nxt_p["seats"] and not any(contested_n.values()) and all(len(nxt_p["candidates"].get(g, [])) == s for g, s in nxt_p["seats"].items()):
            notable_n.append(f"All five regional groups have clean slates so far: {nn} candidates for {sum(nxt_p['seats'].values())} seats.")
        for g, v in contested_n.items():
            if v:
                notable_n.append(f"{GROUPS[g][0]}: contested, {len(nxt_p['candidates'].get(g, []))} candidates for {nxt_p['seats'][g]} seat(s).")
            elif len(nxt_p["candidates"].get(g, [])) < nxt_p["seats"][g]:
                notable_n.append(f"{GROUPS[g][0]}: fewer candidates ({len(nxt_p['candidates'].get(g, []))}) than seats ({nxt_p['seats'][g]}) so far.")
        rerun = [r["name"] for r in results_n if r["incumbent"]]
        if rerun:
            notable_n.append("Seeking re-election: " + ", ".join(rerun) + ".")
        barred = [m["name"] for m in outgoing if m["second_term"]]
        if barred:
            notable_n.append("Barred from immediate re-election after two consecutive terms: " + ", ".join(barred) + ".")
        ishr_names = None
        if ishr_n.get("checked"):
            tt = page_text(http_get(ishr_n["url"], tries=1)[1])
            ishr_names = all((r["name"].split(" ")[0] in tt) or (r["iso3"] and C.name(r["iso3"]).split(" ")[0] in tt) for r in results_n)
        nxt = {
            "year": ny, "term": f"{nxt_p['term_start']}–{nxt_p['term_end']}", "status": "upcoming",
            "date": date, "date_text": None if date else (nxt_p["date_text"] or f"October {ny}"),
            "date_source": "GA page" if nxt_p["date"] else ("ISHR" if ishr_n.get("date") else None),
            "seats": nxt_p["seats"], "candidates": nxt_p["candidates"], "contested": contested_n, "results": results_n,
            "outgoing": outgoing, "notable": notable_n, "required_majority": GA_ABS_MAJORITY,
            "source": nxt_p["url"], "secondary_source": ishr_n["url"] if ishr_n.get("checked") else None,
            "verified": True, "candidates_cross_checked": ishr_names,
            "verification_note": "Candidate list as published by the GA (Member States that announced in writing); it can change until the vote." +
                                 ("" if nxt_p["date"] else " Election date from ISHR (the GA page has no date yet)."),
        }
    else:
        nxt = {"year": ny, "term": f"{ny + 1}–{ny + 3}", "status": "upcoming", "date": ishr_n.get("date"),
               "date_text": f"October {ny} (expected)", "seats": {}, "candidates": {}, "contested": {}, "results": [],
               "outgoing": outgoing, "notable": [], "required_majority": GA_ABS_MAJORITY, "source": None,
               "verified": False, "verification_note": "The GA has not published the candidate page yet."}
    add_source("OHCHR: Human Rights Council elections (past elections, rules)", OHCHR_ELECTIONS, "hrc")
    return {
        "year": year_members or today.year,
        "seats_total": 47, "seats_by_group": HRC_SEATS,
        "rules": "47 members elected directly and individually by secret ballot by an absolute majority of the General Assembly "
                 f"({GA_ABS_MAJORITY} votes); three-year terms starting 1 January; not eligible for immediate re-election after two consecutive terms. "
                 "Elections take place each October for about a third of the seats.",
        "members": members,
        "latest_election": latest,
        "next_election": nxt,
    }


# ---------------------------------------------------------------- ECOSOC

ECOSOC_SEATS = {"AG": 14, "APG": 11, "EEG": 6, "GRULAC": 10, "WEOG": 13}
LIB_ECOSOC = "https://research.un.org/en/unmembers/ecosocmembers"
WIKI_ECOSOC = "United_Nations_Economic_and_Social_Council"

# Latest election: no official page is reachable without a bot check (press.un.org), so the result is
# recorded here from the cited reports and cross-checked live (Xinhua text; UN Library list once updated;
# Wikipedia's members table once it has the new row). Update after each June election.
ECOSOC_ELECTIONS = {
    2026: {
        "date": "2026-06-04", "term": "2027–2029", "term_start": 2027, "term_end": 2029,
        "seats": {"AG": 5, "APG": 3, "EEG": 1, "GRULAC": 4, "WEOG": 5},
        "elected": {"AG": ["Angola", "Eritrea", "Guinea", "Morocco", "Senegal"],
                    "APG": ["Malaysia", "Maldives", "Republic of Korea"],
                    "EEG": ["North Macedonia"],
                    "GRULAC": ["Bolivia", "Brazil", "Guatemala"],
                    "WEOG": ["United Kingdom", "France", "Germany", "Ireland", "Portugal"]},
        "by_election": [{"name": "Luxembourg", "group": "WEOG", "term": "2027", "replaces": "Switzerland",
                         "note": "Elected for a one-year term (rotation within WEOG), replacing Switzerland for the rest of its term."}],
        "vacancies": {"GRULAC": 1},
        "votes": {"MYS": 184, "MDV": 183},
        "present_and_voting": 186,
        "notable": [
            "Only 17 of 18 seats were filled: one Latin American and Caribbean seat remained vacant after the voting (to be filled in a later round).",
            "Luxembourg was elected in a by-election for 2027, replacing Switzerland under a rotation arrangement within WEOG.",
            "First election of the Maldives to the Council (183 votes); Malaysia had the highest tally reported (184 of 186 present and voting).",
        ],
        "sources": [
            {"title": "Xinhua: 17 states elected into UN Economic and Social Council for 3-year term (4 June 2026)",
             "url": "https://english.news.cn/20260605/980c2f89f3264916b1beb395025647e8/c.html", "check": ["Angola", "Eritrea", "Guinea", "Morocco", "Senegal", "Malaysia", "Maldives", "Guatemala", "Portugal", "Luxembourg", "remains to be filled"]},
            {"title": "President of the General Assembly: letter on the June 2026 elections (13 January 2026)",
             "url": "https://www.un.org/pga/wp-content/uploads/sites/110/2026/01/PGA-Letter_Upcoming-Elections-2026.pdf", "check": []},
            {"title": "Edition.mv: Maldives elected to UN Economic and Social Council (183 votes)", "url": "https://edition.mv/news/51485", "check": ["183"]},
            {"title": "Malaysia, Ministry of Foreign Affairs: Malaysia elected to ECOSOC for 2027-2029 (184 of 186 votes)",
             "url": "https://www.kln.gov.my/web/guest/-/malaysia-elected-to-the-united-nations-economic-and-social-council-ecosoc-for-the-term-2027-2029", "check": []},
        ],
        "unverified": ["The country holding the remaining Latin American and Caribbean seat (vacancy) and the round-by-round votes are not published in an accessible official source.",
                       "Vote counts only for Malaysia and the Maldives (from national announcements)."],
    },
}


def ecosoc_wiki_terms(C):
    """Wikipedia 'Current members' table: rows by term, cells by group, with per-member exceptions like 'Italy (2025)'."""
    h = wiki_parse(WIKI_ECOSOC)
    if h is None:
        raise RuntimeError("ECOSOC Wikipedia page missing")
    i = h.find('id="Current_members')
    tbl = re.search(r'<table class="wikitable.*?</table>', h[i:], flags=re.S)
    if not tbl:
        raise RuntimeError("ECOSOC members table not found")
    rows = table_rows(tbl.group(0))
    cols = [group_from_label(clean(c[2])) for c in rows[0][1:]]
    out = []
    for r in rows[1:]:
        tm = re.match(r"(\d{4})\s*[–-]\s*(\d{4})", clean(r[0][2]))
        if not tm:
            continue
        a, b = int(tm.group(1)), int(tm.group(2))
        for ci, (kind, attrs, cell) in enumerate(r[1:]):
            g = cols[ci] if ci < len(cols) else None
            for item in re.split(r"<br\s*/?>", cell):
                ls = links(item)
                if not ls:
                    continue
                txt = clean(item)
                am = re.search(r"\((\d{4})(?:\s*[–-]\s*(\d{4}))?\)", txt)
                s, e = (int(am.group(1)), int(am.group(2) or am.group(1))) if am else (a, b)
                c = country(C, ls[0], g)
                c.update({"term_start": s, "term_end": e, "row_term": f"{a}–{b}"})
                out.append(c)
    add_source("Wikipedia: United Nations Economic and Social Council (current members)", WIKI + WIKI_ECOSOC, "ecosoc.members")
    return out


def ecosoc_library(C):
    """Dag Hammarskjöld Library: official ECOSOC membership by year {year: set(iso3)}."""
    status, body = http_get(LIB_ECOSOC, tries=2)
    if status != 200:
        return {}
    i = body.find("ECOSOC Membership by Year")
    tbl = re.search(r"<table.*?</table>", body[i:], flags=re.S)
    out = {}
    for r in table_rows(tbl.group(0)) if tbl else []:
        if len(r) < 2:
            continue
        y = to_int(r[0][2])
        if not y:
            continue
        txt = re.sub(r"\(partial list pending elections\)", "", clean(r[1][2]))
        isos = {country(C, n)["iso3"] for n in txt.split(",") if n.strip()}
        out[y] = {"members": isos, "partial": "partial list" in clean(r[1][2])}
    add_source("UN Dag Hammarskjöld Library: ECOSOC membership by year", LIB_ECOSOC, "ecosoc.members")
    return out


def ecosoc_section(C, today):
    y = today.year
    terms = ecosoc_wiki_terms(C)
    lib = ecosoc_library(C)
    members = [dict(t) for t in terms if t["term_start"] <= y <= t["term_end"]]
    members.sort(key=lambda m: (GROUP_ORDER.index(m["group"]) if m["group"] in GROUP_ORDER else 9, m["term_end"], m["name"]))
    lib_y = lib.get(y, {}).get("members") or set()
    mine = {m["iso3"] for m in members}
    members_verified = bool(lib_y) and lib_y == mine
    notes = []
    if len(members) != 54:
        notes.append(f"Parsed {len(members)} current members (expected 54).")
    if lib_y and lib_y != mine:
        notes.append("Differences with the UN Library list: missing " + ", ".join(sorted(x or "?" for x in lib_y - mine)) +
                     "; extra " + ", ".join(sorted(x or "?" for x in mine - lib_y)))

    # latest election: the most recent June election on record (curated, cross-checked)
    held = sorted([k for k, v in ECOSOC_ELECTIONS.items() if v["date"] <= today.strftime("%Y-%m-%d")], reverse=True)
    if not held:
        raise RuntimeError("no ECOSOC election recorded")
    ly = held[0]
    e = ECOSOC_ELECTIONS[ly]
    checks = []
    for s in e["sources"]:
        add_source(s["title"], s["url"], "ecosoc.latest_election")
        if s["check"]:
            st, body = http_get(s["url"], tries=1)
            t = page_text(body)
            missing = [w for w in s["check"] if w not in t]
            checks.append({"url": s["url"], "status": st, "confirmed": st == 200 and not missing, "not_found": missing})
    elected = []
    for g in GROUP_ORDER:
        for n in e["elected"].get(g, []):
            c = country(C, n, g)
            c["votes"] = e["votes"].get(c["iso3"])
            elected.append(c)
    # once the Library / Wikipedia publish the next year's list, confirm the winners there too
    nxt_lib = lib.get(e["term_start"], {})
    lib_confirms = None
    if nxt_lib.get("members"):
        lib_confirms = all(c["iso3"] in nxt_lib["members"] for c in elected) if not nxt_lib.get("partial") or any(c["iso3"] in nxt_lib["members"] for c in elected) else None
    wiki_new = [t for t in terms if t["term_start"] == e["term_start"] and t["term_end"] == e["term_end"]]
    wiki_confirms = ({t["iso3"] for t in wiki_new} >= {c["iso3"] for c in elected}) if wiki_new else None
    by_el = [dict(country(C, b["name"], b["group"]), term=b["term"], replaces=b["replaces"], note=b["note"]) for b in e["by_election"]]
    pav = e.get("present_and_voting")
    latest = {
        "year": ly, "date": e["date"], "term": e["term"], "seats": e["seats"], "elected": elected,
        "elected_by_group": by_group(elected), "by_election": by_el, "vacancies": e["vacancies"],
        "present_and_voting": pav, "required_majority": (pav * 2 + 2) // 3 if pav else None,
        "majority_rule": "Two-thirds of the members present and voting (rule 83 of the GA rules of procedure: ECOSOC elections are an 'important question').",
        "notable": e["notable"], "unverified": e["unverified"],
        "sources": [{"title": s["title"], "url": s["url"]} for s in e["sources"]],
        "checks": checks, "library_confirms": lib_confirms, "wikipedia_confirms": wiki_confirms,
        "verified": all(c["confirmed"] for c in checks) and lib_confirms is not False and wiki_confirms is not False,
    }
    # by-elections that hand a member's remaining year(s) to another state (e.g. WEOG rotation)
    for b in by_el:
        m = next((x for x in members if x["name"] == b["replaces"] or x["iso3"] == country(C, b["replaces"])["iso3"]), None)
        start = int(str(b["term"])[:4])
        if m and m["term_end"] >= start:
            m["term_end_original"] = m["term_end"]
            m["term_end"] = start - 1
            m["replaced_by"] = b["name"]
    # outgoing at the end of this year = seats filled in the latest election (when it elected the next term)
    ny = ly + 1
    ending = [m for m in members if m["term_end"] == ny] if ly == y else [m for m in members if m["term_end"] == y]
    for b in by_el:
        bs = str(b["term"]).split("–")
        if int(bs[-1]) == ny:
            ending.append({"iso3": b["iso3"], "name": b["name"], "group": b["group"], "term_start": int(bs[0]), "term_end": ny,
                           "row_term": None, "note": f"one-year term replacing {b['replaces']}"})
    seats_next = {}
    for m in ending:
        seats_next[m["group"]] = seats_next.get(m["group"], 0) + 1
    nxt = {
        "year": ny, "term": f"{ny + 1}–{ny + 3}", "status": "upcoming",
        "date": None, "date_text": f"June {ny} (expected; the GA elects ECOSOC members in early June)",
        "seats": {g: seats_next[g] for g in GROUP_ORDER if g in seats_next},
        "outgoing": ending,
        "candidates": {}, "verified": False,
        "note": "Candidacies for ECOSOC are usually agreed within regional groups and announced shortly before the vote; none is tracked yet." +
                (f" Still pending from {ly}: " + ", ".join(f"{n} {GROUPS[g][0]} seat" for g, n in e["vacancies"].items()) + "." if e["vacancies"] else ""),
    }
    return {
        "year": y, "seats_total": 54, "seats_by_group": ECOSOC_SEATS,
        "rules": "54 members elected by the General Assembly for overlapping three-year terms (18 a year) by secret ballot; "
                 "a two-thirds majority of members present and voting is required; outgoing members can be re-elected immediately.",
        "members": members, "members_verified": members_verified, "members_notes": notes,
        "latest_election": latest, "next_election": nxt,
    }


# ---------------------------------------------------------------- International Court of Justice

ICJ_MEMBERS_URL = "https://www.icj-cij.org/current-members"
ICJ_CYCLE_BASE = 2024  # regular terms end on 5 February of 2024, 2027, 2030, 2033 ...

# 2026 regular election (3 November 2026). No Wikipedia page or accessible official list yet: candidates as reported,
# with the Secretary-General's note of 1 July 2026 (via Boeglin, IUS360) as the reference for the list of nominees.
ICJ_NEXT_CANDIDATES = [
    {"name": "Dapo Akande", "country": "United Kingdom", "url": "https://www.gov.uk/government/publications/uk-candidate-for-the-international-court-of-justice-election-2026-professor-dapo-akande-election-brochure"},
    {"name": "François Alabrune", "country": "France", "url": "https://onu.delegfrance.org/francois-alabrune-candidate-for-judge-at-the-international-court-of-justice"},
    {"name": "Olufemi Elias", "country": "Nigeria", "url": "https://businessday.ng/news/article/nigeria-nominates-olufemi-elias-as-candidate-for-world-court/",
     "note": "Listed in the Secretary-General's note of 1 July 2026 (per IUS360) but not in the Korean foreign ministry's list of eight on 26 September 2026: may have withdrawn (unconfirmed)."},
    {"name": "Mahmoud Daifallah Hmoud", "country": "Jordan", "url": "https://news.sbs.co.kr/english/article.do?news_id=N1008770603"},
    {"name": "Luz del Carmen Ibáñez Carranza", "country": "Peru", "url": "https://ius360.com/la-eleccion-de-los-jueces-en-la-corte-internacional-de-justicia-cij-en-la-recta-final/",
     "note": "Listed in the Secretary-General's note of 1 July 2026 (per IUS360) but not in the Korean foreign ministry's list of eight on 26 September 2026: may have withdrawn (unconfirmed)."},
    {"name": "Charles Chernor Jalloh", "country": "Sierra Leone", "url": "https://charlesjalloh.com/"},
    {"name": "Rena Lee", "country": "Singapore", "url": "https://www.mfa.gov.sg/Newsroom/Announcements-and-Highlights/2024/12/20241202-ICJ-Candidature"},
    {"name": "Phoebe Okowa", "country": "Kenya", "url": "https://en.wikipedia.org/wiki/Phoebe_Okowa",
     "nominating_groups": ["Bahamas", "Brazil", "Burkina Faso", "Colombia", "Denmark", "Djibouti", "Ecuador", "Finland", "France", "Georgia", "Greece", "Guatemala", "Hungary", "Kenya", "Latvia", "Malta", "Mauritius", "Namibia", "Netherlands", "Norway", "Senegal", "Singapore", "Slovakia", "Slovenia", "Spain", "Sweden"]},
    {"name": "Paik Jin-hyun", "country": "Republic of Korea", "url": "https://www.koreaherald.com/article/10435355"},
    {"name": None, "country": "Ecuador", "url": "https://en.sedaily.com/politics/2026/09/26/korea-bids-for-first-icj-judge-seat-in-november-vote",
     "note": "Candidate's name not confirmed in the sources checked."},
]
ICJ_NEXT_SOURCES = [
    {"title": "Seoul Economic Daily: Korea bids for first ICJ judge seat in November vote (26 Sep 2026: eight candidates, vote on 3 November)",
     "url": "https://en.sedaily.com/politics/2026/09/26/korea-bids-for-first-icj-judge-seat-in-november-vote", "check": ["Nov. 3", "Ecuador", "Sierra Leone"]},
    {"title": "SBS News: South Korea launches first bid for ICJ seat (election scheduled for November 3)",
     "url": "https://news.sbs.co.kr/english/article.do?news_id=N1008770603", "check": ["November 3"]},
    {"title": "The Wire: As India launches UNSC bid, its 14-year run at the ICJ quietly ends",
     "url": "https://m.thewire.in/article/world/as-india-launches-unsc-bid-its-14-year-run-at-the-icj-quietly-ends/amp", "check": []},
    {"title": "IUS360 (N. Boeglin): ICJ elections, final stretch (candidates per the Secretary-General's note of 1 July 2026)",
     "url": "https://ius360.com/la-eleccion-de-los-jueces-en-la-corte-internacional-de-justicia-cij-en-la-recta-final/", "check": ["Nigeria, Jordania, Perú, Sierra Leone, Singapur, Kenia"]},
]
ICJ_BY_ELECTIONS = [
    {"date": "2025-05-27", "elected": "Mahmoud Daifallah Hmoud", "country": "Jordan", "replaces": "Nawaf Salam (Lebanon), resigned January 2025",
     "term_end": 2027, "candidates": 1, "ga_votes": 178, "ga_present": 181, "sc_votes": 15, "rounds_ga": 1, "rounds_sc": 1,
     "source": "https://news.un.org/en/story/2025/05/1163721", "check": ["178", "Hmoud"]},
    {"date": "2025-11-12", "elected": "Phoebe Okowa", "country": "Kenya", "replaces": "Abdulqawi Yusuf (Somalia), resigned 30 September 2025",
     "term_end": 2027, "candidates": 4, "ga_votes": 106, "ga_present": 185, "sc_votes": 8, "rounds_ga": 4, "rounds_sc": 3,
     "source": "https://en.wikipedia.org/wiki/Phoebe_Okowa", "check": ["106", "eight votes"]},
]


def icj_judges(C):
    status, body = http_get(ICJ_MEMBERS_URL, tries=2)
    if status != 200 or "judges-wrap" not in body:
        raise RuntimeError(f"ICJ current members page unavailable (HTTP {status})")
    out = []
    for blk in re.findall(r'<div class="col-sm-9">(.*?)(?=<div class="judges-wrap|<div class="col-sm-3"|$)', body, flags=re.S):
        hm = re.search(r"<h1[^>]*>(.*?)</h1>", blk, flags=re.S)
        cm = re.search(r"<h4>(.*?)</h4>", blk, flags=re.S)
        pm = re.search(r"<h5>(.*?)</h5>", blk, flags=re.S)
        if not (hm and cm):
            continue
        toks = clean(hm.group(1)).split()
        role = toks.pop(0) if toks and toks[0] in ("President", "Vice-President", "Judge") else "Judge"
        sur = [t for t in toks if re.fullmatch(r"[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'\-]+", t)]
        given = [t for t in toks if t not in sur]
        surname = " ".join(w.capitalize() if "-" not in w else "-".join(x.capitalize() for x in w.split("-")) for w in sur)
        ctry = clean(cm.group(1))
        c = country(C, ctry)
        name = f"{surname} {' '.join(given)}" if c["iso3"] == "CHN" else f"{' '.join(given)} {surname}".strip()
        txt = clean(pm.group(1)) if pm else ""
        since = re.search(r"Member of the Court since (\d{1,2} [A-Z][a-z]+ \d{4})", txt)
        rm = re.search(r"re-elected (as from [^;]+)", txt)
        rel = re.findall(r"as from (\d{1,2} [A-Z][a-z]+ \d{4})", rm.group(1)) if rm else []
        start = iso_date(rel[-1]) if rel else (iso_date(since.group(1)) if since else None)
        out.append({"name": name, "surname": surname, "iso3": c["iso3"], "nationality": C.name(c["iso3"]) if c["iso3"] else ctry, "group": c["group"],
                    "role": {"President": "president", "Vice-President": "vice-president"}.get(role, "judge"),
                    "member_since": iso_date(since.group(1)) if since else None, "current_term_from": start,
                    "career": txt, "term_end": None, "term_end_derived": None})
    if len(out) != 15:
        raise RuntimeError(f"ICJ: parsed {len(out)} judges, expected 15")
    # term ends: a regular term starting 6 February Y ends 5 February Y+9; a judge elected to a casual vacancy
    # completes the predecessor's term, deduced from which triennial class is short of its five seats.
    classes = {}
    for j in out:
        s = j["current_term_from"] or ""
        if s[5:] == "02-06":
            j["term_end"] = int(s[:4]) + 9
            j["term_end_derived"] = "regular nine-year term"
            classes[j["term_end"]] = classes.get(j["term_end"], 0) + 1
    year = int(datetime.now(timezone.utc).strftime("%Y"))
    upcoming = [y for y in range(ICJ_CYCLE_BASE, year + 12, 3) if y > year or (y == year and datetime.now(timezone.utc).strftime("%m-%d") < "02-06")][:3]
    short = [y for y in upcoming for _ in range(5 - classes.get(y, 0))]
    pending = [j for j in out if j["term_end"] is None]
    if len(short) == len(pending) and len(set(short)) == 1:
        for j in pending:
            j["term_end"] = short[0]
            j["term_end_derived"] = "completes a predecessor's term (casual vacancy)"
    elif pending:
        for j in pending:
            j["term_end_derived"] = "unknown: casual vacancy, class could not be deduced"
    add_source("International Court of Justice: Current Members", ICJ_MEMBERS_URL, "icj.judges")
    return out


def icj_wiki_election(year, C):
    page = f"{year}_International_Court_of_Justice_judges_election"
    h = wiki_parse(page)
    if h is None:
        return None
    url = WIKI + page
    cands = []
    ballots = None
    for tbl in re.findall(r'<table class="wikitable.*?</table>', h, flags=re.S):
        rows = table_rows(tbl)
        head = " ".join(clean(c[2]) for c in rows[0]) if rows else ""
        if "Nominating national groups" in head:
            grp = None
            for r in rows[1:]:
                cells = [clean(c[2]) for c in r]
                if len(cells) == 4:
                    grp, vac, cand, nom = cells
                elif len(cells) == 3:
                    vac, cand, nom = cells
                elif len(cells) == 2:
                    cand, nom = cells
                else:
                    continue
                fl = re.search(r'class="flagicon".*?<img alt="([^"]+)"', r[-2][2], flags=re.S)
                nat = fl.group(1) if fl else None
                cands.append({"name": cand, "regional_group": group_from_label(grp or "") or grp, "nominating_groups": [x.strip() for x in nom.split(",") if x.strip()], "nationality": nat})
        elif "General Assembly" in head and "Security Council" in head:
            gm = re.search(r"General Assembly majority = (\d+)", head)
            sm = re.search(r"Security Council majority = (\d+)", head)
            hdr = [clean(c[2]) for c in rows[1]] if len(rows) > 1 else []
            # header row: first GA rounds then SC rounds (the two bodies vote separately)
            n_ga = 0
            ga_cols = [i for i, x in enumerate(hdr)]
            colspans = [re.search(r'colspan="(\d+)"', c[1]) for c in rows[0][1:]]
            spans = [int(m.group(1)) if m else 1 for m in colspans]
            n_ga = spans[0] if spans else 1
            labels = [re.sub(r"\s+\d{1,2} [A-Z][a-z]+ \d{4}$", "", x) for x in hdr]
            dates = [iso_date(re.search(r"(\d{1,2} [A-Z][a-z]+ \d{4})", x).group(1)) if re.search(r"\d{1,2} [A-Z][a-z]+ \d{4}", x) else None for x in hdr]
            res = []
            for r in rows[2:]:
                cells = [clean(c[2]) for c in r]
                if len(cells) < 2:
                    continue
                vals = [to_int(v) if v else None for v in cells[1:]]
                fl = re.search(r'class="flagicon".*?<img alt="([^"]+)"', r[0][2], flags=re.S)
                res.append({"name": cells[0], "flag": fl.group(1) if fl else None, "ga": vals[:n_ga], "sc": vals[n_ga:]})
            ballots = {"ga_required": int(gm.group(1)) if gm else GA_ABS_MAJORITY, "sc_required": int(sm.group(1)) if sm else SC_ABS_MAJORITY,
                       "ga_rounds": [{"label": labels[i], "date": dates[i]} for i in range(min(n_ga, len(labels)))],
                       "sc_rounds": [{"label": labels[i], "date": dates[i]} for i in range(n_ga, len(labels))],
                       "results": res}
    lead = clean(h[:h.find("<h2") if "<h2" in h else 3000])
    return {"year": year, "candidates": cands, "ballots": ballots, "source": url, "lead": lead[:600]}


def same_judge(j, name):
    """Does an ICJ judge record refer to this candidate name? (surname match, accents kept)"""
    n = (name or "").lower()
    return bool(n) and (j["surname"].lower() in n or j["name"].lower() == n)


def icj_section(C, today):
    judges = icj_judges(C)
    by_name = {j["name"].lower(): j for j in judges}
    y = today.year
    # latest regular (triennial) election with a Wikipedia results page
    reg_years = [yy for yy in range(ICJ_CYCLE_BASE - 1 + 3 * ((y - ICJ_CYCLE_BASE + 1) // 3), y - 10, -3)]
    latest = None
    for yy in reg_years:
        e = icj_wiki_election(yy, C)
        if e and e["ballots"]:
            latest = e
            break
    if not latest:
        raise RuntimeError("no ICJ regular election results parsed")
    add_source(f"Wikipedia: {latest['year']} International Court of Justice judges election", latest["source"], "icj.latest_election")
    b = latest["ballots"]
    res = []
    cand_map = {c["name"].lower(): c for c in latest["candidates"]}
    for r in b["results"]:
        ga_last = next((v for v in reversed(r["ga"]) if v is not None), None)
        sc_last = next((v for v in reversed(r["sc"]) if v is not None), None)
        ga_ok = any((v or 0) >= b["ga_required"] for v in r["ga"])
        sc_ok = (sc_last or 0) >= b["sc_required"]
        cm = cand_map.get(r["name"].lower()) or next((c for k, c in cand_map.items() if r["name"].split()[-1].lower() in k), None)
        j = next((jj for jj in judges if same_judge(jj, r["name"])), None)
        nat = country(C, r["flag"]) if r.get("flag") else ({"iso3": j["iso3"], "name": j["nationality"]} if j else {"iso3": None, "name": None})
        res.append({"name": r["name"], "ga": r["ga"], "sc": r["sc"], "ga_majority": ga_ok, "sc_majority": sc_ok,
                    "elected": bool(j) or (ga_ok and sc_ok), "on_court": bool(j),
                    "nationality": nat["name"], "iso3": nat["iso3"],
                    "regional_group": cm["regional_group"] if cm else None,
                    "nominating_groups": len(cm["nominating_groups"]) if cm else None})
    elected = [r for r in res if r["elected"]]
    lost = [r for r in res if not r["elected"]]
    notable = []
    if len(b["sc_rounds"]) > 1:
        notable.append(f"The Security Council needed {len(b['sc_rounds'])} rounds; the General Assembly {len(b['ga_rounds'])}.")
    for r in lost:
        if r["ga_majority"] or r["sc_majority"]:
            notable.append(f"{r['name']} won a majority in the {'General Assembly' if r['ga_majority'] else 'Security Council'} but not in the other body.")
    gev = next((r for r in lost if "Gevorgian" in r["name"]), None)
    if gev:
        notable.append("Sitting judge (and former Vice-President) Kirill Gevorgian lost re-election: the first time since 1946 that Russia/the USSR has no judge on the Court.")
    lat = {
        "year": latest["year"], "term": f"{latest['year'] + 1}–{latest['year'] + 10}", "seats": 5,
        "date": (b["ga_rounds"][0]["date"] if b["ga_rounds"] else None),
        "ga_required": b["ga_required"], "sc_required": b["sc_required"],
        "ga_rounds": b["ga_rounds"], "sc_rounds": b["sc_rounds"], "results": res,
        "elected": [r["name"] for r in elected], "unsuccessful": [r["name"] for r in lost], "notable": notable,
        "source": latest["source"], "verified": all(r["on_court"] for r in elected),
        "verification_note": "Results from Wikipedia (citing UN records); winners cross-checked against the ICJ's current-members page.",
    }
    # by-elections since then
    bys = []
    for e in ICJ_BY_ELECTIONS:
        if e["date"] < f"{latest['year'] + 1}-01-01":
            continue
        st, body = http_get(e["source"], tries=1)
        t = page_text(body)
        ok = st == 200 and all(w in t for w in e["check"])
        j = next((jj for jj in judges if same_judge(jj, e["elected"])), None)
        add_source(f"{e['elected']} elected to the ICJ ({e['date']})", e["source"], "icj.by_elections")
        bys.append({k: v for k, v in e.items() if k != "check"} | {
            "iso3": country(C, e["country"])["iso3"], "ga_required": GA_ABS_MAJORITY, "sc_required": SC_ABS_MAJORITY,
            "on_court": bool(j), "verified": ok and bool(j)})
    # next regular election
    ny = next(yy for yy in range(ICJ_CYCLE_BASE - 1, y + 4, 3) if yy >= y and (yy > latest["year"]))
    ending = [j for j in judges if j["term_end"] == ny + 1]
    nw = icj_wiki_election(ny, C)
    checks = []
    for s in ICJ_NEXT_SOURCES:
        add_source(s["title"], s["url"], "icj.next_election")
        if not s["check"]:
            continue
        st, body = http_get(s["url"], tries=1)
        t = page_text(body)
        missing = [w for w in s["check"] if w not in t]
        checks.append({"url": s["url"], "status": st, "confirmed": st == 200 and not missing, "not_found": missing})
    date = "2026-11-03" if ny == 2026 and any(c["confirmed"] for c in checks[:2]) else None
    cands = []
    if nw and nw["candidates"]:
        add_source(f"Wikipedia: {ny} International Court of Justice judges election", nw["source"], "icj.next_election")
        for c in nw["candidates"]:
            cc = country(C, c["nationality"]) if c["nationality"] else {"iso3": None, "name": None}
            cands.append({"name": c["name"], "iso3": cc["iso3"], "country": cc["name"], "group": c["regional_group"],
                          "nominating_groups": c["nominating_groups"], "incumbent": any(same_judge(j, c["name"]) for j in judges),
                          "source": nw["source"], "note": None})
    elif ny == 2026:
        for c in ICJ_NEXT_CANDIDATES:
            cc = country(C, c["country"])
            inc = any(same_judge(j, c["name"]) for j in judges)
            cands.append({"name": c["name"], "iso3": cc["iso3"], "country": cc["name"], "group": cc["group"],
                          "nominating_groups": c.get("nominating_groups"), "incumbent": inc, "source": c["url"], "note": c.get("note")})
    ballots_n = nw["ballots"] if nw and nw["ballots"] else None
    nxt = {
        "year": ny, "term": f"{ny + 1}–{ny + 10}", "seats": 5, "status": "held" if ballots_n else "upcoming",
        "date": date, "date_text": None if date else f"November {ny} (expected)",
        "ga_required": GA_ABS_MAJORITY, "sc_required": SC_ABS_MAJORITY,
        "ending_terms": [{"name": j["name"], "iso3": j["iso3"], "nationality": j["nationality"], "group": j["group"],
                          "running": any(same_judge(j, c["name"]) for c in cands)} for j in ending],
        "candidates": cands, "ballots": ballots_n, "checks": checks,
        "verified": bool(nw and nw["candidates"]),
        "verification_note": None if (nw and nw["candidates"]) else
            "No Wikipedia page or accessible official list (Secretary-General's note) yet: candidates compiled from national announcements and press, "
            "with a reported discrepancy (the SG's July note lists ten nominees, the Korean foreign ministry eight in late September).",
        "notable": [],
    }
    if ny == 2026:
        nxt["notable"] = [
            "France (Alabrune) and the United Kingdom (Akande) both field candidates for what is customarily the Western European seat now held by French judge Ronny Abraham (seats are not formally allocated); the UK has had no judge since 2018.",
            "India's Dalveer Bhandari and Brazil's Leonardo Brant are not standing again (no Indian or Brazilian candidate reported).",
            "Two judges elected to casual vacancies in 2025 seek full terms: Mahmoud Hmoud (Jordan) and Phoebe Okowa (Kenya).",
            "Republic of Korea's first-ever ICJ bid (Paik Jin-hyun), in a three-way Asia-Pacific race with Jordan and Singapore.",
        ]
    return {
        "year": y, "seats_total": 15,
        "rules": "15 judges with nine-year terms; a third of the Court (five seats) is renewed every three years. Candidates are nominated by "
                 "national groups of the Permanent Court of Arbitration. The General Assembly and the Security Council vote separately and "
                 f"simultaneously; a candidate needs an absolute majority in both ({GA_ABS_MAJORITY} in the GA, {SC_ABS_MAJORITY} in the Council; "
                 "permanent members have no veto). Terms start on 6 February.",
        "judges": judges, "latest_election": lat, "by_elections": bys, "next_election": nxt,
    }


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

    # --- Human Rights Council, ECOSOC, International Court of Justice: each section is independent; on failure
    # the previous file's section is kept (and the failure noted) so SC/PGA data still refreshes.
    try:
        prev = json.load(open(OUTPUT_FILE))
    except Exception:
        prev = {}
    extra = {}
    for key, fn in (("hrc", hrc_section), ("ecosoc", ecosoc_section), ("icj", icj_section)):
        try:
            extra[key] = fn(C, now)
        except Exception as e:  # keep the previous section
            log(f"  {key} failed: {e}")
            notes.append(f"{key}: refresh failed ({e}); showing data from the previous run")
            if prev.get(key):
                extra[key] = prev[key]
                for src in prev.get("_meta", {}).get("sources", []):
                    if src["section"].split(".")[0] == key:
                        add_source(src["title"], src["url"], src["section"])

    out = {
        "_meta": {
            "updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sources": SOURCES,
            "notes": notes + [
                swing,
                "Results, candidates and winners are parsed from Wikipedia election pages; the latest election is cross-checked "
                "against Security Council Report and unsc-history.json (see verified flags).",
                "Groups follow UN electoral practice: Türkiye votes with WEOG, Israel sits in WEOG, the USA is a WEOG observer.",
                "Human Rights Council: official membership (OHCHR) and GA election pages; vote counts from ISHR's published tally.",
                "ECOSOC: current members from Wikipedia cross-checked with the UN Library; the latest June election is recorded from "
                "press reports (UN press pages sit behind a bot check) and cross-checked live.",
                "ICJ: judges and term ends from the Court's site; the latest regular election from Wikipedia; 2026 candidates from "
                "national announcements and press (unverified until an official list or Wikipedia page is available).",
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
        **extra,
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
    for k in ("hrc", "ecosoc", "icj"):
        x = out.get(k)
        if x:
            le, ne = x.get("latest_election") or {}, x.get("next_election") or {}
            log(f"  {k}: latest {le.get('year')} {le.get('date')} elected {len(le.get('elected') or [])}; next {ne.get('year')} {ne.get('date') or ne.get('date_text')}")


if __name__ == "__main__":
    main()

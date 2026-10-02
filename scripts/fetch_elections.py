#!/usr/bin/env python3
"""Fetch the national elections calendar from English Wikipedia.

Source: the "<year> national electoral calendar" articles (current and next year),
read through the MediaWiki parse API. Content is CC BY-SA 4.0; every entry keeps the
URL of the calendar page (and of the election article when there is one) so the site
can attribute it ("Source: Wikipedia, CC BY-SA").

Writes site/server/data/elections.json:
  {
    "_meta": {source, license, last_updated, pages: [...], counts},
    "elections": [
      {id, date, date_end, precision ("day"|"month"|"year"), sort_date, country, iso3,
       territory, type, types, description, indirect, status ("upcoming"|"past"),
       article_url, source_url}
    ]
  }
Keeps past elections from the last ~6 months and everything upcoming.
On a fetch/parse failure the existing file is left untouched (exit code 1).
"""

import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser

UA = "WorldCountryGroups/1.0 (+https://worldcountrygroups.exe.xyz)"
API = "https://en.wikipedia.org/w/api.php"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "site", "server", "data", "elections.json")
WORLD = os.path.join(ROOT, "worldcountrygroups", "data", "groups", "world.json")
PAST_DAYS = 183

MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august",
     "september", "october", "november", "december"], 1)}

# Wikipedia country names that differ from world.json
ALIASES = {
    "russia": "RUS", "south korea": "KOR", "north korea": "PRK", "iran": "IRN", "syria": "SYR",
    "egypt": "EGY", "kyrgyzstan": "KGZ", "laos": "LAO", "vietnam": "VNM", "turkey": "TUR",
    "türkiye": "TUR", "czech republic": "CZE", "czechia": "CZE", "ivory coast": "CIV",
    "côte d'ivoire": "CIV", "cape verde": "CPV", "cabo verde": "CPV", "the gambia": "GMB",
    "gambia": "GMB", "the bahamas": "BHS", "bahamas": "BHS", "brunei": "BRN",
    "democratic republic of the congo": "COD", "dr congo": "COD", "republic of the congo": "COG",
    "congo": "COG", "micronesia": "FSM", "federated states of micronesia": "FSM",
    "saint kitts and nevis": "KNA", "saint lucia": "LCA", "saint vincent and the grenadines": "VCT",
    "palestine": "PSE", "state of palestine": "PSE", "taiwan": "TWN", "hong kong": "HKG",
    "macau": "MAC", "macao": "MAC", "east timor": "TLS", "timor-leste": "TLS", "eswatini": "SWZ",
    "swaziland": "SWZ", "united states": "USA", "united kingdom": "GBR", "netherlands": "NLD",
    "the netherlands": "NLD", "vatican city": "VAT", "holy see": "VAT", "sint maarten": "SXM",
    "curaçao": "CUW", "curacao": "CUW", "united states virgin islands": "VIR",
    "u.s. virgin islands": "VIR", "northern mariana islands": "MNP", "são tomé and príncipe": "STP",
    "sao tome and principe": "STP", "north macedonia": "MKD", "moldova": "MDA", "tanzania": "TZA",
    "bolivia": "BOL", "venezuela": "VEN", "slovakia": "SVK", "yemen": "YEM", "kosovo": "XKX",
    "western sahara": "ESH", "sahrawi arab democratic republic": "ESH", "saint martin": "MAF",
    "south sudan": "SSD", "somaliland": None, "abkhazia": None, "south ossetia": None,
    "transnistria": None, "northern cyprus": None, "artsakh": None,
}


def get_json(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            if i == retries - 1:
                raise
            print(f"  retry {url}: {e}", file=sys.stderr)
            time.sleep(5 * (i + 1))


def load_country_index():
    with open(WORLD, encoding="utf-8") as f:
        world = json.load(f)
    idx = {}
    for c in world.get("countries", []):
        name = (c.get("name") or "").replace("​", "").strip()
        iso3 = c.get("iso3")
        if name and iso3 and iso3 != "EUU":
            idx.setdefault(name.lower(), iso3)
            # "Congo, Rep." / "Egypt, Arab Rep." style names: also index the part before the comma
            if "," in name:
                idx.setdefault(name.split(",")[0].strip().lower(), iso3)
    for k, v in ALIASES.items():
        idx[k] = v
    return idx


def match_iso3(name, idx):
    n = re.sub(r"\s+", " ", name).strip().lower()
    if n in idx:
        return idx[n]
    n2 = re.sub(r"^the ", "", n)
    return idx.get(n2)


# ---------------------------------------------------------------------------
# Minimal HTML tree: we only need h2 sections and nested ul/li with text + links.
# ---------------------------------------------------------------------------
class Node:
    __slots__ = ("tag", "attrs", "children", "parent")

    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.children, self.parent = tag, dict(attrs), [], parent


VOID = {"br", "img", "meta", "link", "hr", "input", "wbr", "source", "col", "area", "base", "embed", "param", "track"}


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root", {}, None)
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.cur)
        self.cur.children.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not None and n.tag != tag:
            n = n.parent
        if n is not None and n.parent is not None:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.children.append(data)


SKIP_CLASSES = ("reference", "mw-editsection", "noprint")


def skip(node):
    if node.tag in ("style", "script", "sup"):
        return True
    cls = node.attrs.get("class") or ""
    return any(c in cls for c in SKIP_CLASSES)


def own_content(li):
    """Text and links of an <li>, excluding nested lists. Also returns whether the
    country/territory part is in italics (Wikipedia italicises dependent territories)."""
    parts, links = [], []
    italic_first = [None]

    def walk(n, in_i):
        for ch in n.children:
            if isinstance(ch, str):
                parts.append(ch)
                continue
            if ch.tag in ("ul", "ol") or skip(ch):
                continue
            if ch.tag == "a":
                href = ch.attrs.get("href") or ""
                links.append((text_of(ch), href, in_i or ch.tag == "i"))
                if italic_first[0] is None:
                    italic_first[0] = in_i
            walk(ch, in_i or ch.tag == "i")

    walk(li, False)
    return re.sub(r"\s+", " ", "".join(parts)).strip(), links, bool(italic_first[0])


def text_of(n):
    out = []

    def walk(x):
        for ch in x.children:
            if isinstance(ch, str):
                out.append(ch)
            elif not skip(ch):
                walk(ch)

    walk(n)
    return re.sub(r"\s+", " ", "".join(out)).strip()


def sections(root):
    """Yield (h2 id, [top-level ul nodes]) in document order."""
    # The parse output is a flat sequence under div.mw-parser-output
    container = root
    for ch in root.children:
        if isinstance(ch, Node) and "mw-parser-output" in (ch.attrs.get("class") or ""):
            container = ch
            break
    current, uls, out = None, [], []
    for ch in container.children:
        if not isinstance(ch, Node):
            continue
        h2 = None
        if ch.tag == "h2":
            h2 = ch
        elif ch.tag == "div" and "mw-heading2" in (ch.attrs.get("class") or ""):
            h2 = next((c for c in ch.children if isinstance(c, Node) and c.tag == "h2"), None)
        if h2 is not None:
            if current:
                out.append((current, uls))
            current, uls = h2.attrs.get("id") or text_of(h2), []
        elif current and ch.tag == "ul":
            uls.append(ch)
    if current:
        out.append((current, uls))
    return out


# ---------------------------------------------------------------------------
DAY_RE = re.compile(r"^(?:(?:early|mid|late)[-\s]+)?(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?\s+([A-Za-z]+)"
                    r"(?:\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+))?$")
MONTH_RE = re.compile(r"^(?:(early|mid|late)[-\s]+)?([A-Za-z]+)(?:\s*(?:[–/-]|or)\s*[A-Za-z]+)?$", re.I)


def label_is_date(label):
    label = re.sub(r"^(?:TBD|TBA|c\.|circa|by)\s+", "", label.strip(), flags=re.I)
    m = DAY_RE.match(label)
    if m and m.group(3).lower() in MONTHS:
        return True
    m = MONTH_RE.match(label)
    return bool(m and m.group(2).lower() in MONTHS)


def parse_date_label(label, year, section):
    """Return (date, date_end, precision). date is ISO 'YYYY-MM-DD', 'YYYY-MM' or 'YYYY'."""
    label = (label or "").strip().rstrip(":").strip()
    label = re.sub(r"^(?:TBD|TBA|c\.|circa|by)\s+", "", label, flags=re.I)
    m = DAY_RE.match(label)
    if m and m.group(3).lower() in MONTHS:
        mon = MONTHS[m.group(3).lower()]
        try:
            d1 = date(year, mon, int(m.group(1)))
        except ValueError:
            d1 = None
        end = None
        if m.group(2):
            try:
                end = date(year, mon, int(m.group(2))).isoformat()
            except ValueError:
                end = None
        if m.group(4) and m.group(5) and m.group(5).lower() in MONTHS:
            try:
                end = date(year, MONTHS[m.group(5).lower()], int(m.group(4))).isoformat()
            except ValueError:
                end = None
        if d1:
            return d1.isoformat(), end, "day"
    m = MONTH_RE.match(label)
    if m and m.group(2).lower() in MONTHS:
        return f"{year}-{MONTHS[m.group(2).lower()]:02d}", None, "month"
    sec = section.lower()
    if sec in MONTHS:
        return f"{year}-{MONTHS[sec]:02d}", None, "month"
    return str(year), None, "year"


TYPE_RULES = [
    ("referendum", r"referend|plebiscite|recall"),
    ("presidential", r"\bpresiden"),
    ("parliamentary", r"parliament|house of|senate|chamber|assembly|legislat|congress|knesset|duma|diet\b|majlis|"
                      r"national council|cortes|storting|riksdag|folketing|althing|sejm|bundestag|lok sabha|"
                      r"council of states|national congress|seimas|saeima|riigikogu|eduskunta|dáil|"
                      r"house|representatives|deputies|shura|jatiya|mejlis|oliy|khural|hluttaw|fono|"
                      r"general council|landtag|states|grand council|great hural|kurultai|kurultay|jogorku|sabor|skupština|"
                      r"verkhovna|rada|knesset|bundesrat|nationalrat|kesk|loya jirga|tynwald|keys"),
    ("local", r"\blocal|municipal|regional|provincial|gubernatorial|governor|mayor|state elections"),
    ("executive", r"prime minister|leader|head of state|king|emir|federal council|governor-general"),
]


def classify(desc):
    d = desc.lower()
    types = [t for t, rx in TYPE_RULES if re.search(rx, d)]
    if not types:
        types = ["other"]
    if "presidential" in types and "parliamentary" in types:
        primary = "general"
    else:
        primary = types[0]
    return primary, types


def wiki_url(href):
    if not href:
        return None
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/wiki/"):
        return "https://en.wikipedia.org" + href
    if href.startswith("/w/index.php"):
        return None  # red link: no article
    return href if href.startswith("http") else None


def make_entry(text, links, italic, date_iso, date_end, precision, year, section, idx, page_url):
    """text looks like 'Benin, Parliament' (country, description)."""
    if "," in text:
        country, desc = text.split(",", 1)
    else:
        country, desc = text, ""
    country, desc = country.strip(), desc.strip()
    if not country:
        return None
    # Prefer the article name of the 'Elections in X' link for the country
    ctry_link = next((l for l in links if "/wiki/Elections_in_" in l[1]), None)
    if ctry_link:
        country = ctry_link[0] or country
    iso3 = match_iso3(country, idx)
    article = next((wiki_url(l[1]) for l in links if l is not ctry_link and wiki_url(l[1])
                    and not l[1].startswith("/wiki/Elections_in_")), None)
    primary, types = classify(desc)
    indirect = section.lower().startswith("indirect")
    sort_date = date_iso if precision == "day" else (f"{date_iso}-28" if precision == "month" else f"{date_iso}-12-31")
    return {
        "date": date_iso,
        "date_end": date_end,
        "precision": precision,
        "sort_date": sort_date,
        "country": country,
        "iso3": iso3,
        "territory": italic,
        "type": primary,
        "types": types,
        "description": desc,
        "indirect": indirect,
        "article_url": article,
        "source_url": page_url,
    }


def parse_page(html_text, year, idx, page_url):
    tb = TreeBuilder()
    tb.feed(html_text)
    out = []
    for sec, uls in sections(tb.root):
        s = sec.replace("_", " ")
        sl = s.lower()
        if not (sl in MONTHS or sl.startswith("unknown") or sl.startswith("indirect")):
            continue
        for ul in uls:
            for li in [c for c in ul.children if isinstance(c, Node) and c.tag == "li"]:
                text, links, italic = own_content(li)
                nested = [c for c in li.children if isinstance(c, Node) and c.tag in ("ul", "ol")]
                labels, rest = [None], text
                mm = re.match(r"^([^:]{1,60}):\s*(.*)$", text)
                if mm:
                    parts = [x.strip() for x in re.split(r",|\band\b|;", mm.group(1)) if x.strip()]
                    if parts and all(label_is_date(x) for x in parts):
                        labels, rest = parts, mm.group(2)
                for label in labels:
                    date_iso, date_end, precision = parse_date_label(label, year, s)
                    if nested and not rest:
                        for ul2 in nested:
                            for li2 in [c for c in ul2.children if isinstance(c, Node) and c.tag == "li"]:
                                t2, l2, it2 = own_content(li2)
                                e = make_entry(t2, l2, it2, date_iso, date_end, precision, year, s, idx, page_url)
                                if e:
                                    out.append(e)
                    elif rest:
                        e = make_entry(rest, links, italic, date_iso, date_end, precision, year, s, idx, page_url)
                        if e:
                            out.append(e)
    return out


def main():
    today = datetime.now(timezone.utc).date()
    idx = load_country_index()
    years = [today.year, today.year + 1]
    if today.month <= 6:
        years.insert(0, today.year - 1)  # the 6-month look-back can reach last year
    all_items, pages = [], []
    for y in years:
        page = f"{y}_national_electoral_calendar"
        url = f"{API}?action=parse&page={urllib.parse.quote(page)}&prop=text|revid&format=json&formatversion=2&redirects=1"
        try:
            data = get_json(url)
        except Exception as e:  # noqa: BLE001
            print(f"ERROR fetching {page}: {e}", file=sys.stderr)
            if y == today.year:
                return 1
            continue
        if "error" in data:
            print(f"  {page}: {data['error'].get('info')}", file=sys.stderr)
            if y == today.year:
                return 1
            continue
        page_url = f"https://en.wikipedia.org/wiki/{page}"
        items = parse_page(data["parse"]["text"], y, idx, page_url)
        print(f"  {page}: {len(items)} entries")
        pages.append({"title": page.replace("_", " "), "url": page_url, "revid": data["parse"].get("revid"),
                      "entries": len(items)})
        all_items.extend(items)
        time.sleep(1)

    if len(all_items) < 20:
        print(f"ERROR: only {len(all_items)} entries parsed; keeping the existing file", file=sys.stderr)
        return 1

    cutoff = (today - timedelta(days=PAST_DAYS)).isoformat()
    t = today.isoformat()
    month_now = t[:7]
    kept, seen = [], {}
    for e in all_items:
        end = e["date_end"] or e["date"]
        if e["precision"] == "day":
            status = "past" if end < t else "upcoming"
        elif e["precision"] == "month":
            status = "past" if e["date"] < month_now else "upcoming"
        else:
            status = "past" if e["date"] < t[:4] else "upcoming"
        e["status"] = status
        if status == "past" and e["sort_date"] < cutoff:
            continue
        key = (e["date"], e["country"], e["description"])
        if key in seen:
            seen[key]["indirect"] = seen[key]["indirect"] or e["indirect"]
            continue
        seen[key] = e
        e["id"] = re.sub(r"[^a-z0-9]+", "-", f"{e['date']}-{e['iso3'] or e['country']}-{e['description']}".lower()).strip("-")[:90]
        kept.append(e)
    kept.sort(key=lambda e: (e["sort_date"], e["country"]))

    unmatched = sorted({e["country"] for e in kept if not e["iso3"] and not e["territory"]})
    if unmatched:
        print(f"  no iso3 for: {', '.join(unmatched)}")

    out = {
        "_meta": {
            "source": "Wikipedia — national electoral calendars",
            "license": "CC BY-SA 4.0",
            "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
            "attribution": "Source: Wikipedia, CC BY-SA",
            "pages": pages,
            "last_updated": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "past_days": PAST_DAYS,
            "counts": {
                "total": len(kept),
                "upcoming": sum(1 for e in kept if e["status"] == "upcoming"),
                "past": sum(1 for e in kept if e["status"] == "past"),
            },
        },
        "elections": kept,
    }
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    os.replace(tmp, OUT)
    print(f"Wrote {OUT}: {out['_meta']['counts']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

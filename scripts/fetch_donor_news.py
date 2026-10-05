#!/usr/bin/env python3
"""Donor news: latest news on official development assistance (ODA) donors.

Official RSS/Atom feeds where agencies publish one, otherwise a targeted Google News
RSS query per donor. Items are tagged with the donor (ISO3, or 'EU' / 'OECD') and
topics (cuts, pledge, humanitarian, climate-finance, ...) by keyword rules.

Output: site/server/data/donor-news.json (independent of news-config.json).
Items from the previous run are kept while still inside the window, so a feed that
fails once does not empty its donor's stream.
"""

import hashlib
import html
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote
from xml.etree import ElementTree

import requests

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUTPUT_FILE = os.path.join(ROOT, "site", "server", "data", "donor-news.json")
UA = "WorldCountryGroups/1.0 (+https://worldcountrygroups.exe.xyz)"
WINDOW_DAYS = 60
MAX_ITEMS = 900

# Must look like development / aid news (general ministry feeds and broad searches)
DEV_RE = re.compile(
    r"\b(aid|humanitarian|ODA|development (?:assistance|aid|finance|funding|cooperation|co-operation|partner\w*|project\w*|programme\w*|bank)|"
    r"international (?:development|assistance)|foreign assistance|donors?|grants?|loans?|relief|funding|funded|financ\w+|"
    r"pledg\w*|commit\w*|replenish\w*|refugees?|famine|Mattei Plan|vaccin\w*|climate finance|Global Gateway|"
    r"USAID|JICA|BMZ|GIZ|Danida|KOICA|AFD|T[İI]KA|Irish Aid|KSrelief|Enabel|AECID|CIDCA|QFFD)\b", re.I)


def gnews(q):
    return ("https://news.google.com/rss/search?q=" + quote(q + f" when:{WINDOW_DAYS}d")
            + "&hl=en-US&gl=US&ceid=US:en")


# kind: feed = official RSS/Atom; search = Google News query. filter: require DEV_RE match.
SOURCES = [
    # Official feeds (verified)
    {"id": "afd", "name": "AFD (Agence française de développement)", "donor": "FRA", "kind": "feed", "url": "https://www.afd.fr/en/rss.xml", "filter": False},
    {"id": "eu-intpa", "name": "European Commission, International Partnerships", "donor": "EU", "kind": "feed", "url": "https://international-partnerships.ec.europa.eu/node/2/rss_en", "filter": False},
    {"id": "fcdo", "name": "UK Foreign, Commonwealth & Development Office", "donor": "GBR", "kind": "feed", "url": "https://www.gov.uk/government/organisations/foreign-commonwealth-development-office.atom", "filter": True},
    {"id": "bmz", "name": "BMZ (German Development Ministry)", "donor": "DEU", "kind": "feed", "url": "https://www.bmz.de/en/feed.rss", "filter": False},
    {"id": "tika", "name": "TİKA (Turkish Cooperation and Coordination Agency)", "donor": "TUR", "kind": "feed", "url": "https://tika.gov.tr/en/feed/", "filter": False},
    {"id": "gac", "name": "Global Affairs Canada", "donor": "CAN", "kind": "feed",
     "url": "https://api.io.canada.ca/io-server/gc/news/en/v2?dept=departmentofforeignaffairstradeanddevelopment&sort=publishedDate&orderBy=desc&pick=50&format=atom&atomtitle=Global%20Affairs%20Canada",
     "filter": True},
    # News searches (no usable official feed)
    {"id": "gn-oecd", "name": "OECD (news search)", "donor": "OECD", "kind": "search", "url": gnews('site:oecd.org ("development assistance" OR "development co-operation" OR ODA)'), "filter": True, "must": r"\b((?-i:ODA)|aid|development (?:assistance|co-?operation|finance))\b"},
    {"id": "gn-oecd-oda", "name": "OECD ODA statistics (news search)", "donor": "OECD", "kind": "search", "url": gnews('OECD ("official development assistance" OR "ODA figures" OR "aid fell" OR "aid budgets")'), "filter": True, "must": r"\b(OECD|(?-i:ODA)|official development assistance)\b"},
    {"id": "gn-usa", "name": "US foreign assistance (news search)", "donor": "USA", "kind": "search", "url": gnews('("foreign aid" OR "foreign assistance" OR USAID) ("State Department" OR "United States" OR Congress)'), "filter": True, "must": r"\b((?-i:U\.?S\.?)|United States|American|USAID|State Department|Congress|Trump)\b"},
    {"id": "gn-deu", "name": "Germany: BMZ / GIZ (news search)", "donor": "DEU", "kind": "search", "url": gnews('(BMZ OR GIZ OR "German development" OR "Germany development aid" OR "German aid budget")'), "filter": True, "must": r"\b(German\w*|BMZ|GIZ|KfW)\b"},
    {"id": "gn-gbr", "name": "UK aid (news search)", "donor": "GBR", "kind": "search", "url": gnews('("UK aid" OR "UK aid budget" OR "British aid" OR "FCDO aid")'), "filter": True, "must": r"\b((?-i:UK|U\.K\.)|British|Britain|FCDO)\b"},
    {"id": "gn-fra", "name": "France development aid (news search)", "donor": "FRA", "kind": "search", "url": gnews('("Agence française de développement" OR "French aid" OR "France aid" OR "Expertise France" OR "French development")'), "filter": True, "must": r"\b(Fran\w+|AFD|Expertise France)\b"},
    {"id": "gn-jpn", "name": "Japan: JICA / ODA (news search)", "donor": "JPN", "kind": "search", "url": gnews('(JICA OR "Japan ODA" OR "Japanese ODA" OR "Japan official development assistance")'), "filter": True, "must": r"\b(JICA|Japan\w*)\b"},
    {"id": "gn-nor", "name": "Norway: Norad (news search)", "donor": "NOR", "kind": "search", "url": gnews('("Norwegian aid" OR "Norway development aid" OR "Norwegian development" OR (Norad Norway) -NORTHCOM -aerospace)'), "filter": True, "must": r"\b(Norw\w+)\b"},
    {"id": "gn-swe", "name": "Sweden: Sida (news search)", "donor": "SWE", "kind": "search", "url": gnews('("Swedish aid" OR "Sweden development aid" OR "Swedish development cooperation" OR "Sida" Sweden aid)'), "filter": True, "must": r"\b(Swed\w+|(?-i:Sida|SIDA))\b"},
    {"id": "gn-can", "name": "Canada international assistance (news search)", "donor": "CAN", "kind": "search", "url": gnews('("Canada foreign aid" OR "Canadian aid" OR "Canada international assistance" OR "Global Affairs Canada" funding)'), "filter": True, "must": r"\b(Canad\w+)\b"},
    {"id": "gn-aus", "name": "Australia: DFAT aid (news search)", "donor": "AUS", "kind": "search", "url": gnews('("Australian aid" OR "Australia aid budget" OR "Australia development assistance" OR DFAT aid Pacific)'), "filter": True, "must": r"\b(Australi\w+|DFAT)\b"},
    {"id": "gn-irl", "name": "Ireland: Irish Aid (news search)", "donor": "IRL", "kind": "search", "url": gnews('("Irish Aid" OR "Ireland overseas aid" OR "Ireland ODA")'), "filter": True, "must": r"\b(Irish|Ireland)\b"},
    {"id": "gn-dnk", "name": "Denmark: Danida (news search)", "donor": "DNK", "kind": "search", "url": gnews('(Danida OR "Danish development" OR "Denmark development aid")'), "filter": True, "must": r"\b(Danida|Danish|Denmark)\b"},
    {"id": "gn-nld", "name": "Netherlands development aid (news search)", "donor": "NLD", "kind": "search", "url": gnews('("Dutch development aid" OR "Dutch aid" OR "Netherlands development cooperation" OR "Dutch aid cuts")'), "filter": True, "must": r"\b(Dutch|Netherlands)\b"},
    {"id": "gn-che", "name": "Switzerland: SDC (news search)", "donor": "CHE", "kind": "search", "url": gnews('("Swiss Agency for Development and Cooperation" OR "Swiss development aid" OR "Swiss development cooperation")'), "filter": True, "must": r"\b(Swiss|Switzerland|(?-i:SDC))\b"},
    {"id": "gn-kor", "name": "Korea: KOICA (news search)", "donor": "KOR", "kind": "search", "url": gnews('(KOICA OR "Korea ODA" OR "Korean ODA")'), "filter": True, "must": r"\b(KOICA|Korea\w*)\b"},
    {"id": "gn-ita", "name": "Italy development cooperation (news search)", "donor": "ITA", "kind": "search", "url": gnews('("Italian development cooperation" OR "Italy development aid" OR "Italian aid" OR "Mattei Plan")'), "filter": True, "must": r"\b(Ital\w+|Mattei)\b"},
    {"id": "gn-esp", "name": "Spain: AECID (news search)", "donor": "ESP", "kind": "search", "url": gnews('(AECID OR "Spanish Cooperation" OR "Spain development aid")'), "filter": True, "must": r"\b(Spa\w+|AECID)\b"},
    {"id": "gn-bel", "name": "Belgium: Enabel (news search)", "donor": "BEL", "kind": "search", "url": gnews('(Enabel OR "Belgian development cooperation" OR "Belgium development aid")'), "filter": True, "must": r"\b(Belg\w+|Enabel)\b"},
    {"id": "gn-fin", "name": "Finland development cooperation (news search)", "donor": "FIN", "kind": "search", "url": gnews('(Finland OR Finnish) ("development cooperation" OR "development aid" OR "aid cuts" OR "humanitarian aid")'), "filter": True, "must": r"\b(Finland|Finnish)\b"},
    {"id": "gn-nzl", "name": "New Zealand aid (news search)", "donor": "NZL", "kind": "search", "url": gnews('("New Zealand" OR MFAT) ("aid" OR "development assistance" OR "aid programme") Pacific'), "filter": True, "must": r"\b(New Zealand|(?-i:NZ)|MFAT)\b"},
    {"id": "gn-sau", "name": "Saudi Arabia: SFD / KSrelief (news search)", "donor": "SAU", "kind": "search", "url": gnews('("Saudi Fund for Development" OR KSrelief OR "Saudi development aid")'), "filter": True, "must": r"\b(Saudi|KSrelief|(?-i:SFD))\b"},
    {"id": "gn-are", "name": "UAE: Abu Dhabi Fund (news search)", "donor": "ARE", "kind": "search", "url": gnews('("Abu Dhabi Fund for Development" OR "UAE Aid" OR "UAE humanitarian aid" OR "UAE foreign aid")'), "filter": True, "must": r"\b(UAE|Emirat\w+|Abu Dhabi)\b"},
    {"id": "gn-qat", "name": "Qatar Fund for Development (news search)", "donor": "QAT", "kind": "search", "url": gnews('("Qatar Fund for Development" OR QFFD)'), "filter": True, "must": r"\b(Qatar\w*|QFFD)\b"},
    {"id": "gn-kwt", "name": "Kuwait Fund (news search)", "donor": "KWT", "kind": "search", "url": gnews('("Kuwait Fund for Arab Economic Development" OR "Kuwait Fund")'), "filter": True, "must": r"\b(Kuwait\w*)\b"},
    {"id": "gn-chn", "name": "China: CIDCA (news search)", "donor": "CHN", "kind": "search", "url": gnews('(CIDCA OR "China International Development Cooperation Agency" OR "China foreign aid" OR "Chinese development aid")'), "filter": True, "must": r"\b(Chin\w+|CIDCA)\b"},
    {"id": "gn-tur", "name": "Türkiye: TİKA (news search)", "donor": "TUR", "kind": "search", "url": gnews('(TIKA OR "Turkish Cooperation and Coordination Agency") aid'), "filter": True, "must": r"\b(T[İI]KA|Turk\w*|Türk\w*)\b"},
    {"id": "gn-eu", "name": "EU development aid (news search)", "donor": "EU", "kind": "search", "url": gnews('("EU development aid" OR "Global Gateway" OR "EU humanitarian aid" OR "European Commission" "development funding")'), "filter": True, "must": r"\b((?-i:EU)|European|Global Gateway|Team Europe)\b"},
]

CAP = {"feed": 30, "search": 18}

DONOR_NAMES = {
    "FRA": "France", "EU": "European Union", "GBR": "United Kingdom", "DEU": "Germany", "TUR": "Türkiye",
    "CAN": "Canada", "OECD": "OECD", "USA": "United States", "JPN": "Japan", "NOR": "Norway", "SWE": "Sweden",
    "AUS": "Australia", "IRL": "Ireland", "DNK": "Denmark", "NLD": "Netherlands", "CHE": "Switzerland",
    "KOR": "Republic of Korea", "ITA": "Italy", "ESP": "Spain", "BEL": "Belgium", "FIN": "Finland",
    "NZL": "New Zealand", "SAU": "Saudi Arabia", "ARE": "United Arab Emirates", "QAT": "Qatar", "KWT": "Kuwait",
    "CHN": "China",
}

TOPICS = [
    ("cuts", re.compile(r"\b(cut|cuts|cutting|slash\w*|reduc\w+|freez\w*|shrink\w*|scrap\w*|dismantl\w*|shut(?:s|ting)? down|"
                        r"terminat\w+|wind(?:s|ing)? down|axe[ds]?|lower(?:s|ed)? (?:its |the )?aid|decline[ds]?|fell|fall(?:s|ing)?|drop(?:s|ped)?|lay-?offs?|"
                        r"rescission|claw\w* back)\b", re.I)),
    ("pledge", re.compile(r"\b(pledg\w*|commit(?:s|ted|ment|ments)?|replenish\w*|announc\w+ (?:new |an? )?(?:funding|support|package|contribution|grant)|"
                          r"contribut\w+ (?:of )?(?:\$|€|£|US\$|USD|EUR)|(?:\$|€|£|US\$|USD |EUR )\s?\d[\d.,]*\s?(?:m|bn|million|billion)|grant agreement|"
                          r"loan agreement|sign\w* (?:an? )?(?:agreement|grant|loan)|financing agreement)\b", re.I)),
    ("humanitarian", re.compile(r"\b(humanitarian|emergency|relief|famine|refugees?|displaced|earthquake|flood\w*|cyclone|drought|"
                                r"crisis|food (?:aid|assistance|insecurity)|UNHCR|WFP|UNRWA|OCHA|CERF)\b", re.I)),
    ("climate-finance", re.compile(r"\b(climate|adaptation|mitigation|loss and damage|COP ?\d\d|Green Climate Fund|renewable|"
                                   r"clean energy|biodiversity|desertification|resilien\w+)\b", re.I)),
    ("health", re.compile(r"\b(health|vaccin\w*|malaria|HIV|AIDS|tuberculosis|Gavi|Global Fund|polio|PEPFAR|WHO|pandemic|nutrition)\b", re.I)),
    ("budget", re.compile(r"\b(budget|ODA/GNI|0\.7 ?%|0\.7 per ?cent|appropriation\w*|spending review|aid target|finance bill|"
                          r"official development assistance|ODA)\b", re.I)),
    ("multilateral", re.compile(r"\b(World Bank|IDA\d*|African Development (?:Bank|Fund)|Asian Development Bank|IMF|UNDP|UNICEF|"
                                r"United Nations|UN agencies|multilateral)\b", re.I)),
]


def log(*a):
    print(*a, flush=True)


def get(url):
    last = None
    for attempt in range(3):
        try:
            r = requests.get(url, timeout=30, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5"})
            if r.status_code in (429, 500, 502, 503, 504):
                raise RuntimeError(f"HTTP {r.status_code}")
            r.raise_for_status()
            return r.content
        except requests.HTTPError as e:  # 4xx: no point retrying
            raise RuntimeError(str(e)) from e
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(4 * 2 ** attempt)
    raise RuntimeError(str(last))


def strip_html(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def parse_date(s):
    """UTC ISO string or None."""
    if not s:
        return None
    s = s.strip()
    dt = None
    try:
        dt = parsedate_to_datetime(s)
    except Exception:  # noqa: BLE001
        dt = None
    if dt is None:
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:  # noqa: BLE001
            m = re.match(r"(\d{4}-\d{2}-\d{2})", s)
            if not m:
                return None
            dt = datetime.fromisoformat(m.group(1))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def local(tag):
    return tag.rsplit("}", 1)[-1]


def parse_feed(data):
    """Yield dicts {title, url, date, summary, source} from RSS or Atom."""
    root = ElementTree.fromstring(data)
    out = []
    for el in root.iter():
        t = local(el.tag)
        if t not in ("item", "entry"):
            continue
        rec = {"title": "", "url": "", "date": None, "summary": "", "source": None}
        for ch in el:
            n = local(ch.tag)
            txt = (ch.text or "").strip()
            if n == "title":
                rec["title"] = strip_html(txt)
            elif n == "link":
                href = ch.get("href")
                if href and (ch.get("rel") in (None, "alternate")):
                    rec["url"] = rec["url"] or href
                elif txt:
                    rec["url"] = rec["url"] or txt
            elif n in ("pubDate", "published", "date") and not rec["date"]:
                rec["date"] = txt
            elif n == "updated" and not rec["date"]:
                rec["date"] = txt
            elif n in ("description", "summary", "content", "encoded") and not rec["summary"]:
                rec["summary"] = strip_html(txt if txt else "".join(ch.itertext()))
            elif n == "source":
                rec["source"] = strip_html(txt) or None
        if rec["title"] and rec["url"]:
            out.append(rec)
    return out


def accept(src, text):
    """Relevance rules: development keywords (filter) and the donor named (must)."""
    if src.get("filter") and not DEV_RE.search(text):
        return False
    if src.get("must") and not re.search(src["must"], text, re.I):
        return False
    return True


def norm_title(t):
    return re.sub(r"[^a-z0-9]+", "", t.lower())[:90]


def topics_for(text):
    return [name for name, rx in TOPICS if rx.search(text)]


def main():
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=WINDOW_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    future = (now + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    fetched_at = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    prev = {}
    try:
        prev = json.load(open(OUTPUT_FILE))
    except Exception:  # noqa: BLE001
        prev = {}

    items, statuses = [], []
    for src in SOURCES:
        st = {k: src[k] for k in ("id", "name", "donor", "kind")}
        st["url"] = src["url"] if src["kind"] == "feed" else src["url"].split("&hl=")[0]
        try:
            entries = parse_feed(get(src["url"]))
        except Exception as e:  # noqa: BLE001
            st.update(status="error", error=str(e)[:200], count=0)
            statuses.append(st)
            log(f"  {src['id']}: ERROR {e}")
            continue
        kept, no_date = [], 0
        for e in entries:
            pub = parse_date(e["date"])
            if not pub:
                no_date += 1
                continue
            if pub < cutoff or pub > future:
                continue
            title, source = e["title"], src["name"]
            if src["kind"] == "search":
                # Google News: "Headline - Publisher"; the <source> element names the publisher
                publisher = e["source"]
                if publisher and title.endswith(" - " + publisher):
                    title = title[: -len(publisher) - 3].strip()
                elif " - " in title:
                    title, _, tail = title.rpartition(" - ")
                    publisher = publisher or tail
                source = publisher or "Google News"
            excerpt = e["summary"]
            if src["kind"] == "search" or norm_title(excerpt).startswith(norm_title(title)[:40]):
                excerpt = ""  # Google News descriptions only repeat the headline
            text = f"{title} {excerpt}"
            if not accept(src, text):
                continue
            if len(excerpt) > 300:
                excerpt = excerpt[:297].rsplit(" ", 1)[0] + "…"
            kept.append({
                "id": hashlib.sha1((e["url"] or title).encode()).hexdigest()[:14],
                "title": title,
                "url": e["url"],
                "source": source,
                "sourceId": src["id"],
                "via": "official feed" if src["kind"] == "feed" else "news search",
                "donor": src["donor"],
                "publishedAt": pub,
                "excerpt": excerpt,
                "topics": topics_for(text),
                "fetchedAt": fetched_at,
            })
        kept.sort(key=lambda x: x["publishedAt"], reverse=True)
        kept = kept[: CAP[src["kind"]]]
        items.extend(kept)
        st.update(status="ok", count=len(kept), entries=len(entries), skipped_no_date=no_date)
        statuses.append(st)
        log(f"  {src['id']}: {len(kept)} kept of {len(entries)}" + (f" ({no_date} without date skipped)" if no_date else ""))
        time.sleep(1.0 if src["kind"] == "search" else 0.3)

    ok = sum(1 for s in statuses if s["status"] == "ok")
    if ok < len(SOURCES) // 2:
        sys.exit(f"Only {ok}/{len(SOURCES)} donor news sources worked; {OUTPUT_FILE} left unchanged.")

    # keep earlier items still in the window (a feed may fail or rotate items out)
    by_id = {s["id"]: s for s in SOURCES}
    for it in prev.get("items", []):
        src = by_id.get(it.get("sourceId"))
        if src and it.get("publishedAt", "") >= cutoff and accept(src, f"{it['title']} {it.get('excerpt', '')}"):
            items.append(it)

    # dedupe: same URL or same headline; official feeds win over searches, earliest fetch wins
    items.sort(key=lambda x: (x.get("via") != "official feed", x.get("fetchedAt", "")))
    seen_url, seen_title, out = set(), set(), []
    for it in items:
        k1, k2 = it["url"], (it["donor"], norm_title(it["title"]))
        if k1 in seen_url or k2 in seen_title:
            continue
        seen_url.add(k1)
        seen_title.add(k2)
        out.append(it)
    out.sort(key=lambda x: x["publishedAt"], reverse=True)
    out = out[:MAX_ITEMS]

    donors = sorted({it["donor"] for it in out})
    topic_counts = {name: sum(1 for it in out if name in it["topics"]) for name, _ in TOPICS}
    result = {
        "_meta": {
            "updated_at": fetched_at,
            "window_days": WINDOW_DAYS,
            "count": len(out),
            "note": "Official agency feeds where available, otherwise Google News RSS searches per donor. "
                    "Topics are assigned by keyword rules and can be wrong. Items without a publication date are skipped.",
            "donor_names": {d: DONOR_NAMES.get(d, d) for d in donors},
            "topics": topic_counts,
            "sources": statuses,
        },
        "items": out,
    }
    tmp = OUTPUT_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUTPUT_FILE)
    log(f"Written {OUTPUT_FILE}: {len(out)} items from {ok}/{len(SOURCES)} sources, {len(donors)} donors")


if __name__ == "__main__":
    main()

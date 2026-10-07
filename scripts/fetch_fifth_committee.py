#!/usr/bin/env python3
"""
UN budget, reform and the Fifth Committee (Administrative and Budgetary).

Sources (all public un.org pages that allow automated reading):
  * Fifth Committee pages for the current session: agenda, statements of delegations (with the
    statement PDFs, converted to text for search), draft resolutions and decisions.
  * Committee on Contributions: honour roll (Member States that paid the regular budget in full,
    amount and date; monthly counts in past years), scale of assessments 1946-2027 (spreadsheet),
    and the Article 19 list (arrears that can cost a country its General Assembly vote).
  * UN80 Initiative: key reform reports.
  * Press releases on Fifth Committee meetings (press.un.org) and news on UN80, the budget and the
    liquidity crisis, as indexed by Google News (press.un.org itself blocks automated access).

Outputs: site/server/data/fifth-committee.json and fifth-statements.json (statement texts).
"""
import hashlib
import html
import io
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen
from xml.etree import ElementTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_statements import build_country_map, compile_country_patterns, tag_countries  # noqa: E402

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "server", "data")
OUT = os.path.join(DATA_DIR, "fifth-committee.json")
TEXTS = os.path.join(DATA_DIR, "fifth-statements.json")
UA = "Mozilla/5.0 (compatible; WorldCountryGroups/1.0; research)"
BASE = "https://www.un.org/en/ga/fifth/"
CONTRIB = "https://www.un.org/en/ga/contributions/"
GN = "https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
MAX_TEXT = 40000
log = lambda *a: print(*a, flush=True)  # noqa: E731


def fetch(url, binary=False, timeout=45):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={"User-Agent": UA}), timeout=timeout) as r:
                b = r.read()
                return b if binary else b.decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    return None


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def rows_of(page):
    return [[c for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S)] for r in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S)]


def current_session(now):
    # the GA session starts in September: session 81 runs Sept 2026 - Sept 2027
    return now.year - 1945 if now.month >= 9 else now.year - 1946


# ----------------------------------------------------------------------------- Fifth Committee
def parse_agenda(sess):
    page = fetch(f"{BASE}{sess}/agenda{sess}.shtml")
    items = []
    for r in rows_of(page):
        c = [clean(x) for x in r]
        if len(c) >= 2 and re.match(r"^\d+[a-z]?$", c[0]):
            items.append({"item": c[0], "title": c[1]})
    return items


def parse_session_dates(sess):
    page = clean(fetch(f"{BASE}{sess}/main{sess}.shtml"))
    m = re.search(r"Main session \(([^)]+)\)", page)
    return m.group(1) if m else None


ON_BEHALF = re.compile(r"\((?:on behalf of|also on behalf of)\s+(?:the\s+)?(.+?)\)\s*$", re.I)


def parse_statements(sess, patterns):
    url = f"{BASE}{sess}/statements{sess}.0m.shtml"
    page = fetch(url)
    out = []
    for r in rows_of(page):
        if len(r) < 2:
            continue
        items = [x.strip() for x in clean(r[0]).split(",") if x.strip()]
        cell = r[1]
        topic = clean(" ".join(re.findall(r"<strong>(.*?)</strong>", cell, re.S))).strip(" :")
        if not topic and not items:
            topic = "Organization of work and general statements"
        for href, label in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', cell, re.S):
            href = urljoin(url, href)
            label = clean(label)
            if not label or not href.lower().endswith(".pdf"):
                continue
            m = re.search(r"/(\d{4})(\d{2})(\d{2})\d{9}/", href) or re.search(r"_(\d{4})_(\d{2})_(\d{2})_", href)
            date = f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None
            lang = (re.search(r"_([a-z]{2})\.pdf$", href) or [None, None])[1]
            ob = ON_BEHALF.search(label)
            speaker = ON_BEHALF.sub("", label).strip()
            official = bool(re.match(r"^(Introductory remarks|Address by|Presentation (of|by)|Statement by the (Controller|Under-Secretary|Secretary-General|Chair))", label, re.I))
            iso = None if official else (sorted(tag_countries(speaker, patterns)) or [None])[0]
            out.append({
                "items": items, "topic": topic or None, "date": date, "speaker": speaker, "onBehalfOf": ob.group(1) if ob else None,
                "official": official, "iso3": iso, "url": href, "lang": lang,
            })
    return out, url


def pdf_text(url, cache):
    key = hashlib.sha1(url.encode()).hexdigest()[:16]
    if key in cache:
        return cache[key]
    try:
        b = fetch(url, binary=True, timeout=60)
        p = subprocess.run(["pdftotext", "-layout", "-", "-"], input=b, capture_output=True, timeout=60)
        t = re.sub(r"[ \t]+", " ", p.stdout.decode("utf-8", "replace"))
        t = re.sub(r"\n{3,}", "\n\n", t).strip()[:MAX_TEXT]
    except Exception as e:  # noqa: BLE001
        log(f"  ! {url}: {e}")
        t = None
    cache[key] = t
    return t


def parse_resdec(sess):
    page = fetch(f"{BASE}{sess}/resdec{sess}.shtml")
    out, current = [], None
    for r in rows_of(page):
        c = [clean(x) for x in r]
        if len(c) == 1 and re.match(r"^\d+[a-z]?\.", c[0] or ""):
            current = c[0]
            continue
        # the page keeps some rows from past sessions: keep this session's only
        if len(c) >= 5 and any(c[:5]) and not c[0].startswith("Fifth Committee") and re.search(rf"/{sess}/|\b{sess}/", " ".join(c[:4])):
            links = re.findall(r'href="([^"]+)"', "".join(r))
            out.append({"item": current, "draft": c[0] or None, "action": c[1] or None, "resolution": c[2] or None,
                        "plenary": c[3] or None, "description": c[4] or None, "links": links[:4]})
    return out


# ----------------------------------------------------------------------------- contributions
def parse_honour_roll(name_to_iso):
    url = CONTRIB + "honourroll.shtml"
    page = fetch(url)
    rows = rows_of(page)
    head = clean(rows[0][0]) if rows else ""
    m = re.search(r"As of (\d{1,2} \w+ \d{4}), (\d+) Member States", head)
    paid = []
    history = {"years": [], "months": {}}
    for r in rows:
        c = [clean(x) for x in r]
        if len(c) == 4 and re.match(r"^\d+$", c[0]):
            try:
                d = datetime.strptime(c[3], "%d-%b-%y").date().isoformat()
            except ValueError:
                d = None
            amt = float(c[2].replace(",", "")) if re.match(r"^[\d,]+(\.\d+)?$", c[2]) else None
            paid.append({"n": int(c[0]), "country": c[1], "iso3": name_to_iso(c[1]), "usd": amt, "date": d})
        elif c and c[0] in ("Month", "Months") or (len(c) > 10 and all(re.match(r"^\d{4}$", x) for x in c[2:6] if x)):
            years = [int(x) for x in c if re.match(r"^\d{4}$", x or "")]
            if years:
                history["years"] = years
        elif c and c[0] in ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"):
            vals = [int(x) if re.match(r"^\d+$", x or "") else None for x in c[2:]]
            history["months"][c[0]] = vals
    ot = re.search(r"following (\d+) Member States have paid their regular budget assessments in full within the 30 day due period[^(]*\(by (\d{1,2} \w+ \d{4})\)", clean(page))
    return {"asOf": m.group(1) if m else None, "paidCount": int(m.group(2)) if m else len(paid), "paid": paid, "history": history, "url": url,
            "onTimeCount": int(ot.group(1)) if ot else None, "dueDate": ot.group(2) if ot else None}


def parse_scale(name_to_iso):
    import openpyxl
    url = CONTRIB + "Scale%20of%20Assessments%20for%20RB%201946-2027.xlsx"
    wb = openpyxl.load_workbook(io.BytesIO(fetch(url, binary=True)), read_only=True, data_only=True)
    rows = list(wb.worksheets[0].iter_rows(values_only=True))
    hi = next(i for i, r in enumerate(rows) if r and r[0] == "Member State")
    hdr = rows[hi]
    cols = [(i, h) for i, h in enumerate(hdr) if isinstance(h, int)]
    (ci, cy), (pi_, py) = cols[-1], cols[-2]
    out = []
    for r in rows[hi + 1:]:
        if not r or not r[0] or not isinstance(r[0], str) or r[0].strip().lower() == "total":
            continue
        cur, prev = r[ci], r[pi_]
        if not isinstance(cur, (int, float)):
            continue
        hist = [{"col": h, "pct": r[i]} for i, h in cols if isinstance(r[i], (int, float))]
        out.append({"country": r[0].strip(), "iso3": name_to_iso(r[0].strip()), "pct": round(float(cur), 3),
                    "prevPct": round(float(prev), 3) if isinstance(prev, (int, float)) else None, "history": hist[-12:]})
    out.sort(key=lambda x: -x["pct"])
    return {"column": cy, "prevColumn": py, "period": "2025–2027", "prevPeriod": "2022–2024", "countries": out, "url": url}


def parse_article19(name_to_iso):
    url = "https://www.un.org/en/ga/about/art19.shtml"
    t = clean(re.sub(r"<(script|style)[^>]*>.*?</\1>", "", fetch(url), flags=re.S))
    m = re.search(r"provisions of Article 19 \[[^\]]*\]:\s*(.+?)\s*\*\s*(In its resolution.+?)(?:Therefore|For more information|-->)", t)
    names, note = [], None
    if m:
        body = m.group(1)
        names = re.findall(r"([A-Z][A-Za-z'’ ]+?(?:\([^)]+\))?)(?=\s+[A-Z]|$)", body)
        note = m.group(2).strip()
    # re-split on known country names to avoid splitting multi-word names
    found = []
    for name, iso in sorted(((n, i) for n, i in NAME_INDEX.items()), key=lambda x: -len(x[0])):
        if m and name in m.group(1) and iso not in [f["iso3"] for f in found]:
            found.append({"country": name, "iso3": iso})
    return {"countries": found, "note": note, "url": url}


# ----------------------------------------------------------------------------- UN80 and news
def parse_un80():
    url = "https://www.un.org/un80-initiative/en"
    page = fetch(url)
    seen, reports = set(), []
    for href, label in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', page, re.S):
        label = clean(label)
        if re.search(r"Workstream|Progress Report|Comprehensive Guide|Mandate Implementation|Shifting Paradigms", label) and label not in seen:
            seen.add(label)
            reports.append({"title": label, "url": urljoin(url, href)})
    return {"reports": reports, "url": url, "actions": "https://un80actions.un.org/"}


NEWS_QUERIES = [
    ("fifth", '"Fifth Committee" OR "budgetary questions" United Nations'),
    ("reform", '"UN80" OR "UN80 Initiative" OR "mandate implementation review"'),
    ("budget", '"United Nations" ("liquidity crisis" OR "regular budget" OR arrears OR "unpaid dues" OR "budget cuts" OR "programme budget")'),
]
OFFICIAL = re.compile(r"(^|\.)un\.org$")
UN_REF = re.compile(r"\b(UN|U\.N\.|United Nations|UN80|Guterres|Secretariat|Secretary-General|Fifth Committee|General Assembly|peacekeeping)\b")
TOPIC_REF = re.compile(r"budget|liquidity|cash|arrears|dues|fund(ing|s)?\b|cuts?\b|jobs|staff|layoffs?|reform|UN80|mandates?|merg|relocat|efficien|assessed|contribution|financ|austerity|shortfall|savings", re.I)


def news_items(now, first_run):
    out = {}
    days = 365 if first_run else 21
    step = 14
    end = now.date() + timedelta(days=1)
    windows = []
    while (now.date() - end).days < days:
        start = end - timedelta(days=step)
        windows.append((start.isoformat(), end.isoformat()))
        end = start
    for topic, q in NEWS_QUERIES:
        for a, b in windows:
            try:
                root = ElementTree.fromstring(fetch(GN.format(q=quote(f"{q} after:{a} before:{b}")), binary=True))
            except Exception as e:  # noqa: BLE001
                log(f"  ! news {topic} {a}: {e}")
                continue
            for it in root.iter("item"):
                src = it.find("source")
                src_name = (src.text or "").strip() if src is not None else ""
                host = re.sub(r"^https?://(www\.)?", "", (src.get("url") if src is not None else "") or "").strip("/").lower()
                title = (it.findtext("title") or "").strip()
                if src_name and title.endswith(" - " + src_name):
                    title = title[: -len(src_name) - 3]
                title = re.sub(r"\s+-\s+(UN Meetings Coverage and Press Releases|United Nations.*)$", "", title).strip()
                if len(title) < 25:
                    continue
                if topic == "fifth" and not OFFICIAL.search(host) and "Fifth Committee" not in title:
                    continue
                if topic in ("budget", "reform") and not (UN_REF.search(title) and TOPIC_REF.search(title)):
                    continue
                try:
                    d = parsedate_to_datetime(it.findtext("pubDate")).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                except Exception:  # noqa: BLE001
                    continue
                k = re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()[:120]
                rec = out.get(k) or {"title": title, "url": (it.findtext("link") or "").strip(), "date": d, "outlet": src_name, "host": host,
                                     "official": bool(OFFICIAL.search(host)), "topics": []}
                if topic not in rec["topics"]:
                    rec["topics"].append(topic)
                rec["date"] = min(rec["date"], d)
                out[k] = rec
            time.sleep(1.0)
    return out


NAME_INDEX = {}


def main():
    now = datetime.now(timezone.utc)
    sess = current_session(now)
    cmap = build_country_map()
    patterns = compile_country_patterns(cmap)
    NAME_INDEX.update(cmap)
    NAME_INDEX.update({"Bolivia (Plurinational State of)": "BOL", "Venezuela (Bolivarian Republic of)": "VEN", "Sao Tome and Principe": "STP",
                       "United States of America": "USA", "United Kingdom of Great Britain and Northern Ireland": "GBR", "Republic of Korea": "KOR",
                       "Democratic People's Republic of Korea": "PRK", "Iran (Islamic Republic of)": "IRN", "Micronesia (Federated States of)": "FSM",
                       "Türkiye": "TUR", "Russian Federation": "RUS", "Republic of Moldova": "MDA", "United Republic of Tanzania": "TZA",
                       "Lao People's Democratic Republic": "LAO", "Syrian Arab Republic": "SYR", "Viet Nam": "VNM", "Côte d'Ivoire": "CIV",
                       "Netherlands (Kingdom of the)": "NLD", "Czechia": "CZE", "Democratic Republic of the Congo": "COD"})

    def name_to_iso(n):
        n = n.replace("’", "'").strip()
        if n in NAME_INDEX:
            return NAME_INDEX[n]
        found = sorted(tag_countries(n, patterns))
        return found[0] if len(found) == 1 else None

    try:
        with open(OUT) as f:
            prev = json.load(f)
    except Exception:  # noqa: BLE001
        prev = {}
    try:
        with open(TEXTS) as f:
            texts = json.load(f)
    except Exception:  # noqa: BLE001
        texts = {}

    status = {}

    def step(name, fn, default):
        try:
            v = fn()
            status[name] = "ok"
            return v
        except Exception as e:  # noqa: BLE001
            log(f"  ! {name}: {e}")
            status[name] = f"failed: {e}"[:200]
            return (prev.get(name) if prev.get(name) is not None else default)

    log(f"Fifth Committee, session {sess} …")
    agenda = step("agenda", lambda: parse_agenda(sess), [])
    dates = step("sessionDates", lambda: parse_session_dates(sess), None)
    stm = step("statementsPage", lambda: parse_statements(sess, patterns), None)
    statements = stm[0] if isinstance(stm, tuple) else (prev.get("statements") or [])
    for s in statements:
        if s.get("lang") in (None, "en") or not any(x["url"] != s["url"] and x["speaker"] == s["speaker"] and x["items"] == s["items"] for x in statements):
            t = pdf_text(s["url"], texts)
            s["chars"] = len(t) if t else 0
            s["textKey"] = hashlib.sha1(s["url"].encode()).hexdigest()[:16] if t else None
    log(f"  {len(agenda)} agenda items, {len(statements)} statements ({sum(1 for s in statements if s.get('textKey'))} with text)")
    resdec = step("resdec", lambda: parse_resdec(sess), [])
    log(f"  {len(resdec)} draft resolutions/decisions")

    log("Contributions …")
    honour = step("honourRoll", lambda: parse_honour_roll(name_to_iso), None)
    scale = step("scale", lambda: parse_scale(name_to_iso), None)
    art19 = step("article19", lambda: parse_article19(name_to_iso), None)
    if honour:
        log(f"  honour roll: {honour['paidCount']} paid as of {honour['asOf']}")
    if scale:
        log(f"  scale: {len(scale['countries'])} countries; top {scale['countries'][0]['country']} {scale['countries'][0]['pct']}%")
    if art19:
        log(f"  Article 19: {[c['country'] for c in art19['countries']]}")

    log("UN80 and news …")
    un80 = step("un80", parse_un80, None)
    first = not (prev.get("_meta") or {}).get("newsBackfilled")
    news = {re.sub(r"[^a-z0-9]+", " ", n["title"].lower()).strip()[:120]: n for n in (prev.get("news") or [])}
    try:
        for k, v in news_items(now, first).items():
            if k in news:
                news[k]["topics"] = sorted(set(news[k]["topics"]) | set(v["topics"]))
                news[k]["date"] = min(news[k]["date"], v["date"])
            else:
                news[k] = v
        status["news"] = "ok"
    except Exception as e:  # noqa: BLE001
        status["news"] = f"failed: {e}"[:200]
    news_list = sorted(news.values(), key=lambda n: n["date"], reverse=True)
    cutoff = (now - timedelta(days=730)).strftime("%Y-%m-%d")
    news_list = [n for n in news_list if n["date"] >= cutoff]
    for n in news_list:
        n["countries"] = sorted(tag_countries(n["title"], patterns))
    log(f"  {len(news_list)} news items")

    out = {
        "_meta": {
            "updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "session": sess, "status": status, "newsBackfilled": True,
            "sources": {
                "fifth": BASE + f"{sess}/main{sess}.shtml", "statements": f"{BASE}{sess}/statements{sess}.0m.shtml",
                "resdec": f"{BASE}{sess}/resdec{sess}.shtml", "contributions": CONTRIB, "un80": "https://www.un.org/un80-initiative/en",
            },
        },
        "session": {"n": sess, "mainSession": dates},
        "agenda": agenda,
        "statements": statements,
        "resdec": resdec,
        "honourRoll": honour,
        "scale": scale,
        "article19": art19,
        "un80": un80,
        "news": news_list,
    }
    for path, data in ((OUT, out), (TEXTS, texts)):
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, path)
    log(f"wrote {OUT}")
    if all(v != "ok" for v in status.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()

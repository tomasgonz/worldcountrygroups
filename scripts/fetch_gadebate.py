#!/usr/bin/env python3
"""Fetch UN General Debate statements from gadebate.un.org for one or more sessions.

Merges into site/server/data/un-speeches-index.json without touching other
sessions or existing analyses (unless the speech text changes).

For every speaker page listed in the site's sitemap it collects:
  - speaker name, honorific, function, and the date they spoke
  - the statement text, taken from (in order of preference):
      1. the official English PDF               -> text_source "pdf_en"
      2. the UN's AI-generated English transcript -> text_source "transcript_en"
      3. the official PDF in the original language -> text_source "pdf_<lang>"
  - the UN Meetings Coverage summary and UN News story link, when present

Usage:
  python3 scripts/fetch_gadebate.py --session 81
  python3 scripts/fetch_gadebate.py --session 80 --upgrade-non-english
  python3 scripts/fetch_gadebate.py --session 81 --only france,brazil
"""

import argparse
import html as htmllib
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.request

BASE = "https://gadebate.un.org"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA_DIR = os.path.join(ROOT, "site", "server", "data")
SPEECHES_DIR = os.path.join(DATA_DIR, "speeches")
INDEX_FILE = os.path.join(DATA_DIR, "un-speeches-index.json")
WORLD_JSON = os.path.join(ROOT, "worldcountrygroups", "data", "groups", "world.json")

# gadebate slug -> ISO3, for slugs that don't match our country names
SLUG_ALIASES = {
    "united-states-america": "USA",
    "united-kingdom-great-britain-and-northern-ireland": "GBR",
    "republic-korea": "KOR",
    "democratic-peoples-republic-korea": "PRK",
    "iran-islamic-republic": "IRN",
    "venezuela-bolivarian-republic": "VEN",
    "bolivia-plurinational-state": "BOL",
    "united-republic-tanzania": "TZA",
    "syrian-arab-republic": "SYR",
    "lao-peoples-democratic-republic": "LAO",
    "democratic-republic-congo": "COD",
    "congo": "COG",
    "republic-congo": "COG",
    "cote-divoire": "CIV",
    "micronesia-federated-states": "FSM",
    "republic-moldova": "MDA",
    "turkiye": "TUR",
    "viet-nam": "VNM",
    "brunei-darussalam": "BRN",
    "russian-federation": "RUS",
    "state-palestine": "PSE",
    "holy-see": "VAT",
    "naoero": "NRU",
    "nauru": "NRU",
    "czechia": "CZE",
    "czech-republic": "CZE",
    "cabo-verde": "CPV",
    "eswatini": "SWZ",
    "gambia": "GMB",
    "gambia-republic-of-the": "GMB",
    "bahamas": "BHS",
    "netherlands-kingdom-the": "NLD",
    "netherlands": "NLD",
    "north-macedonia": "MKD",
    "sao-tome-and-principe": "STP",
    "timor-leste": "TLS",
}

# Pages that are not Member/Observer State statements
NON_STATE_SLUGS = {
    "secretary-general-united-nations",
    "president-general-assembly-opening",
    "president-general-assembly-closing",
    "president-general-assembly",
    "european-union",
}

STOPWORDS = {
    'the', 'and', 'that', 'this', 'with', 'from', 'have', 'been', 'were', 'will',
    'would', 'could', 'should', 'which', 'their', 'there', 'they', 'them', 'than',
    'what', 'when', 'where', 'while', 'also', 'more', 'most', 'must', 'only',
    'other', 'some', 'such', 'very', 'just', 'over', 'into', 'about', 'after',
    'before', 'between', 'each', 'every', 'both', 'through', 'during', 'under',
    'above', 'below', 'same', 'well', 'these', 'those', 'being', 'does', 'done',
    'doing', 'like', 'make', 'made', 'many', 'much', 'need', 'even', 'back',
    'take', 'come', 'came', 'give', 'gave', 'good', 'great', 'long', 'still',
    'first', 'last', 'never', 'then', 'here', 'part', 'upon', 'shall', 'your',
    'president', 'assembly', 'general', 'united', 'nations', 'session',
    'country', 'countries', 'people', 'world', 'international', 'national',
    'government', 'state', 'states', 'year', 'years', 'today', 'time',
    'continue', 'continued', 'efforts', 'work', 'important', 'ensure',
    'page', 'excellency', 'distinguished', 'delegates', 'thank', 'want', 'know',
    'going', 'think', 'because', 'said', 'says', 'really', 'things', 'thing',
}


def slugify(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = s.lower().replace("'", "").replace("’", "")
    s = re.sub(r"\b(of|the|and)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def http_get(url, method="GET", retries=3, timeout=60):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, method=method, headers={
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/json,*/*",
                "Accept-Language": "en-US,en;q=0.9",
            })
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (404, 403):
                return None
            time.sleep(2 * (attempt + 1))
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None


def sitemap_slugs(session):
    idx = http_get(f"{BASE}/sitemap.xml")
    if not idx:
        sys.exit("Could not fetch sitemap index")
    pages = re.findall(r"<loc>([^<]+)</loc>", idx.decode())
    slugs = set()
    for p in pages:
        body = http_get(htmllib.unescape(p))
        if not body:
            continue
        for m in re.finditer(rf"<loc>{re.escape(BASE)}/en/{session}/([^<]+?)/?</loc>", body.decode()):
            slugs.add(m.group(1))
    return sorted(slugs)


def field_text(page, field):
    m = re.search(rf'field--name-{field}\b[^>]*>(.*?)</div>\s*(?:</div>\s*)*', page, re.S)
    if not m:
        return ""
    inner = re.sub(r"<[^>]+>", " ", m.group(1))
    return re.sub(r"\s+", " ", htmllib.unescape(inner)).strip()


def block_text(page, field):
    """Return paragraph text of a long-text field, preserving paragraph breaks."""
    m = re.search(rf'field--name-{field}\b.*?<div class="field__item">(.*?)</div>\s*</div>\s*</div>', page, re.S)
    if not m:
        return ""
    inner = re.sub(r"</(p|h\d|li)>", "\n", m.group(1))
    inner = re.sub(r"<[^>]+>", "", inner)
    lines = [re.sub(r"\s+", " ", htmllib.unescape(l)).strip() for l in inner.split("\n")]
    return "\n".join(l for l in lines if l)


def parse_page(page, session):
    info = {}
    info["country_name"] = field_text(page, "field-speaker-list")
    if not info["country_name"]:
        m = re.search(r'og:title" content="([^"|]+)', page)
        info["country_name"] = htmllib.unescape(m.group(1)).strip() if m else ""
    info["speaker_honorific"] = field_text(page, "field-speaker-title")
    info["speaker"] = field_text(page, "field-speaker-name")
    info["speaker_title"] = field_text(page, "field-speaker-function-2")
    m = re.search(r'<time datetime="(\d{4}-\d{2}-\d{2})', page)
    info["date"] = m.group(1) if m else ""
    info["pdfs"] = list(dict.fromkeys(re.findall(rf'/sites/default/files/gastatements/{session}/([a-z0-9]+_[a-z]+)\.pdf', page, re.I)))
    m = re.search(r'data-prepare-url="(/en/node/\d+/transcript/en/prepare-download)"', page)
    info["transcript_prepare"] = m.group(1) if m else None

    coverage = block_text(page, "field-no-summary-text") or block_text(page, "field-statement-detail")
    coverage = re.sub(r"^Meetings Coverage[^\n]*\n", "", coverage)
    info["un_summary"] = coverage.strip()
    m = re.search(r'field--name-field-news-title.*?<a href="([^"]+)">([^<]+)</a>', page, re.S)
    info["news"] = {"url": m.group(1), "title": htmllib.unescape(m.group(2)).strip()} if m else None
    m = re.search(r'href="(https://press\.un\.org/en/\d{4}/ga\d+\.doc\.htm)"', page)
    info["press_release"] = m.group(1) if m else None
    return info


def pdf_text(path):
    text = ""
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            text = "\n\n".join((p.extract_text() or "") for p in pdf.pages).strip()
    except Exception:
        text = ""
    if len(text.split()) < 50 or "(cid:" in text:
        try:
            text = subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True,
                                  text=True, timeout=120).stdout.strip()
        except Exception:
            text = ""
    if len(text.split()) < 50 or "(cid:" in text:
        return ""
    return text


COMMON_EN = {"the", "and", "of", "to", "in", "a", "is", "that", "we", "for", "our", "this", "on", "with", "are"}


def looks_english(text):
    """True when extracted text reads as English prose rather than font-encoding garbage."""
    tokens = re.findall(r"[A-Za-z]+", text.lower())
    if len(tokens) < 100:
        return False
    return sum(t in COMMON_EN for t in tokens) / len(tokens) > 0.15


MIN_PDF_WORDS = 600  # shorter English PDFs are usually excerpts; prefer a longer transcript


def fetch_transcript(prepare_path):
    body = http_get(BASE + prepare_path, method="POST")
    if not body:
        return ""
    try:
        url = json.loads(body)["url"]
    except Exception:
        return ""
    txt = http_get(BASE + url.replace("\\/", "/"))
    if not txt:
        return ""
    text = txt.decode("utf-8", "replace")
    # Drop the header block (Meeting/Event, Date, disclaimer) and the PGA introduction
    text = re.sub(r"^Meeting/Event:.*?\[Auto-generated transcript[^\]]*\]\s*", "", text, flags=re.S)
    return text.strip()


def keywords(text):
    words = [w for w in re.split(r"[^a-z]+", text.lower()) if len(w) >= 4 and w not in STOPWORDS]
    freq = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1
    return [k for k, _ in sorted(freq.items(), key=lambda x: -x[1])[:15]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--session", type=int, action="append", required=True)
    ap.add_argument("--only", help="comma-separated gadebate slugs to process")
    ap.add_argument("--upgrade-non-english", action="store_true",
                    help="replace existing non-English texts with the English transcript when available")
    ap.add_argument("--recheck", action="store_true",
                    help="re-evaluate existing texts that are garbled or very short")
    ap.add_argument("--delay", type=float, default=0.4)
    args = ap.parse_args()

    world = json.load(open(WORLD_JSON))["countries"]
    by_iso2 = {c["iso2"].lower(): c for c in world if c.get("iso2")}
    by_iso3 = {c["iso3"]: c for c in world}
    by_slug = {slugify(c["name"]): c for c in world}

    index = json.load(open(INDEX_FILE))
    lookup = {(s["iso3"], s["session"]): s for s in index["speeches"]}
    os.makedirs(SPEECHES_DIR, exist_ok=True)

    unmatched, failed, added, updated, retexted = [], [], 0, 0, 0

    for session in args.session:
        year = 1945 + session
        pdf_dir = os.path.join(DATA_DIR, f"pdfs-{session}")
        os.makedirs(pdf_dir, exist_ok=True)
        slugs = args.only.split(",") if args.only else sitemap_slugs(session)
        print(f"Session {session} ({year}): {len(slugs)} pages")

        for slug in slugs:
            if slug in NON_STATE_SLUGS:
                continue
            raw = http_get(f"{BASE}/en/{session}/{slug}")
            if not raw:
                failed.append((session, slug, "page fetch failed"))
                continue
            page = raw.decode("utf-8", "replace")
            info = parse_page(page, session)

            # Resolve country: PDF filename prefix, then slug alias, then name
            country = None
            if slug in SLUG_ALIASES:
                country = by_iso3.get(SLUG_ALIASES[slug])
            if not country:
                country = by_slug.get(slug) or by_slug.get(slugify(info["country_name"]))
            if not country:
                for p in info["pdfs"]:
                    country = by_iso2.get(p.split("_")[0])
                    if country:
                        break
            if not country:
                unmatched.append((session, slug, info["country_name"]))
                continue

            iso3, iso2 = country["iso3"], country["iso2"]
            existing = lookup.get((iso3, session))
            fname = f"{iso3}_{session}.txt"
            txt_path = os.path.join(SPEECHES_DIR, fname)

            bad_existing = False
            if args.recheck and existing is not None and os.path.exists(txt_path):
                cur = open(txt_path, errors="replace").read()
                bad_existing = not looks_english(cur) or len(cur.split()) < MIN_PDF_WORDS
            need_text = (existing is None or not os.path.exists(txt_path) or bad_existing
                         or (args.upgrade_non_english and existing.get("language", "en") != "en"
                             and existing.get("text_source") != "transcript_en"))

            text, source, lang = "", None, None
            if need_text:
                en_pdfs = [p for p in info["pdfs"] if p.endswith("_en")]
                for p in en_pdfs:
                    path = os.path.join(pdf_dir, p + ".pdf")
                    if not os.path.exists(path):
                        body = http_get(f"{BASE}/sites/default/files/gastatements/{session}/{p}.pdf")
                        if body and len(body) > 500:
                            open(path, "wb").write(body)
                    if os.path.exists(path):
                        text = pdf_text(path)
                        if text and looks_english(text):
                            source, lang = "pdf_en", "en"
                            break
                        text = ""
                if info["transcript_prepare"] and (not text or len(text.split()) < MIN_PDF_WORDS):
                    tr = fetch_transcript(info["transcript_prepare"])
                    if len(tr.split()) >= 150 and len(tr.split()) > len(text.split()):
                        text, source, lang = tr, "transcript_en", "en"
                if not text:
                    for p in info["pdfs"]:
                        if p.endswith("_en"):
                            continue
                        path = os.path.join(pdf_dir, p + ".pdf")
                        if not os.path.exists(path):
                            body = http_get(f"{BASE}/sites/default/files/gastatements/{session}/{p}.pdf")
                            if body and len(body) > 500:
                                open(path, "wb").write(body)
                        if os.path.exists(path):
                            text = pdf_text(path)
                            if text:
                                lang = p.split("_")[1]
                                source = f"pdf_{lang}"
                                break
                if not text and existing is None:
                    failed.append((session, slug, "no usable text"))
                    time.sleep(args.delay)
                    continue

            entry = existing or {"iso3": iso3, "iso2": iso2, "session": session, "year": year, "file": fname}
            entry.update({
                "speaker": info["speaker"] or entry.get("speaker", ""),
                "speaker_title": info["speaker_title"] or entry.get("speaker_title", ""),
                "speaker_honorific": info["speaker_honorific"],
                "date": info["date"] or entry.get("date") or f"{year}-09-23",
                "source_url": f"{BASE}/en/{session}/{slug}",
            })
            if info["pdfs"]:
                entry["pdf_urls"] = [f"{BASE}/sites/default/files/gastatements/{session}/{p}.pdf" for p in info["pdfs"]]
            if info["un_summary"]:
                entry["un_summary"] = info["un_summary"]
            if info["news"]:
                entry["un_news"] = info["news"]
            if info["press_release"]:
                entry["press_release"] = info["press_release"]

            if text:
                with open(txt_path, "w") as f:
                    f.write(text)
                entry["file"] = fname
                entry["word_count"] = len(text.split())
                entry["keywords"] = keywords(text)
                entry["text_source"] = source
                entry["language"] = lang
                if existing is not None:
                    entry.pop("analysis", None)  # text changed: re-analyze
                    retexted += 1
            if existing is None:
                index["speeches"].append(entry)
                lookup[(iso3, session)] = entry
                added += 1
            else:
                updated += 1

            print(f"  {session} {iso3} {info['speaker'] or '?':30.30} {source or 'meta-only':14} "
                  f"{entry.get('word_count', 0)} words")
            time.sleep(args.delay)

    meta = index["_meta"]
    meta["total_speeches"] = len(index["speeches"])
    meta["sessions"] = sorted({s["session"] for s in index["speeches"]})
    meta["country_count"] = len({s["iso3"] for s in index["speeches"]})
    meta["updated_at"] = time.strftime("%Y-%m-%d")
    max_s = max(meta["sessions"])
    meta["source"] = f"Harvard Dataverse UNGDC (sessions 25-79) + gadebate.un.org (sessions 80-{max_s})"

    tmp = INDEX_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
    os.replace(tmp, INDEX_FILE)

    print(f"\nAdded {added}, updated {updated} (re-texted {retexted})")
    if unmatched:
        print("Unmatched pages:")
        for u in unmatched:
            print("  ", u)
    if failed:
        print("Failed:")
        for f_ in failed:
            print("  ", f_)


if __name__ == "__main__":
    main()

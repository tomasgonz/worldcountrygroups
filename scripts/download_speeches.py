#!/usr/bin/env python3
"""Download UN General Debate 80th session (2025) speeches from gadebate.un.org"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
import pdfplumber

SESSION = 80
YEAR = 2025
BASE_URL = "https://gadebate.un.org/sites/default/files/gastatements/80"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "site", "server", "data")
SPEECHES_DIR = os.path.join(DATA_DIR, "speeches")
INDEX_FILE = os.path.join(DATA_DIR, "un-speeches-index.json")
PDF_DIR = os.path.join(DATA_DIR, "pdfs-80")
WORLD_JSON = os.path.join(os.path.dirname(__file__), "..", "worldcountrygroups", "data", "groups", "world.json")

# Some countries don't participate or have different codes on the UN site
# Map our iso2 -> UN site code (lowercase) when they differ
ISO2_OVERRIDES = {}

# Countries that typically don't speak at UNGA general debate
SKIP = {"AS", "GU", "MP", "PR", "VI", "UM", "AQ", "BV", "HM", "TF", "GS", "IO",
        "CX", "CC", "NF", "CK", "NU", "TK", "WF", "PM", "BL", "MF", "SX", "CW",
        "BQ", "AW", "FK", "GI", "SH", "PN", "TC", "VG", "AI", "MS", "KY", "BM",
        "GL", "FO", "AX", "SJ", "JE", "GG", "IM", "HK", "MO", "TW", "EH", "XK"}


def load_countries():
    with open(WORLD_JSON) as f:
        data = json.load(f)
    return [(c["iso2"], c["iso3"], c["name"]) for c in data["countries"] if c["iso2"] and c["iso2"] not in SKIP]


def download_pdf(iso2, name):
    """Try to download PDF in English, then original language."""
    code = ISO2_OVERRIDES.get(iso2, iso2).lower()
    pdf_path = os.path.join(PDF_DIR, f"{code}_en.pdf")

    if os.path.exists(pdf_path):
        return pdf_path

    # Try English first, then common language codes
    attempts = [
        f"{code}_en.pdf",
        f"{code}_{code}.pdf",  # original language often matches country code
    ]

    for filename in attempts:
        url = f"{BASE_URL}/{filename}"
        try:
            urllib.request.urlretrieve(url, pdf_path)
            size = os.path.getsize(pdf_path)
            if size > 500:  # valid PDF
                return pdf_path
            else:
                os.remove(pdf_path)
        except urllib.error.HTTPError:
            continue
        except Exception as e:
            print(f"  Error downloading {url}: {e}")
            continue

    return None


def extract_text(pdf_path):
    """Extract text from PDF using pdfplumber."""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
            return "\n\n".join(pages).strip()
    except Exception as e:
        print(f"  Error extracting text: {e}")
        return None


def simple_keywords(text):
    """Extract simple keywords from text."""
    stopwords = {
        'the', 'and', 'that', 'this', 'with', 'from', 'have', 'been', 'were', 'will',
        'would', 'could', 'should', 'which', 'their', 'there', 'they', 'them', 'than',
        'what', 'when', 'where', 'while', 'also', 'more', 'most', 'must', 'only',
        'other', 'some', 'such', 'very', 'just', 'over', 'into', 'about', 'after',
        'before', 'between', 'each', 'every', 'both', 'through', 'during', 'under',
        'above', 'below', 'same', 'well', 'these', 'those', 'being', 'does', 'done',
        'doing', 'like', 'make', 'made', 'many', 'much', 'need', 'even', 'back',
        'take', 'come', 'came', 'give', 'gave', 'good', 'great', 'long', 'still',
        'first', 'last', 'never', 'then', 'here', 'part', 'upon', 'shall', 'your',
        'all', 'any', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'are', 'but',
        'not', 'you', 'say', 'she', 'his', 'how', 'its', 'let', 'may', 'nor', 'who',
        'why', 'did', 'get', 'got', 'has', 'him', 'yet', 'now', 'old', 'see', 'way',
        'too', 'use', 'for', 'new', 'per',
        'president', 'assembly', 'general', 'united', 'nations', 'session',
        'country', 'countries', 'people', 'world', 'international', 'national',
        'government', 'state', 'states', 'year', 'years', 'today', 'time',
        'continue', 'continued', 'efforts', 'work', 'important', 'ensure',
    }
    words = [w for w in text.lower().split() if len(w) >= 4 and w.isalpha() and w not in stopwords]
    freq = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1
    return [kw for kw, _ in sorted(freq.items(), key=lambda x: -x[1])[:15]]


def main():
    os.makedirs(PDF_DIR, exist_ok=True)
    os.makedirs(SPEECHES_DIR, exist_ok=True)

    countries = load_countries()
    print(f"Checking {len(countries)} countries for 80th session speeches...")

    speeches = []
    downloaded = 0
    failed = []

    for iso2, iso3, name in countries:
        sys.stdout.write(f"  {iso2} {name}... ")
        sys.stdout.flush()

        pdf_path = download_pdf(iso2, name)
        if not pdf_path:
            print("no PDF")
            failed.append((iso2, name))
            continue

        text = extract_text(pdf_path)
        if not text or len(text) < 100:
            print("no text extracted")
            failed.append((iso2, name))
            continue

        # Save speech text
        txt_filename = f"{iso3}_{SESSION}.txt"
        txt_path = os.path.join(SPEECHES_DIR, txt_filename)
        with open(txt_path, "w") as f:
            f.write(text)

        word_count = len(text.split())
        keywords = simple_keywords(text)

        speeches.append({
            "iso3": iso3,
            "iso2": iso2,
            "session": SESSION,
            "year": YEAR,
            "speaker": "",
            "speaker_title": "",
            "date": f"{YEAR}-09-23",
            "word_count": word_count,
            "keywords": keywords,
            "file": txt_filename,
        })

        downloaded += 1
        print(f"OK ({word_count} words)")
        time.sleep(0.3)  # be polite

    # Load existing index or create new
    if os.path.exists(INDEX_FILE):
        with open(INDEX_FILE) as f:
            index = json.load(f)
        # Remove old session 80 entries
        index["speeches"] = [s for s in index["speeches"] if s["session"] != SESSION]
    else:
        index = {
            "_meta": {
                "updated_at": "",
                "source": "gadebate.un.org",
                "total_speeches": 0,
                "sessions": [],
                "country_count": 0,
            },
            "speeches": []
        }

    index["speeches"].extend(speeches)
    index["_meta"]["total_speeches"] = len(index["speeches"])
    index["_meta"]["updated_at"] = f"{YEAR}-03-03"
    sessions = sorted(set(s["session"] for s in index["speeches"]))
    index["_meta"]["sessions"] = sessions
    index["_meta"]["country_count"] = len(set(s["iso3"] for s in index["speeches"]))

    with open(INDEX_FILE, "w") as f:
        json.dump(index, f, indent=2)

    print(f"\nDone: {downloaded} speeches downloaded, {len(failed)} failed")
    if failed:
        print("Failed countries:")
        for iso2, name in failed:
            print(f"  {iso2} {name}")


if __name__ == "__main__":
    main()

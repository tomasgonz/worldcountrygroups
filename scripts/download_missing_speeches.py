#!/usr/bin/env python3
"""Download missing UN General Debate speeches in any available language."""

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

# Map ISO2 -> list of language codes to try (in order of preference)
# Based on country's official/common languages
LANG_MAP = {
    # Arabic-speaking
    "AF": ["en", "ar", "fa"],  # Afghanistan (Dari/Pashto but may use English/Arabic)
    "DZ": ["ar", "fr", "en"],  # Algeria
    "BH": ["ar", "en"],
    "DJ": ["fr", "ar", "en"],  # Djibouti
    "EG": ["ar", "en"],
    "IQ": ["ar", "en"],
    "JO": ["ar", "en"],
    "KW": ["ar", "en"],
    "LB": ["ar", "fr", "en"],  # Lebanon
    "LY": ["ar", "en"],
    "MA": ["ar", "fr", "en"],  # Morocco
    "MR": ["ar", "fr", "en"],  # Mauritania
    "OM": ["ar", "en"],
    "SA": ["ar", "en"],
    "SD": ["ar", "en"],
    "SS": ["en", "ar"],  # South Sudan
    "TN": ["ar", "fr", "en"],
    "YE": ["ar", "en"],
    "KM": ["ar", "fr", "en"],  # Comoros

    # Spanish-speaking
    "AR": ["es", "en"],
    "BO": ["es", "en"],
    "CL": ["es", "en"],
    "CO": ["es", "en"],
    "CR": ["es", "en"],
    "DO": ["es", "en"],
    "EC": ["es", "en"],
    "SV": ["es", "en"],
    "GT": ["es", "en"],
    "GQ": ["es", "fr", "en"],  # Equatorial Guinea
    "HN": ["es", "en"],
    "MX": ["es", "en"],
    "PA": ["es", "en"],
    "PY": ["es", "en"],
    "PE": ["es", "en"],
    "UY": ["es", "en"],
    "VE": ["es", "en"],

    # French-speaking
    "BJ": ["fr", "en"],
    "BF": ["fr", "en"],
    "BI": ["fr", "en"],
    "CM": ["fr", "en"],
    "CF": ["fr", "en"],
    "TD": ["fr", "en"],
    "CG": ["fr", "en"],
    "CD": ["fr", "en"],
    "CI": ["fr", "en"],
    "GA": ["fr", "en"],
    "GN": ["fr", "en"],
    "HT": ["fr", "en"],
    "MG": ["fr", "en"],
    "ML": ["fr", "en"],
    "MC": ["fr", "en"],
    "NE": ["fr", "en"],
    "SN": ["fr", "en"],
    "TG": ["fr", "en"],
    "NC": ["fr", "en"],
    "ST": ["pt", "en"],  # Sao Tome - Portuguese

    # Portuguese-speaking
    "BR": ["pt", "en"],
    "MZ": ["pt", "en"],

    # Other
    "AD": ["ca", "es", "fr", "en"],  # Andorra - Catalan
    "AM": ["am", "en", "ru"],  # Armenia
    "BD": ["bn", "en"],  # Bangladesh - Bangla
    "BY": ["be", "ru", "en"],  # Belarus
    "KH": ["km", "en"],  # Cambodia - Khmer
    "CA": ["en", "fr"],
    "DE": ["de", "en"],
    "ET": ["am", "en"],  # Ethiopia - Amharic
    "GH": ["en"],
    "HU": ["hu", "en"],
    "LA": ["lo", "en"],  # Laos
    "LI": ["de", "en"],  # Liechtenstein
    "MM": ["my", "en"],  # Myanmar
    "PF": ["fr", "en"],  # French Polynesia
    "SC": ["en", "fr"],  # Seychelles
    "SK": ["sk", "en"],
    "ES": ["es", "en"],
    "TR": ["tr", "en"],
    "US": ["en"],
}


def try_download(iso2, langs):
    """Try downloading PDF with various language codes."""
    code = iso2.lower()
    for lang in langs:
        filename = f"{code}_{lang}.pdf"
        url = f"{BASE_URL}/{filename}"
        pdf_path = os.path.join(PDF_DIR, f"{code}_{lang}.pdf")
        try:
            urllib.request.urlretrieve(url, pdf_path)
            size = os.path.getsize(pdf_path)
            if size > 500:
                return pdf_path, lang
            os.remove(pdf_path)
        except urllib.error.HTTPError:
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
        except Exception as e:
            print(f"    Error: {e}")
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
    return None, None


def extract_text_pdfplumber(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
            return "\n\n".join(pages).strip()
    except Exception:
        return None


def extract_text_ocr(pdf_path):
    try:
        from pdf2image import convert_from_path
        import pytesseract
        images = convert_from_path(pdf_path, dpi=300)
        parts = [pytesseract.image_to_string(img) for img in images]
        return "\n\n".join(parts).strip()
    except Exception as e:
        print(f"    OCR error: {e}")
        return None


def extract_text(pdf_path):
    text = extract_text_pdfplumber(pdf_path)
    if text and len(text.split()) >= 50 and "(cid:" not in text:
        return text
    # Fall back to OCR
    return extract_text_ocr(pdf_path)


def extract_keywords(text):
    import re
    stopwords = {
        'the', 'and', 'that', 'this', 'with', 'from', 'have', 'been', 'were', 'will',
        'would', 'could', 'should', 'which', 'their', 'there', 'they', 'them', 'than',
        'what', 'when', 'where', 'while', 'also', 'more', 'most', 'must', 'only',
        'other', 'some', 'such', 'very', 'just', 'over', 'into', 'about', 'after',
        'before', 'between', 'each', 'every', 'both', 'through', 'during', 'under',
        'president', 'assembly', 'general', 'united', 'nations', 'session',
        'country', 'countries', 'people', 'world', 'international', 'national',
        'government', 'state', 'states', 'year', 'years', 'today', 'time',
    }
    words = [w for w in re.split(r'[^a-z]+', text.lower()) if len(w) >= 4 and w not in stopwords]
    freq = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1
    return [kw for kw, _ in sorted(freq.items(), key=lambda x: -x[1])[:15]]


def main():
    os.makedirs(PDF_DIR, exist_ok=True)
    os.makedirs(SPEECHES_DIR, exist_ok=True)

    with open(INDEX_FILE) as f:
        index = json.load(f)
    have = {s["iso2"] for s in index["speeches"]}

    WORLD = os.path.join(os.path.dirname(__file__), "..", "worldcountrygroups", "data", "groups", "world.json")
    with open(WORLD) as f:
        world = json.load(f)

    SKIP = {"AS", "GU", "MP", "PR", "VI", "UM", "AQ", "BV", "HM", "TF", "GS", "IO",
            "CX", "CC", "NF", "CK", "NU", "TK", "WF", "PM", "BL", "MF", "SX", "CW",
            "BQ", "AW", "FK", "GI", "SH", "PN", "TC", "VG", "AI", "MS", "KY", "BM",
            "GL", "FO", "AX", "SJ", "JE", "GG", "IM", "HK", "MO", "TW", "EH", "XK"}

    missing = []
    for c in world["countries"]:
        iso2 = c["iso2"]
        if iso2 and iso2 not in SKIP and iso2 not in have:
            missing.append((iso2, c["iso3"], c["name"]))

    print(f"Trying {len(missing)} missing countries with language variants...\n")

    downloaded = []
    still_missing = []

    for iso2, iso3, name in missing:
        langs = LANG_MAP.get(iso2, ["en"])
        sys.stdout.write(f"  {iso2} {name} (trying {','.join(langs)})... ")
        sys.stdout.flush()

        pdf_path, lang = try_download(iso2, langs)
        if not pdf_path:
            print("no PDF found")
            still_missing.append((iso2, name))
            continue

        text = extract_text(pdf_path)
        if not text or len(text.split()) < 50:
            print(f"no usable text (lang={lang})")
            still_missing.append((iso2, name))
            continue

        # Save original text
        txt_filename = f"{iso3}_{SESSION}.txt"
        txt_path = os.path.join(SPEECHES_DIR, txt_filename)
        with open(txt_path, "w") as f:
            f.write(text)

        word_count = len(text.split())
        keywords = extract_keywords(text)
        is_english = lang == "en"

        entry = {
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
            "language": lang,
        }
        index["speeches"].append(entry)
        downloaded.append((iso2, name, lang, word_count))
        print(f"OK ({word_count} words, lang={lang})")
        time.sleep(0.3)

    # Update meta
    index["_meta"]["total_speeches"] = len(index["speeches"])
    index["_meta"]["country_count"] = len(set(s["iso3"] for s in index["speeches"]))
    index["_meta"]["sessions"] = sorted(set(s["session"] for s in index["speeches"]))

    with open(INDEX_FILE, "w") as f:
        json.dump(index, f, indent=2)

    print(f"\nDownloaded: {len(downloaded)} new speeches")
    for iso2, name, lang, wc in downloaded:
        print(f"  {iso2} {name}: {wc} words (lang={lang})")

    print(f"\nStill missing: {len(still_missing)}")
    for iso2, name in still_missing:
        print(f"  {iso2} {name}")


if __name__ == "__main__":
    main()

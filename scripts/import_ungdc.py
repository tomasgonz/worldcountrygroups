#!/usr/bin/env python3
"""
Import UN General Debate Corpus (sessions 25-79) from Harvard Dataverse.
Source: https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/0TJX8Y
License: CC BY 4.0

Filenames in the corpus: {ISO3}_{SESSION}_{YEAR}.txt in per-session folders.
We rename to {ISO3}_{SESSION}.txt to match the existing convention.
Preserves all session 80 entries (with AI analysis) from the existing index.
"""

import json
import os
import sys
import tarfile
import urllib.request
import urllib.error
import tempfile

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "site", "server", "data")
SPEECHES_DIR = os.path.join(DATA_DIR, "speeches")
INDEX_FILE = os.path.join(DATA_DIR, "un-speeches-index.json")
WORLD_JSON = os.path.join(os.path.dirname(__file__), "..", "worldcountrygroups", "data", "groups", "world.json")

# Harvard Dataverse: direct download of the TXT corpus tar.gz (file ID 11095259)
# This is the UNGDC_1946-2024.tar.gz file (~70MB) from doi:10.7910/DVN/0TJX8Y
DOWNLOAD_URL = "https://dataverse.harvard.edu/api/access/datafile/11095259"


def load_iso3_to_iso2():
    """Build iso3 -> iso2 mapping from world.json."""
    mapping = {}
    try:
        with open(WORLD_JSON) as f:
            data = json.load(f)
        for c in data["countries"]:
            if c.get("iso3") and c.get("iso2"):
                mapping[c["iso3"].upper()] = c["iso2"].upper()
    except Exception as e:
        print(f"Warning: could not load world.json: {e}")
    return mapping


def simple_keywords(text):
    """Extract simple keywords from text (same algorithm as download_speeches.py)."""
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


def parse_speech_filename(filename):
    """Parse {ISO3}_{SESSION}_{YEAR}.txt -> (iso3, session, year) or None."""
    name = os.path.splitext(filename)[0]
    parts = name.split("_")
    if len(parts) < 3:
        return None
    try:
        iso3 = parts[0].upper()
        session = int(parts[1])
        year = int(parts[2])
        return iso3, session, year
    except (ValueError, IndexError):
        return None


def download_dataset(dest_path):
    """Download the UNGDC tar.gz from Harvard Dataverse."""
    print("Downloading UNGDC corpus from Harvard Dataverse...")
    print(f"  URL: {DOWNLOAD_URL}")
    print("  This may take a few minutes (~70MB)...")

    req = urllib.request.Request(DOWNLOAD_URL, headers={
        'User-Agent': 'WorldCountryGroups/1.0 (research)',
    })

    try:
        with urllib.request.urlopen(req, timeout=300) as response:
            total = response.headers.get('Content-Length')
            total = int(total) if total else None
            downloaded = 0
            chunk_size = 1024 * 256

            with open(dest_path, 'wb') as f:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total:
                        pct = downloaded * 100 // total
                        mb = downloaded / (1024 * 1024)
                        sys.stdout.write(f"\r  Downloaded {mb:.1f} MB ({pct}%)")
                    else:
                        mb = downloaded / (1024 * 1024)
                        sys.stdout.write(f"\r  Downloaded {mb:.1f} MB")
                    sys.stdout.flush()

        print(f"\n  Download complete: {os.path.getsize(dest_path) / (1024*1024):.1f} MB")
        return True
    except Exception as e:
        print(f"\n  Download failed: {e}")
        return False


def extract_and_import(archive_path, iso3_to_iso2):
    """Extract speeches from tar.gz and import to our data directory."""
    os.makedirs(SPEECHES_DIR, exist_ok=True)

    speeches = []
    processed = 0
    skipped = 0

    print("Extracting and processing speeches...")

    with tarfile.open(archive_path, 'r:gz') as tf:
        txt_members = [m for m in tf.getmembers() if m.isfile() and m.name.endswith('.txt')]
        print(f"  Found {len(txt_members)} text files in archive")

        for member in sorted(txt_members, key=lambda m: m.name):
            filename = os.path.basename(member.name)
            parsed = parse_speech_filename(filename)
            if not parsed:
                skipped += 1
                continue

            iso3, session, year = parsed

            # Skip session 80+ — we already have those with AI analysis
            if session >= 80:
                skipped += 1
                continue

            # Read the speech text
            try:
                fobj = tf.extractfile(member)
                if fobj is None:
                    skipped += 1
                    continue
                text = fobj.read().decode('utf-8', errors='replace').strip()
            except Exception:
                skipped += 1
                continue

            if len(text) < 50:
                skipped += 1
                continue

            # Save to our format: {ISO3}_{SESSION}.txt
            out_filename = f"{iso3}_{session}.txt"
            out_path = os.path.join(SPEECHES_DIR, out_filename)
            with open(out_path, 'w', encoding='utf-8') as f:
                f.write(text)

            keywords = simple_keywords(text)
            word_count = len(text.split())
            iso2 = iso3_to_iso2.get(iso3, "")

            speeches.append({
                "iso3": iso3,
                "iso2": iso2,
                "session": session,
                "year": year,
                "speaker": "",
                "speaker_title": "",
                "date": f"{year}-09-01",
                "word_count": word_count,
                "keywords": keywords,
                "file": out_filename,
            })

            processed += 1
            if processed % 500 == 0:
                print(f"  Processed {processed} speeches...")

    print(f"  Done: {processed} speeches imported, {skipped} skipped")
    return speeches


def update_index(new_speeches):
    """Load existing index, preserve session 80 entries, merge new speeches."""
    if os.path.exists(INDEX_FILE):
        with open(INDEX_FILE) as f:
            index = json.load(f)
        session80 = [s for s in index["speeches"] if s["session"] >= 80]
        print(f"  Preserving {len(session80)} session 80+ entries with AI analysis")
    else:
        index = {
            "_meta": {"updated_at": "", "source": "", "total_speeches": 0, "sessions": [], "country_count": 0},
            "speeches": []
        }
        session80 = []

    all_speeches = new_speeches + session80
    all_speeches.sort(key=lambda s: (s["session"], s["iso3"]))

    sessions = sorted(set(s["session"] for s in all_speeches))
    countries = set(s["iso3"] for s in all_speeches)

    index["speeches"] = all_speeches
    index["_meta"] = {
        "updated_at": "2026-03-04",
        "source": "Harvard Dataverse UNGDC (sessions 25-79) + gadebate.un.org (session 80)",
        "total_speeches": len(all_speeches),
        "sessions": sessions,
        "country_count": len(countries),
    }

    with open(INDEX_FILE, 'w') as f:
        json.dump(index, f, indent=2)

    print(f"\nIndex updated:")
    print(f"  Total speeches: {len(all_speeches)}")
    print(f"  Sessions: {sessions[0]}-{sessions[-1]} ({len(sessions)} sessions)")
    print(f"  Countries: {len(countries)}")


def main():
    iso3_to_iso2 = load_iso3_to_iso2()
    print(f"Loaded {len(iso3_to_iso2)} ISO3->ISO2 mappings from world.json")

    with tempfile.TemporaryDirectory() as tmpdir:
        archive_path = os.path.join(tmpdir, "ungdc.tar.gz")

        if not download_dataset(archive_path):
            print("Failed to download dataset. Aborting.")
            sys.exit(1)

        # Verify it's a valid tar.gz
        if not tarfile.is_tarfile(archive_path):
            print("Downloaded file is not a valid tar.gz. Aborting.")
            sys.exit(1)

        new_speeches = extract_and_import(archive_path, iso3_to_iso2)

        if not new_speeches:
            print("No speeches extracted. Check the archive structure.")
            sys.exit(1)

        update_index(new_speeches)

    print("\nDone! Next steps:")
    print("  1. cd site && npx nuxt build")
    print("  2. sudo systemctl restart worldcountrygroups")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build the quote repository from the General Debate speech analyses.

Each analysed speech carries 2-3 "key quotes" picked by the AI. Because a model
picked them, every quote is checked against the speech text:

  exact       appears verbatim (ignoring case, punctuation and line breaks)
  close       most of its wording appears in order (likely trimmed or lightly edited)
  unverified  could not be found in the text (may be paraphrased) - shown with a warning

Output: site/server/data/quotes-index.json
"""

import json
import os
import re
import time

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "site", "server", "data")
INDEX = os.path.join(DATA, "un-speeches-index.json")
SPEECHES = os.path.join(DATA, "speeches")
OUT = os.path.join(DATA, "quotes-index.json")
WORLD = os.path.join(ROOT, "worldcountrygroups", "data", "groups", "world.json")

EXTRA = {"VAT": ("Holy See", "VA"), "PSE": ("State of Palestine", "PS"), "COD": ("Democratic Republic of the Congo", "CD"),
         "YUG": ("Yugoslavia", ""), "CSK": ("Czechoslovakia", ""), "DDR": ("German Democratic Republic", ""),
         "YMD": ("South Yemen", ""), "EU": ("European Union", "")}


def norm(t):
    t = t.lower()
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("–", "-"), ("—", "-")):
        t = t.replace(a, b)
    t = re.sub(r"-\s*\n\s*", "", t)          # words hyphenated across lines
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return " ".join(t.split())


def shingles(words, n=4):
    return {" ".join(words[i:i + n]) for i in range(max(1, len(words) - n + 1))}


def check(quote, text_norm, text_shingles):
    q = norm(quote.strip(" \"'…."))
    if not q:
        return "unverified"
    if q in text_norm:
        return "exact"
    qs = shingles(q.split())
    hit = len(qs & text_shingles) / len(qs) if qs else 0
    return "close" if hit >= 0.6 else "unverified"


def speaker_level(title):
    t = (title or "").lower()
    if not t:
        return ""
    if re.search(r"vice|deputy", t):
        return "Vice-President / Deputy"
    if "minister" in t and not re.search(r"prime minister|president of the council of ministers", t):
        return "Minister"
    if re.search(r"^president|constitutional president|head of state|king|queen|emir|sultan|prince|chairman of the presidency", t):
        return "Head of State"
    if re.search(r"prime minister|head of government|chancellor|taoiseach|president of the council of ministers", t):
        return "Head of Government"
    if re.search(r"permanent representative|ambassador", t):
        return "Ambassador"
    return "Other"


SPEAKERS_XLSX = os.path.join(ROOT, "scripts", "data", "Speakers_by_session.xlsx")


def load_corpus_speakers():
    """Speaker names/posts for sessions 1-80 from the UNGDC "Speakers_by_session.xlsx"
    (Harvard Dataverse doi:10.7910/DVN/0TJX8Y; download it manually into scripts/data/).
    Returns {(iso3, session): (name, post)}; empty if the file or openpyxl is missing."""
    if not os.path.exists(SPEAKERS_XLSX):
        return {}
    try:
        import openpyxl
    except ImportError:
        print("openpyxl not installed; skipping corpus speaker names")
        return {}
    ws = openpyxl.load_workbook(SPEAKERS_XLSX, read_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [str(h or "").strip().lower() for h in next(rows)]

    def col(*keys):
        for i, h in enumerate(header):
            if any(k in h for k in keys):
                return i
        return None
    c_sess, c_iso, c_name, c_post = col("session"), col("iso"), col("name of person", "speaker", "name"), col("post", "title", "position")
    if None in (c_sess, c_iso, c_name):
        print(f"Unrecognised speaker file columns: {header}")
        return {}
    out = {}
    for r in rows:
        try:
            key = (str(r[c_iso]).strip().upper(), int(r[c_sess]))
        except (TypeError, ValueError):
            continue
        name = " ".join(str(r[c_name] or "").split())
        post = " ".join(str(r[c_post] or "").split()) if c_post is not None else ""
        if name and name.lower() not in ("nan", "none"):
            out[key] = (name, post)
    print(f"Loaded {len(out)} corpus speaker records")
    return out


def main():
    started = time.time()
    corpus_speakers = load_corpus_speakers()
    world = json.load(open(WORLD))["countries"]
    names = {c["iso3"]: (c["name"], c["iso2"]) for c in world if c.get("iso3")}
    for k, v in EXTRA.items():
        names.setdefault(k, v)

    speeches = json.load(open(INDEX))["speeches"]
    quotes, counts = [], {"exact": 0, "close": 0, "unverified": 0}
    for s in speeches:
        kq = (s.get("analysis") or {}).get("key_quotes") or []
        if not kq:
            continue
        try:
            raw = open(os.path.join(SPEECHES, s["file"]), errors="replace").read()
        except OSError:
            continue
        tn = norm(raw)
        ts = shingles(tn.split())
        name, iso2 = names.get(s["iso3"], (s["iso3"], s.get("iso2", "")))
        speaker, title = s.get("speaker", ""), s.get("speaker_title", "")
        if not speaker and (s["iso3"], s["session"]) in corpus_speakers:
            speaker, title = corpus_speakers[(s["iso3"], s["session"])]
        a = s["analysis"]
        themes = [t["name"] for t in a.get("themes", []) if t.get("relevance") == "high"][:4]
        seen = set()
        for i, q in enumerate(kq):
            q = (q or "").strip().strip('"').strip()
            if len(q) < 25 or q.lower() in seen:
                continue
            seen.add(q.lower())
            status = check(q, tn, ts)
            counts[status] += 1
            quotes.append({
                "id": f"{s['iso3']}-{s['session']}-{i}",
                "q": q,
                "iso3": s["iso3"],
                "iso2": iso2 or s.get("iso2", ""),
                "country": name,
                "session": s["session"],
                "year": s["year"],
                "date": s.get("date", ""),
                "speaker": speaker,
                "title": title,
                "level": speaker_level(title),
                "themes": themes,
                "tone": (a.get("sentiment") or {}).get("overall", ""),
                "status": status,
                "url": s.get("source_url") or "",
            })

    quotes.sort(key=lambda x: (-x["year"], x["country"]))
    out = {
        "_meta": {
            "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total": len(quotes),
            "verification": counts,
            "source": "Key quotes from AI analyses of UN General Debate speeches, checked against the speech texts",
        },
        "quotes": quotes,
    }
    tmp = OUT + ".tmp"
    with open(tmp, "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)
    print(f"{len(quotes)} quotes ({counts}) in {time.time() - started:.0f}s -> {OUT}")


if __name__ == "__main__":
    main()

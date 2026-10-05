#!/usr/bin/env python3
"""Build the full-text search index used by the Ask research desk.

Passages come from:
  - every General Debate speech since 1946 (site/server/data/speeches/*.txt),
    cut into passages of about 220 words
  - official statements (title + excerpt) and news (title + description)

The index is an SQLite database (site/server/data/search.db) with:
  passages      one row per passage (kind, country, year, date, title, url, text, hash)
  passages_fts  FTS5 keyword index over the passage text and title
  vectors       one embedding per distinct passage text (by hash), so a meaning-based
                search finds passages that use different words; 256 dimensions,
                stored as int8 to keep memory small
  meta          bookkeeping (speech file stamps, build times, embedding totals)

Speeches are only re-read when the speech files change; statements and news are
replaced on every run. With --embed, passages without a vector are embedded with
OpenAI text-embedding-3-small (key from ai-config.json), up to --max-tokens per run.

Usage:
  build_search_index.py [--embed] [--max-tokens 6000000] [--rebuild]
"""

import argparse
import hashlib
import json
import os
import re
import sqlite3
import struct
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ai_usage  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA = os.environ.get("WCG_SITE_DATA") or os.path.join(ROOT, "site", "server", "data")
SPEECH_DIR = os.path.join(DATA, "speeches")
DB = os.path.join(DATA, "search.db")
EMBED_MODEL = "text-embedding-3-small"
DIMS = 256
TARGET_WORDS = 220
MAX_WORDS = 380


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def load(name, default=None):
    try:
        with open(os.path.join(DATA, name)) as f:
            return json.load(f)
    except Exception:
        return default


def connect():
    con = sqlite3.connect(DB, timeout=60)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    con.executescript("""
    CREATE TABLE IF NOT EXISTS passages(
      id INTEGER PRIMARY KEY, kind TEXT, src TEXT, iso3 TEXT, year INTEGER, session INTEGER, date TEXT,
      speaker TEXT, title TEXT, url TEXT, text TEXT, hash TEXT);
    CREATE INDEX IF NOT EXISTS passages_src ON passages(src);
    CREATE INDEX IF NOT EXISTS passages_kind ON passages(kind, iso3, year);
    CREATE VIRTUAL TABLE IF NOT EXISTS passages_fts USING fts5(text, title, content='passages', content_rowid='id',
      tokenize='porter unicode61 remove_diacritics 2');
    CREATE TABLE IF NOT EXISTS vectors(hash TEXT PRIMARY KEY, v BLOB);
    CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
    """)
    return con


def meta_get(con, k, default=None):
    r = con.execute("SELECT v FROM meta WHERE k=?", (k,)).fetchone()
    return json.loads(r[0]) if r else default


def meta_set(con, k, v):
    con.execute("INSERT OR REPLACE INTO meta(k, v) VALUES(?, ?)", (k, json.dumps(v)))


def h(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:20]


def chunk(text):
    """Pack lines/paragraphs into passages of ~TARGET_WORDS; split overlong ones by sentence."""
    units = []
    for line in re.split(r"\n+", text):
        line = re.sub(r"^\s*\d{1,3}\.\s+", "", line).strip()  # old records number their paragraphs
        if not line:
            continue
        words = line.split()
        if len(words) <= MAX_WORDS:
            units.append(line)
            continue
        cur = []
        for sent in re.split(r"(?<=[.!?])\s+", line):
            cur.append(sent)
            if sum(len(s.split()) for s in cur) >= TARGET_WORDS:
                units.append(" ".join(cur))
                cur = []
        if cur:
            units.append(" ".join(cur))
    out, cur, n = [], [], 0
    for u in units:
        w = len(u.split())
        if cur and n + w > TARGET_WORDS * 1.3:
            out.append(" ".join(cur))
            cur, n = [], 0
        cur.append(u)
        n += w
        if n >= TARGET_WORDS:
            out.append(" ".join(cur))
            cur, n = [], 0
    if cur:
        if out and n < 60:
            out[-1] += " " + " ".join(cur)
        else:
            out.append(" ".join(cur))
    return out


def insert(con, rows):
    cur = con.cursor()
    for r in rows:
        cur.execute("""INSERT INTO passages(kind, src, iso3, year, session, date, speaker, title, url, text, hash)
                       VALUES(?,?,?,?,?,?,?,?,?,?,?)""", r)
        cur.execute("INSERT INTO passages_fts(rowid, text, title) VALUES(?,?,?)", (cur.lastrowid, r[9], r[7]))


def delete_src(con, where, params):
    ids = [r[0] for r in con.execute(f"SELECT id FROM passages WHERE {where}", params)]
    for i in range(0, len(ids), 500):
        part = ids[i:i + 500]
        q = ",".join("?" * len(part))
        con.execute(f"INSERT INTO passages_fts(passages_fts, rowid, text, title) SELECT 'delete', id, text, title FROM passages WHERE id IN ({q})", part)
        con.execute(f"DELETE FROM passages WHERE id IN ({q})", part)
    return len(ids)


def index_speeches(con, rebuild):
    idx = load("un-speeches-index.json", {}) or {}
    meta = {s["file"]: s for s in idx.get("speeches", []) if s.get("file")}
    world = load_world()
    stamps = {} if rebuild else meta_get(con, "speech_stamps", {})
    seen, added, changed = {}, 0, 0
    for f in sorted(os.listdir(SPEECH_DIR)):
        if not f.endswith(".txt"):
            continue
        p = os.path.join(SPEECH_DIR, f)
        st = os.stat(p)
        stamp = f"{int(st.st_mtime)}:{st.st_size}"
        seen[f] = stamp
        if stamps.get(f) == stamp:
            continue
        changed += 1
        delete_src(con, "src=?", (f"speech:{f}",))
        m = meta.get(f, {})
        iso3 = m.get("iso3") or f.split("_")[0]
        session = int(m.get("session") or re.sub(r"\D", "", f.split("_")[-1]) or 0)
        year = int(m.get("year") or (1945 + session))
        name = world.get(iso3, iso3)
        speaker = m.get("speaker") or ""
        title = f"{name}, General Debate {year}" + (f" ({speaker})" if speaker else "")
        url = f"/countries/{iso3.lower()}/speeches?session={session}"
        with open(p, encoding="utf-8", errors="replace") as fh:
            parts = chunk(fh.read())
        insert(con, [("speech", f"speech:{f}", iso3, year, session, m.get("date") or "", speaker, title, url, t, h(t)) for t in parts])
        added += len(parts)
        if changed % 500 == 0:
            con.commit()
    for f in set(stamps) - set(seen):
        delete_src(con, "src=?", (f"speech:{f}",))
    meta_set(con, "speech_stamps", seen)
    con.commit()
    return changed, added


def load_world():
    try:
        with open(os.path.join(ROOT, "worldcountrygroups", "data", "groups", "world.json")) as f:
            w = json.load(f)
        names = {c["iso3"]: c["name"] for c in w.get("countries", []) if c.get("iso3")}
    except Exception:
        names = {}
    # observers and states that no longer exist, which still have General Debate speeches
    for code, name in {"VAT": "Holy See", "CSK": "Czechoslovakia", "DDR": "German Democratic Republic",
                       "YMD": "Democratic Yemen", "YUG": "Yugoslavia", "SUN": "Soviet Union", "EU": "European Union"}.items():
        names.setdefault(code, name)
    return names


def as_list(v):
    if isinstance(v, list):
        return v
    if isinstance(v, str) and v.startswith("["):
        try:
            return json.loads(v.replace("'", '"'))
        except Exception:
            return []
    return []


def index_feeds(con):
    """Index every archived article and statement (archive.db), adding only new ones each run."""
    arch = os.path.join(DATA, "archive.db")
    if not os.path.exists(arch):
        print("  archive.db not found; run archive_feeds.py first")
        return 0
    if not meta_get(con, "feeds_from_archive", False):
        # earlier versions re-indexed only the live feeds on each run; switch over once
        delete_src(con, "kind IN ('statement','news')", ())
        meta_set(con, "feeds_from_archive", True)
        meta_set(con, "archive_cursor", "")
    cursor = meta_get(con, "archive_cursor", "") or ""
    a = sqlite3.connect(f"file:{arch}?mode=ro", uri=True, timeout=60)
    rows = a.execute("""SELECT id, kind, outlet, countries, day, speaker, title, summary, url, archived_at
                        FROM items WHERE archived_at > ? ORDER BY archived_at""", (cursor,)).fetchall()
    a.close()
    out = []
    last = cursor
    for iid, kind, outlet, countries, day, speaker, title, summary, url, archived_at in rows:
        last = max(last, archived_at or "")
        text = title if not summary else f"{title} — {summary}"
        try:
            iso = (json.loads(countries) or [""])[0]
        except Exception:
            iso = ""
        out.append((kind, f"{kind}:{iid}", iso, int((day or "0")[:4] or 0), None, day or "", speaker or "",
                    f"{title[:140]} ({outlet})", url or "", text, h(text)))
    # an item re-archived with new tags keeps a single passage
    for i in range(0, len(out), 500):
        part = [r[1] for r in out[i:i + 500]]
        delete_src(con, f"src IN ({','.join('?' * len(part))})", part)
    insert(con, out)
    meta_set(con, "archive_cursor", last)
    con.commit()
    return len(out)


def api_key():
    cfg = load("ai-config.json", {}) or {}
    provs = cfg.get("providers", [])
    active = cfg.get("activeProvider") or cfg.get("activeProviderId")
    cands = [p for p in provs if p.get("type") == "openai" and p.get("apiKey")]
    cands.sort(key=lambda p: p.get("id") != active)
    return cands[0]["apiKey"] if cands else None


def embed_batch(key, texts):
    body = json.dumps({"model": EMBED_MODEL, "input": texts, "dimensions": DIMS}).encode()
    for attempt in range(6):
        req = urllib.request.Request("https://api.openai.com/v1/embeddings", data=body, method="POST",
                                     headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                res = json.loads(r.read())
            return [d["embedding"] for d in sorted(res["data"], key=lambda d: d["index"])], res.get("usage", {}).get("total_tokens", 0)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 5:
                time.sleep(min(60, 5 * 2 ** attempt))
                continue
            raise RuntimeError(f"Embeddings API error {e.code}: {e.read()[:200]!r}")
        except (urllib.error.URLError, TimeoutError):
            if attempt < 5:
                time.sleep(10)
                continue
            raise


def quantize(v):
    m = max(abs(x) for x in v) or 1.0
    return struct.pack("f", m) + bytes((int(round(x / m * 127)) & 0xFF) for x in v)


def record_usage(tokens):
    ai_usage.record("search-index", "OpenAI embeddings", EMBED_MODEL, tokens)


def embed(con, max_tokens):
    key = api_key()
    if not key:
        print("No OpenAI key in ai-config.json; skipping embeddings")
        return 0
    # newest material first, so recent speeches and statements become searchable by meaning soonest
    todo = con.execute("""SELECT p.hash, MIN(p.text) FROM passages p LEFT JOIN vectors v ON v.hash = p.hash
                          WHERE v.hash IS NULL GROUP BY p.hash ORDER BY MAX(p.year) DESC""").fetchall()
    print(f"{len(todo)} passages need embeddings")
    used, done = 0, 0
    batch, size = [], 0
    def flush():
        nonlocal used, done, batch, size
        if not batch:
            return
        vecs, tokens = embed_batch(key, [t[:6000] for _, t in batch])
        con.executemany("INSERT OR REPLACE INTO vectors(hash, v) VALUES(?, ?)", [(hh, quantize(v)) for (hh, _), v in zip(batch, vecs)])
        con.commit()
        record_usage(tokens)
        used += tokens
        done += len(batch)
        batch, size = [], 0
    for hh, text in todo:
        est = int(len(text.split()) * 1.4) + 8
        if used + size + est > max_tokens:
            break
        batch.append((hh, text))
        size += est
        if len(batch) >= 256 or size > 120_000:
            flush()
            if done % 5120 < 256:
                print(f"  embedded {done} passages, {used:,} tokens")
    flush()
    return done, used


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--embed", action="store_true")
    ap.add_argument("--max-tokens", type=int, default=6_000_000)
    ap.add_argument("--rebuild", action="store_true", help="re-read every speech")
    args = ap.parse_args()
    t0 = time.time()
    con = connect()
    changed, added = index_speeches(con, args.rebuild)
    print(f"Speeches: {changed} files re-indexed, {added} passages")
    feeds = index_feeds(con)
    print(f"Statements and news from the archive: {feeds} new items")
    if args.embed:
        done, used = embed(con, args.max_tokens)
        print(f"Embeddings: {done} passages, {used:,} tokens")
        # drop vectors for passages that no longer exist (old news), keeping the file small
        con.execute("DELETE FROM vectors WHERE hash NOT IN (SELECT hash FROM passages)")
    total = con.execute("SELECT COUNT(*) FROM passages").fetchone()[0]
    with_vec = con.execute("SELECT COUNT(*) FROM passages p JOIN vectors v ON v.hash = p.hash").fetchone()[0]
    meta_set(con, "built_at", now())
    meta_set(con, "counts", {"passages": total, "with_vectors": with_vec, "embed_model": EMBED_MODEL, "dims": DIMS})
    con.commit()
    con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    con.close()
    print(f"Index: {total} passages, {with_vec} with vectors ({time.time() - t0:.0f}s)")


if __name__ == "__main__":
    sys.exit(main())

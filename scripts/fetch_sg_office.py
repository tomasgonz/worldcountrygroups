#!/usr/bin/env python3
"""
Secretary-General's office: senior appointments and statements.

The UN's own pages (un.org/sg, press.un.org) sit behind a bot challenge, so this reads what
Google News has indexed from them: headline, date and link. Appointment headlines follow a fixed
form ("Secretary-General Appoints <name> of <country> <post>"), which is parsed into person,
nationality, post, category and duty country. Results accumulate in sg-office.json, so the
history grows with every run (Google News only returns the latest ~100 items per query).

Output: site/server/data/sg-office.json
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import quote
from urllib.request import Request, urlopen
from xml.etree import ElementTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_statements import build_country_map, compile_country_patterns, tag_countries  # noqa: E402

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "server", "data")
OUT = os.path.join(DATA_DIR, "sg-office.json")
UA = "Mozilla/5.0 (compatible; WorldCountryGroups/1.0; research)"

GN = "https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
# Google News returns at most ~100 items per query, so searches run in date windows: a one-off
# backfill (appointments 36 months, statements 12 months), then the most recent windows each run.
APPOINTMENT_QUERY = '"Secretary-General appoints" OR "Secretary-General designates" OR "Secretary-General names"'
STATEMENT_QUERY = 'Guterres OR "Secretary-General" OR "UN chief" OR "Spokesperson for the Secretary-General"'
SENIOR_QUERIES = [
    'appoints "Under-Secretary-General" OR "Assistant Secretary-General" Secretary-General',
    'appoints "Special Representative" OR "Special Envoy" OR "Special Adviser" OR "Personal Envoy" Secretary-General',
    'appoints "Force Commander" OR "Police Commissioner" OR "Head of Mission" Secretary-General',
]
EXTRA_QUERIES = [
    'site:press.un.org "Secretary-General appoints"',
    'site:press.un.org "Secretary-General designates"',
    'site:press.un.org appoints "Under-Secretary-General"',
    'site:press.un.org appoints "Assistant Secretary-General"',
    'site:press.un.org appoints "Special Representative"',
    'site:press.un.org appoints "Special Envoy" OR "Personal Envoy" OR "Special Adviser"',
    'site:press.un.org appoints "Force Commander" OR "Police Commissioner"',
    'site:press.un.org "Secretary-General appoints" when:30d',
    'site:press.un.org "Secretary-General" when:7d',
    'site:un.org/sg "Secretary-General" when:30d',
]
OFFICIAL = re.compile(r"(^|\.)un\.org$|unmissions\.org$")

SUFFIXES = re.compile(r"\s+[-|–]\s+(UN Meetings Coverage and Press Releases|Welcome to the United Nations|United Nations Secretary-General|UN News|Meetings Coverage and Press Releases)\s*$", re.I)
JUNK = re.compile(r"^\s*(\||welcome to the united nations|secretary-general\s*$|the statement of the secretary-general\s*$)", re.I)

# Nationality forms seen in UN headlines that are not plain country names
NATIONALITY_ALIASES = {
    "United States": "USA", "United States of America": "USA", "United Kingdom": "GBR", "Republic of Korea": "KOR",
    "Türkiye": "TUR", "Turkey": "TUR", "Russian Federation": "RUS", "Iran": "IRN", "Viet Nam": "VNM", "Côte d'Ivoire": "CIV",
    "Democratic Republic of the Congo": "COD", "Republic of Moldova": "MDA", "United Republic of Tanzania": "TZA",
    "Bolivia": "BOL", "Venezuela": "VEN", "Syria": "SYR", "Lao People's Democratic Republic": "LAO", "Netherlands": "NLD",
    "Kingdom of the Netherlands": "NLD", "Czechia": "CZE", "Czech Republic": "CZE", "Gambia": "GMB", "the Gambia": "GMB",
    "Cote d'Ivoire": "CIV", "Philippines": "PHL", "the Philippines": "PHL", "Sudan": "SDN", "South Sudan": "SSD", "Eswatini": "SWZ", "Cabo Verde": "CPV",
    "North Macedonia": "MKD", "State of Palestine": "PSE", "Palestine": "PSE", "Micronesia": "FSM", "Brunei Darussalam": "BRN",
}


def categorise(post, person=None):
    p = post.lower()
    if not person and re.search(r"panel|group|board|council|committee|network|advisory|commission", p):
        return "body"
    if "resident coordinator" in p or "humanitarian coordinator" in p:
        return "resident-coordinator"
    if re.search(r"special (envoy|representative|adviser|advisor|coordinator)|personal envoy|personal representative|envoy", p):
        return "envoy"
    if re.search(r"force commander|police commissioner|head of mission|deputy head|deputy special representative|military adviser|chief of staff of the .*mission|head of the united nations .*(mission|office)", p):
        return "mission"
    if "under-secretary-general" in p or "executive director" in p or "administrator" in p or "high commissioner" in p or "director-general" in p:
        return "senior"
    if "assistant secretary-general" in p:
        return "senior"
    return "other"


CATEGORY_LABELS = {
    "resident-coordinator": "Resident / humanitarian coordinators",
    "envoy": "Envoys and special representatives",
    "mission": "Peace operations leadership",
    "senior": "Under- and Assistant Secretaries-General, agency heads",
    "body": "Panels and advisory bodies",
    "other": "Other posts",
}


def rank(post):
    p = post.lower()
    if "under-secretary-general" in p:
        return "USG"
    if "assistant secretary-general" in p:
        return "ASG"
    return None


def statement_kind(title):
    """Kind of statement, from the headline wording."""
    t = title.lower()
    if t.startswith("note to correspondents"):
        return "note"
    if "attributable to the spokesperson" in t or "spokesperson for the secretary-general" in t:
        return "spokesperson"
    if t.startswith("message") or "'s message" in t or " message " in t or "video message" in t:
        return "message"
    if "remarks" in t or "address" in t or "opening" in t or "speech" in t:
        return "remarks"
    if "readout" in t or "meets with" in t or "meeting with" in t or "telephone" in t or "phone call" in t:
        return "readout"
    return "statement"


KIND_LABELS = {"note": "Notes to correspondents", "spokesperson": "Spokesperson's statements", "message": "Messages", "remarks": "Remarks and speeches", "readout": "Readouts of meetings", "statement": "Statements and press releases"}


def fetch(q):
    url = GN.format(q=quote(q))
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={"User-Agent": UA}), timeout=40) as r:
                return ElementTree.fromstring(r.read())
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                print(f"  ! {q}: {e}", file=sys.stderr)
                return None
            time.sleep(3 * (attempt + 1))


def items(q):
    root = fetch(q)
    if root is None:
        return []
    out = []
    for it in root.iter("item"):
        src = it.find("source")
        src_name = (src.text or "").strip() if src is not None else ""
        title = (it.findtext("title") or "").strip().replace("\u2019", "'")
        # Google News appends " - <outlet>", sometimes truncated: drop it
        if src_name:
            m = re.search(r"\s+[-|–]\s+([^-|–]{2,80})$", title)
            if m and (src_name.lower().startswith(m.group(1).lower().rstrip(". ")) or m.group(1).lower().startswith(src_name.lower()[:12])):
                title = title[:m.start()]
        title = SUFFIXES.sub("", title)
        title = re.sub(r"\s+[-|–]\s+United Na[a-z ]*$", "", title)
        title = re.sub(r"\s+-\s*$", "", title).strip()
        if not title or JUNK.search(title) or len(title) < 20:
            continue
        try:
            when = parsedate_to_datetime(it.findtext("pubDate")).astimezone(timezone.utc)
        except Exception:  # noqa: BLE001
            continue
        out.append({"title": title, "url": (it.findtext("link") or "").strip(), "date": when.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "site": (src.get("url") if src is not None else "") or ""})
    return out


def host_of(url):
    m = re.match(r"https?://([^/]+)", url or "")
    return (m.group(1) if m else "").lower().removeprefix("www.")


def windows(days_back, step_days, now):
    """(after, before) date pairs covering the last `days_back` days, newest first."""
    out = []
    end = now.date() + timedelta(days=1)
    start_limit = now.date() - timedelta(days=days_back)
    while end > start_limit:
        start = max(start_limit, end - timedelta(days=step_days))
        out.append((start.isoformat(), end.isoformat()))
        end = start
    return out


def appt_key(person, post, title):
    if person:
        return key_of(f"{person} {re.sub(r'^(the|his|her)\s+', '', (post or '').lower())}")
    return key_of(title)


def key_of(title):
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()[:140]


def parse_appointment(title, nat_names):
    m = re.match(r"^Secretary-General\s+(Appoints|Designates|Names|Announces Appointment of)\s+(.+)$", title, re.I)
    if not m:
        return None
    verb, rest = m.group(1).lower(), m.group(2)
    rest = re.sub(r"^(Mr|Ms|Mrs|Dr|H\.E\.)\.?\s+", "", rest)
    # find " of <Country> " where <Country> is a known nationality; prefer the longest match
    best = None
    for mm in re.finditer(r"\s+of\s+", rest):
        tail = re.sub(r"^the\s+", "", rest[mm.end():], flags=re.I)
        skip = len(rest[mm.end():]) - len(tail)
        for name in nat_names:
            if tail[:len(name)].lower() == name.lower() and (len(tail) == len(name) or not tail[len(name)].isalpha()):
                if best is None or (mm.start() == best[0] and len(name) > len(best[1])) or mm.start() < best[0]:
                    best = (mm.start(), name, mm.end() + skip)
        if best:
            break
    if not best:
        # no nationality given: "<name> as <post>", or a body ("High-Level Panel on ...")
        mm = re.match(r"^(.+?)\s+as\s+(?:his\s+|her\s+|the\s+)?(.+)$", rest)
        if mm and len(mm.group(1).split()) <= 5 and not re.search(r"panel|group|board|council|committee|network", mm.group(1), re.I):
            return {"person": mm.group(1).strip(), "nationalityName": None, "post": mm.group(2).strip(), "verb": verb}
        return {"person": None, "nationalityName": None, "post": rest, "verb": verb}
    start, name, end = best
    person = rest[:start].strip()
    post = rest[end + len(name):].strip(" ,-–")
    post = re.sub(r"^as\s+", "", post, flags=re.I)
    post = re.sub(r"^(his|her|the)\s+", "", post, flags=re.I)
    mr = re.match(r"^((?:Lieutenant |Major |Brigadier )?General|Rear Admiral|Vice Admiral|Admiral|Colonel|Commissioner)\s+(.+)$", person)
    if mr:
        person = mr.group(2)
        post = f"{post} ({mr.group(1)})" if post else post
    if person.isupper():
        person = person.title()
        post = post.title()
    return {"person": person, "nationalityName": name, "post": post, "verb": verb}


def main():
    now = datetime.now(timezone.utc)
    cmap = build_country_map()
    nat = dict(cmap)
    nat.update(NATIONALITY_ALIASES)
    nat_names = sorted(nat.keys(), key=len, reverse=True)
    patterns = compile_country_patterns(cmap)

    try:
        with open(OUT) as f:
            prev = json.load(f)
    except Exception:  # noqa: BLE001
        prev = {}
    appts = {}
    for a in prev.get("appointments", []):
        k = appt_key(a.get("person"), a.get("post"), a["title"])
        if k not in appts or (a.get("official") and not appts[k].get("official")):
            appts[k] = a
    stmts = {key_of(s["title"]): s for s in prev.get("statements", [])}
    seen_a = seen_s = 0

    backfilled = prev.get("_meta", {}).get("backfilled") or {}
    a_windows = windows(1095 if not backfilled.get("appointments") else 62, 31, now)
    s_windows = windows(365 if not backfilled.get("statements") else 21, 7, now)
    queries = [("a", f"{APPOINTMENT_QUERY} after:{a} before:{b}") for a, b in a_windows]
    queries += [("s", f"{STATEMENT_QUERY} after:{a} before:{b}") for a, b in s_windows]
    q_windows = windows(1095 if not backfilled.get("senior") else 92, 92, now)
    queries += [("a", f"{q} after:{a} before:{b}") for q in SENIOR_QUERIES for a, b in q_windows]
    if not backfilled.get("senior2017"):  # the current Secretary-General's whole tenure, for heads of departments
        queries += [("a", f"{q} after:{a} before:{b}") for q in SENIOR_QUERIES[:2] for a, b in windows((now.date() - datetime(2017, 1, 1, tzinfo=timezone.utc).date()).days, 92, now)]
    queries += [("x", q) for q in EXTRA_QUERIES]
    print(f"  {len(queries)} searches ({len(a_windows)} appointment windows, {len(s_windows)} statement windows)")

    for kind, q in queries:
        for it in items(q):
            host = host_of(it["site"])
            official = bool(OFFICIAL.search(host))
            t = it["title"]
            t = re.sub(r"^(UN|U\.N\.|United Nations)\s+(?=Secretary-General)", "", t)
            t = re.sub(r"^(Guterres|UN chief|UN Secretary-General António Guterres)\s+(?=appoints\b)", "Secretary-General ", t, flags=re.I)
            t = re.sub(r"^Secretary-General\s+appoints", "Secretary-General Appoints", t, flags=re.I)
            if re.match(r"^Secretary-General\s+(Appoints|Designates|Names|Announces Appointment)", t, re.I):
                p = parse_appointment(t, nat_names) or {}
                # outlets other than the UN count only when they repeat the UN headline form exactly
                if not official and not p.get("nationalityName"):
                    continue
                seen_a += 1
                k = appt_key(p.get("person"), p.get("post"), t)
                iso3 = nat.get(p.get("nationalityName") or "")
                post = p.get("post") or ""
                rec = appts.get(k) or {"firstSeen": now.strftime("%Y-%m-%dT%H:%M:%SZ")}
                better_url = official and not rec.get("official")
                rec.update({
                    "title": t, "url": it["url"] if better_url or not rec.get("url") else rec["url"],
                    "source": host if better_url or not rec.get("source") else rec["source"], "official": rec.get("official") or official,
                    "date": min(rec.get("date") or it["date"], it["date"]),
                    "person": p.get("person"), "nationality": iso3, "nationalityName": p.get("nationalityName"),
                    "post": post, "category": categorise(post, p.get("person")), "rank": rank(post),
                    "acting": bool(re.search(r"\bacting\b|\bofficer-in-charge\b|\binterim\b", post, re.I)),
                    "dutyCountries": sorted(tag_countries(post, patterns)),
                })
                appts[k] = rec
                continue
            if kind == "a" or not official:
                continue
            if not re.search(r"Secretary-General|Guterres|UN chief|Spokesperson", t, re.I):
                continue
            if re.match(r"^(Mr|Ms|Mrs|Dr)\.?\s+[^-]+\s+of\s+[^-]+\s+-\s+", t):
                continue  # biography page of an appointee
            seen_s += 1
            k = key_of(t)
            rec = stmts.get(k) or {"firstSeen": now.strftime("%Y-%m-%dT%H:%M:%SZ")}
            rec.update({"title": t, "url": rec.get("url") or it["url"], "date": min(rec.get("date") or it["date"], it["date"]),
                        "kind": statement_kind(t), "countries": sorted(tag_countries(t, patterns)), "source": host})
            stmts[k] = rec
        time.sleep(1.2)

    for r in stmts.values():  # re-tag with the current matcher
        r["countries"] = sorted(tag_countries(r["title"], patterns))
    for r in appts.values():
        r["dutyCountries"] = sorted(tag_countries(r.get("post") or "", patterns))
    a_list = sorted(appts.values(), key=lambda a: a["date"], reverse=True)
    s_list = sorted(stmts.values(), key=lambda s: s["date"], reverse=True)
    # keep statements for two years; appointments indefinitely
    cutoff = (now - timedelta(days=730)).strftime("%Y-%m-%d")
    s_list = [s for s in s_list if s["date"] >= cutoff]

    if not a_list and not s_list:
        print("No items fetched; keeping the previous file", file=sys.stderr)
        sys.exit(1)

    out = {
        "_meta": {
            "updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "UN Meetings Coverage and Press Releases (press.un.org) and the Secretary-General's website (un.org/sg), as indexed by Google News",
            "method": "Headlines, dates and links only; appointment headlines parsed into person, nationality, post and duty country. History accumulates across runs.",
            "first_run": prev.get("_meta", {}).get("first_run") or now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "category_labels": CATEGORY_LABELS,
            "kind_labels": KIND_LABELS,
            "seen_this_run": {"appointments": seen_a, "statements": seen_s},
            "backfilled": {"appointments": True, "statements": True, "senior": True, "senior2017": True},
        },
        "appointments": a_list,
        "statements": s_list,
    }
    tmp = OUT + ".tmp"
    with open(tmp, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    os.replace(tmp, OUT)
    unparsed = sum(1 for a in a_list if not a.get("nationality"))
    print(f"sg-office: {len(a_list)} appointments ({unparsed} without a recognised nationality), {len(s_list)} statements")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build the people directory: leaders, ministers, UN officials and debate speakers,
with their roles, General Debate speeches, quotes, statements they delivered and
mentions of them in the news and statements feeds.

Sources
  - Wikidata (current heads of state and government, foreign ministers, UN
    officials; portrait, description, Wikipedia link). Cached for 3 days.
  - un-speeches-index.json  (General Debate speakers)
  - statements-feed.json / news-feed.json (who delivered what, who is mentioned)
  - quotes-index.json       (quotes attributed to the person)

Output: site/server/data/people-index.json
"""

import hashlib
import json
import os
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "site", "server", "data")
WORLD = os.path.join(ROOT, "worldcountrygroups", "data", "groups", "world.json")
OUT = os.path.join(DATA, "people-index.json")
WD_CACHE = os.path.join(DATA, "people-wikidata.json")
UA = "WorldCountryGroups/1.0 (https://worldcountrygroups.exe.xyz)"
SPARQL = "https://query.wikidata.org/sparql"

UN_POSITIONS = [
    "United Nations Secretary-General", "Secretary-General of the United Nations", "President of the United Nations General Assembly",
    "United Nations High Commissioner for Human Rights", "United Nations High Commissioner for Refugees",
    "Under-Secretary-General for Humanitarian Affairs and Emergency Relief Coordinator",
    "Director-General of the World Health Organization", "Executive Director of UNICEF",
    "Executive Director of the World Food Programme", "Administrator of the United Nations Development Programme",
    "Director General of the International Atomic Energy Agency", "President of the International Court of Justice",
    "Prosecutor of the International Criminal Court", "Deputy Secretary-General of the United Nations",
    "Director-General of the World Trade Organization", "Director-General of UNESCO",
]

Q_HEADS = """SELECT ?iso3 ?role ?person ?start WHERE {
  ?country wdt:P298 ?iso3 ; wdt:P463 wd:Q1065 .
  { ?country p:P35 ?st . ?st ps:P35 ?person . BIND("Head of State" AS ?role) }
  UNION { ?country p:P6 ?st . ?st ps:P6 ?person . BIND("Head of Government" AS ?role) }
  OPTIONAL { ?st pq:P580 ?start }
  OPTIONAL { ?st pq:P582 ?end }
  FILTER(!BOUND(?end) || ?end > NOW())
}"""
Q_FM = """SELECT ?iso3 ?person ?start WHERE {
  ?country wdt:P298 ?iso3 ; wdt:P463 wd:Q1065 .
  { ?pos wdt:P279 wd:Q7330070 } UNION { ?pos wdt:P31 wd:Q7330070 }
  ?pos wdt:P1001 ?country .
  ?person p:P39 ?st . ?st ps:P39 ?pos ; pq:P580 ?start .
  OPTIONAL { ?st pq:P582 ?end }
  FILTER(!BOUND(?end) || ?end > NOW())
  FILTER(YEAR(?start) >= 2012)
}"""
Q_UN = """SELECT ?posLabel ?person ?start WHERE {
  VALUES ?label { %s }
  ?pos rdfs:label ?label .
  ?person p:P39 ?st . ?st ps:P39 ?pos .
  OPTIONAL { ?st pq:P580 ?start }
  OPTIONAL { ?st pq:P582 ?end }
  FILTER(!BOUND(?end) || ?end > NOW())
  BIND(STR(?label) AS ?posLabel)
}""" % " ".join(f'"{p}"@en' for p in UN_POSITIONS)


def http_json(url, data=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept": "application/sparql-results+json, application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def sparql(q):
    return http_json(SPARQL + "?" + urllib.parse.urlencode({"query": q, "format": "json"}))["results"]["bindings"]


def qid(uri):
    return uri.rsplit("/", 1)[-1]


def fold(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().lower()


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", fold(s)).strip("-")


def load_wikidata():
    """Current office holders from Wikidata, cached for three days."""
    if os.path.exists(WD_CACHE):
        cached = json.load(open(WD_CACHE))
        if datetime.fromisoformat(cached["fetched"]) > datetime.now(timezone.utc) - timedelta(days=3):
            return cached
    roles = []  # (qid, role, iso3 or None, start)
    for b in sparql(Q_HEADS):
        roles.append((qid(b["person"]["value"]), b["role"]["value"], b["iso3"]["value"], b.get("start", {}).get("value", "")[:10]))
    for b in sparql(Q_FM):
        roles.append((qid(b["person"]["value"]), "Foreign Minister", b["iso3"]["value"], b.get("start", {}).get("value", "")[:10]))
    try:
        for b in sparql(Q_UN):
            roles.append((qid(b["person"]["value"]), b["posLabel"]["value"], None, b.get("start", {}).get("value", "")[:10]))
    except Exception as e:
        print("UN positions query failed:", e)
    # Wikidata often lacks end dates for past holders: keep the most recent holder of each office
    latest = {}
    for r in roles:
        k = (r[1], r[2])
        if k not in latest or (r[3] or "") > (latest[k][3] or ""):
            latest[k] = r
    multi_ok = {"Foreign Minister"}  # some countries list several current holders legitimately
    roles = [r for r in roles if r[1] in multi_ok or latest[(r[1], r[2])] == r]
    # UN offices without a start date or started long ago are past holders
    roles = [r for r in roles if r[2] is not None or (r[3] and r[3] >= "2016")]
    # entity details in batches of 50
    ids = sorted({r[0] for r in roles if r[0].startswith("Q")})
    entities = {}
    for i in range(0, len(ids), 50):
        chunk = ids[i:i + 50]
        url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({
            "action": "wbgetentities", "ids": "|".join(chunk), "props": "labels|aliases|descriptions|claims|sitelinks",
            "languages": "en|mul", "sitefilter": "enwiki", "format": "json"})
        for q, e in http_json(url).get("entities", {}).items():
            img = None
            p18 = e.get("claims", {}).get("P18")
            if p18:
                img = p18[0]["mainsnak"].get("datavalue", {}).get("value")
            labels, aliases = e.get("labels", {}), e.get("aliases", {})
            wiki = e.get("sitelinks", {}).get("enwiki", {}).get("title")
            entities[q] = {
                # many names now live under the language-neutral "mul" label
                "label": (labels.get("en") or labels.get("mul") or {}).get("value") or (re.sub(r" \(.*\)$", "", wiki) if wiki else None),
                "aliases": sorted({a["value"] for lang in ("en", "mul") for a in aliases.get(lang, [])}),
                "description": e.get("descriptions", {}).get("en", {}).get("value", ""),
                "image": img,
                "wikipedia": e.get("sitelinks", {}).get("enwiki", {}).get("title"),
            }
        time.sleep(0.5)
    cached = {"fetched": datetime.now(timezone.utc).isoformat(), "roles": roles, "entities": entities}
    with open(WD_CACHE, "w") as f:
        json.dump(cached, f, ensure_ascii=False)
    return cached


ROLE_WORDS = r"(Deputy|Permanent|Representative|Ambassador|Minister|Secretary|President|Spokesperson|Chargé|Charge)"
VERBS = {"appoints", "strongly", "condemns", "welcomes", "calls", "urges", "says", "notes", "statement", "remarks"}


def clean_speaker(s):
    """Statement 'speaker' fields are sometimes scraped noise ("Appoints Mohamed Yahya")."""
    s = re.split(r"\s+" + ROLE_WORDS + r"\b", (s or "").strip())[0].strip(" ,.-")
    words = s.split()
    if not (2 <= len(words) <= 4) or words[0].lower() in VERBS:
        return None
    if not all(w[:1].isupper() for w in words):
        return None
    return s


def main():
    world = json.load(open(WORLD))["countries"]
    cname = {c["iso3"]: c["name"] for c in world if c.get("iso3")}
    cname.update({"PSE": "State of Palestine", "VAT": "Holy See", "COD": "DR Congo", "KOR": "Republic of Korea", "PRK": "DPR Korea",
                  "IRN": "Iran", "SYR": "Syria", "RUS": "Russian Federation", "EGY": "Egypt", "VEN": "Venezuela"})
    iso2 = {c["iso3"]: c["iso2"] for c in world if c.get("iso3")}

    people = {}          # id -> person
    by_name = {}         # folded name/alias -> id

    def add_name(pid, name):
        if name and len(fold(name)) >= 4:
            by_name.setdefault(fold(name), pid)

    def person(pid, name):
        if pid not in people:
            people[pid] = {"id": pid, "name": name, "aliases": [], "roles": [], "speeches": [], "qid": None,
                           "image": None, "description": "", "wikipedia": None}
            add_name(pid, name)
        return people[pid]

    # ---- Wikidata office holders ----
    try:
        wd = load_wikidata()
    except Exception as e:
        print("Wikidata unavailable, continuing without it:", e)
        wd = {"roles": [], "entities": {}}
    for q, role, iso3, start in wd["roles"]:
        ent = wd["entities"].get(q)
        if not ent or not ent.get("label") or re.match(r"^Q\d+$", ent["label"]):
            continue
        p = person(q, ent["label"])
        p.update(qid=q, image=ent.get("image"), description=ent.get("description", ""), wikipedia=ent.get("wikipedia"))
        p["aliases"] = sorted(set(p["aliases"]) | {a for a in ent.get("aliases", []) if len(a.split()) >= 2 or len(a) >= 5})
        for a in p["aliases"]:
            add_name(q, a)
        if not any(r["role"] == role and r.get("iso3") == iso3 for r in p["roles"]):
            p["roles"].append({"role": role, "iso3": iso3, "country": cname.get(iso3) if iso3 else "United Nations", "since": start, "source": "Wikidata"})

    # ---- General Debate speakers ----
    speeches = json.load(open(os.path.join(DATA, "un-speeches-index.json")))["speeches"]
    for s in speeches:
        nm = (s.get("speaker") or "").strip()
        if not nm:
            continue
        pid = by_name.get(fold(nm))
        if not pid:
            # "Luiz Inácio Lula da Silva" vs Wikidata "Luiz Inácio Lula da Silva": also try first + last
            parts = nm.split()
            pid = by_name.get(fold(f"{parts[0]} {parts[-1]}")) if len(parts) > 2 else None
        if not pid:
            pid = slugify(nm)
            person(pid, nm)
        p = people[pid]
        p["speeches"].append({"iso3": s["iso3"], "country": cname.get(s["iso3"], s["iso3"]), "session": s["session"],
                              "year": s["year"], "date": s.get("date", ""), "title": s.get("speaker_title", "")})
        if s.get("speaker_title") and not any(r["iso3"] == s["iso3"] and r["source"] != "Wikidata" for r in p["roles"]) and not p["roles"]:
            p["roles"].append({"role": s["speaker_title"], "iso3": s["iso3"], "country": cname.get(s["iso3"], s["iso3"]), "since": "", "source": "General Debate"})

    # ---- statement speakers ----
    statements = json.load(open(os.path.join(DATA, "statements-feed.json")))["statements"]
    news = json.load(open(os.path.join(DATA, "news-feed.json")))["articles"]
    for st in statements:
        nm = clean_speaker(st.get("speaker"))
        if nm and not by_name.get(fold(nm)):
            p = person(slugify(nm), nm)
            if st.get("country") and not p["roles"]:
                p["roles"].append({"role": "Official", "iso3": st["country"], "country": cname.get(st["country"], st["country"]), "since": "", "source": "Statements"})

    # ---- name variants for matching ----
    texts = [(x.get("title", "") + " " + (x.get("description") or x.get("excerpt") or "")) for x in news + statements]
    lower_vocab = Counter(w for t in texts for w in re.findall(r"\b[a-z][a-z'-]{3,}\b", t))
    places = {fold(n) for n in cname.values()} | {fold(c.get("name", "")) for c in world}
    surname_owner = Counter(fold(p["name"].split()[-1]) for p in people.values())
    COMMON = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "january", "february", "march",
              "april", "may", "june", "july", "august", "september", "october", "november", "december", "spring", "summer",
              "winter", "autumn", "king", "queen", "prince", "young", "bush", "love", "rich", "white", "black", "green", "brown"}

    def variants(p):
        v = {p["name"]} | set(p["aliases"])
        parts = p["name"].split()
        if len(parts) > 2:
            v.add(f"{parts[0]} {parts[-1]}")
        last = parts[-1] if parts else ""
        fl = fold(last)
        # surname alone only when it can't be an ordinary word, a place or another person's name
        if len(last) >= 5 and last[:1].isupper() and fl not in places and fl not in COMMON and lower_vocab[fl] == 0 and surname_owner[fl] == 1:
            v.add(last)
        return sorted(v, key=len, reverse=True)

    # Office titles that refer to the current holder (UN sources rarely repeat the name)
    OFFICE_ALIASES = {"United Nations Secretary-General": ["UN chief", "U.N. chief", "UN Secretary-General", "U.N. Secretary-General",
                                                           "United Nations Secretary-General", "UN Secretary General"]}
    sg_id = next((pid for pid, p in people.items() if any(r["role"] == "United Nations Secretary-General" for r in p["roles"])), None)

    def all_variants(pid, p):
        v = variants(p)
        for r in p["roles"]:
            v += OFFICE_ALIASES.get(r["role"], [])
        return sorted(set(v), key=len, reverse=True)

    compiled = {pid: re.compile(r"(?<![\w-])(" + "|".join(re.escape(x) for x in all_variants(pid, p)) + r")(?![\w-])") for pid, p in people.items()}
    UN_OFFICIAL = {"un-press-releases", "un-spokesperson", "un-sg", "gnews-un-sg", "un-press-archive", "dppa"}
    SG_TITLE = re.compile(r"^(The\s+)?(UN\s+)?Secretary-General(?!.*\bDeputy)\b")

    # ---- quotes ----
    quotes_by = defaultdict(list)
    qpath = os.path.join(DATA, "quotes-index.json")
    if os.path.exists(qpath):
        for q in json.load(open(qpath))["quotes"]:
            if q.get("speaker") and q["status"] != "unverified":
                pid = by_name.get(fold(q["speaker"]))
                if pid:
                    quotes_by[pid].append({"q": q["q"], "year": q["year"], "session": q["session"], "iso3": q["iso3"], "status": q["status"]})

    # ---- mentions and delivered statements ----
    now = datetime.now(timezone.utc)
    mentions = defaultdict(list)
    delivered = defaultdict(list)
    for kind, items in (("news", news), ("statement", statements)):
        for it in items:
            title = it.get("title", "")
            text = title + " " + (it.get("description") or it.get("excerpt") or "")
            spk = clean_speaker(it.get("speaker"))
            # "Secretary-General Appoints ...", "Secretary-General's remarks to ..." from UN sources are the SG's own
            if sg_id and it.get("source") in UN_OFFICIAL and SG_TITLE.search(title) and not re.search(r"\bDeputy Secretary-General", title):
                delivered[sg_id].append({"title": title, "url": it.get("url"), "source": it.get("source"), "publishedAt": it.get("publishedAt"), "kind": kind})
                continue
            for pid, rx in compiled.items():
                m = rx.search(text)
                is_speaker = spk and by_name.get(fold(spk)) == pid
                if not m and not is_speaker:
                    continue
                rec = {"title": title, "url": it.get("url"), "source": it.get("source"), "publishedAt": it.get("publishedAt"), "kind": kind}
                # delivered: the feed names them as speaker, or the title reads "... by <name>"
                if is_speaker or (m and re.search(r"\bby\s+(?:[A-Z][\w.-]*\s+){0,4}" + re.escape(m.group(1)), title)):
                    delivered[pid].append(rec)
                else:
                    mentions[pid].append(rec)

    # keep mention history across runs (the feeds themselves only hold a couple of weeks)
    previous = {}
    if os.path.exists(OUT):
        try:
            previous = {p["id"]: p for p in json.load(open(OUT))["people"]}
        except Exception:
            previous = {}
    keep_after = (now - timedelta(days=180)).isoformat()

    def merged(pid, key, fresh):
        byurl = {x["url"]: x for x in (previous.get(pid, {}).get(key) or []) if (x.get("publishedAt") or "") >= keep_after}
        for x in fresh:
            byurl[x["url"]] = x
        return sorted(byurl.values(), key=lambda x: x.get("publishedAt") or "", reverse=True)

    def recent_count(lst, days):
        cut = (now - timedelta(days=days)).isoformat()
        return sum(1 for x in lst if (x.get("publishedAt") or "") >= cut)

    out = []
    for pid, p in people.items():
        ms = merged(pid, "mentions", mentions[pid])
        dl = merged(pid, "delivered", delivered[pid])
        qs = sorted(quotes_by[pid], key=lambda x: -x["year"])
        if not (p["roles"] or p["speeches"] or ms or dl):
            continue
        days = Counter()
        for x in ms + dl:
            day = (x.get("publishedAt") or "")[:10]
            if day:
                days[day] += 1
        # merge "Head of State" + "Head of Government" of the same country into one role
        hs = {r["iso3"] for r in p["roles"] if r["role"] == "Head of State"}
        hg = {r["iso3"] for r in p["roles"] if r["role"] == "Head of Government"}
        both = hs & hg
        if both:
            roles = [r for r in p["roles"] if not (r["iso3"] in both and r["role"] == "Head of Government")]
            for r in roles:
                if r["iso3"] in both and r["role"] == "Head of State":
                    r["role"] = "Head of State and Government"
            p["roles"] = roles
        # direct Wikimedia thumbnail path (avoids the throttled Special:FilePath redirect)
        if p.get("image"):
            fn = p["image"].replace(" ", "_")
            h = hashlib.md5(fn.encode("utf-8")).hexdigest()
            p["imagePath"] = f"{h[0]}/{h[:2]}/{urllib.parse.quote(fn)}"
        for r in p["roles"]:
            r["iso2"] = iso2.get(r.get("iso3") or "", "")
        out.append({
            **p,
            "slug": pid if not pid.startswith("Q") else slugify(p["name"]) or pid,
            "speeches": sorted(p["speeches"], key=lambda s: -s["session"]),
            "quotes": qs[:12],
            "quoteCount": len(qs),
            "delivered": dl[:100],
            "mentions": ms[:200],
            "mentionCount": len(ms) + len(dl),
            "mentions7d": recent_count(ms + dl, 7),
            "mentions30d": recent_count(ms + dl, 30),
            "daily": sorted(days.items())[-90:],
            "lastSeen": (dl[:1] or ms[:1] or [{}])[0].get("publishedAt"),
        })
    # unique slugs
    seen = Counter()
    for p in sorted(out, key=lambda x: (-len(x["roles"]), x["name"])):
        seen[p["slug"]] += 1
        if seen[p["slug"]] > 1:
            p["slug"] = f'{p["slug"]}-{(p["qid"] or str(seen[p["slug"]])).lower()}'
    out.sort(key=lambda x: (-x["mentions30d"], x["name"]))
    payload = {"_meta": {"generated": now.isoformat(), "people": len(out),
                         "sources": ["Wikidata", "UN General Debate", "statements feed", "news feed", "quotes index"]},
               "people": out}
    tmp = OUT + ".tmp"
    with open(tmp, "w") as f:
        json.dump(payload, f, ensure_ascii=False)
    os.replace(tmp, OUT)
    print(f"{len(out)} people; with mentions: {sum(1 for p in out if p['mentionCount'])}; "
          f"top: {[(p['name'], p['mentions30d']) for p in out[:8]]}")


if __name__ == "__main__":
    main()

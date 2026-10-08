#!/usr/bin/env python3
"""
UN leadership: who holds the principal offices and key Under-Secretary-General posts, and what
they have said recently.

Holders come from evidence, newest first, never from a hard-coded list:
  1. manual overrides (site/server/data/un-leadership-overrides.json, edited in Admin);
  2. the Secretary-General's appointment press releases (sg-office.json, back to 2017);
  3. the people index (Wikidata and the PGA's own site), for offices it covers;
  4. for the ECOSOC President, the Council's annual election headline.
An office without evidence is shown as "holder not confirmed".

Statements: headlines on UN sites naming the office or its holder, as indexed by Google News.
Output: site/server/data/un-leadership.json
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote
from urllib.request import Request, urlopen
from xml.etree import ElementTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_statements import build_country_map, compile_country_patterns, tag_countries  # noqa: E402

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "server", "data")
OUT = os.path.join(DATA_DIR, "un-leadership.json")
OVERRIDES = os.path.join(DATA_DIR, "un-leadership-overrides.json")
UA = "Mozilla/5.0 (compatible; WorldCountryGroups/1.0; research)"
GN = "https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
OFFICIAL = re.compile(r"(^|\.)un\.org$|unmissions\.org$|unhcr\.org$|unicef\.org$|wfp\.org$|undp\.org$|ohchr\.org$|unocha\.org$|unwomen\.org$|unfpa\.org$|unep\.org$")
log = lambda *a: print(*a, flush=True)  # noqa: E731

# group, id, label, short name, appointment-post pattern, people-index role, headline terms
OFFICES = [
    ("principals", "sg", "Secretary-General", "SG", None, "United Nations Secretary-General", ["Secretary-General", "UN chief"]),
    ("principals", "dsg", "Deputy Secretary-General", "DSG", r"^Deputy Secretary-General\b", "Deputy Secretary-General of the United Nations", ["Deputy Secretary-General"]),
    ("principals", "pga", "President of the General Assembly", "PGA", None, "President of the United Nations General Assembly", ["President of the General Assembly", "General Assembly President"]),
    ("principals", "ecosoc", "President of the Economic and Social Council", "ECOSOC President", None, None, ["ECOSOC President", "President of the Economic and Social Council", "President of ECOSOC"]),
    ("peace", "dppa", "Under-Secretary-General for Political and Peacebuilding Affairs", "DPPA", r"Under-Secretary-General for Political (and Peacebuilding )?Affairs", None, ["Political and Peacebuilding Affairs", "UN political affairs chief"]),
    ("peace", "dpo", "Under-Secretary-General for Peace Operations", "DPO", r"Under-Secretary-General for (Peace Operations|Peacekeeping Operations)", None, ["Peace Operations", "UN peacekeeping chief"]),
    ("peace", "oda", "High Representative for Disarmament Affairs", "ODA", r"High Representative for Disarmament Affairs|Under-Secretary-General for Disarmament", None, ["High Representative for Disarmament Affairs", "UN disarmament chief"]),
    ("peace", "oct", "Under-Secretary-General for Counter-Terrorism", "OCT", r"Under-Secretary-General.{0,30}Counter-Terrorism", None, ["Office of Counter-Terrorism", "Counter-Terrorism Office"]),
    ("humanitarian", "ocha", "Emergency Relief Coordinator (OCHA)", "OCHA", r"Humanitarian Affairs and Emergency Relief Coordinator|Emergency Relief Coordinator", "Under-Secretary-General for Humanitarian Affairs and Emergency Relief Coordinator", ["Emergency Relief Coordinator", "UN humanitarian chief", "UN aid chief"]),
    ("humanitarian", "ohchr", "High Commissioner for Human Rights", "OHCHR", r"High Commissioner for Human Rights", "United Nations High Commissioner for Human Rights", ["High Commissioner for Human Rights", "UN rights chief", "UN human rights chief"]),
    ("humanitarian", "unhcr", "High Commissioner for Refugees", "UNHCR", r"High Commissioner for Refugees", "United Nations High Commissioner for Refugees", ["High Commissioner for Refugees", "UN refugee chief"]),
    ("development", "desa", "Under-Secretary-General for Economic and Social Affairs", "DESA", r"Under-Secretary-General for Economic and Social Affairs", None, ["Economic and Social Affairs"]),
    ("development", "undp", "Administrator of UNDP", "UNDP", r"^Administrator of the United Nations Development Programme|UNDP Administrator", "Administrator of the United Nations Development Programme", ["UNDP Administrator", "UNDP chief"]),
    ("development", "unicef", "Executive Director of UNICEF", "UNICEF", r"^Executive Director of (UNICEF|the United Nations Children's Fund)", "Executive Director of UNICEF", ["UNICEF Executive Director", "UNICEF chief"]),
    ("development", "wfp", "Executive Director of WFP", "WFP", r"^Executive Director,? (of )?(the )?World Food Programme", "Executive Director of the World Food Programme", ["WFP Executive Director", "WFP chief"]),
    ("development", "unfpa", "Executive Director of UNFPA", "UNFPA", r"^Executive Director of (UNFPA|the United Nations Population Fund)", None, ["UNFPA Executive Director", "UNFPA chief"]),
    ("development", "unwomen", "Executive Director of UN Women", "UN Women", r"^Executive Director of UN[- ]Women", None, ["UN Women Executive Director", "UN Women chief"]),
    ("development", "unep", "Executive Director of UNEP", "UNEP", r"^Executive Director of (UNEP|the United Nations Environment Programme)", None, ["UNEP Executive Director", "UNEP chief", "UN environment chief"]),
    ("management", "dmspc", "Under-Secretary-General for Management Strategy, Policy and Compliance", "DMSPC", r"Under-Secretary-General for Management", None, ["Management Strategy, Policy and Compliance"]),
    ("management", "dos", "Under-Secretary-General for Operational Support", "DOS", r"Under-Secretary-General for (Operational Support|Field Support)", None, ["Operational Support"]),
    ("management", "dgc", "Under-Secretary-General for Global Communications", "DGC", r"Under-Secretary-General for (Global Communications|Communications and Public Information)", None, ["Global Communications"]),
    ("management", "dss", "Under-Secretary-General for Safety and Security", "DSS", r"Under-Secretary-General for Safety and Security", None, ["Department of Safety and Security"]),
    ("management", "ola", "Legal Counsel (Office of Legal Affairs)", "OLA", r"Under-Secretary-General for Legal Affairs|Legal Counsel", None, ["Legal Counsel", "Office of Legal Affairs"]),
]
UNIT = {
    "dppa": re.compile(r"Political and Peacebuilding|Political Affairs", re.I), "dpo": re.compile(r"Peace Operations|Peacekeeping", re.I), "oda": re.compile(r"Disarmament", re.I),
    "oct": re.compile(r"Office of Counter-Terrorism|UNOCT", re.I), "ocha": re.compile(r"Humanitarian Affairs|Emergency Relief|OCHA", re.I), "ohchr": re.compile(r"Human Rights|OHCHR", re.I),
    "unhcr": re.compile(r"Refugees|UNHCR", re.I), "desa": re.compile(r"Economic and Social Affairs|DESA", re.I), "undp": re.compile(r"Development Programme|UNDP", re.I),
    "unicef": re.compile(r"Children.s Fund|UNICEF", re.I), "wfp": re.compile(r"World Food Programme|WFP", re.I), "unfpa": re.compile(r"Population Fund|UNFPA", re.I),
    "unwomen": re.compile(r"UN[- ]Women|Gender Equality and the Empowerment of Women", re.I), "unep": re.compile(r"Environment Programme|UNEP", re.I),
    "dmspc": re.compile(r"Management Strategy|DMSPC", re.I), "dos": re.compile(r"Operational Support", re.I), "dgc": re.compile(r"Global Communications", re.I),
    "dss": re.compile(r"Safety and Security", re.I), "ola": re.compile(r"Legal Affairs|Legal Counsel", re.I),
}
HEAD = re.compile(r"Under-Secretary-General|Executive Director|Administrator|High Commissioner|High Representative|Legal Counsel|Emergency Relief Coordinator", re.I)
GROUPS = {"principals": "Principal organs", "peace": "Peace and security", "humanitarian": "Humanitarian and human rights",
          "development": "Development, funds and programmes", "management": "Management and support"}


def fetch_items(q):
    for attempt in range(3):
        try:
            with urlopen(Request(GN.format(q=quote(q)), headers={"User-Agent": UA}), timeout=40) as r:
                root = ElementTree.fromstring(r.read())
            break
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                log(f"  ! {q[:60]}: {e}")
                return []
            time.sleep(3 * (attempt + 1))
    out = []
    for it in root.iter("item"):
        src = it.find("source")
        src_name = (src.text or "").strip() if src is not None else ""
        host = re.sub(r"^https?://(www\.)?", "", (src.get("url") if src is not None else "") or "").strip("/").lower()
        title = (it.findtext("title") or "").strip().replace("’", "'")
        if src_name and title.endswith(" - " + src_name):
            title = title[: -len(src_name) - 3]
        title = re.sub(r"\s+[-|–]\s+(UN Meetings Coverage and Press Releases|United Nations.*|UN News|Welcome to the United Nations)$", "", title).strip()
        try:
            d = parsedate_to_datetime(it.findtext("pubDate")).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:  # noqa: BLE001
            continue
        if len(title) >= 20:
            out.append({"title": title, "url": (it.findtext("link") or "").strip(), "date": d, "outlet": src_name, "host": host})
    return out


def windows(days_back, step, now):
    out, end = [], now.date() + timedelta(days=1)
    limit = now.date() - timedelta(days=days_back)
    while end > limit:
        start = max(limit, end - timedelta(days=step))
        out.append((start.isoformat(), end.isoformat()))
        end = start
    return out


def surname(name):
    parts = [p for p in re.split(r"\s+", name or "") if p and not p.endswith(".")]
    return parts[-1] if parts else None


def main():
    now = datetime.now(timezone.utc)
    cmap = build_country_map()
    patterns = compile_country_patterns(cmap)
    iso_name = {}  # the fullest name for each country ("United States", not "US")
    for n, i in cmap.items():
        if len(n) > 3 and (i not in iso_name or (len(iso_name[i]) <= 3)):
            iso_name[i] = n

    def load(path, default):
        try:
            with open(path) as f:
                return json.load(f)
        except Exception:  # noqa: BLE001
            return default

    prev = load(OUT, {})
    roster = load(os.path.join(DATA_DIR, "un-leadership-roster.json"), {})
    overrides = load(OVERRIDES, {})
    sg = load(os.path.join(DATA_DIR, "sg-office.json"), {})
    people = load(os.path.join(DATA_DIR, "people-index.json"), {}).get("people", [])
    appts = sg.get("appointments", [])

    # ECOSOC president: the Council elects its President each July for a one-year term
    ecosoc = (prev.get("_meta") or {}).get("ecosoc")
    try:
        cands = []
        for q in ['"Economic and Social Council" elects President', 'ECOSOC elects President', '"elected President of the Economic and Social Council"']:
            cands += fetch_items(q + " when:1y")
            time.sleep(1.0)
        for it in sorted(cands, key=lambda x: x["date"], reverse=True):
            m = re.search(r"(?:Elects|elected|elects)\s+(?:Ambassador\s+)?([A-Z][\w'’.-]+(?:\s+[A-Z][\w'’.-]+){0,4})\s+(?:of|\()\s*([A-Z][A-Za-z' ]+?)\)?\s+(?:as\s+)?(?:its\s+)?(?:President|Eighty|Ninety|\d)", it["title"]) \
                or re.search(r"([A-Z][\w'’.-]+(?:\s+[A-Z][\w'’.-]+){1,4})\s+\(([A-Z][A-Za-z' ]+)\)\s+(?:is\s+)?elected President of the Economic and Social Council", it["title"])
            nat = m.group(2).strip() if m else None
            if not m:
                m = re.search(r"(?:Ambassador\s+)?([A-Z][\w'’.-]+(?:\s+[A-Z][\w'’.-]+){1,3})\s+(?:is\s+)?elected (?:as\s+)?(?:new\s+)?ECOSOC President", it["title"]) \
                    or re.search(r"ECOSOC elects (?:\w+\s+){0,2}(?:diplomat|ambassador|envoy)\s+([A-Z][\w'’.-]+(?:\s+[A-Z][\w'’.-]+){1,3})\s+as", it["title"], re.I)
            if m:
                name = m.group(1).strip()
                if not nat:  # nationality from any headline naming them ("Algeria's Presidency", "Algerian diplomat")
                    sn = name.split()[-1]
                    for c in cands:
                        if sn in c["title"] or "ECOSOC" in c["title"]:
                            tagged = sorted(tag_countries(c["title"].replace("Algerian", "Algeria"), patterns))
                            if len(tagged) == 1:
                                nat = next((n for n, i in cmap.items() if i == tagged[0]), None)
                                break
                ecosoc = {"name": name, "nationalityName": nat, "since": it["date"][:10], "url": it["url"], "source": it["outlet"] or "news", "evidence": it["title"]}
                break
    except Exception as e:  # noqa: BLE001
        log(f"  ! ECOSOC: {e}")
    log(f"ECOSOC President: {ecosoc and ecosoc['name']}")

    offices = []
    for group, oid, label, short, post_re, people_role, terms in OFFICES:
        cands = []
        if oid in overrides and overrides[oid].get("name"):
            o = overrides[oid]
            cands.append({"name": o["name"], "iso3": o.get("iso3"), "since": o.get("since") or "", "source": "Set by the site's editors", "url": o.get("url"), "kind": "override"})
        if post_re:
            for a in appts:
                post = a.get("post") or ""
                if a.get("person") and re.search(post_re, post, re.I) and not re.match(r"^(Deputy|Assistant|Acting|Officer)", post, re.I) and not re.search(r"\b(Deputy|Assistant)\s+(Executive|High|Secretary|Director|Special)", post):
                    cands.append({"name": a["person"], "iso3": a.get("nationality"), "since": a["date"][:10], "source": a.get("source") or "press.un.org", "url": a.get("url"), "kind": "appointment", "acting": a.get("acting")})
        if people_role:
            for p in people:
                for r in p.get("roles", []):
                    if (r.get("role") or "").startswith(people_role) and not r.get("iso3"):
                        if oid == "pga" and str(ga_session(now)) not in (r.get("role") or "") and "un.org/pga" != r.get("source"):
                            continue
                        cands.append({"name": p["name"], "iso3": None, "since": r.get("since") or "", "source": r.get("source") or "Wikidata", "url": (f"https://en.wikipedia.org/wiki/{p['wikipedia']}" if p.get("wikipedia") else None),
                                      "kind": "people", "slug": p.get("slug"), "image": p.get("imagePath") or p.get("image")})
        if oid == "ecosoc" and ecosoc:
            cands.append({"name": ecosoc["name"], "iso3": cmap.get(ecosoc.get("nationalityName") or ""), "since": ecosoc["since"], "source": ecosoc["source"], "url": ecosoc["url"], "kind": "election"})
        # the official list pasted from un.org (same matching as the site: department/agency name + head title)
        for e in roster.get("entries", []):
            t = e.get("title", "")
            if re.match(r"^(Deputy|Assistant|Associate)\b", t) and oid != "dsg":
                continue
            unit = UNIT.get(oid)
            hit = (oid == "dsg" and re.match(r"^Deputy Secretary-General\b", t)) or (unit and HEAD.search(t) and unit.search(t)) or (post_re and re.search(post_re, t, re.I))
            if hit:
                cands.append({"name": e["name"], "iso3": None, "since": (roster.get("pastedAt") or "")[:10], "source": "UN leadership team page", "url": roster.get("source"), "kind": "roster"})
                break
        # most recent evidence wins; an override always wins
        cands.sort(key=lambda c: (c["kind"] == "override", c.get("since") or ""), reverse=True)
        holder = dict(cands[0]) if cands else None
        if holder and holder.get("kind") == "roster":
            # the official list proves who holds the post, not since when: take the start date from the same person's other records
            sn = holder["name"].split()[-1].lower()
            same = next((c for c in cands[1:] if c.get("name") and c["name"].split()[-1].lower() == sn and c.get("since")), None)
            holder["listedOn"] = holder.get("since")
            holder["since"] = same["since"] if same else None
            if same and not holder.get("iso3"):
                holder["iso3"] = same.get("iso3")
        if holder:
            # enrich from the people index (photo, page) and nationality from appointments
            pp = next((p for p in people if p["name"].lower() == holder["name"].lower() or holder["name"].lower() in [a.lower() for a in p.get("aliases", [])]), None)
            if pp:
                holder.setdefault("slug", pp.get("slug"))
                holder["image"] = holder.get("image") or pp.get("imagePath") or pp.get("image")
            if not holder.get("iso3"):
                same = next((c for c in cands if c.get("iso3") and c["name"].lower() == holder["name"].lower()), None)
                holder["iso3"] = same["iso3"] if same else None
            holder["nationality"] = iso_name.get(holder["iso3"]) if holder.get("iso3") else None
            since = holder.get("since") or ""
            # only a holder known solely from an old appointment announcement needs confirming
            holder["stale"] = bool(holder.get("kind") == "appointment" and since and since < (now - timedelta(days=365 * 6)).date().isoformat())
        offices.append({"id": oid, "group": group, "label": label, "short": short, "holder": holder, "postRe": post_re, "peopleRole": people_role,
                        "evidence": [{k: c.get(k) for k in ("name", "since", "source", "url", "kind")} for c in cands[:4]], "terms": terms})

    # ---- upkeep: General Assembly approvals, departures and stand-ins, nationalities
    ga_approvals = []
    try:
        for q in ['"General Assembly" approves appointment OR "elects" "High Commissioner" when:1y',
                  '"General Assembly" approves appointment "Secretary-General" when:1y']:
            ga_approvals += fetch_items(q)
            time.sleep(1.0)
    except Exception as e:  # noqa: BLE001
        log(f"  ! approvals: {e}")
    roster_by = {}
    for o in offices:
        h = o.get("holder")
        # approvals: "General Assembly Approves Appointment of <name> as <post>" / "elects <name> (<country>) as <post>"
        for it in ga_approvals:
            if not OFFICIAL.search(it["host"]):
                continue
            m = re.search(r"(?:Approves Appointment of|Elects|elected)\s+([A-Z][\w'’.\- ]{3,60}?)\s+(?:\(([^)]+)\)\s+)?(?:as|to be)\s+(.+)$", it["title"], re.I)
            if m and o.get("postRe") and re.search(o["postRe"], m.group(3), re.I) and (not h or h.get("since", "") < it["date"][:10]) and (not h or m.group(1).split()[-1] not in h["name"]):
                o["note"] = f"General Assembly approved {m.group(1).strip()} ({it['date'][:10]})"
                o["holder"] = h = {"name": m.group(1).strip(), "iso3": cmap.get(m.group(2) or ""), "since": it["date"][:10], "source": it["outlet"] or "UN", "url": it["url"], "kind": "ga-approval"}
        if not h or o["id"] == "sg":  # the Secretary-General's succession is followed on the elections pages
            continue
        # departures and acting heads, from headlines naming the holder
        parts = [w for w in h["name"].split() if w]
        short = f"{parts[0]} {parts[-1]}" if len(parts) >= 2 else h["name"]
        try:
            items = fetch_items(f'"{short}" ("step down" OR "steps down" OR resigns OR resignation OR "end of his term" OR "end of her term" OR "concludes" OR "departure") when:120d')
        except Exception:  # noqa: BLE001
            items = []
        for it in items:
            if parts[-1] in it["title"] and re.search(r"step(s|ping)? down|resign|departure|leav(es|ing) (the|his|her) post|end of (his|her) (term|tenure)|concludes (his|her) (term|tenure)", it["title"], re.I) \
                    and it["date"][:10] >= (h.get("since") or "0000"):
                o["transition"] = {"title": it["title"], "url": it["url"], "date": it["date"][:10], "source": it["outlet"]}
                break
        time.sleep(0.8)
    # acting heads / officers-in-charge announced for tracked offices
    try:
        acting = fetch_items('"Officer-in-Charge" OR "Acting Under-Secretary-General" OR "acting head" United Nations when:120d')
    except Exception:  # noqa: BLE001
        acting = []
    for it in acting:
        if not OFFICIAL.search(it["host"]):
            continue
        for o in offices:
            if o.get("postRe") and re.search(o["postRe"].replace("^", ""), it["title"], re.I) and re.search(r"Officer-in-Charge|Acting", it["title"], re.I):
                o["transition"] = o.get("transition") or {"title": it["title"], "url": it["url"], "date": it["date"][:10], "source": it["outlet"], "acting": True}
    # nationalities: from appointment announcements (same surname), then Wikidata citizenship
    nat_cache = {k: v for k, v in ((prev.get("_meta") or {}).get("nationalities", {})).items() if v}
    lookups = 0
    for o in offices:
        h = o.get("holder")
        if not h or h.get("iso3"):
            continue
        sn = h["name"].split()[-1].lower()
        hit = next((a for a in appts if a.get("person") and a["person"].split()[-1].lower() == sn and a.get("nationality")), None)
        if hit:
            h["iso3"] = hit["nationality"]
        elif h["name"] in nat_cache:
            h["iso3"] = nat_cache[h["name"]]
        elif lookups < 6:  # Wikidata asks for gentle use: a few lookups per run, a few seconds apart
            lookups += 1
            found = wikidata_citizenship(h["name"])
            if found:
                h["iso3"] = nat_cache[h["name"]] = found
            time.sleep(4)
        h["nationality"] = iso_name.get(h["iso3"]) if h.get("iso3") else None
    # roster reminder: how old the pasted official list is, and senior appointments announced since
    pasted = (roster.get("pastedAt") or "")[:10]
    since_list = [a for a in appts if pasted and a["date"][:10] > pasted and a.get("category") in ("senior", "envoy", "mission")]
    roster_status = {"pastedAt": pasted or None, "ageDays": (now.date() - datetime.fromisoformat(pasted).date()).days if pasted else None,
                     "appointmentsSince": len(since_list), "examples": [f"{a['person']}: {a['post']}" for a in since_list[:5]]}

    # statements: headlines on UN sites naming the office or its holder
    first = not (prev.get("_meta") or {}).get("statementsBackfilled")
    prev_stmts = {o["id"]: o.get("statements", []) for o in prev.get("offices", [])}
    prev_as = {o["id"]: o.get("searchedAs") for o in prev.get("offices", [])}
    for o in offices:
        if o["id"] == "sg":
            o["statements"] = [{"title": s["title"], "url": s["url"], "date": s["date"], "host": s.get("source"), "countries": s.get("countries", [])} for s in sg.get("statements", [])[:60]]
            continue
        full = o["holder"]["name"] if o.get("holder") else None
        parts = [w for w in re.split(r"\s+", re.sub(r"^((Lieutenant |Major[- ])?General|LG|MG)\s+", "", full or "")) if w]
        short_name = f"{parts[0]} {parts[-1]}" if len(parts) >= 2 else full  # "Jean-Pierre Lacroix", as the news writes it
        names = [short_name] if short_name else []
        sn = surname(full) if full else None
        o["searchedAs"] = short_name
        # a new holder (or the first run) gets four months of history; otherwise the last two weeks
        win = windows(120 if first or prev_as.get(o["id"]) != short_name else 14, 14, now)
        words = [f'"{t}"' for t in o["terms"]] + ([f'"{names[0]}"'] if names else [])
        title_re = re.compile("|".join([re.escape(t) for t in o["terms"]] + ([re.escape(sn)] if sn and len(sn) > 3 else [])), re.I)
        got = {re.sub(r"[^a-z0-9]+", " ", s["title"].lower())[:120]: s for s in prev_stmts.get(o["id"], [])}
        for a, b in win:
            for it in fetch_items(f"({' OR '.join(words)}) after:{a} before:{b}"):
                if not OFFICIAL.search(it["host"]) or not title_re.search(it["title"]):
                    continue
                if o["id"] == "pga" and re.search(r"elects?\b.*President of the|President-elect", it["title"], re.I) and not (sn and sn in it["title"]):
                    continue
                k = re.sub(r"[^a-z0-9]+", " ", it["title"].lower())[:120]
                if k not in got:
                    got[k] = {"title": it["title"], "url": it["url"], "date": it["date"], "host": it["host"], "countries": sorted(tag_countries(it["title"], patterns))}
            time.sleep(1.0)
        cutoff = (now - timedelta(days=365)).strftime("%Y-%m-%d")
        o["statements"] = sorted([s for s in got.values() if s["date"] >= cutoff], key=lambda s: s["date"], reverse=True)[:60]
        log(f"  {o['short']:<16} {o['holder']['name'] if o.get('holder') else '— not confirmed —':<32} {len(o['statements'])} items")

    out = {
        "_meta": {"updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "statementsBackfilled": True, "ecosoc": ecosoc, "groups": GROUPS,
                  "nationalities": nat_cache, "roster": roster_status,
                  "method": "Holders from overrides, the Secretary-General's appointment press releases, the people index (Wikidata, the PGA's site) and ECOSOC's election headline; statements are UN-site headlines naming the office or holder."},
        "offices": offices,
    }
    tmp = OUT + ".tmp"
    with open(tmp, "w") as f:
        json.dump(out, f, ensure_ascii=False)
    os.replace(tmp, OUT)
    log(f"wrote {OUT}: {sum(1 for o in offices if o.get('holder'))}/{len(offices)} holders confirmed")


WD_UA = "WorldCountryGroups/1.0 (https://www.worldcountrygroups.org; research site) python-urllib"


def wikidata_citizenship(name):
    """ISO3 of a person's country of citizenship on Wikidata (first exact-name match that has one)."""
    import urllib.parse
    UA = WD_UA  # noqa: N806
    try:
        q = urllib.parse.urlencode({"action": "wbsearchentities", "search": name, "language": "en", "type": "item", "limit": 3, "format": "json"})
        with urlopen(Request(f"https://www.wikidata.org/w/api.php?{q}", headers={"User-Agent": UA}), timeout=30) as r:
            hits = json.loads(r.read()).get("search", [])
        for h in hits:
            q2 = urllib.parse.urlencode({"action": "wbgetentities", "ids": h["id"], "props": "claims", "format": "json"})
            with urlopen(Request(f"https://www.wikidata.org/w/api.php?{q2}", headers={"User-Agent": UA}), timeout=30) as r:
                cl = json.loads(r.read())["entities"][h["id"]].get("claims", {})
            if not any(c["mainsnak"].get("datavalue", {}).get("value", {}).get("id") == "Q5" for c in cl.get("P31", [])):
                continue
            for c in cl.get("P27", []):
                cid = c["mainsnak"].get("datavalue", {}).get("value", {}).get("id")
                if not cid:
                    continue
                q3 = urllib.parse.urlencode({"action": "wbgetentities", "ids": cid, "props": "claims", "format": "json"})
                with urlopen(Request(f"https://www.wikidata.org/w/api.php?{q3}", headers={"User-Agent": UA}), timeout=30) as r:
                    cc = json.loads(r.read())["entities"][cid].get("claims", {})
                iso = next((x["mainsnak"]["datavalue"]["value"] for x in cc.get("P298", []) if x["mainsnak"].get("datavalue")), None)
                if iso:
                    return iso
            return None
    except Exception:  # noqa: BLE001
        return None
    return None


def ga_session(now):
    return now.year - 1945 - (1 if (now.month, now.day) < (9, 9) else 0)


if __name__ == "__main__":
    main()

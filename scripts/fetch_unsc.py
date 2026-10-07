#!/usr/bin/env python3
"""Fetch UN Security Council activity from the Dag Hammarskjöld Library's official tables.

Sources (the data feeds behind research.un.org/en/docs/sc/quick):
  - meetings per year:  .../render_meeting/scmeetings_<year>/EN
      meeting record, date, press release, agenda topic, outcome and vote tally
  - veto list:          .../render_meeting_veto/sc_veto_list/EN
  - current members:    https://www.un.org/securitycouncil/content/current-members

Writes (schemas kept compatible with the site):
  site/server/data/unsc-votes.json     resolutions + failed drafts, with tallies
  site/server/data/unsc-vetoes.json    every veto since 1946
  site/server/data/unsc-history.json   elected-member terms (current terms corrected)
  site/server/data/unsc-activity.json  recent meetings + presidential statements + presidency rota
  site/server/data/ga-resolutions.json General Assembly resolutions of the current and previous session

Per-country votes: the meeting tables give tallies only. A resolution's per-member
votes are filled in only where the record fixes them (unanimous adoption, or the
permanent members that vetoed a draft); otherwise `votes_complete` is false.

On any fetch failure the existing files are left untouched.
"""

import html
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

API = "https://ydsftksff8.execute-api.us-east-1.amazonaws.com/dev"
MEMBERS_URL = "https://www.un.org/securitycouncil/content/current-members"
PRESIDENCY_URL = "https://www.un.org/securitycouncil/content/presidency"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "site", "server", "data")
WORLD = os.path.join(ROOT, "worldcountrygroups", "data", "groups", "world.json")
FIRST_YEAR = 1995
ACTIVITY_DAYS = 120
P5 = ["CHN", "FRA", "RUS", "GBR", "USA"]

ALIASES = {
    "russian federation": "RUS", "russia": "RUS", "ussr": "RUS", "union of soviet socialist republics": "RUS",
    "united kingdom": "GBR", "united states": "USA", "united states of america": "USA",
    "china": "CHN", "france": "FRA", "republic of korea": "KOR", "korea": "KOR",
    "democratic republic of the congo": "COD", "republic of the congo": "COG", "congo": "COG",
    "iran": "IRN", "syria": "SYR", "venezuela": "VEN", "bolivia": "BOL", "tanzania": "TZA",
    "united republic of tanzania": "TZA", "viet nam": "VNM", "turkiye": "TUR", "türkiye": "TUR",
    "cote d'ivoire": "CIV", "côte d'ivoire": "CIV", "czechia": "CZE", "north macedonia": "MKD",
    "moldova": "MDA", "lao": "LAO", "gambia": "GMB", "bahamas": "BHS", "netherlands": "NLD",
}


def get(url, timeout=90, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            err = e
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"{url}: {err}")


def rows(page):
    out = []
    for r in re.findall(r"<tr.*?</tr>", page, re.S):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S)
        text = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", c))).strip() for c in cells]
        links = re.findall(r'href="([^"]+)"', r)
        out.append((text, links))
    return out


def iso_date(s):
    for fmt in ("%d %B %Y", "%d %b %Y"):
        try:
            return datetime.strptime(s.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


class Names:
    def __init__(self):
        world = json.load(open(WORLD))["countries"]
        self.by_name = {c["name"].lower(): c["iso3"] for c in world}
        self.by_name.update(ALIASES)

    def iso3(self, name):
        n = re.sub(r"\s+", " ", name.strip().lower().replace("’", "'"))
        n = re.sub(r"^the ", "", n)
        if n in self.by_name:
            return self.by_name[n]
        for k, v in self.by_name.items():
            if len(k) > 4 and (n.startswith(k) or k.startswith(n)):
                return v
        return None


TALLY = r"(\d{1,2})-(\d{1,2})-(\d{1,2})"


def parse_outcome(outcome, names):
    """Return (resolutions, failed_drafts, prsts) parsed from an outcome cell."""
    res, failed, prst = [], [], []
    for m in re.finditer(r"S/RES/(\d+)\s*\((\d{4})\)\s*" + TALLY, outcome):
        res.append({"id": f"S/RES/{m.group(1)} ({m.group(2)})", "tally": tuple(map(int, m.group(3, 4, 5)))})
    for m in re.finditer(r"Draft (?:resolution|amendments?) (S/\d{4}/\d+)(.*?)" + TALLY, outcome):
        body = m.group(2)
        vetoers = []
        v = re.search(r"vetoed by ([A-Za-z ,]+?)(?:\s*;|\s*$|\s+S/|\s+The)", body + " ")
        if v:
            for part in re.split(r",| and ", v.group(1)):
                code = names.iso3(part)
                if code in P5:
                    vetoers.append(code)
        failed.append({"id": m.group(1), "tally": tuple(map(int, m.group(3, 4, 5))), "vetoed_by": vetoers})
    for m in re.finditer(r"S/PRST/(\d{4})/(\d+)", outcome):
        prst.append(f"S/PRST/{m.group(1)}/{m.group(2)}")
    return res, failed, prst



def fetch_presidency(names):
    """Monthly Council presidency rota (current, next and previous year) from un.org."""
    page = get(PRESIDENCY_URL)
    out = []
    for cells, _ in rows(page):
        if len(cells) < 2:
            continue
        m = re.match(r"(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$", cells[0])
        if not m:
            continue
        month = datetime.strptime(cells[0], "%B %Y").strftime("%Y-%m")
        term = cells[2] if len(cells) > 2 else ""
        out.append({"month": month, "country": cells[1], "iso3": names.iso3(cells[1]),
                    "permanent": "permanent" in term.lower(),
                    "term_end": None if "permanent" in term.lower() else (re.findall(r"\d{4}", term) or [None])[0]})
    return sorted({p["month"]: p for p in out}.values(), key=lambda p: p["month"])


def fetch_ga_resolutions(session):
    """General Assembly resolutions of one session, with the vote (or adoption without a vote)."""
    page = get(f"{API}/render_meeting_ga/garesolutions_{session}/EN")
    out = []
    for cells, links in rows(page):
        if len(cells) < 6 or not cells[0].startswith("A/RES/"):
            continue
        res_id, body, agenda, meeting_vote, draft, title = cells[:6]
        m = re.search(r"(A/\d+/PV\.\d+)\s*-->\s*(\d{1,2} \w+ \d{4})\s*(.*)$", meeting_vote)
        if not m:
            continue
        date = iso_date(m.group(2))
        vote = m.group(3).strip()
        # Assembly votes run to three digits ("152-3-4"); the Council pattern only allows two
        t = re.search(r"(?<!\d)(\d{1,3})-(\d{1,3})-(\d{1,3})(?!\d)", vote)
        out.append({
            "id": res_id, "session": session, "date": date, "title": title, "body": body,
            "agenda_item": agenda, "meeting": m.group(1), "draft": draft,
            "without_vote": "without" in vote.lower(),
            "tally": {"yes": int(t.group(1)), "no": int(t.group(2)), "abstain": int(t.group(3))} if t else None,
            "url": f"https://docs.un.org/{res_id}",
        })
    return out


def members_in(year, history):
    elected = [iso for iso, terms in history["terms"].items() if any(s <= year <= e for s, e in terms)]
    return P5 + elected


def main():
    names = Names()
    now = datetime.now(timezone.utc)
    this_year = now.year

    # ---- current members (fix elected terms) ----
    page = get(MEMBERS_URL)
    text = html.unescape(re.sub(r"<[^>]+>", "\n", re.sub(r"<script.*?</script>", "", page, flags=re.S)))
    i = text.find("non-permanent members elected")
    pairs = re.findall(r"([A-Z][A-Za-z' .-]+?)\s*\((20\d\d)\)", re.sub(r"\s+", " ", text[i:i + 2000]))
    current = {}
    for name, end in pairs:
        code = names.iso3(name)
        if code and code not in P5:
            current[code] = int(end)
    if len(current) != 10:
        sys.exit(f"Expected 10 elected members, parsed {len(current)}: {current}")

    history_path = os.path.join(DATA, "unsc-history.json")
    history = json.load(open(history_path))
    for iso, terms in list(history["terms"].items()):
        # drop any recorded term covering this year that the official list doesn't confirm
        history["terms"][iso] = [t for t in terms if not (t[0] <= this_year <= t[1]) or iso in current]
    for iso, end in current.items():
        terms = [t for t in history["terms"].get(iso, []) if not (t[0] <= this_year <= t[1])]
        terms.append([end - 1, end])
        history["terms"][iso] = sorted(terms)
    history["terms"] = {k: v for k, v in history["terms"].items() if v}
    history["_meta"]["last_updated"] = now.strftime("%Y-%m-%d")
    history["_meta"]["current_terms_source"] = MEMBERS_URL

    # ---- meetings, resolutions, failed drafts ----
    resolutions, activity, prsts = [], [], []
    activity_cutoff = (now.timestamp() - ACTIVITY_DAYS * 86400)
    for year in range(FIRST_YEAR, this_year + 1):
        try:
            page = get(f"{API}/render_meeting/scmeetings_{year}/EN")
        except Exception as e:
            if year >= this_year - 1:
                sys.exit(f"Failed to fetch meetings for {year}: {e}")
            print(f"  skip {year}: {e}")
            continue
        n_year = 0
        for cells, links in rows(page):
            if len(cells) != 5 or not cells[0].startswith("S/PV"):
                continue
            meeting, date_s, press, topic, outcome = cells
            date = iso_date(date_s)
            if not date:
                continue
            press_url = next((l for l in links if "/press/" in l or "press.un.org" in l), None)
            res, failed, pr = parse_outcome(outcome, names)
            members = members_in(int(date[:4]), history)
            for r in res:
                y, n, a = r["tally"]
                unanimous = y == 15 and n == 0 and a == 0
                resolutions.append({
                    "id": r["id"], "date": date, "title": topic, "adopted": True, "vetoed": False,
                    "tally": {"yes": y, "no": n, "abstain": a},
                    "votes": {c: "Y" for c in members} if unanimous else {},
                    "votes_complete": unanimous,
                    "meeting": meeting, "press_release": press_url,
                })
                n_year += 1
            for f in failed:
                y, n, a = f["tally"]
                resolutions.append({
                    "id": f["id"], "date": date, "title": topic, "adopted": False,
                    "vetoed": bool(f["vetoed_by"]),
                    "tally": {"yes": y, "no": n, "abstain": a},
                    "votes": {c: "N" for c in f["vetoed_by"]},
                    "votes_complete": False,
                    "meeting": meeting, "press_release": press_url,
                })
                n_year += 1
            for p in pr:
                prsts.append({"id": p, "date": date, "topic": topic, "meeting": meeting, "press_release": press_url})
            if datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp() >= activity_cutoff:
                activity.append({"meeting": meeting, "date": date, "topic": topic, "outcome": outcome,
                                 "press_release": press_url,
                                 "record": f"https://docs.un.org/{meeting}"})
        print(f"  {year}: {n_year} decisions")
        time.sleep(0.3)

    if not any(r["date"].startswith(str(this_year)) for r in resolutions) and now.month > 2:
        sys.exit("No decisions parsed for the current year; refusing to overwrite")

    # ---- vetoes ----
    page = get(f"{API}/render_meeting_veto/sc_veto_list/EN")
    vetoes = []
    for cells, _ in rows(page):
        if len(cells) != 5:
            continue
        date = iso_date(cells[0])
        if not date:
            continue
        # The cell uses abbreviations such as "USSR", "UK", "USA", "France UK USA"
        low = " " + re.sub(r"[^a-z]+", " ", cells[4].lower()) + " "
        by = []
        for pattern, code in ((r" (ussr|russian) ", "RUS"), (r" (uk|united kingdom) ", "GBR"),
                              (r" (usa|united states) ", "USA"), (r" china ", "CHN"), (r" france ", "FRA")):
            if re.search(pattern, low) and code not in by:
                by.append(code)
        vetoes.append({"date": date, "draft": cells[1], "meeting": cells[2].replace("S/PV.", ""),
                       "subject": cells[3], "vetoed_by": by})
    if len(vetoes) < 200:
        sys.exit(f"Veto list looks incomplete ({len(vetoes)} rows); refusing to overwrite")

    # ---- presidency rota and General Assembly resolutions (non-fatal if unavailable) ----
    try:
        presidency = fetch_presidency(names)
    except Exception as e:
        print(f"  presidency: {e}")
        presidency = []
    ga_session = this_year - 1945 - (1 if now.month < 9 else 0)
    ga = []
    for sess in (ga_session, ga_session - 1):
        try:
            got = fetch_ga_resolutions(sess)
            print(f"  GA session {sess}: {len(got)} resolutions")
            ga += got
        except Exception as e:
            print(f"  GA session {sess}: {e}")

    resolutions.sort(key=lambda r: r["date"], reverse=True)
    stamp = now.strftime("%Y-%m-%d")
    out = {
        "unsc-votes.json": {
            "_meta": {"last_updated": stamp, "total_resolutions": len(resolutions),
                      "source": "Dag Hammarskjöld Library, Security Council meetings tables",
                      "years": f"{FIRST_YEAR}-{this_year}",
                      "note": "Tallies are official. Per-member votes are only filled where the record fixes them (votes_complete)."},
            "resolutions": resolutions,
        },
        "unsc-vetoes.json": {
            "_meta": {"last_updated": stamp, "total_vetoes": len(vetoes),
                      "source": "Dag Hammarskjöld Library veto list",
                      "note": "USSR vetoes are recorded under RUS."},
            "vetoes": vetoes,
        },
        "unsc-history.json": history,
        "unsc-activity.json": {
            "_meta": {"last_updated": stamp, "days": ACTIVITY_DAYS,
                      "source": "Dag Hammarskjöld Library, Security Council meetings tables"},
            "meetings": sorted(activity, key=lambda m: m["date"], reverse=True),
            "presidential_statements": sorted(prsts, key=lambda p: p["date"], reverse=True)[:100],
            "presidency": presidency,
        },
    }
    if ga:
        out["ga-resolutions.json"] = {
            "_meta": {"last_updated": stamp, "sessions": sorted({r["session"] for r in ga}),
                      "source": "Dag Hammarskjöld Library, General Assembly resolutions tables"},
            "resolutions": sorted(ga, key=lambda r: (r["date"] or "", r["id"]), reverse=True),
        }
    # member-by-member votes from the UN Digital Library (scripts/undl_sc.py), when collected
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from undl_sc import merge as undl_merge
        rep = undl_merge(unsc=out["unsc-votes.json"], write=False)
        print(f"  Digital Library member votes: {rep.get('filled', 0)} filled, {rep.get('added', 0)} added")
    except Exception as e:  # noqa: BLE001
        print(f"  Digital Library merge skipped: {e}")
    for name, data in out.items():
        path = os.path.join(DATA, name)
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp, path)
    print(f"Wrote {len(resolutions)} decisions, {len(vetoes)} vetoes, {len(activity)} recent meetings, "
          f"{len(prsts)} presidential statements; elected members: {sorted(current)}")


if __name__ == "__main__":
    main()

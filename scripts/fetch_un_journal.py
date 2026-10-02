#!/usr/bin/env python3
"""Fetch the official meetings programme from the Journal of the United Nations.

The Journal website (https://journal.un.org) is an Angular app; its data comes from a
public JSON API whose base URL is published in https://journal.un.org/assets/config.json
("baseUrl": "https://journal-api.un.org/api/"). The calls the app itself makes:

  GET {base}officialsnew/<YYYY-MM-DD>   official meetings for one day
  GET {base}officials/<meeting id>      one meeting: agenda, programme, links
  headers:  location: "new york" | "geneva" | ...   language: "en"

For New York and Geneva this fetches today and the next 7 days, then the agenda of
each public meeting that has one (one request per meeting, paced). No login, captcha
or bot check is involved; requests are paced and identify the site.

Writes site/server/data/un-journal.json:
  {
    "_meta": {source, api, last_updated, issue_dates, days, counts},
    "meetings": [
      {id, location, timezone, date, start, end, time, time_to, followed_by, group, organ,
       session, title, room, closed, cancelled, webcast_url, journal_url,
       agenda: [str], documents: [str]}
    ]
  }
On failure (no day could be fetched) the existing file is left untouched (exit 1).
"""

import html
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

UA = "WorldCountryGroups/1.0 (+https://worldcountrygroups.exe.xyz)"
CONFIG_URL = "https://journal.un.org/assets/config.json"
DEFAULT_BASE = "https://journal-api.un.org/api/"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "site", "server", "data", "un-journal.json")
DAYS_AHEAD = 7
MAX_DETAILS = 120
PAUSE = 0.6

LOCATIONS = [
    # (slug used in journal.un.org URLs, API header value, label, timezone)
    ("new-york", "new york", "New York", "America/New_York"),
    ("geneva", "geneva", "Geneva", "Europe/Zurich"),
]


def get_json(url, headers=None, retries=3):
    h = {"User-Agent": UA, "Accept": "application/json"}
    h.update(headers or {})
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=h)
            with urllib.request.urlopen(req, timeout=45) as r:
                body = r.read().decode("utf-8")
                return json.loads(body) if body.strip() else None
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if i == retries - 1:
                raise
        except Exception:  # noqa: BLE001
            if i == retries - 1:
                raise
        time.sleep(3 * (i + 1))
    return None


def strip_html(s):
    if not s:
        return ""
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


def en(v):
    if isinstance(v, dict):
        return v.get("en") or next((x for x in v.values() if isinstance(x, str)), "")
    return v if isinstance(v, str) else ""


def paragraphs(h):
    """Split a Journal HTML block into its <p> paragraphs as plain text."""
    if not h:
        return []
    parts = re.split(r"</p\s*>|<br\s*/?>", h, flags=re.I)
    out = [strip_html(p) for p in parts]
    return [p for p in out if p]


def webcast_url(v):
    """The Journal gives a Kaltura entry id ("1_p8hht1gr"); UN Web TV serves it at
    https://webtv.un.org/en/asset/k1p/k1p8hht1gr."""
    if not v:
        return None
    v = v.strip()
    if v.startswith("http"):
        return v
    m = re.match(r"^1_([a-z0-9]{6,12})$", v, re.I)
    if m:
        k = "k1" + m.group(1).lower()
        return f"https://webtv.un.org/en/asset/{k[:3]}/{k}"
    return None


def get_base():
    try:
        cfg = get_json(CONFIG_URL)
        base = (cfg or {}).get("baseUrl")
        if base and base.startswith("https://"):
            return base if base.endswith("/") else base + "/"
    except Exception as e:  # noqa: BLE001
        print(f"  config.json unavailable ({e}); using default API base", file=sys.stderr)
    return DEFAULT_BASE


def local_iso(naive, tzname):
    """'2026-10-02T10:00:00' (local wall time) -> ISO with the UTC offset."""
    try:
        dt = datetime.fromisoformat(naive[:19]).replace(tzinfo=ZoneInfo(tzname))
        return dt.isoformat()
    except Exception:  # noqa: BLE001
        return None


TREATY_BODY = re.compile(r"^(Committee (on|against)|Human Rights Committee|Subcommittee on Prevention|"
                         r"Pre-sessional Working Group of the Committee)", re.I)


def group_name(group_title, m, organ):
    g = (group_title or "").strip() or ((m.get("groupName") or {}).get("value") or "").strip()
    if g:
        return g
    if TREATY_BODY.search(organ or ""):
        return "Human Rights Treaty Bodies"
    return "Other bodies"


def normalise(m, group_title, sess, loc, tzname, day):
    organ = (sess.get("name") or m.get("relatedOrganizationFullName") or "").strip()
    title = strip_html(en(m.get("meetingNumber")))
    extra = strip_html(en(m.get("title")))
    time_from = (m.get("timeFrom") or "").strip()
    followed = bool(m.get("isFollowedBy")) or time_from.lower().startswith("followed")
    start_raw = m.get("startDate") or ""
    end_raw = m.get("endDate") or ""
    rooms = [r.get("value") for r in (m.get("rooms") or []) if r.get("value")]
    session = strip_html(en(m.get("session")) or sess.get("session") or m.get("sessionNameText") or "")
    mid = m.get("id")
    return {
        "id": mid,
        "location": loc,
        "timezone": tzname,
        "date": (start_raw[:10] or day),
        "start": local_iso(start_raw, tzname) if start_raw else None,
        "end": local_iso(end_raw, tzname) if end_raw and (m.get("timeTo") or "").strip() else None,
        "time": "Followed by" if followed else (time_from or None),
        "time_to": (m.get("timeTo") or "").strip() or None,
        "followed_by": followed,
        "group": group_name(group_title, m, organ),
        "organ": organ,
        "organ_symbol": m.get("organSymbol") or None,
        "session": session or None,
        "title": title or None,
        "note": extra or None,
        "room": ", ".join(rooms) or strip_html(en(m.get("room"))) or None,
        "closed": bool(m.get("isClosed")),
        "cancelled": bool(m.get("isCancelled")),
        "webcast_url": webcast_url(m.get("webcastLink")),
        "journal_url": f"https://journal.un.org/en/meeting/officials/{mid}/{start_raw[:10] or day}" if mid else None,
        "agenda": [],
        "documents": [],
        "_has_agenda": (m.get("agendaTextCount") or 0) > 0 or (m.get("agendaCount") or 0) > 0,
    }


def main():
    base = get_base()
    print(f"  API base: {base}")
    meetings, days_meta, issue_dates = [], [], {}
    ok_days = 0
    for slug, header_loc, label, tzname in LOCATIONS:
        today = datetime.now(ZoneInfo(tzname)).date()
        hdr = {"location": header_loc, "language": "en"}
        for i in range(DAYS_AHEAD + 1):
            day = (today + timedelta(days=i)).isoformat()
            try:
                data = get_json(f"{base}officialsnew/{day}", hdr)
            except Exception as e:  # noqa: BLE001
                print(f"  {label} {day}: ERROR {e}", file=sys.stderr)
                days_meta.append({"location": label, "date": day, "ok": False, "count": 0})
                time.sleep(PAUSE)
                continue
            ok_days += 1
            n = 0
            if data:
                if data.get("issueDate"):
                    issue_dates[label] = data["issueDate"]
                for g in data.get("groups") or []:
                    for sess in g.get("sessions") or []:
                        for m in sess.get("meetings") or []:
                            meetings.append(normalise(m, g.get("groupNameTitle"), sess, label, tzname, day))
                            n += 1
            days_meta.append({"location": label, "date": day, "ok": True, "count": n,
                              "journal_url": f"https://journal.un.org/en/{slug}/all/{day}"})
            print(f"  {label} {day}: {n} meetings")
            time.sleep(PAUSE)

    if ok_days == 0:
        print("ERROR: no Journal day could be fetched; keeping the existing file", file=sys.stderr)
        return 1

    # de-duplicate (a meeting can appear under more than one group)
    seen, uniq = set(), []
    for m in meetings:
        k = (m["id"], m["date"])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(m)
    meetings = uniq

    # agenda of public meetings (closed consultations rarely publish one)
    want = [m for m in meetings if m["_has_agenda"] and not m["cancelled"] and m["id"]]
    want.sort(key=lambda m: (m["closed"], m["date"]))
    details_ok = 0
    for m in want[:MAX_DETAILS]:
        hdr = {"location": m["location"].lower(), "language": "en"}
        try:
            d = get_json(f"{base}officials/{m['id']}", hdr)
        except Exception as e:  # noqa: BLE001
            print(f"  detail {m['id']}: {e}", file=sys.stderr)
            d = None
        if d:
            details_ok += 1
            agenda_html = en(d.get("agenda"))
            m["agenda"] = paragraphs(agenda_html)[:25]
            docs = re.findall(r"docs\.un\.org/en/([^?'\"]+)\?direct", agenda_html or "")
            m["documents"] = list(dict.fromkeys(docs))[:30]
            if not m["webcast_url"]:
                m["webcast_url"] = webcast_url(d.get("webcastLink"))
        time.sleep(PAUSE)
    for m in meetings:
        m.pop("_has_agenda", None)

    meetings.sort(key=lambda m: (m["location"] != "New York", m["date"], m["start"] or "", m["organ"]))
    out = {
        "_meta": {
            "source": "Journal of the United Nations",
            "source_url": "https://journal.un.org/",
            "api": base,
            "last_updated": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "issue_dates": issue_dates,
            "days_ahead": DAYS_AHEAD,
            "days": days_meta,
            "counts": {
                "meetings": len(meetings),
                "by_location": {loc[2]: sum(1 for m in meetings if m["location"] == loc[2]) for loc in LOCATIONS},
                "agendas_fetched": details_ok,
            },
            "note": "Official meetings only. Times are local to each duty station. The programme for later days is "
                    "provisional and grows as the Journal is updated; Security Council meetings are usually listed "
                    "only a day ahead.",
        },
        "meetings": meetings,
    }
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    os.replace(tmp, OUT)
    print(f"Wrote {OUT}: {out['_meta']['counts']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

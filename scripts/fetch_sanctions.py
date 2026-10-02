#!/usr/bin/env python3
"""Build site/server/data/sanctions.json from the UN Security Council Consolidated List.

Regime metadata (measures, establishing resolution, target countries) comes from the
curated base in scripts/data/sanctions_regimes.json. Each regime is enriched with live
data from the consolidated list XML:
  - number of listed individuals and entities, most recent listing date
  - the most recent listings (name, reference number, date listed, nationality)
  - listed individuals by nationality and entities by address country (ISO3)
and a top-level by_country index gives, per ISO3, how many listed individuals hold that
nationality / entities are located there, split by regime.

List types found in the XML but missing from the curated base are added with defaults.

Source: https://scsanctions.un.org/resources/xml/en/consolidated.xml (redirects to a blob).
The downloaded XML is cached in ~/.cache/wcg/sanctions/ and revalidated with ETag.

Stdlib only. Output is written atomically.
"""

import json
import os
import re
import sys
import tempfile
import unicodedata
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA = os.environ.get("WCG_SITE_DATA") or os.path.join(ROOT, "site", "server", "data")
OUTPUT = os.path.join(DATA, "sanctions.json")
BASE_FILE = os.path.join(ROOT, "scripts", "data", "sanctions_regimes.json")
WORLD_FILE = os.path.join(ROOT, "worldcountrygroups", "data", "groups", "world.json")
CACHE = os.path.join(os.path.expanduser("~"), ".cache", "wcg", "sanctions")
XML_URL = "https://scsanctions.un.org/resources/xml/en/consolidated.xml"
SOURCE_PAGE = "https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list"
UA = "WorldCountryGroups/1.0 (+https://worldcountrygroups.exe.xyz)"
RECENT_PER_REGIME = 10
RECENT_GLOBAL = 20

# UN naming -> ISO3 for names that world.json spells differently
ALIASES = {
    "iran (islamic republic of)": "IRN",
    "russian federation": "RUS",
    "united kingdom of great britain and northern ireland": "GBR",
    "united states of america": "USA",
    "syrian arab republic": "SYR",
    "united republic of tanzania": "TZA",
    "turkiye": "TUR",
    "turkey": "TUR",
    "congo": "COG",
    "republic of the congo": "COG",
    "democratic republic of the congo": "COD",
    "egypt": "EGY",
    "kyrgyzstan": "KGZ",
    "lao people's democratic republic": "LAO",
    "republic of korea": "KOR",
    "viet nam": "VNM",
    "gambia": "GMB",
    "bolivia (plurinational state of)": "BOL",
    "venezuela (bolivarian republic of)": "VEN",
    "china, hong kong special administrative region": "HKG",
    "hong kong": "HKG",
    "china, macao special administrative region": "MAC",
    "cote d'ivoire": "CIV",
    "czechia": "CZE",
    "republic of moldova": "MDA",
    "micronesia (federated states of)": "FSM",
    "saint kitts and nevis": "KNA",
    "saint lucia": "LCA",
    "saint vincent and the grenadines": "VCT",
    "state of palestine": "PSE",
    "palestine": "PSE",
    "occupied palestinian territory": "PSE",
    "brunei darussalam": "BRN",
    "slovakia": "SVK",
    "north macedonia": "MKD",
    "eswatini": "SWZ",
    "cabo verde": "CPV",
    "united arab emirates": "ARE",
    "taiwan": "TWN",
    "kosovo": "XKX",
    "netherlands (kingdom of the)": "NLD",
    "democratic people's republic of korea": "PRK",
    "british virgin islands": "VGB",
}
IGNORE_NATIONALITY = {"", "na", "n/a", "unknown", "former soviet union", "none", "stateless"}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = s.replace("​", "")
    return re.sub(r"\s+", " ", s.strip().lower())


def load_name_index():
    idx = {}
    try:
        with open(WORLD_FILE) as f:
            for c in json.load(f).get("countries", []):
                if c.get("iso3"):
                    idx[norm(c["name"])] = c["iso3"].upper()
    except Exception as e:
        log("warning: could not read world.json:", e)
    idx.update(ALIASES)
    return idx


def fetch_xml():
    """Download the consolidated list into the cache; revalidate with ETag."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, "consolidated.xml")
    meta_path = path + ".meta.json"
    meta = {}
    if os.path.exists(path) and os.path.exists(meta_path):
        try:
            with open(meta_path) as f:
                meta = json.load(f)
        except Exception:
            meta = {}
    headers = {"User-Agent": UA}
    if meta.get("etag"):
        headers["If-None-Match"] = meta["etag"]
    if meta.get("last_modified"):
        headers["If-Modified-Since"] = meta["last_modified"]
    req = urllib.request.Request(XML_URL, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            fd, tmp = tempfile.mkstemp(dir=CACHE, suffix=".part")
            with os.fdopen(fd, "wb") as out:
                while True:
                    chunk = r.read(1 << 16)
                    if not chunk:
                        break
                    out.write(chunk)
            os.replace(tmp, path)
            meta = {
                "etag": r.headers.get("ETag"),
                "last_modified": r.headers.get("Last-Modified"),
                "fetched": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
            with open(meta_path, "w") as f:
                json.dump(meta, f)
            log(f"downloaded consolidated list ({os.path.getsize(path):,} bytes)")
    except urllib.error.HTTPError as e:
        if e.code == 304 and os.path.exists(path):
            log("consolidated list unchanged (304), using cache")
        elif os.path.exists(path):
            log(f"warning: download failed ({e}); using cached copy")
        else:
            raise
    except urllib.error.URLError as e:
        if os.path.exists(path):
            log(f"warning: download failed ({e}); using cached copy")
        else:
            raise
    return path, meta


def text(el, tag):
    v = el.findtext(tag)
    return v.strip() if v else ""


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "unknown"


def main():
    name_idx = load_name_index()
    with open(BASE_FILE) as f:
        base = json.load(f)["regimes"]

    path, fetch_meta = fetch_xml()
    root = ET.parse(path).getroot()
    generated = root.get("dateGenerated") or ""

    by_list_type = {r["list_type"]: r for r in base if r.get("list_type")}
    entries = defaultdict(list)  # list_type -> [entry]
    unmapped = Counter()

    def iso_for(name):
        n = norm(name)
        if n in IGNORE_NATIONALITY:
            return None
        iso = name_idx.get(n)
        if not iso:
            unmapped[name] += 1
        return iso

    for kind, xpath in (("individual", "INDIVIDUALS/INDIVIDUAL"), ("entity", "ENTITIES/ENTITY")):
        for el in root.findall(xpath):
            lt = text(el, "UN_LIST_TYPE") or "Unknown"
            parts = [text(el, t) for t in ("FIRST_NAME", "SECOND_NAME", "THIRD_NAME", "FOURTH_NAME")]
            name = " ".join(p for p in parts if p)
            if kind == "individual":
                countries = [v.text.strip() for v in el.findall("NATIONALITY/VALUE") if v.text and v.text.strip()]
            else:
                countries = [c.text.strip() for c in el.findall("ENTITY_ADDRESS/COUNTRY") if c.text and c.text.strip()]
            countries = list(dict.fromkeys(countries))
            isos = [i for i in dict.fromkeys(iso_for(c) for c in countries) if i]
            entries[lt].append({
                "kind": kind,
                "name": name,
                "reference": text(el, "REFERENCE_NUMBER"),
                "listed_on": text(el, "LISTED_ON")[:10],
                "countries": countries,
                "iso3": isos,
            })

    total = sum(len(v) for v in entries.values())
    if total < 100:
        log(f"error: only {total} entries parsed; refusing to overwrite {OUTPUT}")
        return 1

    today = date.today()
    cutoff_12m = (today - timedelta(days=365)).isoformat()
    regimes_out = []
    by_country = defaultdict(lambda: {"individuals": 0, "entities": 0, "by_regime": Counter()})
    all_recent = []

    def enrich(reg, items):
        inds = [e for e in items if e["kind"] == "individual"]
        ents = [e for e in items if e["kind"] == "entity"]
        dates = sorted((e["listed_on"] for e in items if e["listed_on"]), reverse=True)
        recent = sorted(items, key=lambda e: (e["listed_on"], e["reference"]), reverse=True)[:RECENT_PER_REGIME]
        nat = Counter()
        loc = Counter()
        for e in inds:
            for i in e["iso3"]:
                nat[i] += 1
        for e in ents:
            for i in e["iso3"]:
                loc[i] += 1
        reg["listed_individuals"] = len(inds)
        reg["listed_entities"] = len(ents)
        reg["listed_total"] = len(items)
        reg["latest_listing"] = dates[0] if dates else None
        reg["listed_last_12_months"] = sum(1 for d in dates if d >= cutoff_12m)
        reg["recent_listings"] = [
            {
                "name": e["name"],
                "reference": e["reference"],
                "type": e["kind"],
                "listed_on": e["listed_on"],
                "nationality": e["countries"][0] if e["countries"] else None,
                "iso3": e["iso3"][0] if e["iso3"] else None,
            }
            for e in recent
        ]
        reg["individuals_by_nationality"] = dict(nat.most_common())
        reg["entities_by_country"] = dict(loc.most_common())
        for i, n in nat.items():
            by_country[i]["individuals"] += n
            by_country[i]["by_regime"][reg["id"]] += n
        for i, n in loc.items():
            by_country[i]["entities"] += n
            by_country[i]["by_regime"][reg["id"]] += n
        for e in recent:
            all_recent.append({
                "regime": reg["id"],
                "name": e["name"],
                "reference": e["reference"],
                "type": e["kind"],
                "listed_on": e["listed_on"],
                "nationality": e["countries"][0] if e["countries"] else None,
                "iso3": e["iso3"][0] if e["iso3"] else None,
            })

    seen_types = set()
    for b in base:
        reg = {k: v for k, v in b.items()}
        reg.setdefault("status", "active")
        reg["curated"] = True
        lt = b.get("list_type")
        items = entries.get(lt, []) if lt else []
        if lt:
            seen_types.add(lt)
        enrich(reg, items)
        regimes_out.append(reg)

    for lt, items in sorted(entries.items()):
        if lt in seen_types:
            continue
        log(f"note: list type {lt!r} not in curated base; adding with defaults")
        reg = {
            "id": slug(lt),
            "name": lt,
            "resolution": "",
            "established": "",
            "measures": ["travel_ban", "asset_freeze"],
            "target_countries": [],
            "list_type": lt,
            "status": "active",
            "curated": False,
        }
        enrich(reg, items)
        regimes_out.append(reg)

    all_recent.sort(key=lambda e: (e["listed_on"], e["reference"]), reverse=True)
    out = {
        "_meta": {
            "last_updated": today.isoformat(),
            "regime_count": len(regimes_out),
            "active_regime_count": sum(1 for r in regimes_out if r.get("status") != "terminated"),
            "source": "UN Security Council Consolidated List",
            "source_url": SOURCE_PAGE,
            "list_generated": generated,
            "list_etag": fetch_meta.get("etag"),
            "listed_individuals": sum(r["listed_individuals"] for r in regimes_out),
            "listed_entities": sum(r["listed_entities"] for r in regimes_out),
            "latest_listing": max((r["latest_listing"] for r in regimes_out if r["latest_listing"]), default=None),
            "notes": "Regime metadata (measures, resolutions, target countries) is curated in scripts/data/sanctions_regimes.json; listing counts and recent listings come from the live list. by_country counts listed individuals by nationality and listed entities by address country; these are not the same as the country being a sanctions target.",
            "unmapped_countries": dict(unmapped.most_common()),
        },
        "regimes": regimes_out,
        "recent_listings": all_recent[:RECENT_GLOBAL],
        "by_country": {
            iso: {"individuals": v["individuals"], "entities": v["entities"], "by_regime": dict(v["by_regime"].most_common())}
            for iso, v in sorted(by_country.items(), key=lambda kv: -(kv[1]["individuals"] + kv[1]["entities"]))
        },
    }

    os.makedirs(DATA, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=DATA, prefix=".sanctions.", suffix=".tmp")
    with os.fdopen(fd, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    os.chmod(tmp, 0o644)
    os.replace(tmp, OUTPUT)
    log(f"wrote {OUTPUT}: {len(regimes_out)} regimes, {out['_meta']['listed_individuals']} individuals, "
        f"{out['_meta']['listed_entities']} entities, latest listing {out['_meta']['latest_listing']}")
    if unmapped:
        log("unmapped country names:", dict(unmapped))
    return 0


if __name__ == "__main__":
    sys.exit(main())

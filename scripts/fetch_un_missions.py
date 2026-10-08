#!/usr/bin/env python3
"""
Permanent Missions to the United Nations in New York, from the UN Protocol and Liaison Service's
online Blue Book (bluebook.e-delegate.un.org/data.json, the public file its web page loads).

Kept: for each mission, its public contact details (address, telephone, website, mission email),
membership date and category; its Permanent Representative or Permanent Observer (name, title,
rank, function, appointment and credentials dates) and Deputy Permanent Representatives (name and
function). Not kept: other staff, spouses, personal telephone numbers or emails.

Output: site/server/data/un-missions.json
"""
import json
import os
import re
import sys
from datetime import datetime, timezone
from urllib.request import Request, urlopen

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_statements import build_country_map  # noqa: E402

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "server", "data")
OUT = os.path.join(DATA, "un-missions.json")
URL = "https://bluebook.e-delegate.un.org/data.json"
CATEGORY = {"1": "Member State", "2": "Non-member State (observer)", "4": "Intergovernmental organization (observer)",
            "5": "Other entity (observer)", "6": "Specialized agency or related organization", "7": "Other entity", "9": "Other"}
ALIASES = {"UNITED STATES OF AMERICA": "USA", "UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND": "GBR", "RUSSIAN FEDERATION": "RUS",
           "REPUBLIC OF KOREA": "KOR", "DEMOCRATIC PEOPLE'S REPUBLIC OF KOREA": "PRK", "IRAN (ISLAMIC REPUBLIC OF)": "IRN", "TÜRKIYE": "TUR",
           "VIET NAM": "VNM", "SYRIAN ARAB REPUBLIC": "SYR", "LAO PEOPLE'S DEMOCRATIC REPUBLIC": "LAO", "BOLIVIA (PLURINATIONAL STATE OF)": "BOL",
           "VENEZUELA (BOLIVARIAN REPUBLIC OF)": "VEN", "MICRONESIA (FEDERATED STATES OF)": "FSM", "REPUBLIC OF MOLDOVA": "MDA",
           "UNITED REPUBLIC OF TANZANIA": "TZA", "DEMOCRATIC REPUBLIC OF THE CONGO": "COD", "CONGO": "COG", "CÔTE D'IVOIRE": "CIV", "COTE D'IVOIRE": "CIV",
           "KINGDOM OF THE NETHERLANDS": "NLD", "NETHERLANDS (KINGDOM OF THE)": "NLD", "CZECHIA": "CZE", "STATE OF PALESTINE": "PSE", "HOLY SEE": "VAT",
           "GAMBIA (REPUBLIC OF THE)": "GMB", "GAMBIA": "GMB", "BAHAMAS": "BHS", "SAO TOME AND PRINCIPE": "STP", "KYRGYZ REPUBLIC": "KGZ", "KYRGYZSTAN": "KGZ",
           "BRUNEI DARUSSALAM": "BRN", "CABO VERDE": "CPV", "ESWATINI": "SWZ", "NORTH MACEDONIA": "MKD", "TIMOR-LESTE": "TLS"}


def day(v):
    return (v or "")[:10] or None


def clean(s):
    return re.sub(r"\s+", " ", (s or "").replace(":", ", ")).strip()


def main():
    now = datetime.now(timezone.utc)
    with urlopen(Request(URL, headers={"User-Agent": "WorldCountryGroups/1.0 (research)"}), timeout=120) as r:
        d = json.loads(r.read())
    cmap = {k.upper(): v for k, v in build_country_map().items()}
    cmap.update(ALIASES)

    people = {}
    for p in d.get("bluebooks", []):
        if (p.get("BB_Status") or "").strip() != "Active":
            continue
        people.setdefault(p.get("BB_Mission"), []).append(p)

    missions = []
    for c in d.get("countries", []):
        ent = c.get("MC_Entity")
        staff = people.get(ent, [])
        fn = lambda p: (p.get("BB_Function") or "").strip()  # noqa: E731
        head = next((p for p in staff if re.match(r"^(Ambassador, )?Permanent (Representative|Observer)$", fn(p), re.I)), None) \
            or next((p for p in staff if p.get("BB_Cred_Presented") and not re.search(r"Deputy|Alternate", fn(p), re.I)), None)  # e.g. the US "Representative"
        acting = None
        if not head:
            acting = next((p for p in staff if re.search(r"Charg[ée]", fn(p) + " " + (p.get("BB_Dipl_Rank_Display") or ""), re.I)), None) \
                or next((p for p in staff if re.match(r"^(Acting )?Deputy Permanent (Representative|Observer)", fn(p), re.I)), None)
        deputies = [p for p in staff if re.match(r"^(Acting )?Deputy (Permanent )?(Representative|Observer)", fn(p), re.I) and p is not acting]

        def person(p):
            if not p:
                return None
            first, last = clean(p.get("BB_FirstName")), clean(p.get("BB_LastName"))
            return {
                "name": f"{first} {last}".strip() if p.get("BB_NameOrder", True) else f"{last} {first}".strip(),
                "title": clean(p.get("BB_Title")), "rank": clean(p.get("BB_Dipl_Rank_Display")), "function": fn(p),
                "appointed": day(p.get("BB_Appointment")), "credentials": day(p.get("BB_Cred_Presented")),
            }
        name = c.get("MC_EntityBB") or c.get("MC_EntityShort") or ent
        iso3 = cmap.get((ent or "").upper()) or cmap.get((name or "").upper())
        missions.append({
            "entity": name, "iso3": iso3, "category": CATEGORY.get(str(c.get("MC_Category")), "Other"),
            "member": str(c.get("MC_Category")) == "1", "memberSince": day(c.get("MC_MembershipDate")),
            "address": re.sub(r"^.*?(United Nations|U\.N\.)[,\s]*", "", clean(c.get("MC_Address")), count=1) or clean(c.get("MC_Address")),
            "telephone": clean(c.get("MC_Telephone")), "website": clean(c.get("MC_WebSite")), "email": clean(c.get("MC_eMail")),
            "head": person(head), "acting": person(acting), "deputies": [person(p)["name"] for p in deputies][:4],
            "staff": len(staff),
        })
    missions.sort(key=lambda m: (not m["member"], m["entity"]))
    out = {"_meta": {"updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "source": "UN Protocol and Liaison Service, online Blue Book",
                     "source_url": "https://bluebook.unmeetings.org/", "missions": len(missions),
                     "members_with_pr": sum(1 for m in missions if m["member"] and m["head"])},
           "missions": missions}
    if sum(1 for m in missions if m["member"]) < 150:
        raise SystemExit("Too few member states in the Blue Book data; keeping the previous file")
    with open(OUT + ".tmp", "w") as f:
        json.dump(out, f, ensure_ascii=False)
    os.replace(OUT + ".tmp", OUT)
    unmatched = [m["entity"] for m in missions if m["member"] and not m["iso3"]]
    print(f"missions: {len(missions)}; member states {sum(1 for m in missions if m['member'])}, with a PR {out['_meta']['members_with_pr']}; unmatched {unmatched}")


if __name__ == "__main__":
    main()

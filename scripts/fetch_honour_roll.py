#!/usr/bin/env python3
"""Fetch the UN regular-budget "Honour Roll" (Committee on Contributions).

Scrapes https://www.un.org/en/ga/contributions/honourroll.shtml, which lists
member states that have paid their regular-budget assessment in full for the
current year: section I (paid within the 30-day due period) and section II
(paid in full later). Also captures the historical month-end counts table.

Country names are mapped to ISO3 via worldcountrygroups/data/groups/un.json.

Output: site/server/data/honour-roll.json
"""

import json
import os
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timezone

URL = "https://www.un.org/en/ga/contributions/honourroll.shtml"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "site", "server", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "honour-roll.json")
UN_GROUP_FILE = os.path.join(
    os.path.dirname(__file__), "..", "worldcountrygroups", "data", "groups", "un.json"
)

REQUEST_TIMEOUT = 30
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) WCG-HonourRollFetcher/1.0"

MONTHS = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}
MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

# UN official names on the page -> names used in un.json
NAME_ALIASES = {
    "turkiye": "turkey",
    "czechia": "czech republic",
    "republic of korea": "korea, rep.",
    "democratic republic of the congo": "congo, dem. rep.",
    "congo": "congo, rep.",
    "iran": "iran",
    "syrian arab republic": "syria",
    "united republic of tanzania": "tanzania",
    "venezuela": "venezuela",
    "bolivia": "bolivia",
    "united kingdom of great britain and northern ireland": "united kingdom",
    "united states of america": "united states",
    "kyrgyzstan": "kyrgyz republic",
    "slovak republic": "slovakia",
    "egypt": "egypt, arab rep.",
}


def normalize(name):
    """Lowercase, strip accents/parentheticals/punctuation quirks for matching."""
    text = unicodedata.normalize("NFKD", name)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.replace("’", "'").replace("–", "-")
    text = re.sub(r"\s*\([^)]*\)", "", text)  # drop "(Islamic Republic of)" etc.
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def build_name_index():
    with open(UN_GROUP_FILE) as f:
        data = json.load(f)
    index = {}
    by_plain = {}
    for c in data["countries"]:
        iso3 = c["iso3"].upper()
        index[normalize(c["name"])] = (iso3, c["name"])
        by_plain[c["name"]] = iso3
    return index, by_plain


def match_country(page_name, index):
    key = normalize(page_name)
    key = NAME_ALIASES.get(key, key)
    return index.get(key)


def fetch_page():
    req = urllib.request.Request(URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        return resp.read().decode("utf-8", errors="replace")


def strip_tags(html):
    text = re.sub(r"<[^>]+>", " ", html)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&#39;", "'")
    return re.sub(r"\s+", " ", text).strip()


def parse_date(raw, default_year):
    """Parse dates like '9-Jan-26' to ISO format."""
    m = re.match(r"(\d{1,2})-([A-Za-z]{3})-(\d{2,4})", raw.strip())
    if not m:
        return None
    day, mon, year = int(m.group(1)), MONTHS.get(m.group(2).title()), int(m.group(3))
    if not mon:
        return None
    if year < 100:
        year += 2000
    return f"{year:04d}-{mon:02d}-{day:02d}"


def parse_rows(html):
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S):
        cells = [strip_tags(td) for td in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
        if cells:
            rows.append(cells)
    return rows


def main():
    print(f"Fetching UN honour roll... ({datetime.now(timezone.utc).isoformat()})")

    index, _ = build_name_index()
    html = fetch_page()
    rows = parse_rows(html)

    # Header line: "As of 13 July 2026, 120 Member States have paid ..."
    as_of_date = None
    total_paid = None
    for row in rows:
        text = " ".join(row)
        m = re.search(r"As of (\d{1,2} \w+ \d{4}),?\s+(\d+)\s+Member States", text)
        if m:
            try:
                as_of_date = datetime.strptime(m.group(1), "%d %B %Y").date().isoformat()
            except ValueError:
                as_of_date = m.group(1)
            total_paid = int(m.group(2))
            break

    year = int(as_of_date[:4]) if as_of_date and as_of_date[:4].isdigit() \
        else datetime.now(timezone.utc).year

    # Payment rows: [rank, country, amount, date]; rank resets to 1 at section II.
    paid = {}
    unmatched = []
    section = 0
    for cells in rows:
        if len(cells) != 4 or not cells[0].isdigit():
            continue
        rank, name, amount_raw, date_raw = cells
        if int(rank) == 1:
            section += 1
        if section > 2:
            break
        matched = match_country(name, index)
        if not matched:
            unmatched.append(name)
            continue
        iso3, repo_name = matched
        amount = None
        try:
            amount = int(amount_raw.replace(",", "").replace(" ", ""))
        except ValueError:
            pass
        paid[iso3] = {
            "name": repo_name,
            "officialName": name,
            "section": "within-30-days" if section == 1 else "later-in-full",
            "amountUsd": amount,
            "datePaid": parse_date(date_raw, year),
        }

    # Historical table: month rows with one count per year column.
    history = {}
    year_header = None
    for cells in rows:
        digit_cells = [c for c in cells if re.fullmatch(r"(19|20)\d{2}", c)]
        if len(digit_cells) >= 5:
            year_header = digit_cells
            continue
        if year_header and cells and cells[0] in MONTH_NAMES:
            counts = [c for c in cells[1:] if re.fullmatch(r"\d{1,3}", c) or c == ""]
            for yr, cnt in zip(year_header, counts):
                if cnt:
                    history.setdefault(yr, {})[cells[0]] = int(cnt)

    unpaid = sorted(set(iso3 for iso3, _ in index.values()) - set(paid))

    output = {
        "_meta": {
            "generated": datetime.now(timezone.utc).isoformat(),
            "source": URL,
            "asOfDate": as_of_date,
            "budgetYear": year,
            "totalPaidReported": total_paid,
            "totalPaidMatched": len(paid),
            "unmatchedNames": unmatched,
        },
        "paid": paid,
        "unpaidIso3": unpaid,
        "historyMonthEndCounts": history,
    }

    if unmatched:
        print(f"  WARNING: unmatched country names: {unmatched}", file=sys.stderr)
    if total_paid is not None and len(paid) + len(unmatched) != total_paid:
        print(
            f"  WARNING: parsed {len(paid) + len(unmatched)} payments, "
            f"page reports {total_paid}",
            file=sys.stderr,
        )

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=1, ensure_ascii=False)
    print(
        f"Wrote {OUTPUT_FILE}: {len(paid)} paid ({total_paid} reported), "
        f"{len(unpaid)} unpaid, history years: {len(history)}"
    )


if __name__ == "__main__":
    main()

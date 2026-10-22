#!/usr/bin/env python3
"""UN Secretary-General selection: a forecast built on the Security Council's own rule.

Builds site/server/data/sg-forecast.json from sg-selection.json (stdlib only, no network).

The Council recommends a candidate who has at least 9 of 15 votes and no veto from a permanent
member (P5). The model asks two questions of every official candidate the Council has polled:

  1. Will the candidate reach 9 "encourage" votes? The latest straw poll's count, nudged by its
     recent change, with room to move (a normal spread of SIGMA votes): P(reach 9).
  2. Will every P5 "discourage" be lifted? Each one is lifted with probability LIFT. Colour-coded
     polls show how many P5 members discouraged; before those, the number is inferred from the
     candidate's discourage count (how many of them could be P5 among 15 members): P(no veto).

A candidate's weight is P(reach 9) x P(no veto). Official candidates the Council has not polled
yet get the weight NEW_ENTRANT; anyone not yet nominated shares the weight SOMEONE_ELSE. The
weights are then shared out so they add up to 100%. When one candidate clears both tests the
outside weights matter little; when everyone carries vetoes they dominate, as in 1981 and 1996,
when vetoed front-runners gave way to candidates who entered late.

Parameters are set from the record, not fitted (there are too few races to fit them):
  * LIFT: of the P5 vetoes held through a deadlock since 1981, one was lifted (France on Annan,
    13 December 1996); Waldheim's (China) and Salim's (US) in 1981, Boutros-Ghali's (US) and
    Essy's (US, UK) in 1996 were not.
  * SIGMA: candidates' encourage counts moved by 2-3 votes between polls in 2006 and 2016.
The forecast is replayed after every straw poll of 2006 and 2016 (complete leaked tables on
Wikipedia) as a check: the chance it gave the eventual winner at each poll is in "backtest".

Every run also re-forecasts the current race as it stood after each of its straw polls
("by_poll") and keeps a change log ("history") so forecasts can be scored once the Council
recommends someone.
"""

import json
import math
import os
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA_DIR = os.path.join(ROOT, "site", "server", "data")
SG_FILE = os.path.join(DATA_DIR, "sg-selection.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "sg-forecast.json")

SIGMA = 2.5          # votes: how far an "encourage" count can still move
MOMENTUM = 0.5       # weight of the average change in "encourage" over the last two polls
LIFT = 0.2           # chance that one P5 "discourage" is lifted before the Council decides
NEW_ENTRANT = 0.12   # weight of an official candidate the Council has not polled yet
SOMEONE_ELSE = 0.12  # weight shared by anyone not yet nominated: as much as one named entrant
MEMBERS, P5 = 15, 5
OTHER = "_other"

PARAMS = {"sigma": SIGMA, "momentum": MOMENTUM, "lift": LIFT, "new_entrant": NEW_ENTRANT, "someone_else": SOMEONE_ELSE}

# Past races with complete straw-poll tables: (encourage, discourage, no opinion, P5 discourage or None).
# Sources: the "straw polls" tables of the Wikipedia articles below (leaked figures, as in 2026).
HISTORY = {
    "2016": {
        "winner": "António Guterres",
        "source": "https://en.wikipedia.org/wiki/2016_United_Nations_Secretary-General_selection",
        "polls": [
            ("2016-07-21", False), ("2016-08-05", False), ("2016-08-29", False),
            ("2016-09-09", False), ("2016-09-26", False), ("2016-10-05", True),
        ],
        "results": {
            "Irina Bokova": [(9, 4, 2), (7, 7, 1), (7, 5, 3), (7, 5, 3), (6, 7, 2), (7, 7, 1, 2)],
            "Helen Clark": [(8, 5, 2), (6, 8, 1), (6, 8, 1), (6, 7, 2), (6, 9, 0), (6, 8, 1, 3)],
            "Christiana Figueres": [(5, 5, 5), (5, 8, 2), (2, 12, 1), (5, 10, 0), None, None],
            "Kristalina Georgieva": [None, None, None, None, None, (5, 8, 2, 2)],
            "Natalia Gherman": [(4, 4, 7), (3, 10, 2), (2, 12, 1), (3, 11, 1), (3, 11, 1), (3, 11, 1, 3)],
            "António Guterres": [(12, 0, 3), (11, 2, 2), (11, 3, 1), (12, 2, 1), (12, 2, 1), (13, 0, 2, 0)],
            "Vuk Jeremić": [(9, 5, 1), (8, 4, 3), (7, 5, 3), (9, 4, 2), (8, 6, 1), (7, 6, 2, 3)],
            "Srgjan Kerim": [(9, 5, 1), (6, 7, 2), (6, 7, 2), (8, 7, 0), (6, 9, 0), (5, 9, 1, 3)],
            "Miroslav Lajčák": [(7, 3, 5), (2, 6, 7), (9, 5, 1), (10, 4, 1), (8, 7, 0), (7, 6, 2, 2)],
            "Igor Lukšić": [(3, 7, 5), (2, 9, 4), None, None, None, None],
            "Susana Malcorra": [(7, 4, 4), (8, 6, 1), (7, 7, 1), (7, 7, 1), (7, 7, 1), (5, 7, 3, 1)],
            "Vesna Pusić": [(2, 11, 2), None, None, None, None, None],
            "Danilo Türk": [(11, 2, 2), (7, 5, 3), (5, 6, 4), (7, 6, 2), (7, 7, 1), (5, 8, 2, 4)],
        },
    },
    "2006": {
        "winner": "Ban Ki-moon",
        "source": "https://en.wikipedia.org/wiki/2006_United_Nations_Secretary-General_selection",
        "polls": [("2006-07-24", False), ("2006-09-14", False), ("2006-09-28", False), ("2006-10-02", True)],
        "results": {
            "Ban Ki-moon": [(12, 1, 2), (14, 1, 0), (13, 1, 1), (14, 0, 1, 0)],
            "Shashi Tharoor": [(10, 2, 3), (10, 3, 2), (8, 3, 4), (10, 3, 2, 1)],
            "Surakiart Sathirathai": [(7, 3, 5), (9, 3, 3), (5, 7, 3), (4, 7, 4, 2)],
            "Jayantha Dhanapala": [(5, 6, 4), (3, 5, 7), (3, 7, 5), None],
            "Prince Zeid bin Ra'ad": [None, (6, 4, 5), (3, 6, 6), (2, 8, 5, 1)],
            "Vaira Vīķe-Freiberga": [None, None, (7, 6, 2), (5, 6, 4, 2)],
            "Ashraf Ghani": [None, None, (3, 6, 6), (4, 11, 0, 3)],
        },
    },
}


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def phi(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def hypergeom(v, discouraged):
    """Chance that v of a candidate's discourage votes came from the 5 permanent members."""
    if v > min(P5, discouraged) or discouraged - v > MEMBERS - P5:
        return 0.0
    return math.comb(P5, v) * math.comb(MEMBERS - P5, discouraged - v) / math.comb(MEMBERS, discouraged)


def p_reach_nine(enc_series):
    e = enc_series[-1]
    steps = [b - a for a, b in zip(enc_series, enc_series[1:])][-2:]
    trend = sum(steps) / len(steps) if steps else 0.0
    return phi((e + MOMENTUM * trend - 8.5) / SIGMA), trend


def p_no_veto(discouraged, vetoes, any_p5_discourage=None):
    """vetoes: P5 discourage count from a colour-coded poll, or None when the ballots were identical."""
    if vetoes is not None:
        return LIFT ** vetoes, float(vetoes)
    if any_p5_discourage is False:
        return 1.0, 0.0
    dist = [(v, hypergeom(v, discouraged)) for v in range(0, min(P5, discouraged) + 1)]
    if any_p5_discourage:  # at least one, number unknown
        dist = [(v, p) for v, p in dist if v >= 1]
    total = sum(p for _, p in dist) or 1.0
    return (sum(p * LIFT ** v for v, p in dist) / total,
            sum(p * v for v, p in dist) / total)


def forecast(field, unpolled):
    """field: {key: [(enc, disc, no_op, p5_disc or None, any_p5_disc or None), ...]} polls in order.
    unpolled: official candidates with no poll yet. Returns {key: row}, plus OTHER."""
    rows = {}
    for key, series in field.items():
        last = series[-1]
        reach, trend = p_reach_nine([s[0] for s in series])
        colour = [s for s in series if s[3] is not None]
        if colour:
            noveto, vetoes = p_no_veto(last[1], colour[-1][3])
            known = True
        else:
            noveto, vetoes = p_no_veto(last[1], None, last[4])
            known = False
        rows[key] = {"weight": reach * noveto, "p_reach_9": reach, "p_no_veto": noveto, "trend": trend,
                     "vetoes": vetoes, "vetoes_known": known, "polled": True}
    for key in unpolled:
        rows[key] = {"weight": NEW_ENTRANT, "p_reach_9": None, "p_no_veto": None, "trend": None,
                     "vetoes": None, "vetoes_known": False, "polled": False}
    rows[OTHER] = {"weight": SOMEONE_ELSE, "polled": False}
    total = sum(r["weight"] for r in rows.values())
    for r in rows.values():
        r["prob"] = r["weight"] / total
    return rows


def r4(x):
    return None if x is None else round(x, 4)


# ---------------------------------------------------------------------------- backtest

def backtest():
    out = {}
    for year, race in HISTORY.items():
        steps = []
        for k, (date, _colour) in enumerate(race["polls"]):
            field = {}
            for name, res in race["results"].items():
                if res[k] is None:
                    continue  # not on this ballot (not yet nominated, or withdrawn)
                series = [(r[0], r[1], r[2], r[3] if len(r) > 3 else None, None) for r in res[: k + 1] if r is not None]
                field[name] = series
            rows = forecast(field, [])
            ranked = sorted((n for n in rows if n != OTHER), key=lambda n: -rows[n]["prob"])
            steps.append({"n": k + 1, "date": date, "p_winner": r4(rows[race["winner"]]["prob"]),
                          "rank": ranked.index(race["winner"]) + 1, "leader": ranked[0],
                          "p_leader": r4(rows[ranked[0]]["prob"]), "p_other": r4(rows[OTHER]["prob"])})
        out[year] = {"winner": race["winner"], "source": race["source"], "by_poll": steps}
    return out


# ---------------------------------------------------------------------------- current race

def gone_by(c, date):
    """True when the candidate had withdrawn (or announced it) by this date."""
    when = [x for x in (c.get("withdrawal_date"), c.get("withdrawal_announced")) if x]
    return c.get("status") == "withdrawn" and (not when or min(when) <= date)


def race_at(sg, date, polls):
    """The field as it stood on `date`, using the straw polls given (held by then)."""
    cands = [c for c in sg["candidates"] if (c.get("nomination_date") or "0000") <= date and not gone_by(c, date)]
    field, unpolled = {}, []
    for c in cands:
        series = []
        for p in polls:
            r = next((r for r in p["results"] if r.get("candidate_id") == c["id"]), None)
            if r is None:
                continue
            p5 = r.get("p5_discourage_n") if p.get("colour_coded") else None
            series.append((r["encourage"], r["discourage"], r["no_opinion"], p5, r.get("p5_discourage")))
        if series:
            field[c["id"]] = series
        else:
            unpolled.append(c["id"])
    return field, unpolled


def explain(c, row, last_poll):
    if not row["polled"]:
        return "Not yet in a straw poll: weighted as a new entrant"
    head = f"Poll {last_poll['n']}: {last_poll['encourage']} for, {last_poll['discourage']} against" if last_poll else "Polled"
    if row["vetoes_known"]:
        v = int(row["vetoes"])
        return f"{head}, {v} of them P5" if v else f"{head}, none P5"
    return f"{head}, about {row['vetoes']:.1f} P5 (not colour-coded)"


def main():
    with open(SG_FILE, encoding="utf-8") as f:
        sg = json.load(f)
    polls = [p for p in sg["process"]["straw_polls"] if p.get("results")]
    names = {c["id"]: c["name"] for c in sg["candidates"]}
    today = datetime.now(timezone.utc).date().isoformat()

    selected = next((c for c in sg["candidates"] if c.get("status") == "selected"), None)
    field, unpolled = race_at(sg, today, polls)
    rows = forecast(field, unpolled)
    if selected:
        rows = {k: dict(v, prob=1.0 if k == selected["id"] else 0.0) for k, v in rows.items()}
        rows.setdefault(selected["id"], {"prob": 1.0, "weight": 1.0, "polled": True})

    current = []
    for cid, row in rows.items():
        if cid == OTHER:
            continue
        c = next(x for x in sg["candidates"] if x["id"] == cid)
        lp = (c.get("poll_history") or [None])[-1]
        current.append({
            "id": cid, "name": names.get(cid, cid), "prob": r4(row["prob"]), "weight": r4(row.get("weight")),
            "p_reach_9": r4(row.get("p_reach_9")), "p_no_veto": r4(row.get("p_no_veto")), "trend": r4(row.get("trend")),
            "vetoes": r4(row.get("vetoes")), "vetoes_known": row.get("vetoes_known", False), "polled": row["polled"],
            "basis": explain(c, row, lp),
        })
    current.sort(key=lambda r: -r["prob"])

    by_poll = []
    for k, p in enumerate(polls):
        f, u = race_at(sg, p["date"], polls[: k + 1])
        rr = forecast(f, u)
        by_poll.append({"n": p["n"], "date": p["date"], "colour_coded": bool(p.get("colour_coded")),
                        "probs": {cid: r4(r["prob"]) for cid, r in rr.items()}})

    probs = {r["id"]: r["prob"] for r in current}
    probs[OTHER] = r4(rows[OTHER]["prob"])
    try:
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            history = json.load(f).get("history") or []
    except Exception:  # noqa: BLE001
        history = []
    at = now_iso()
    if not history or history[-1]["probs"] != probs:
        history.append({"at": at, "probs": probs, "basis_poll": polls[-1]["n"] if polls else None})

    out = {
        "_meta": {
            "updated_at": at,
            "params": PARAMS,
            "basis": f"straw poll {polls[-1]['n']} ({polls[-1]['date']})" if polls else "no straw poll yet",
            "selected": selected["id"] if selected else None,
            "notes": [
                "The Council recommends a candidate with at least 9 of 15 votes and no veto from a permanent member. "
                "The model scores each polled candidate on both: the chance of reaching 9 'encourage' votes, times the "
                "chance that every P5 'discourage' is lifted.",
                f"Each P5 discourage is lifted with a {LIFT:.0%} chance: since 1981 one of the vetoes held through a "
                "deadlock was lifted (France on Annan, 1996); Waldheim's and Salim's (1981), Boutros-Ghali's and "
                "Essy's (1996) were not.",
                f"An official candidate not yet polled weighs {NEW_ENTRANT}; anyone not yet nominated shares "
                f"{SOMEONE_ELSE}. These outside weights take over when every polled candidate carries vetoes, as when "
                "late entrants won in 1981 (Pérez de Cuéllar) and 1996 (Annan).",
                "Not in the model: regional rotation, gender, endorsements, or how close the deadline is. The poll "
                "figures are leaked tallies.",
            ],
        },
        "current": current,
        "someone_else": r4(rows[OTHER]["prob"]),
        "by_poll": by_poll,
        "backtest": backtest(),
        "history": history[-2000:],
    }
    tmp = OUTPUT_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    os.replace(tmp, OUTPUT_FILE)
    top = ", ".join(f"{r['name']} {r['prob']:.0%}" for r in current[:5])
    print(f"wrote {OUTPUT_FILE}: {top}, someone else {rows[OTHER]['prob']:.0%} (basis {out['_meta']['basis']})", flush=True)


if __name__ == "__main__":
    main()

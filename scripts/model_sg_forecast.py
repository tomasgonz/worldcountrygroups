#!/usr/bin/env python3
"""UN Secretary-General selection: a forecast built on the Security Council's own rule.

Builds site/server/data/sg-forecast.json from sg-selection.json (stdlib only, no network).

The Council recommends a candidate who has at least 9 of 15 votes and no veto from a permanent
member (P5). Two versions of the forecast are computed; the simulation is the one shown.

SIMULATION (Monte Carlo, RUNS simulated endings of the race). In each run:

  1. Veto climate. The chance that a P5 "discourage" is lifted before the Council decides is not
     known; it is drawn from Beta(1 + lifted, 1 + held), a flat prior updated on the record since
     1981 (VETO_RECORD: 1 lifted of 6 held through a deadlock).
  2. Members. Each permanent member gets its own flexibility, drawn around that climate
     (Beta with concentration MEMBER_SPREAD), and a hawkishness weight (log-normal, HAWK_SPREAD).
     Leaked colour-coded polls give only how many P5 members discouraged a candidate, not which;
     each run assigns them to members in proportion to hawkishness, so the same members tend to
     block several candidates, and a member's flexibility applies to all its vetoes.
  3. Lifting. Each veto is lifted with its member's flexibility.
  4. Support. Every straw poll is read as a noisy measure of a candidate's underlying support,
     which drifts between polls (a local-level model; Kalman filter). Drift and noise are fitted
     by maximum likelihood to all 2006, 2016 and 2026 polls. The final count is drawn from the
     filtered level, widened for the polls left before mid-December.
  5. Newcomers. Official candidates not yet polled, and a Poisson number (FUTURE_ENTRANTS) of
     people not yet nominated, get support and P5 discourages drawn from how past late entrants
     did in their first polls (ENTRANTS).
  6. Decision. Candidates with 9+ votes and no veto left are viable; the one with most votes
     wins. If nobody is viable, the race is deadlocked. Since 1981 both deadlocks (1981, 1996)
     were broken by newcomers, never by settling on a vetoed front-runner (DEADLOCK_RECORD), so
     each run draws the chance of settling on the existing field from Beta(1 + 0, 1 + 2). The
     Council then takes, from the field or else from the newcomers, the candidate with 9+ votes
     facing the fewest vetoes (then most votes), as with Annan in December 1996; if no newcomer
     has 9 votes either, someone not yet in the race.

A candidate's chance is the share of runs it wins; the standard error is sqrt(p(1-p)/RUNS).

CLOSED FORM (no simulation, kept as a cross-check): P(reach 9) from the latest poll with a fixed
spread, times P(every veto lifted) = E[q^V] under the same Beta belief about the lift chance q;
weights shared out with fixed weights for newcomers.

Both are replayed after every straw poll of 2006 and 2016 ("backtest") and of the current race
("by_poll"). A change log ("history") lets forecasts be scored once the Council recommends someone.
"""

import hashlib
import json
import math
import os
import random
from collections import Counter
from datetime import date, datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA_DIR = os.path.join(ROOT, "site", "server", "data")
SG_FILE = os.path.join(DATA_DIR, "sg-selection.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "sg-forecast.json")

MEMBERS, P5 = 15, 5
OTHER = "_other"

# The record on P5 vetoes held through a deadlock since 1981: lifted France on Annan (13 Dec 1996);
# held China on Waldheim and the US on Salim (1981), the US on Boutros-Ghali and the US and UK on Essy (1996).
VETO_RECORD = {"lifted": 1, "held": 5}
VETO_A, VETO_B = 1 + VETO_RECORD["lifted"], 1 + VETO_RECORD["held"]   # Beta(2, 6)

# How deadlocks (nobody with 9 votes and no veto) ended since 1981: by settling on a candidate already
# in the field, or by turning to newcomers (1981: Pérez de Cuéllar after Waldheim and Salim; 1996: Annan
# after Boutros-Ghali).
DEADLOCK_RECORD = {"settled_on_field": 0, "newcomer": 2}
SETTLE_A, SETTLE_B = 1 + DEADLOCK_RECORD["settled_on_field"], 1 + DEADLOCK_RECORD["newcomer"]   # Beta(1, 3)

# Candidates who entered a race already under way: encourage/discourage/no opinion in their first
# straw poll, and P5 discourages in their first colour-coded poll. Sources: Wikipedia articles on the
# 2016, 2006 and 1996 selections (1996 figures from the text of "Open selection").
ENTRANTS = [
    ("Kristalina Georgieva", 2016, (5, 8, 2), 2),
    ("Prince Zeid bin Ra'ad", 2006, (6, 4, 5), 1),
    ("Vaira Vīķe-Freiberga", 2006, (7, 6, 2), 2),
    ("Ashraf Ghani", 2006, (3, 6, 6), 3),
    ("Kofi Annan", 1996, (12, 2, 1), 1),
    ("Amara Essy", 1996, (11, 4, 0), 2),
]

# Simulation settings (judgement, stated on the page)
RUNS = 20000             # simulated endings for the current forecast
RUNS_REPLAY = 4000       # for replays of past polls
MEMBER_SPREAD = 4.0      # how much the five members' flexibility differs around the climate (lower = more)
HAWK_SPREAD = 1.0        # how unevenly vetoes concentrate on some members (sd of log weights)
FUTURE_ENTRANTS = 1.5    # expected number of people still to be nominated
DECISION = (12, 15)      # the Council has always recommended someone by mid-December
PRIOR_LEVEL = (7.5, 9.0)  # a candidate's support before any poll: mean, variance (half of 15, +/- 3 votes)
GRID = [x / 4 for x in range(1, 13)]  # 0.25 ... 3.0 votes, for fitting drift and noise

# Closed-form settings (v1)
SIGMA = 2.5              # votes: how far an "encourage" count can still move
MOMENTUM = 0.5           # weight of the average change in "encourage" over the last two polls
NEW_ENTRANT = 0.12       # weight of an official candidate the Council has not polled yet
SOMEONE_ELSE = 0.12      # weight shared by anyone not yet nominated

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


def r4(x):
    return None if x is None else round(x, 4)


def phi(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def hypergeom(v, discouraged):
    """Chance that v of a candidate's discourage votes came from the 5 permanent members."""
    if v > min(P5, discouraged) or discouraged - v > MEMBERS - P5:
        return 0.0
    return math.comb(P5, v) * math.comb(MEMBERS - P5, discouraged - v) / math.comb(MEMBERS, discouraged)


def veto_dist(discouraged, any_p5_discourage=None):
    """P5 discourage count when ballots were identical: [(v, probability)]."""
    if any_p5_discourage is False:
        return [(0, 1.0)]
    dist = [(v, hypergeom(v, discouraged)) for v in range(0, min(P5, discouraged) + 1)]
    if any_p5_discourage:
        dist = [(v, p) for v, p in dist if v >= 1]
    total = sum(p for _, p in dist) or 1.0
    return [(v, p / total) for v, p in dist]


def beta_moment(k, a=VETO_A, b=VETO_B):
    """E[q^k] for q ~ Beta(a, b): the chance that k vetoes are all lifted, averaged over q."""
    out = 1.0
    for t in range(k):
        out *= (a + t) / (a + b + t)
    return out


# ---------------------------------------------------------------------------- support: Kalman filter

def kalman(series, tau2, s2):
    """Local-level model: level_k = level_{k-1} + drift (var tau2); poll_k = level_k + noise (var s2).
    Returns the level after the last poll (mean, variance) and the log-likelihood of the polls."""
    m, p = PRIOR_LEVEL
    loglik = 0.0
    for k, e in enumerate(series):
        if k:
            p += tau2                      # predict: the level drifts between polls
        f = p + s2                         # the poll's predicted variance
        loglik += -0.5 * (math.log(2 * math.pi * f) + (e - m) ** 2 / f)
        gain = p / f                       # update: how much to trust the new poll
        m += gain * (e - m)
        p *= 1 - gain
    return m, p, loglik


def fit_noise(all_series):
    """Maximum-likelihood drift (tau) and poll noise (s) over every candidate's series, on a grid."""
    best = None
    for tau in GRID:
        for s in GRID:
            ll = sum(kalman(x, tau * tau, s * s)[2] for x in all_series if x)
            if best is None or ll > best[2]:
                best = (tau, s, ll)
    return {"tau": best[0], "s": best[1], "loglik": round(best[2], 2)}


def entrant_prior():
    es = [e[2][0] for e in ENTRANTS]
    mean = sum(es) / len(es)
    sd = math.sqrt(sum((x - mean) ** 2 for x in es) / (len(es) - 1))
    disc = sum(e[3] for e in ENTRANTS)
    slots = P5 * len(ENTRANTS)
    return {"mean": round(mean, 3), "sd": round(sd, 3), "p_a": 1 + disc, "p_b": 1 + slots - disc, "n": len(ENTRANTS)}


def polls_left(as_of, poll_dates):
    """Straw polls still expected before mid-December, at the race's own pace (at least 1)."""
    d = date.fromisoformat(as_of)
    deadline = date(d.year, *DECISION)
    ds = sorted(date.fromisoformat(x) for x in poll_dates)
    gap = (ds[-1] - ds[0]).days / (len(ds) - 1) if len(ds) > 1 else 14
    return max(1, round((deadline - d).days / max(gap, 7)))


# ---------------------------------------------------------------------------- simulation

def simulate(field, newcomers, fit, ent, runs, seed):
    """field: {key: {"m", "sd", "vetoes" (int or None), "disc", "any_p5"}}; newcomers: unpolled official
    candidates. Returns wins, viable counts and deadline-rule wins per key (OTHER = not yet nominated)."""
    rng = random.Random(seed)
    wins, viable_n, by_rule = Counter(), Counter(), Counter()
    deadlocks = settled = 0
    keys = list(field)
    vdist = {k: field[k]["vetoes"] if field[k]["vetoes"] is not None else veto_dist(field[k]["disc"], field[k]["any_p5"])
             for k in keys}

    def pick_members(hawk, n):
        idx, w, out = list(range(P5)), list(hawk), []
        for _ in range(n):
            x = rng.random() * sum(w)
            for t, wt in enumerate(w):
                x -= wt
                if x <= 0 or t == len(w) - 1:
                    out.append(idx.pop(t))
                    w.pop(t)
                    break
        return out

    def draw_count(dist):
        if isinstance(dist, int):
            return dist
        x = rng.random()
        for v, p in dist:
            x -= p
            if x <= 0:
                return v
        return dist[-1][0]

    def poisson(lam):
        n, p, limit = 0, rng.random(), math.exp(-lam)
        while p > limit:
            n += 1
            p *= rng.random()
        return n

    for _ in range(runs):
        q = rng.betavariate(VETO_A, VETO_B)
        flex = [rng.betavariate(MEMBER_SPREAD * q, MEMBER_SPREAD * (1 - q)) for _ in range(P5)]
        hawk = [math.exp(rng.gauss(0, HAWK_SPREAD)) for _ in range(P5)]
        p_new = rng.betavariate(ent["p_a"], ent["p_b"])
        settle = rng.betavariate(SETTLE_A, SETTLE_B)
        pool, fresh = [], []
        for k in keys:
            c = field[k]
            e = min(MEMBERS, max(0.0, rng.gauss(c["m"], c["sd"])))
            left = sum(1 for j in pick_members(hawk, draw_count(vdist[k])) if rng.random() >= flex[j])
            pool.append((k, e, left))
        for k in list(newcomers) + [OTHER] * poisson(FUTURE_ENTRANTS):
            e = min(MEMBERS, max(0.0, rng.gauss(ent["mean"], ent["sd"])))
            v = sum(1 for _ in range(P5) if rng.random() < p_new)
            left = sum(1 for j in pick_members(hawk, v) if rng.random() >= flex[j])
            fresh.append((k, e, left))
        pool += fresh
        viable = [(e, k) for k, e, left in pool if left == 0 and e >= 8.5]
        for k in {k for _, k in viable}:
            viable_n[k] += 1
        if viable:
            winner = max(viable)[1]
        else:
            deadlocks += 1
            field_ok = [x for x in pool[: len(keys)] if x[1] >= 8.5]
            fresh_ok = [x for x in fresh if x[1] >= 8.5]
            if field_ok and rng.random() < settle:
                settled += 1
                winner = min(field_ok, key=lambda x: (x[2], -x[1]))[0]
            elif fresh_ok:
                winner = min(fresh_ok, key=lambda x: (x[2], -x[1]))[0]
            else:
                winner = OTHER  # nobody acceptable yet: someone not yet in the race
            by_rule[winner] += 1
        wins[winner] += 1
    return {"wins": wins, "viable": viable_n, "by_rule": by_rule, "deadlocks": deadlocks, "settled": settled, "runs": runs}


def closed_form(field, newcomers):
    """v1 with the Beta belief about the lift chance: weights P(reach 9) x E[q^V], shared out."""
    w = {}
    for k, c in field.items():
        es = c["series"]
        steps = [b - a for a, b in zip(es, es[1:])][-2:]
        trend = sum(steps) / len(steps) if steps else 0.0
        reach = phi((es[-1] + MOMENTUM * trend - 8.5) / SIGMA)
        vd = [(c["vetoes"], 1.0)] if c["vetoes"] is not None else veto_dist(c["disc"], c["any_p5"])
        w[k] = reach * sum(p * beta_moment(v) for v, p in vd)
    for k in newcomers:
        w[k] = NEW_ENTRANT
    w[OTHER] = SOMEONE_ELSE
    total = sum(w.values())
    return {k: v / total for k, v in w.items()}


def build_field(series_by_key, fit, horizon):
    """series_by_key: {key: [(enc, disc, no_op, p5_disc or None, any_p5 or None), ...]} in poll order."""
    field = {}
    for k, series in series_by_key.items():
        es = [s[0] for s in series]
        m, p, _ = kalman(es, fit["tau"] ** 2, fit["s"] ** 2)
        colour = [s for s in series if s[3] is not None]
        field[k] = {
            "series": es, "m": m, "level_sd": math.sqrt(p),
            "sd": math.sqrt(p + horizon * fit["tau"] ** 2 + fit["s"] ** 2),
            "vetoes": colour[-1][3] if colour else None,
            "disc": series[-1][1], "any_p5": series[-1][4],
        }
    return field


def seed_of(*parts):
    return int(hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()[:12], 16)


# ---------------------------------------------------------------------------- races

def history_series():
    """Every candidate's encourage series in the past races, for fitting drift and noise."""
    return [[r[0] for r in res if r is not None] for race in HISTORY.values() for res in race["results"].values()]


def backtest(fit, ent):
    out = {}
    for year, race in HISTORY.items():
        steps = []
        dates = [d for d, _ in race["polls"]]
        for k, (when, _colour) in enumerate(race["polls"]):
            series = {}
            for name, res in race["results"].items():
                if res[k] is None:
                    continue  # not on this ballot (not yet nominated, or withdrawn)
                series[name] = [(r[0], r[1], r[2], r[3] if len(r) > 3 else None, None) for r in res[: k + 1] if r is not None]
            field = build_field(series, fit, polls_left(when, dates[: k + 1]))
            sim = simulate(field, [], fit, ent, RUNS_REPLAY, seed_of(year, k, fit))
            probs = {n: sim["wins"][n] / sim["runs"] for n in list(field) + [OTHER]}
            cf = closed_form(field, [])
            ranked = sorted(field, key=lambda n: -probs[n])
            steps.append({"n": k + 1, "date": when, "p_winner": r4(probs[race["winner"]]),
                          "rank": ranked.index(race["winner"]) + 1, "leader": ranked[0],
                          "p_leader": r4(probs[ranked[0]]), "p_other": r4(probs[OTHER]),
                          "closed_form_p_winner": r4(cf[race["winner"]])})
        out[year] = {"winner": race["winner"], "source": race["source"], "by_poll": steps}
    return out


def gone_by(c, day):
    """True when the candidate had withdrawn (or announced it) by this date."""
    when = [x for x in (c.get("withdrawal_date"), c.get("withdrawal_announced")) if x]
    return c.get("status") == "withdrawn" and (not when or min(when) <= day)


def race_at(sg, day, polls):
    """The 2026 field as it stood on `day`, using the straw polls given (held by then)."""
    cands = [c for c in sg["candidates"] if (c.get("nomination_date") or "0000") <= day and not gone_by(c, day)]
    series, unpolled = {}, []
    for c in cands:
        s = []
        for p in polls:
            r = next((r for r in p["results"] if r.get("candidate_id") == c["id"]), None)
            if r is None:
                continue
            p5 = r.get("p5_discourage_n") if p.get("colour_coded") else None
            s.append((r["encourage"], r["discourage"], r["no_opinion"], p5, r.get("p5_discourage")))
        if s:
            series[c["id"]] = s
        else:
            unpolled.append(c["id"])
    return series, unpolled


def explain(row, latest):
    if not row["polled"]:
        return "Not yet in a straw poll: drawn like past late entrants"
    head = f"Poll {latest['n']}: {latest['encourage']} for, {latest['discourage']} against"
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
    dates = [p["date"] for p in polls]

    # fit drift and noise on every series we have: 2006, 2016 and this race so far
    now_series, newcomers = race_at(sg, today, polls)
    all_2026 = [[r["encourage"] for p in polls for r in p["results"] if r.get("candidate_id") == c["id"]] for c in sg["candidates"]]
    fit = fit_noise(history_series() + all_2026)
    ent = entrant_prior()

    horizon = polls_left(today, dates) if polls else 4
    field = build_field(now_series, fit, horizon)
    sim = simulate(field, newcomers, fit, ent, RUNS, seed_of(now_series, newcomers, fit, horizon))
    cf = closed_form(field, newcomers)
    n = sim["runs"]
    prob = {k: sim["wins"][k] / n for k in list(field) + list(newcomers) + [OTHER]}

    selected = next((c for c in sg["candidates"] if c.get("status") == "selected"), None)
    if selected:
        prob = {k: (1.0 if k == selected["id"] else 0.0) for k in set(prob) | {selected["id"]}}

    current = []
    for cid in list(field) + list(newcomers):
        c = next(x for x in sg["candidates"] if x["id"] == cid)
        fld = field.get(cid)
        if fld:
            vd = [(fld["vetoes"], 1.0)] if fld["vetoes"] is not None else veto_dist(fld["disc"], fld["any_p5"])
            vetoes = sum(v * p for v, p in vd)
        row = {
            "id": cid, "name": names.get(cid, cid),
            "prob": r4(prob.get(cid, 0.0)), "se": r4(math.sqrt(prob.get(cid, 0.0) * (1 - prob.get(cid, 0.0)) / n)),
            "p_viable": r4(sim["viable"][cid] / n), "p_by_rule": r4(sim["by_rule"][cid] / n),
            "polled": bool(fld),
            "latest_e": fld["series"][-1] if fld else None,
            "level": r4(fld["m"]) if fld else None, "level_sd": r4(fld["level_sd"]) if fld else None,
            "final_sd": r4(fld["sd"]) if fld else None,
            "p_reach_9": r4(1 - phi((8.5 - fld["m"]) / fld["sd"])) if fld else None,
            "vetoes": r4(vetoes) if fld else None, "vetoes_known": bool(fld and fld["vetoes"] is not None),
            "closed_form": r4(cf.get(cid)),
        }
        row["basis"] = explain(row, (c.get("poll_history") or [None])[-1])
        current.append(row)
    current.sort(key=lambda r: -r["prob"])

    by_poll = []
    for k, p in enumerate(polls):
        s, u = race_at(sg, p["date"], polls[: k + 1])
        fl = build_field(s, fit, polls_left(p["date"], dates[: k + 1]))
        sm = simulate(fl, u, fit, ent, RUNS_REPLAY, seed_of(s, u, fit, "2026", k))
        by_poll.append({"n": p["n"], "date": p["date"], "colour_coded": bool(p.get("colour_coded")),
                        "probs": {key: r4(sm["wins"][key] / sm["runs"]) for key in list(fl) + list(u) + [OTHER]}})

    probs = {r["id"]: r["prob"] for r in current}
    probs[OTHER] = r4(prob.get(OTHER, 0.0))
    try:
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            history = json.load(f).get("history") or []
    except Exception:  # noqa: BLE001
        history = []
    history = [h for h in history if h.get("method") == "simulation"]  # score one method only
    at = now_iso()
    if not history or history[-1]["probs"] != probs:
        history.append({"at": at, "probs": probs, "basis_poll": polls[-1]["n"] if polls else None, "method": "simulation"})

    p_other = prob.get(OTHER, 0.0)
    out = {
        "_meta": {
            "updated_at": at,
            "method": "simulation",
            "basis": f"straw poll {polls[-1]['n']} ({polls[-1]['date']})" if polls else "no straw poll yet",
            "selected": selected["id"] if selected else None,
            "runs": n,
            "deadlock_share": r4(sim["deadlocks"] / n),
            "settled_share": r4(sim["settled"] / n),
            "deadlock_prior": {"a": SETTLE_A, "b": SETTLE_B, "record": DEADLOCK_RECORD},
            "polls_left": horizon,
            "fit": fit,
            "veto_prior": {"a": VETO_A, "b": VETO_B, "record": VETO_RECORD, "mean": r4(VETO_A / (VETO_A + VETO_B))},
            "entrant_prior": ent,
            "params": {"member_spread": MEMBER_SPREAD, "hawk_spread": HAWK_SPREAD, "future_entrants": FUTURE_ENTRANTS,
                       "decision_by": f"{DECISION[0]:02d}-{DECISION[1]:02d}"},
            "notes": [
                f"Each chance is the share of {n:,} simulated endings of the race that the candidate wins. In each "
                "one, the Council recommends whoever has 9 or more votes and no veto left (most votes first).",
                f"How likely a veto is to be lifted is itself uncertain. The record since 1981 is {VETO_RECORD['lifted']} "
                f"lifted (France on Annan, 1996) of {VETO_RECORD['lifted'] + VETO_RECORD['held']} held through a "
                f"deadlock; with no prior view, that gives a Beta({VETO_A}, {VETO_B}) belief, centred on "
                f"{VETO_A / (VETO_A + VETO_B):.0%}. Each run draws a value from it.",
                "Leaks give only how many permanent members discouraged a candidate, not which. Each run decides which "
                "members are the hawks and how flexible each one is, so a member that blocks several candidates "
                "softens or holds firm on all of them together.",
                f"Each straw poll is read as a noisy measure of a candidate's support, which drifts between polls. "
                f"Fitted to every poll of 2006, 2016 and 2026: drift {fit['tau']} and noise {fit['s']} votes per poll.",
                f"Official candidates not yet polled, and on average {FUTURE_ENTRANTS} people not yet nominated, are "
                f"drawn like the {ent['n']} late entrants of 1996-2016: about {ent['mean']:.0f} votes in their first "
                f"poll (spread {ent['sd']:.1f}), each permanent member discouraging with a chance near "
                f"{ent['p_a'] / (ent['p_a'] + ent['p_b']):.0%}.",
                f"Nobody cleared both bars in {sim['deadlocks'] / n:.0%} of the simulated races. Both real deadlocks since "
                "1981 were broken by newcomers, not by a vetoed front-runner, so a run settles on the existing field with "
                f"a chance drawn from Beta({SETTLE_A}, {SETTLE_B}) (centred on {SETTLE_A / (SETTLE_A + SETTLE_B):.0%}). "
                "Either way the Council takes the candidate with 9 or more votes facing the fewest vetoes, as with Annan "
                "in 1996; if no newcomer has 9 votes, someone not yet in the race.",
                "Not in the model: regional rotation, gender, endorsements or campaigning. The poll figures are leaked "
                "tallies.",
            ],
        },
        "current": current,
        "someone_else": r4(p_other),
        "someone_else_se": r4(math.sqrt(p_other * (1 - p_other) / n)),
        "closed_form": {"someone_else": r4(cf[OTHER])},
        "by_poll": by_poll,
        "backtest": backtest(fit, ent),
        "history": history[-2000:],
    }
    tmp = OUTPUT_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    os.replace(tmp, OUTPUT_FILE)
    top = ", ".join(f"{r['name']} {r['prob']:.1%}" for r in current[:5])
    print(f"wrote {OUTPUT_FILE}: {top}, someone else {p_other:.1%}; deadline rule {sim['deadlocks'] / n:.0%} of runs; "
          f"fit tau={fit['tau']} s={fit['s']} (basis {out['_meta']['basis']})", flush=True)


if __name__ == "__main__":
    main()

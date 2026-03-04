#!/usr/bin/env python3
"""Analyze UN General Debate speeches using OpenAI GPT-4o."""

import argparse
import json
import os
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date

from dotenv import load_dotenv
from openai import OpenAI, RateLimitError

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "site", "server", "data")
SPEECHES_DIR = os.path.join(DATA_DIR, "speeches")
INDEX_FILE = os.path.join(DATA_DIR, "un-speeches-index.json")

ANALYSIS_PROMPT = """You are an expert political analyst. Analyze this UN General Assembly speech and return a JSON object with the following fields:

{
  "summary": "2-3 sentence summary of key points and themes",
  "themes": [
    {"name": "theme name", "relevance": "high|medium|low"}
  ],
  "sentiment": {
    "overall": "positive|negative|neutral|mixed",
    "tone_descriptors": ["hopeful", "critical", etc.],
    "criticism_targets": ["entity or topic criticized"]
  },
  "mentioned_countries": [
    {"iso3": "XXX", "context": "ally|criticism|partnership|concern|neutral"}
  ],
  "mentioned_conflicts": [
    {"name": "conflict name", "stance": "country's stated position"}
  ],
  "policy_positions": [
    {"topic": "policy area", "position": "stated position summary"}
  ],
  "alliances_mentioned": [
    {"entity": "org or group name", "sentiment": "positive|neutral|negative"}
  ],
  "key_quotes": ["exact quote 1", "exact quote 2"],
  "language_detected": "en|fr|es|ar|zh|ru|pt|etc"
}

Rules:
- themes: 3-7 themes, choose from: climate_change, peace_security, human_rights, sustainable_development, nuclear_disarmament, terrorism, poverty, health, education, trade, migration, technology, sovereignty, reform_un, gender_equality, food_security, water, energy, democracy, rule_of_law, multilateralism, conflict_resolution, economic_growth, inequality, biodiversity, oceans, cyber_security, corruption, youth, indigenous_rights, debt, sanctions, colonialism, self_determination, apartheid
- mentioned_countries: use ISO 3166-1 alpha-3 codes (e.g., USA, GBR, CHN, RUS, UKR, ISR, PSE, IRN)
- key_quotes: select 2-3 memorable or significant exact quotes from the text
- If the speech is not in English, still analyze it in whatever language it is, and write the analysis fields in English
- Be precise and factual. Only include what is explicitly stated or strongly implied."""


def load_index():
    with open(INDEX_FILE) as f:
        return json.load(f)


def save_index(index):
    with open(INDEX_FILE, "w") as f:
        json.dump(index, f, indent=2)


def analyze_speech(client, text, model="gpt-4o"):
    """Send speech text to OpenAI and return structured analysis."""
    response = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": ANALYSIS_PROMPT},
            {"role": "user", "content": f"Analyze this UN General Assembly speech:\n\n{text[:15000]}"},
        ],
        temperature=0.3,
        max_tokens=2000,
    )
    return json.loads(response.choices[0].message.content)


def main():
    parser = argparse.ArgumentParser(description="Analyze UN speeches with GPT-4o")
    parser.add_argument("--country", type=str, help="Analyze only this country (ISO3 code)")
    parser.add_argument("--force", action="store_true", help="Re-analyze already analyzed speeches")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be analyzed without calling API")
    parser.add_argument("--provider", default="openai", choices=["openai", "anthropic"], help="AI provider")
    parser.add_argument("--model", type=str, help="Override model name")
    parser.add_argument("--concurrency", type=int, default=1, help="Number of parallel requests (default 1)")
    parser.add_argument("--session", type=int, help="Analyze only this session number")
    args = parser.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key or api_key == "sk-REPLACE_ME":
        if not args.dry_run:
            print("Error: Set OPENAI_API_KEY in scripts/.env")
            sys.exit(1)

    client = None if args.dry_run else OpenAI(api_key=api_key)
    model = args.model or "gpt-4o"

    index = load_index()
    speeches = index["speeches"]

    # Filter by country or session if specified
    if args.country:
        code = args.country.upper()
        speeches = [s for s in speeches if s["iso3"] == code]
        if not speeches:
            print(f"No speeches found for {code}")
            sys.exit(1)
    if args.session is not None:
        speeches = [s for s in speeches if s["session"] == args.session]
        if not speeches:
            print(f"No speeches found for session {args.session}")
            sys.exit(1)

    # Filter already analyzed (unless --force)
    if not args.force:
        to_analyze = [s for s in speeches if "analysis" not in s]
    else:
        to_analyze = list(speeches)

    print(f"Found {len(to_analyze)} speeches to analyze (of {len(speeches)} total)")

    if args.dry_run:
        for s in to_analyze:
            txt_path = os.path.join(SPEECHES_DIR, s["file"])
            exists = os.path.exists(txt_path)
            size = os.path.getsize(txt_path) if exists else 0
            print(f"  {s['iso3']} session {s['session']}: {'OK' if exists else 'MISSING'} ({size} bytes)")
        print(f"\nDry run complete. {len(to_analyze)} speeches would be analyzed.")
        return

    analyzed = 0
    errors = []
    save_interval = 50
    lock = threading.Lock()
    today = date.today().isoformat()

    # Build lookup for fast index updates
    speech_lookup = {}
    for s in index["speeches"]:
        speech_lookup[(s["iso3"], s["session"])] = s

    def process_one(i, speech):
        """Process a single speech. Returns (iso3, session, analysis) or (iso3, session, None)."""
        iso3 = speech["iso3"]
        session = speech["session"]
        txt_path = os.path.join(SPEECHES_DIR, speech["file"])

        if not os.path.exists(txt_path):
            return iso3, session, None, "file missing"

        with open(txt_path) as f:
            text = f.read()

        if len(text) < 100:
            return iso3, session, None, "text too short"

        retries = 0
        while retries < 3:
            try:
                analysis = analyze_speech(client, text, model)
                analysis["_model"] = model
                analysis["_analyzed_at"] = today
                return iso3, session, analysis, None
            except RateLimitError:
                retries += 1
                time.sleep(10 * retries)
            except Exception as e:
                return iso3, session, None, str(e)

        return iso3, session, None, "rate limit exhausted"

    concurrency = args.concurrency
    total = len(to_analyze)
    start_time = time.time()

    print(f"Processing with concurrency={concurrency}...")

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = {
            executor.submit(process_one, i, speech): (i, speech)
            for i, speech in enumerate(to_analyze)
        }

        for future in as_completed(futures):
            i, speech = futures[future]
            iso3, session, analysis, error = future.result()

            with lock:
                if analysis:
                    speech_lookup[(iso3, session)]["analysis"] = analysis
                    analyzed += 1
                    if analyzed % 100 == 0:
                        elapsed = time.time() - start_time
                        rate = analyzed / elapsed
                        eta = (total - analyzed) / rate if rate > 0 else 0
                        print(f"  [{analyzed}/{total}] {rate:.1f}/s, ETA {eta/60:.0f}m")
                    if analyzed % save_interval == 0:
                        save_index(index)
                else:
                    errors.append((iso3, error))
                    if len(errors) <= 20:
                        print(f"  {iso3} s{session}: {error}")

    # Final save
    if analyzed > 0:
        save_index(index)

    elapsed = time.time() - start_time
    print(f"\nDone: {analyzed} analyzed, {len(errors)} errors in {elapsed/60:.1f} minutes")
    if errors:
        print(f"Errors ({len(errors)} total):")
        for iso3, err in errors[:20]:
            print(f"  {iso3}: {err}")
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more")


if __name__ == "__main__":
    main()

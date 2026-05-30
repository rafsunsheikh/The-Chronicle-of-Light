#!/usr/bin/env python3
"""
Enrich the parsed events with geocoded locations and categories.

Stage 2 of the pipeline:
    parse_events.py   ->  events/events.json            (titles + dates)
    enrich_events.py  ->  events/events.enriched.json   (+ location + category)

Locations are resolved against the local curated gazetteer (`gazetteer.json`,
built by `build_gazetteer.py`) — no external geocoding service. Categories are
assigned by keyword rules over the title.

Matching is whole-word on a normalized form (diacritics stripped, 'al-'/'the'
dropped), so place names cannot match inside longer words — critically, "Marw"
(Merv) never matches inside "Marwan", and "Iraq" never matches "Iraqi".
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
# prefer the linked file (has descriptions) if stage 2.5 has run
LINKED = HERE / "events" / "events.linked.json"
BASE = HERE / "events" / "events.json"
EVENTS = LINKED if LINKED.exists() else BASE
GAZ = HERE / "gazetteer.json"
OUT = HERE / "events" / "events.enriched.json"

STOP = {"al", "the", "of"}


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[`'ʿʾ‘’]", "", s)          # drop transliteration apostrophes
    s = re.sub(r"[^a-z0-9]+", " ", s)        # punctuation/hyphens -> space
    toks = [t for t in s.split() if t not in STOP]
    return " ".join(toks)


# --------------------------------------------------------------------------- #
# Location matching
# --------------------------------------------------------------------------- #
def load_gazetteer():
    gaz = json.loads(GAZ.read_text())
    phrases = []  # (normalized_phrase, entry)
    for e in gaz:
        forms = {e["name"], *e["aliases"]}
        for f in forms:
            nf = normalize(f)
            if nf:
                phrases.append((nf, e))
    # longest phrases first so 'dumat jandal' beats 'jandal', cities beat regions
    phrases.sort(key=lambda p: (-len(p[0].split()), -len(p[0])))
    # compile a word-boundary regex per phrase
    compiled = [(re.compile(rf"\b{re.escape(nf)}\b"), e) for nf, e in phrases]
    return compiled


def match_location(title: str, compiled):
    """Return the best gazetteer hit in the title, or None.

    Prefers a place that follows a locative preposition (at/in/near/...), since
    'Revolt at Qinnasrin' is located at Qinnasrin, not at an incidental mention.
    Falls back to the longest matching phrase anywhere in the title.
    """
    norm_title = normalize(title)
    loc_zone = ""
    m = re.search(r"\b(?:at|in|near|to|from|on)\b\s+(.*)$", " " + title, re.I)
    if m:
        loc_zone = normalize(m.group(1))

    best_zone = best_any = None
    for rx, entry in compiled:           # already longest-first
        if loc_zone and best_zone is None and rx.search(loc_zone):
            best_zone = entry
        if best_any is None and rx.search(norm_title):
            best_any = entry
        if best_zone:
            break
    chosen = best_zone or best_any
    if not chosen:
        return None
    return {
        "name": chosen["name"],
        "lat": chosen["lat"],
        "lon": chosen["lon"],
        "type": chosen["type"],
        "modern": chosen["modern"],
        "matchedVia": "locative" if best_zone else "mention",
    }


# --------------------------------------------------------------------------- #
# Categorization
# --------------------------------------------------------------------------- #
CATEGORY_RULES = [   # (category, [keywords]) in priority order
    ("revolt",      ["revolt", "rebell", "uprising", "insurrection", "sedition",
                     "mutiny", "kharijite", "khariji", "secess"]),
    ("battle",      ["battle", "war ", " war", "campaign", "expedition", "siege",
                     "conquest", "raid", "defeat", "fighting", "engagement",
                     "clash", "invasion", "attack", "operations against"]),
    ("death",       ["death", "died", "dies", "killing", "slaying", "slain",
                     "execution", "assassinat", "murder", "martyr", "demise"]),
    ("succession",  ["caliphate", "caliph", "succession", "allegiance", "accession",
                     "appointment", "dismissal", "governor", "deposition",
                     "abdicat", "oath", "vizier", "imamate", "investiture"]),
    ("religion",    ["pilgrimage", "hajj", "prayer", "mosque", "prophet",
                     "qur'an", "quran", "conversion", "messenger of god"]),
    ("construction",["built", "building", "foundation", "founding", "founded",
                     "construction"]),
    ("diplomacy",   ["treaty", "truce", "peace", "embassy", "envoy", "negotiat"]),
]


def categorize(title: str):
    low = title.lower()
    tags = [cat for cat, kws in CATEGORY_RULES if any(k in low for k in kws)]
    return (tags[0] if tags else "general"), tags


# --------------------------------------------------------------------------- #
def main(argv):
    events = json.loads(EVENTS.read_text())
    compiled = load_gazetteer()

    geocoded = via_desc = 0
    cat_counts = {}
    for e in events:
        loc = match_location(e["title"], compiled)
        if not loc and e.get("description"):
            # fall back to the first place named in the opening narrative
            loc = match_location(e["description"][:200], compiled)
            if loc:
                loc["matchedVia"] = "description"
                via_desc += 1
        if loc:
            e["location"] = loc
            geocoded += 1
        cat, tags = categorize(e["title"])
        e["category"] = cat
        e["tags"] = tags
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    OUT.write_text(json.dumps(events, ensure_ascii=False, indent=2))

    print(f"Enriched {len(events)} events (source: {EVENTS.name}) -> {OUT}")
    print(f"  geocoded: {geocoded} ({100*geocoded//len(events)}%)   "
          f"[{via_desc} via description]   un-located: {len(events)-geocoded}")
    print("  categories:")
    for c, n in sorted(cat_counts.items(), key=lambda x: -x[1]):
        print(f"    {c:14} {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

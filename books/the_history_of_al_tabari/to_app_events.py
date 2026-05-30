#!/usr/bin/env python3
"""
Convert the enriched Tabari events into the web app's per-file event schema.

Reads  : events/events.enriched.json
Writes : <repo>/src/data/events/tabari/event-YYYY-<slug>.json   (one per event)

The app (`src/types/incident.ts` + `src/data/event.schema.json`) expects:
  - id        event-YYYY-slug   (4-digit year, lowercase slug)
  - startDate zero-padded YYYY-MM-DD
  - category  one of: political | religious | cultural | scientific | military
  - location  optional {latitude, longitude, name}
  - connections  array of related event ids
  - sources / confidence for provenance

Our 8 categories are mapped onto the app's 5; our (id, connection) space is
remapped to the app's id pattern; missing descriptions are synthesised so they
satisfy the schema's minLength. The tabari/ folder is rewritten on each run.
"""
import json
import re
import shutil
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
SRC = HERE / "events" / "events.enriched.json"
EVENTS_DIR = REPO / "src" / "data" / "events"
OUT_DIR = EVENTS_DIR / "tabari"

CATEGORY_MAP = {
    "battle": "military", "revolt": "military",
    "death": "political", "succession": "political", "diplomacy": "political",
    "general": "political",
    "religion": "religious",
    "construction": "cultural",
}


def slugify(title: str) -> str:
    s = unicodedata.normalize("NFKD", title)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    s = re.sub(r"^(the|a|an)-", "", s)
    words = s.split("-")
    s = "-".join(words[:8])           # keep slugs readable
    return s or "event"


def clean_title(t: str) -> str:
    t = re.split(r"\s*/\s*\d", t)[0]          # drop OCR-merged "/ 114 ..." tails
    t = t.strip(" []()-.").replace("`", "'")
    t = re.sub(r"\s+", " ", t)
    return t


def pad_date(s, *, end=False) -> str:
    s = str(s)
    m = re.match(r"(\d{1,4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{int(m.group(1)):04d}-{m.group(2)}-{m.group(3)}"
    y = re.sub(r"\D", "", s)
    if y:
        return f"{int(y):04d}-{'12-31' if end else '01-01'}"
    return "0001-01-01"


def main():
    events = json.loads(SRC.read_text())

    # existing curated ids (avoid collisions with the hand-made events)
    curated = set()
    for f in EVENTS_DIR.glob("*.json"):
        try:
            curated.add(json.loads(f.read_text())["id"])
        except Exception:
            pass

    # pass 1: assign a unique app id to every Tabari event
    id_map, used = {}, set(curated)
    for e in events:
        year = pad_date(e["startDate"])[:4]
        base = f"event-{year}-{slugify(clean_title(e['title']))}"
        app_id, n = base, 1
        while app_id in used:
            n += 1
            app_id = f"{base}-{n}"
        used.add(app_id)
        id_map[e["id"]] = app_id

    # pass 2: emit records
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)

    written = geocoded = 0
    for e in events:
        app_id = id_map[e["id"]]
        title = clean_title(e["title"])[:200]
        if len(title) < 3:
            continue

        desc = (e.get("description") or "").strip()
        if len(desc) < 10:
            desc = (f"{title}. Recorded under the year {e['hijriYear']} AH "
                    f"({e['ceLabel']} CE) in al-Tabari's History, volume {e['source']['volume']}.")
        desc = desc[:2000]

        rec = {
            "id": app_id,
            "title": title,
            "description": desc,
            "startDate": pad_date(e["startDate"]),
            "category": CATEGORY_MAP.get(e.get("category", "general"), "political"),
            "connections": sorted({
                id_map[c["id"]] for c in e.get("connections", [])
                if c["id"] in id_map and id_map[c["id"]] != app_id
            }),
            "confidence": "auto-imported",
        }
        if e.get("endDate"):
            end = pad_date(e["endDate"], end=True)
            if end >= rec["startDate"]:        # guard against OCR-reversed ranges
                rec["endDate"] = end

        loc = e.get("location")
        if loc:
            rec["location"] = {
                "latitude": loc["lat"], "longitude": loc["lon"],
                "name": loc.get("modern") or loc["name"],
            }
            geocoded += 1

        src = e["source"]
        cite = f"al-Tabari, The History of al-Tabari (SUNY), vol. {src['volume']}"
        page = {"citation": cite}
        if src.get("page"):
            page["page"] = str(src["page"])
        rec["sources"] = [page]

        (OUT_DIR / f"{app_id}.json").write_text(
            json.dumps(rec, ensure_ascii=False, indent=2))
        written += 1

    print(f"Wrote {written} events -> {OUT_DIR}  ({geocoded} geocoded)")


if __name__ == "__main__":
    main()

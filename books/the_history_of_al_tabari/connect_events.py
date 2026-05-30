#!/usr/bin/env python3
"""
Link related events into sequences (narrative threads).

Stage 4 of the pipeline (after enrich). Reads events/events.enriched.json, adds
`connections` to each event, writes the file back in place, and emits
events/sequences.json describing each thread.

Two kinds of thread:
  - person : events naming the same distinctive historical figure
  - place  : events at the same gazetteer location

Precision guards
----------------
- Only DISTINCTIVE figures are used (regnal names / epithets like 'al-Mansur',
  'al-Ma'mun', 'Abu Muslim'). Bare ultra-common names ('Muhammad', 'Ali',
  'Abdallah') are deliberately excluded — they refer to different people across
  three centuries and would create false links.
- A thread is split whenever consecutive events are more than GAP years apart,
  so even a reused name (two caliphs named Marwan) separates into distinct
  threads instead of being chained across a century.
- Person matching keeps the 'al-' article (so 'al-Mansur' the caliph never
  matches 'Mansur b. Jumhur').
"""
import json
import re
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENRICHED = HERE / "events" / "events.enriched.json"
SEQUENCES = HERE / "events" / "sequences.json"

GAP_PERSON = 35   # a person's active public career; larger gap => new thread
GAP_PLACE = 60    # places persist; only split genuinely disjoint clusters

# canonical figure -> DISTINCTIVE surface forms (matched whole-word, 'al-' kept).
# Bare common names (Marwan, Mu'awiyah, 'Abd al-Malik, Hisham, al-Walid) are
# excluded or required in full ibn-chain form, because as personal names they
# recur across many unrelated individuals and would merge false threads.
PERSONS = {
    # Umayyad caliphs & figures — full forms only (the names are common)
    "Mu'awiyah b. Abi Sufyan": ["muawiyah b abi sufyan"],
    "'Abd al-Malik b. Marwan": ["abd al malik b marwan"],
    "'Umar b. 'Abd al-'Aziz": ["umar b abd al aziz"],
    "Hisham b. 'Abd al-Malik": ["hisham b abd al malik"],
    "al-Walid b. Yazid": ["al walid b yazid"],
    "Marwan b. Muhammad": ["marwan b muhammad"],
    "Ibn al-Zubayr": ["ibn al zubayr", "abdallah b al zubayr"],
    "al-Mukhtar": ["al mukhtar"],
    "al-Hajjaj b. Yusuf": ["al hajjaj b yusuf", "al hajjaj"],
    "Yazid b. al-Muhallab": ["yazid b al muhallab"],
    "Nasr b. Sayyar": ["nasr b sayyar"],
    "al-Husayn b. 'Ali": ["al husayn b ali", "husayn b ali"],
    # the Abbasid revolution & caliphs — 'al-' regnal epithets are ~unique
    "Abu Muslim": ["abu muslim"],
    "Qahtabah": ["qahtabah"],
    "al-Saffah": ["al saffah"],
    "al-Mansur": ["al mansur"],
    "al-Mahdi": ["al mahdi"],
    "al-Hadi": ["al hadi", "musa al hadi"],
    "Harun al-Rashid": ["harun al rashid", "al rashid"],
    "al-Amin": ["al amin", "muhammad al amin"],
    "al-Ma'mun": ["al mamun"],
    "Tahir b. al-Husayn": ["tahir b al husayn"],
    "al-Mu'tasim": ["al mutasim", "al mu tasim"],
    "al-Wathiq": ["al wathiq"],
    "al-Mutawakkil": ["al mutawakkil"],
    "Babak": ["babak"],
    "al-Afshin": ["al afshin", "afshin"],
    # groups / movements (coherent recurring threads)
    "the Kharijites": ["kharijite", "kharijites", "khariji"],
}


def pnorm(s: str) -> str:
    """Normalize but KEEP the 'al' article (distinguishes al-Mansur from Mansur)."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[`'ʿʾ‘’]", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


PERSON_RX = {canon: [re.compile(rf"\b{re.escape(a)}\b") for a in forms]
             for canon, forms in PERSONS.items()}


def figures_in(text: str):
    t = pnorm(text)
    return {canon for canon, rxs in PERSON_RX.items() if any(r.search(t) for r in rxs)}


def start_year(e):
    return int(e["startDate"][:4])


def split_by_gap(events, gap):
    """Split a date-sorted event list into runs where consecutive gaps <= gap."""
    runs, cur = [], []
    for e in events:
        if cur and start_year(e) - start_year(cur[-1]) > gap:
            runs.append(cur); cur = []
        cur.append(e)
    if cur:
        runs.append(cur)
    return runs


def build_threads(events):
    """Return list of threads: {id,type,label,eventIds}. Events get .entities."""
    for e in events:
        e["_figures"] = figures_in(e["title"] + " " + e.get("description", "")[:200])

    threads = []

    def add_threads(groups, typ, label_of):
        for key, evs in groups.items():
            evs = sorted(evs, key=start_year)
            gap = GAP_PERSON if typ == "person" else GAP_PLACE
            for k, run in enumerate(split_by_gap(evs, gap)):
                if len(run) < 2:
                    continue
                y0, y1 = start_year(run[0]), start_year(run[-1])
                tid = f"{typ}:{re.sub(r'[^a-z0-9]+','-',key.lower()).strip('-')}-{y0}"
                threads.append({
                    "id": tid, "type": typ,
                    "label": label_of(key, y0, y1),
                    "eventIds": [e["id"] for e in run],
                })

    # person threads
    pgroups = {}
    for e in events:
        for f in e["_figures"]:
            pgroups.setdefault(f, []).append(e)
    add_threads(pgroups, "person",
                lambda k, a, b: f"{k} ({a}–{b} CE)")

    # place threads
    lgroups = {}
    for e in events:
        if e.get("location"):
            lgroups.setdefault(e["location"]["name"], []).append(e)
    add_threads(lgroups, "place",
                lambda k, a, b: f"{k} ({a}–{b} CE)")

    for e in events:
        del e["_figures"]
    return threads


def main():
    events = json.loads(ENRICHED.read_text())
    by_id = {e["id"]: e for e in events}
    for e in events:
        e["connections"] = []
        e["sequenceIds"] = []

    threads = build_threads(events)

    for t in threads:
        ids = t["eventIds"]
        for i, eid in enumerate(ids):
            e = by_id[eid]
            e["sequenceIds"].append(t["id"])
            if i > 0:
                e["connections"].append({"id": ids[i - 1], "relation": "previous",
                                         "via": t["label"], "viaType": t["type"]})
            if i < len(ids) - 1:
                e["connections"].append({"id": ids[i + 1], "relation": "next",
                                         "via": t["label"], "viaType": t["type"]})

    ENRICHED.write_text(json.dumps(events, ensure_ascii=False, indent=2))
    SEQUENCES.write_text(json.dumps(threads, ensure_ascii=False, indent=2))

    linked = sum(1 for e in events if e["connections"])
    p = [t for t in threads if t["type"] == "person"]
    pl = [t for t in threads if t["type"] == "place"]
    print(f"Threads: {len(threads)}  ({len(p)} person, {len(pl)} place)")
    print(f"Events with >=1 connection: {linked}/{len(events)} ({100*linked//len(events)}%)")
    print(f"-> {SEQUENCES}")
    print("\nLargest threads:")
    for t in sorted(threads, key=lambda x: -len(x["eventIds"]))[:10]:
        print(f"  {len(t['eventIds']):2d}  [{t['type']}] {t['label']}")


if __name__ == "__main__":
    main()

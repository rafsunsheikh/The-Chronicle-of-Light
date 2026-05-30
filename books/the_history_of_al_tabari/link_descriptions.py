#!/usr/bin/env python3
"""
Link each parsed event to its narrative in the body text and pull a description.

Stage 2.5 of the pipeline:
    parse_events.py     -> events/events.json
    link_descriptions.py-> events/events.linked.json   (+ description, + leidenPage)
    enrich_events.py    -> events/events.enriched.json

Print page numbers from the Table of Contents do NOT survive into the body text
(the cleaner stripped the running headers that carried them; the body keeps only
Leiden '[nnn]' markers). So we locate each event by matching its ToC title to a
body section heading. The ToC and the body share the same order, so matching is
SEQUENTIAL — a forward cursor walks the body, which disambiguates repeated
titles ("Other Events of This Year") and keeps each event after the previous one.

For each located event we capture:
  - description : the opening of the narrative (a few cleaned sentences)
  - leidenPage  : the Leiden-edition page '[nnn]' at which the section starts
                  (the standard al-Tabari citation anchor)

Run with `--report` to print per-volume hit rates without writing output.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import parse_events as pe

HERE = Path(__file__).resolve().parent
IN = HERE / "events" / "events.json"
OUT = HERE / "events" / "events.linked.json"

STOP = {"the", "of", "a", "and", "in", "at", "to", "for", "on", "b", "al"}
LEIDEN_RE = re.compile(r"^\[?\s*\d{2,4}\s*\]?$")          # '[1391]' or '1391'
ROMAN_RE = re.compile(r"\b[ivxlcdm]+\b", re.I)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[`'ʿʾ‘’]", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


def content_tokens(nrm: str):
    return [t for t in nrm.split() if t not in STOP and len(t) > 2]


def is_indexish(line: str) -> bool:
    """Reject index/contents lines: many page numbers or roman-numeral runs."""
    if len(ROMAN_RE.findall(line)) >= 3:
        return True
    if len(re.findall(r"\d+", line)) >= 4:
        return True
    return False


def body_region(text):
    """(lines, body_start, region_end) — body excludes ToC and end-matter."""
    lines = text.split("\n")
    block = pe.find_toc_block(text)
    body_start = block[-1][0] + 1 if block else 0
    # cap before the end-matter (bibliography / index), searched in the back half
    region_end = len(lines)
    for i in range(len(lines) - 1, len(lines) // 2, -1):
        if re.match(r"\s*(bibliography|index)\b", lines[i], re.I) and len(lines[i]) < 40:
            region_end = i
    return lines, body_start, region_end


def _close(a: str, b: str) -> bool:
    """Token equality tolerant of one OCR error (common vowel swaps like
    'mamun'/'mamnn'), or a clear prefix relationship for longer tokens."""
    if a == b:
        return True
    if len(a) >= 4 and len(b) >= 4:
        if a[:4] == b[:4] and abs(len(a) - len(b)) <= 2:
            return True
        if abs(len(a) - len(b)) <= 1 and _edit_le1(a, b):
            return True
    return False


def _edit_le1(a: str, b: str) -> bool:
    if a == b:
        return True
    if len(a) == len(b):
        return sum(x != y for x, y in zip(a, b)) <= 1
    if abs(len(a) - len(b)) == 1:                     # one insertion/deletion
        lo, hi = (a, b) if len(a) < len(b) else (b, a)
        for i in range(len(hi)):
            if lo == hi[:i] + hi[i + 1:]:
                return True
    return False


def _common_prefix_len(a, b):
    n = 0
    for x, y in zip(a, b):
        if not _close(x, y):
            break
        n += 1
    return n


def _prefix_match(ttok, ctok):
    """Heuristic: do the title and candidate share enough of a leading run of
    content tokens? ToC titles often carry extra trailing words and a leading
    article, but the opening content words line up with the body heading."""
    cp = _common_prefix_len(ttok, ctok)
    if cp >= 3:
        return cp
    # short titles: 2 matching leading tokens are enough if lengths are close
    if cp >= 2 and len(ttok) <= 4 and abs(len(ttok) - len(ctok)) <= 2:
        return cp
    return 0


def find_heading(body, cursor, title_tok):
    """First heading-like body line (at/after cursor) whose leading content
    tokens match the title. Forward-only — body sections share the ToC order.
    Returns (body_index, score) or (None, 0)."""
    if len(title_tok) < 2:
        return None, 0
    for bi in range(cursor, len(body)):
        i, nl, raw = body[bi]
        if len(raw) > 110 or is_indexish(raw):
            continue
        ctok = content_tokens(nl)
        if not ctok:
            continue
        score = _prefix_match(title_tok, ctok)
        # strong matches (>=3 aligned tokens) accepted at any forward distance;
        # weak (2-token) matches only nearby, so one bad hit can't derail a volume
        if score >= 3 or (score == 2 and bi - cursor < 800):
            return bi, score
    return None, 0


def extract_description(lines, start_line, region_end, max_chars=480):
    """Narrative opening after a heading: skip blanks/Leiden markers, then collect
    a few sentences. Returns (description, leiden_page|None)."""
    i = start_line + 1
    leiden = None
    while i < region_end and (not lines[i].strip() or LEIDEN_RE.match(lines[i].strip())):
        m = LEIDEN_RE.match(lines[i].strip())
        if m and leiden is None:
            digits = re.sub(r"\D", "", lines[i])
            leiden = int(digits) if digits else None
        i += 1
    buf = []
    chars = 0
    while i < region_end and chars < max_chars + 120:
        ln = lines[i].strip()
        if not ln:
            if buf:
                break                    # paragraph break ends the snippet
            i += 1
            continue
        if LEIDEN_RE.match(ln):          # inline Leiden marker — record & drop it
            if leiden is None:
                digits = re.sub(r"\D", "", ln)
                leiden = int(digits) if digits else None
            i += 1
            continue
        # an inline bracketed marker embedded in a text line, e.g. "...[1391]..."
        if leiden is None:
            mk = re.search(r"\[(\d{2,4})\]", ln)
            if mk:
                leiden = int(mk.group(1))
        buf.append(ln)
        chars += len(ln) + 1
        i += 1
    text = re.sub(r"\s+", " ", " ".join(buf)).strip()
    if not text:
        return "", leiden
    # trim to a sentence boundary near max_chars
    if len(text) > max_chars:
        cut = text.rfind(". ", 0, max_chars + 80)
        text = text[:cut + 1] if cut > max_chars // 2 else text[:max_chars].rsplit(" ", 1)[0] + "…"
    return text, leiden


def link_volume(vol, events_in_order, report=False):
    text = (pe.SRC / f"Tabari_Volume_{vol}.txt").read_text()
    lines, body_start, region_end = body_region(text)
    body = [(i, norm(lines[i]), lines[i].strip())
            for i in range(body_start, region_end) if lines[i].strip()]
    # map body list position by line index for description extraction
    cursor = 0
    found = 0
    for ev in events_in_order:
        ttok = content_tokens(norm(ev["title"]))
        bi, ov = find_heading(body, cursor, ttok)
        if bi is None:
            continue
        line_idx = body[bi][0]
        desc, leiden = extract_description(lines, line_idx, region_end)
        if desc:
            ev["description"] = desc
            ev["titleMatchTokens"] = ov          # leading content tokens that aligned
            if leiden is not None:
                ev["source"]["leidenPage"] = leiden
            found += 1
            cursor = bi + 1
    if report:
        n = len(events_in_order)
        print(f"  Vol {vol:>3}: {found:>3}/{n:<3} linked ({100*found//max(n,1)}%)")
    return found


def main(argv):
    report = "--report" in argv
    events = json.loads(IN.read_text())
    # group by volume, preserving ToC order (events.json is year-sorted, but the
    # id sequence '-NNN' encodes ToC order within a volume)
    by_vol = {}
    for e in events:
        by_vol.setdefault(e["source"]["volume"], []).append(e)
    for vol in by_vol:
        by_vol[vol].sort(key=lambda e: int(e["id"].rsplit("-", 1)[1]))

    total = 0
    if report:
        print("Event -> body linkage hit rates:")
    for vol in sorted(by_vol):
        total += link_volume(vol, by_vol[vol], report=report)

    if not report:
        OUT.write_text(json.dumps(events, ensure_ascii=False, indent=2))
        print(f"Linked descriptions for {total}/{len(events)} events "
              f"({100*total//len(events)}%) -> {OUT}")
    else:
        print(f"  TOTAL: {total}/{len(events)} ({100*total//len(events)}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

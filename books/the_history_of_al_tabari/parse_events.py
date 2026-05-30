#!/usr/bin/env python3
"""
Parse the cleaned Tabari volumes into datable historical events.

al-Tabari's History is an *annalistic* chronicle: from the Hijra onward it is
organized year-by-year ("The Events of the Year N [AH]"), and each volume opens
with a Table of Contents that lists the named episodes of every year together
with their page numbers. That ToC is a human-authored, structured index of
datable events — this script mines it, then anchors each event to a precise
Gregorian date range taken from the body year-headings.

Pipeline (per volume)
---------------------
1. parse_body_years()  -> {hijri_year: (ce_start, ce_end, raw)}   precise dating
2. parse_toc()         -> [(hijri_year, title, page)]             event titles
3. join                -> events anchored to the year's CE range

Output: events/events.json   (all volumes, HistoricalIncident-shaped records)
        events/events_by_volume/<vol>.json

Volumes that are biographical rather than annalistic (e.g. Vol 39, Companions
of the Prophet; Vol 40, the Index) yield few/no year-anchored events — that is
expected and reported, not an error.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "cleaned_text"
OUT = HERE / "events"

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11,
    "december": 12,
}
MONTH_RE = "|".join(MONTHS)


# --------------------------------------------------------------------------- #
# OCR-tolerant number handling
# --------------------------------------------------------------------------- #
def fix_digits(tok: str) -> str:
    """Repair a token that should be numeric but carries OCR letter-glyphs."""
    return (tok.replace("I", "1").replace("i", "1").replace("l", "1")
               .replace("|", "1").replace("O", "0").replace("o", "0")
               .replace("S", "5").replace("B", "8"))


def to_int(tok: str):
    tok = fix_digits(tok.strip())
    tok = re.sub(r"\D", "", tok)
    return int(tok) if tok else None


def squash_spaced_digits(s: str) -> str:
    """'8 1 8' -> '818', 'JUNE 27, 7 50' -> 'JUNE 27, 750' (join split digits)."""
    return re.sub(r"(?<=\d)\s+(?=\d)", "", s)


# --------------------------------------------------------------------------- #
# Gregorian date parsing out of the parenthetical that follows a year heading
# --------------------------------------------------------------------------- #
def parse_ce(paren: str):
    """Return (start_iso, end_iso, start_year, end_year) from a CE parenthetical.

    Handles the verbose form  'SEPTEMBER 11, 747-AUGUST 30, 748'
    and the compact form      '749/50'  /  '785/786'  /  '750'.
    Missing month/day -> ISO date is just the year (YYYY).
    """
    p_fixed = fix_digits_in_years(paren)
    p_sq = squash_spaced_digits(p_fixed)

    # verbose: capture up to two "MONTH DAY, YEAR" anchors
    full = re.findall(rf"({MONTH_RE})\.?\s*,?\s*(\d{{1,2}})\s*,\s*(\d{{3,4}})", p_sq, re.I)
    if full and 600 <= int(full[0][2]) <= 930:
        start = _iso(full[0])
        end = _iso(full[-1]) if len(full) > 1 else None
        sy = int(full[0][2])
        ey = int(full[-1][2]) if len(full) > 1 else sy
        return start, end, sy, ey

    sy, ey = _compact_years(p_fixed)
    if sy:
        return str(sy), (str(ey) if ey != sy else None), sy, ey
    return None, None, None, None


CE_MIN, CE_MAX = 600, 930  # plausible Gregorian range for al-Tabari's chronicle


def _compact_years(p: str):
    """Two CE years from a compact parenthetical, tolerant of OCR turning the
    '/' separator into a digit ('835/836' -> '8351836', '653 1654')."""
    nums = re.findall(r"\d{2,4}", p)
    if nums and CE_MIN <= int(nums[0]) <= CE_MAX:           # clean interpretation
        sy = int(nums[0])
        ey = _expand_abbrev(sy, nums[1]) if len(nums) > 1 else sy
        if CE_MIN <= ey <= CE_MAX:
            return sy, ey
        return sy, sy
    # fall back: scan a digits-only blob for valid consecutive 3-digit years
    digits = re.sub(r"\D", "", p)
    years, i = [], 0
    while i <= len(digits) - 3 and len(years) < 2:
        v = int(digits[i:i + 3])
        if CE_MIN <= v <= CE_MAX:
            years.append(v); i += 3
        else:
            i += 1
    if years:
        return years[0], (years[1] if len(years) > 1 else years[0])
    return None, None


def fix_digits_in_years(p: str) -> str:
    """Repair OCR glyphs only inside tokens that are clearly numeric-ish."""
    def repl(m):
        t = m.group(0)
        digits = sum(c.isdigit() for c in t)
        return fix_digits(t) if digits >= max(1, len(t) - 2) else t
    return re.sub(r"[0-9IiloOSB|]{2,4}", repl, p)


def _iso(triple) -> str:
    month, day, year = triple
    return f"{int(year):04d}-{MONTHS[month.lower()]:02d}-{int(day):02d}"


def _expand_abbrev(start_year: int, tok: str) -> int:
    """'749','50' -> 750 ; '785','786' -> 786 ; '699','700' stays."""
    n = int(tok)
    if len(tok) <= 2:  # abbreviated within the same century
        return (start_year // 100) * 100 + n if n >= start_year % 100 else \
               (start_year // 100 + 1) * 100 + n
    return n


def ah_to_ce(ah: int) -> int:
    """Approximate Gregorian year for a Hijri year (fallback only)."""
    return round(ah * 0.970229 + 621.567)


def ce_to_ah(ce: int):
    """Hijri year for a Gregorian year — authoritative when a CE date is present,
    since OCR frequently corrupts the printed Hijri digits (r2->12, '3->13)."""
    ah = round((ce - 621.567) / 0.970229)
    return ah if 1 <= ah <= 400 else None


# --------------------------------------------------------------------------- #
# Body: map each Hijri year to its precise CE range
# --------------------------------------------------------------------------- #
# A *body* year-heading is "Events of the Year" with the number/CE on the same
# or the next lines, and it is NOT a Table-of-Contents line (those end in
# " / <page>"). We capture the parenthetical CE that sits right after the year.
BODY_YEAR_RE = re.compile(
    r"(?:the\s+)?events of (?:the|this) year\b[^\n/]*?"   # heading (no ToC slash)
    r"(?:\s+|\n+)\s*([0-9IiloOSB]{1,4})\b"                # hijri year
    r"[^\n(]*(?:\n+\s*)?\(([^)]*\d{3,4}[^)]*)\)",         # (CE ...)
    re.I,
)


def parse_body_years(text: str) -> dict:
    years = {}
    for m in BODY_YEAR_RE.finditer(text):
        start, end, sy, ey = parse_ce(m.group(2))
        if not sy:
            continue
        # derive the Hijri year from the CE date (robust to OCR'd AH digits),
        # falling back to the printed AH number if the CE is implausible
        ah = ce_to_ah(sy) or to_int(m.group(1))
        if ah is None or not (1 <= ah <= 400):
            continue
        if ah not in years:
            years[ah] = {"ce_start": start, "ce_end": end,
                         "ce_start_year": sy, "ce_end_year": ey,
                         "ce_raw": m.group(2).strip()}
    return years


# --------------------------------------------------------------------------- #
# Table of Contents: ordered (hijri_year, title, page) records
# --------------------------------------------------------------------------- #
_PAGE_TOK = r"[0-9IiloOSBrR|]{1,4}(?:\s[0-9IiloOSBrR|]{1,2}){0,2}"  # '134', 'i i', '15 5'
TOC_PAGE_RE = re.compile(rf"^(.*?)\s*/\s*({_PAGE_TOK})\s*$")
# A year-anchor line: a "...Year N..." heading, ideally with a CE parenthetical
# we can date from. Captures (printed-year, CE-parenthetical).
TOC_YEAR_RE = re.compile(
    r"^(?:the\s+)?(?:other\s+|remainder of the\s+)?"
    r"(?:events of\s+)?(?:the\s+|this\s+)?year\s+[0-9IiloOSBrR|'!]{1,4}\b"
    r"[^\n(]*(?:\(([^)]*\d{2,4}[^)]*)\))?",
    re.I,
)


# A "title / page" segment. The page token tolerates OCR glyphs and the spaced
# forms ('i i' = 11, '5 r' = 51, '15 5' = 155); the lookahead ends the page at
# the next capitalized title or end-of-line so merged entries split cleanly.
TOC_SEGMENT_RE = re.compile(rf"([^/]+?)\s*/\s*({_PAGE_TOK})(?=\s|$)")


def find_toc_block(text: str, window: int = 1600):
    """Return the Table-of-Contents region as [(lineno, text)].

    Anchors on the first dense *cluster* of '... / page' lines near the front
    of the volume (no dependence on a 'Contents' heading, which several volumes
    lack). Tolerates blank lines and wrapped-title lines inside the cluster.
    """
    lines = text.split("\n")
    hits = [i for i, l in enumerate(lines[:window]) if TOC_PAGE_RE.match(l.strip())]
    if not hits:
        return []
    # group hits into clusters (gap<=25 lines tolerates wrapped/blank lines) and
    # keep the largest cluster — that is the Table of Contents, not a stray
    # slash-line in the front matter.
    clusters, cur = [], [hits[0]]
    for i in hits[1:]:
        if i - cur[-1] <= 25:
            cur.append(i)
        else:
            clusters.append(cur); cur = [i]
    clusters.append(cur)
    best = max(clusters, key=len)
    start, end = best[0], best[-1]
    return [(i, lines[i].strip()) for i in range(start, end + 1) if lines[i].strip()]


def parse_toc(text: str):
    """Return [(hijri_year, title, page, ce_hint_year)]."""
    block = find_toc_block(text)
    events, cur_year, cur_ce, pending = [], None, None, ""
    for _, line in block:
        ym = TOC_YEAR_RE.match(line)
        has_page = TOC_PAGE_RE.match(line)
        if ym:                                # a year-anchor line (with/without page)
            cur_year, cur_ce = _anchor_year(ym, line)
            pending = ""
            continue
        if has_page:
            # a physical line may hold several merged entries: "A / 51 B / 53"
            segs = TOC_SEGMENT_RE.findall(line)
            for k, (raw_title, raw_page) in enumerate(segs):
                title = clean_title((pending + " " + raw_title) if k == 0 else raw_title)
                pending = ""
                page = to_int(raw_page)
                if (title and len(title) >= 4
                        and re.search(r"[A-Za-z]", title) and not _is_meta(title)):
                    events.append((cur_year, title, page, cur_ce))
        else:
            # wrapped-title continuation (line without a page number)
            pending = (pending + " " + line).strip()

    # back-fill events that were listed before their first recognized year-anchor
    first = next(((y, c) for y, _, _, c in events if y), None)
    if first is not None:
        fy, fc = first
        events = [(y or fy, t, p, c or (fc if not y else c)) for y, t, p, c in events]
    else:
        events = [(y, t, p, c) for y, t, p, c in events if y]
    return events


def _anchor_year(match, line):
    """(hijri_year, ce_start_year) for a ToC year-anchor: prefer deriving the
    Hijri year from the CE parenthetical (OCR-robust), else the printed digits."""
    ce_paren = match.group(1)
    ce_year = None
    if ce_paren:
        ce_year, _ = _compact_years(ce_paren)
        if ce_year:
            ah = ce_to_ah(ce_year)
            if ah:
                return ah, ce_year
    printed = re.search(r"year\s+([0-9IiloOSBrR|']{1,4})", line, re.I)
    if printed:
        y = to_int(printed.group(1).replace("r", "1").replace("R", "1")
                                   .replace("'", "1").replace("|", "1"))
        if y and 1 <= y <= 400:
            return y, ce_year
    return None, ce_year


def clean_title(t: str) -> str:
    t = re.sub(r"\s+", " ", t).strip(" .-")
    t = t.replace("`", "'")
    return t


def _is_meta(title: str) -> bool:
    low = title.lower()
    return low in {"contents", "bibliography", "index", "introduction",
                   "preface", "foreword", "maps", "glossary", "abbreviations",
                   "translator's foreword", "other events of this year",
                   "events of this year", "other events of the year"} \
        or bool(re.fullmatch(r"(other events.*|events of th(is|e) year.*)", low)) \
        or bool(re.match(r"(maps?\b|genealogical|list of |plates?\b|table of "
                         r"|primary sources|secondary sources|\d+\.\s)", low))


# --------------------------------------------------------------------------- #
# Assemble events
# --------------------------------------------------------------------------- #
ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V"}  # not used; volumes are arabic


def vol_label(path: Path) -> str:
    m = re.search(r"Volume_(\w+)", path.stem)
    return m.group(1) if m else path.stem


def build_events(path: Path):
    text = path.read_text(encoding="utf-8")
    vol = vol_label(path)
    body_years = parse_body_years(text)
    toc = parse_toc(text)

    events = []
    for idx, (ah, title, page, ce_hint) in enumerate(toc, 1):
        info = body_years.get(ah)
        if info:                                  # precise CE range from body heading
            start_iso = info["ce_start"]
            end_iso = info["ce_end"]
            sy, ey = info["ce_start_year"], info["ce_end_year"]
            date_precision = ("day" if start_iso and len(start_iso) == 10
                              else ("year-range" if end_iso else "year"))
            ce_label = f"{sy}" + (f"–{ey}" if ey and ey != sy else "")
        elif ce_hint:                             # CE year from the ToC anchor
            sy = ce_hint
            ey = sy
            start_iso = str(sy)
            end_iso = None
            date_precision = "year-from-toc"
            ce_label = str(sy)
        else:                                     # last resort: AH->CE estimate
            sy = ah_to_ce(ah)
            ey = sy
            start_iso = str(sy)
            end_iso = None
            date_precision = "estimated-from-AH"
            ce_label = f"c. {sy}"
        events.append({
            "id": f"tabari-v{vol}-{ah}-{idx:03d}",
            "title": title,
            "description": "",                       # filled by later enrichment
            "hijriYear": ah,
            "ceLabel": ce_label,
            "startDate": start_iso,
            "endDate": end_iso,
            "datePrecision": date_precision,
            "location": None,                         # filled by later enrichment
            "category": None,                         # filled by later enrichment
            "connections": [],
            "source": {
                "work": "The History of al-Tabari",
                "volume": vol,
                "page": page,
                "ceRaw": body_years.get(ah, {}).get("ce_raw"),
            },
        })
    return vol, body_years, events


def main(argv):
    files = sorted(SRC.glob("Tabari_Volume_*.txt"))
    if argv:
        files = [f for f in files if vol_label(f) in argv or f.name in argv]
    OUT.mkdir(exist_ok=True)
    (OUT / "events_by_volume").mkdir(exist_ok=True)

    all_events = []
    print(f"{'VOL':>8} {'YEARS':>6} {'EVENTS':>7}  COVERAGE")
    for f in files:
        vol, body_years, events = build_events(f)
        dated = sum(1 for e in events if e["datePrecision"] != "estimated-from-AH")
        cov = f"{dated}/{len(events)} precisely dated" if events else "(no annalistic events)"
        print(f"{vol:>8} {len(body_years):>6} {len(events):>7}  {cov}")
        (OUT / "events_by_volume" / f"Volume_{vol}.json").write_text(
            json.dumps(events, ensure_ascii=False, indent=2))
        all_events.extend(events)

    all_events.sort(key=lambda e: (e["hijriYear"], e["source"]["volume"]))
    (OUT / "events.json").write_text(
        json.dumps(all_events, ensure_ascii=False, indent=2))
    print(f"\nTotal events: {len(all_events)} -> {OUT/'events.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

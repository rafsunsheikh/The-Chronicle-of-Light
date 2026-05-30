#!/usr/bin/env python3
"""
Clean the pdftotext-extracted Tabari volumes.

Input : extracted_text/Tabari_Volume_*.txt   (raw pdftotext output, one \\f per page)
Output: cleaned_text/Tabari_Volume_*.txt      (headers stripped + light normalization)

What it does
------------
1. Strips running page headers/footers:
   - standalone page-number lines (arabic or roman) at the top/bottom of a page
   - repeated "running head" title lines, detected by frequency across the volume
     (e.g. "Holders of Power after Ardashir b. Babak"), in all four observed layouts:
       "4 / <blank> / Title", "Title / <blank> / 5", "6 Title", "Title 7"
2. Re-joins words hyphenated across a page break (conservative: only when the
   continuation begins with a lowercase letter, so footnote/number splits are left alone).
3. Removes spurious spaces before punctuation ( . , ; : ! ? ) and around parentheses.
4. Collapses runs of blank lines.

What it deliberately KEEPS
--------------------------
- In-line bracketed Leiden pagination markers like "[815]" (scholarly citation anchors)
  — these live in the body, not in the header zone, so they are never touched.
- Footnotes and all body text.

Originals in extracted_text/ are never modified.
"""
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "extracted_text"
DST = HERE / "cleaned_text"

# A token that looks like a page number: arabic digits or a roman numeral.
PAGENUM = r"(?:\d{1,4}|[ivxlcdmIVXLCDM]+)"
RE_LEAD_PAGENUM = re.compile(rf"^\s*{PAGENUM}\b[\s.]*")
RE_TRAIL_PAGENUM = re.compile(rf"[\s.]*\b{PAGENUM}\s*$")
RE_PURE_PAGENUM = re.compile(rf"^\s*{PAGENUM}\s*$")


def loose(line: str) -> str:
    """Normalized signature of a line for header matching.

    Strips leading/trailing page-number tokens (arabic or roman) and any stray
    digits, drops odd OCR glyphs, lowercases. Keeps interior words intact (so a
    word like 'civil' is never mistaken for a roman numeral) and keeps brackets
    so '[the kings of the persians]' compares cleanly.
    """
    s = line.strip().lower()
    s = re.sub(rf"^\s*{PAGENUM}\b[\s.]*", " ", s)   # leading page number
    s = re.sub(rf"[\s.]*\b{PAGENUM}\s*$", " ", s)   # trailing page number
    s = re.sub(r"\d+", " ", s)                       # any stray digits
    s = re.sub(r"[^a-z\[\]()'. ]", " ", s)           # drop other glyphs
    return re.sub(r"\s+", " ", s).strip()


def alpha_count(s: str) -> int:
    return sum(c.isalpha() for c in s)


def learn_headers(pages: list[str], min_pages: int = 3) -> set[str]:
    """Find running-head titles that repeat across the volume."""
    counter: Counter[str] = Counter()
    for p in pages:
        nonblank = [l for l in p.split("\n") if l.strip()]
        for line in nonblank[:2]:  # header zone = first two non-blank lines
            sig = loose(line)
            if alpha_count(sig) >= 3 and len(sig) <= 70:
                counter[sig] += 1
    return {sig for sig, n in counter.items() if n >= min_pages}


def _edit_distance_le(a: str, b: str, k: int) -> bool:
    """True if Levenshtein(a, b) <= k. Cheap band check, then DP."""
    if abs(len(a) - len(b)) > k:
        return False
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i] + [0] * len(b)
        best = cur[0]
        for j, cb in enumerate(b, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb))
            best = min(best, cur[j])
        if best > k:
            return False  # whole row already exceeds budget
        prev = cur
    return prev[-1] <= k


def is_header_line(line: str, headers: set[str]) -> bool:
    """True if a (leading) line is a running head.

    Long, distinctive titles (>=10 chars) match fuzzily: the title may be
    contained in the line with a little extra OCR noise (garbled page numbers
    like 'ro' or '1 6'), or the title text itself may be slightly misread
    ('Babak' -> 'Bibak') — allowed within a small edit distance. Short titles
    ('index', 'contents') must match exactly to avoid stripping body lines that
    merely contain the word.
    """
    lf = loose(line)
    if not lf:
        return False
    if lf in headers:
        return True
    for t in headers:
        if len(t) < 10:
            continue
        if t in lf and (len(lf) - len(t)) <= 8:
            return True
        # tolerate a couple of OCR character errors within the title text
        if abs(len(lf) - len(t)) <= 4 and _edit_distance_le(lf, t, 3):
            return True
    return False


def _is_companion_pagenum(line: str) -> bool:
    """A bare page-number companion line — never a bracketed Leiden marker."""
    if "[" in line or "]" in line:
        return False  # protect inline Leiden pagination markers like [815]
    if RE_PURE_PAGENUM.match(line):
        return True
    lf = loose(line)
    return alpha_count(lf) <= 3 and len(lf) <= 4  # e.g. 'ro', 'i i'


def strip_page(page: str, headers: set[str]) -> str:
    """Strip leading header lines and trailing footer page-numbers from one page."""
    lines = page.split("\n")
    nonblank_idx = [k for k, l in enumerate(lines) if l.strip()]
    if not nonblank_idx:
        return ""

    # --- strip the header zone from the top ---
    # Remove header-title / page-number / garble lines individually (not as a
    # contiguous block) so that real content sitting inside the header zone —
    # e.g. a Leiden marker "[837]" between the page number and the running
    # head — is preserved.
    remove: set[int] = set()
    for pos in nonblank_idx[:5]:
        ln = lines[pos]
        if is_header_line(ln, headers):
            remove.add(pos)
        elif RE_PURE_PAGENUM.match(ln):
            remove.add(pos)
        elif _is_companion_pagenum(ln):
            remove.add(pos)
        elif "[" in ln and alpha_count(loose(ln)) == 0:
            continue  # bracketed marker (e.g. "[837]") — keep, keep scanning
        else:
            break  # genuine body text — stop scanning the header zone
    if remove:
        lines = [l for k, l in enumerate(lines) if k not in remove]

    # --- strip a single trailing footer page number, if any ---
    nb_tail = [k for k, l in enumerate(lines) if l.strip()]
    if nb_tail and RE_PURE_PAGENUM.match(lines[nb_tail[-1]]):
        lines = lines[: nb_tail[-1]]

    return "\n".join(lines).strip("\n")


def normalize_text(text: str) -> str:
    # Join words hyphenated across a (now header-stripped) page/paragraph break,
    # but ONLY when the continuation starts lowercase — avoids gluing footnote
    # text or numbers onto a fragment (e.g. "Inscrip-\n\nRiyanus" is left alone).
    text = re.sub(r"([A-Za-z])-\n\s*\n([a-z])", r"\1\2", text)
    text = re.sub(r"([a-z])-\n([a-z])", r"\1\2", text)  # safety net, same-line case

    # Remove spurious spaces before punctuation.
    text = re.sub(r"[ \t]+([,.;:!?])", r"\1", text)
    # Tidy parentheses spacing.
    text = re.sub(r"\([ \t]+", "(", text)
    text = re.sub(r"[ \t]+\)", ")", text)

    # Collapse multiple spaces and excessive blank lines.
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"


def clean_file(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8", errors="replace")
    pages = raw.split("\f")
    headers = learn_headers(pages)
    bodies = [strip_page(p, headers) for p in pages]
    joined = "\n\n".join(b for b in bodies if b.strip())
    cleaned = normalize_text(joined)

    DST.mkdir(exist_ok=True)
    (DST / path.name).write_text(cleaned, encoding="utf-8")
    return {
        "file": path.name,
        "pages": len(pages),
        "headers_found": len(headers),
        "raw_chars": len(raw),
        "clean_chars": len(cleaned),
    }


def main(argv: list[str]) -> int:
    files = sorted(SRC.glob("Tabari_Volume_*.txt"))
    if argv:
        wanted = set(argv)
        files = [f for f in files if f.name in wanted or f.stem in wanted]
    if not files:
        print("No matching input files in", SRC)
        return 1
    print(f"{'FILE':32} {'PAGES':>6} {'HEADS':>6} {'RAW':>10} {'CLEAN':>10} {'DELTA':>7}")
    for f in files:
        s = clean_file(f)
        delta = s["raw_chars"] - s["clean_chars"]
        print(f"{s['file']:32} {s['pages']:>6} {s['headers_found']:>6} "
              f"{s['raw_chars']:>10} {s['clean_chars']:>10} {delta:>7}")
    print(f"\nDone -> {DST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

"""
Splits each of the four faces in two, so the first paint waits on as few
bytes as possible and nothing is lost:

  core  every character the site's own text uses, and all of plain ASCII
        (whatever a visitor types in English); this is what every page loads
  rest  the remainder of the Latin set (accented letters, rarer symbols),
        which the browser fetches only if a page ever shows one of them

The browser picks between them by each file's unicode-range, so text looks
exactly as before. Fetched before the first paint, the four whole files were
115 kB of what a phone's largest paint waited on.

The site's characters are read from its sources (the content package, the
page template and the build and interface code), so a new symbol in the copy
is picked up the next time this runs. Should the copy gain a symbol the core
lacks, nothing breaks: the browser fetches that face's rest for it, a little
later; running this again brings it into the core. Newsreader is taken from
the cut tools/newsreader.py makes, the Plex faces from @fontsource. Run from
the project root (after newsreader.py, when that changes):
    python tools/fonts.py
"""
import html
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

web = Path(__file__).resolve().parents[1]
root = web
out = web / 'src' / 'fonts'
fontsource = root / 'node_modules' / '@fontsource'

FACES = [
    # family, weight, source file, file stem written here, css format
    ('Newsreader', 400, out / 'newsreader-latin.woff2', 'newsreader', 'woff2-variations'),
    ('IBM Plex Sans', 400, fontsource / 'ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2', 'plex-sans-400', 'woff2'),
    ('IBM Plex Sans', 500, fontsource / 'ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2', 'plex-sans-500', 'woff2'),
    ('IBM Plex Mono', 500, fontsource / 'ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2', 'plex-mono-500', 'woff2'),
]

# the Latin set as @fontsource cuts it: what the whole files covered
LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'

# where the site's text comes from
SOURCES = [root / 'content/src', web / 'index.html', web / 'build', web / 'src']


def ranges_to_set(spec: str) -> set[int]:
    cps: set[int] = set()
    for part in spec.split(','):
        a, _, b = part.strip()[2:].partition('-')
        cps.update(range(int(a, 16), int(b or a, 16) + 1))
    return cps


def set_to_ranges(cps: set[int]) -> str:
    runs, start, prev = [], None, None
    for c in sorted(cps):
        if start is None:
            start = prev = c
        elif c == prev + 1:
            prev = c
        else:
            runs.append((start, prev))
            start = prev = c
    if start is not None:
        runs.append((start, prev))
    return ','.join(f'U+{a:04X}' if a == b else f'U+{a:04X}-{b:04X}' for a, b in runs)


def site_characters() -> set[int]:
    """every character the sources can put on screen: written out, as an entity (&copy;), or escaped in JS or CSS"""
    found: set[int] = set()
    for src in SOURCES:
        files = [src] if src.is_file() else [p for p in src.rglob('*') if p.suffix in {'.ts', '.html', '.css'}]
        for f in files:
            text = f.read_text(encoding='utf-8')
            text += html.unescape(text)
            # JS escapes (backslash, u, four hex digits) and CSS ones (backslash, four hex digits)
            text += ''.join(chr(int(h, 16)) for h in re.findall(r'\\u?([0-9a-fA-F]{4})', text))
            found.update(ord(ch) for ch in text)
    return found


latin = ranges_to_set(LATIN)
ascii_printable = set(range(0x20, 0x7F))
# a few a page can produce without the copy containing them: the no-break space, typographic quotes and dashes
always = {0xA0, 0x2018, 0x2019, 0x201C, 0x201D, 0x2013, 0x2014, 0x2026, 0xB7}
core = (ascii_printable | always | (site_characters() & latin)) & latin
rest = latin - core
print(f'core {len(core)} code points, rest {len(rest)}; outside ASCII in core:',
      ' '.join(f'U+{c:04X}' for c in sorted(core - ascii_printable)))


def cut(src: Path, keep: set[int], target: Path) -> None:
    font = TTFont(src)
    cmap = font.getBestCmap()
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']      # kerning, ligatures and the rest, for the glyphs kept
    options.name_IDs = ['*']
    options.notdef_outline = True
    sub = subset.Subsetter(options)
    sub.populate(unicodes=[c for c in keep if c in cmap])
    sub.subset(font)
    font.flavor = 'woff2'
    font.save(target)


rules = []
for family, weight, src, stem, fmt in FACES:
    have = set(TTFont(src).getBestCmap())
    for part, keep in (('core', core), ('rest', rest)):
        covered = keep & have
        if not covered:
            continue
        target = out / f'{stem}-{part}.woff2'
        cut(src, covered, target)
        print(f'{target.name}: {target.stat().st_size / 1024:.1f} kB')
        rules.append(f"""@font-face {{
  font-family: '{family}';
  font-style: normal;
  font-display: swap;
  font-weight: {weight};
  src: url(./{target.name}) format('{fmt}');
  unicode-range: {set_to_ranges(covered)};
}}""")

# Newsreader's other scripts, as tools/newsreader.py cut them, carry on unchanged
for block in re.findall(r'@font-face \{.*?\}', (out / 'newsreader.css').read_text(), re.S):
    if 'newsreader-latin.woff2' not in block:
        rules.append(block)

(out / 'faces.css').write_text(
    '/* written by tools/fonts.py: each face split into the characters the site uses (core)\n'
    '   and the rest of Latin (rest), which the browser fetches only if a page needs it */\n'
    + '\n\n'.join(rules) + '\n', encoding='utf-8')
print('faces.css written')

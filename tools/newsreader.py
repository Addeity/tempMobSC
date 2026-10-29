"""
Cuts the headline face down to what the site sets: Newsreader at weight 400
only, its optical sizes kept from 16 to 72 (the smallest serif text on the
site is 16px; the headline is the largest). The full variable file is 132 kB
for Latin alone and is the first thing the page waits on; this one is 52 kB
and looks the same at every size the site uses.

Reads the files @fontsource-variable/newsreader installs and writes, per
subset the browser may need, src/fonts/newsreader-<subset>.woff2 and the
@font-face rules for them in src/fonts/newsreader.css.

    pip install fonttools brotli
    python tools/newsreader.py

Run it again only to change the weight or the size range below, and then
tools/fonts.py, which splits the Latin file into the two parts the page loads.
"""
import re
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

WEIGHT = 400
OPTICAL_SIZES = (16, 72)

web = Path(__file__).resolve().parents[1]
source = web.parents[1] / 'node_modules' / '@fontsource-variable' / 'newsreader'
out = web / 'src' / 'fonts'
out.mkdir(exist_ok=True)

rules = []
for block in re.findall(r'@font-face \{(.*?)\}', (source / 'opsz.css').read_text(), re.S):
    file = re.search(r'url\(\./files/(newsreader-(.+?)-opsz-normal\.woff2)\)', block)
    unicode_range = re.search(r'unicode-range: ([^;]+);', block).group(1)
    subset = file.group(2).replace('-', '_')

    font = instancer.instantiateVariableFont(
        TTFont(source / 'files' / file.group(1)),
        {'wght': WEIGHT, 'opsz': OPTICAL_SIZES},
        updateFontNames=False,
    )
    font.flavor = 'woff2'
    target = out / f'newsreader-{subset}.woff2'
    font.save(target)
    print(f'{target.name}: {target.stat().st_size // 1024} kB')

    rules.append(f"""@font-face {{
  font-family: 'Newsreader';
  font-style: normal;
  font-display: swap;
  font-weight: {WEIGHT};
  src: url(./{target.name}) format('woff2-variations');
  unicode-range: {unicode_range};
}}""")

(out / 'newsreader.css').write_text(
    '/* written by tools/newsreader.py: Newsreader at weight '
    f'{WEIGHT}, optical sizes {OPTICAL_SIZES[0]} to {OPTICAL_SIZES[1]} */\n'
    + '\n\n'.join(rules) + '\n'
)

"""
The page's grain (styles/base.css): one small tile of white specks of
random strength, repeated. It used to be an SVG feTurbulence filter, which
the browser has to compute when it first paints (twice, with the stage's own
grain) and, under a blend mode, on every frame the ring moved. A tile made
here once costs nothing but its few kilobytes. Run from the project root:
    python tools/grain.py
"""
import random
from pathlib import Path
from PIL import Image

SIZE = 96           # big enough that the repeat never reads as a pattern at this strength
LEVELS = 16         # alpha in sixteen steps: the specks look the same and the file is a third the size
random.seed(7)      # the same tile every time it is made

# a four-bit palette: sixteen whites, each a step more opaque than the last
tile = Image.new('P', (SIZE, SIZE))
tile.putpalette([255, 255, 255] * LEVELS)
tile.putdata([min(LEVELS - 1, max(0, round(random.gauss(.35, .2) * (LEVELS - 1)))) for _ in range(SIZE * SIZE)])
out = Path('src/styles/grain.png')
tile.save(out, optimize=True, bits=4, transparency=bytes(i * 255 // (LEVELS - 1) for i in range(LEVELS)))
print(out, out.stat().st_size, 'bytes')

"""Make a seamless bitmap loop from the exact supplied menu painting.

The lettering stays baked into the source pixels; no generative video pass can
warp or mistranslate it. Only a restrained periodic camera breath is added.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageEnhance


def main(source: Path, output: Path) -> None:
    image = Image.open(source).convert("RGB")
    width, height = image.size
    fps, seconds = 12, 6
    count = fps * seconds
    frames: list[Image.Image] = []

    for index in range(count):
        phase = 2 * math.pi * index / count
        zoom = 1 + 0.012 * (1 - math.cos(phase)) / 2
        scaled = image.resize((round(width * zoom), round(height * zoom)), Image.Resampling.LANCZOS)
        left = (scaled.width - width) // 2
        top = (scaled.height - height) // 2
        frame = scaled.crop((left, top, left + width, top + height))
        frame = ImageEnhance.Brightness(frame).enhance(1 + 0.006 * math.sin(phase))
        frames.append(frame)

    output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        output,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=round(1000 / fps),
        loop=0,
        quality=91,
        method=6,
    )
    print(f"Wrote {output}: {count} raster frames, seamless {seconds}s loop")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python scripts/make-menu-loop.py INPUT.png OUTPUT.webp")
    main(Path(sys.argv[1]), Path(sys.argv[2]))

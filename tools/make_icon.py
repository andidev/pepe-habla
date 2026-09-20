"""
Build every app-icon asset from the one Pepe drawing.

The source is a 1024px cartoon on flat white. Each platform wants something
different from it, so rather than hand-cutting five PNGs this renders them all
from the single original and can be re-run whenever the art changes.

What each platform needs, and why the compositions differ:

  iOS      `icon.png` must be fully opaque -- alpha is flattened or rejected at
           submission -- and iOS only rounds the corners, so the drawing can
           nearly fill the tile.

  Android  the adaptive icon is two layers: a transparent foreground over a
           flat background. Only the central 72 of the 108dp canvas is ever
           shown, and just the inner 66dp circle is safe under every launcher
           mask, so the foreground sits far smaller than the iOS one.
           ART_SCALE is tuned against that ring (see tools/ preview scripts).

The white background is removed the same way `extract_sprites.py` does it:
flood-fill inward from the border rather than keying on colour, so the white
chest patch and the eye highlights stay opaque. Only the largest connected
blob is kept -- the original has a stray fragment of tail at bottom-left that
would otherwise float as a speck inside the safe zone.

Usage:  uv run --with pillow --with numpy --with scipy python tools/make_icon.py
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = Path('images/originals/pepe-hablas-icon.jpeg')
OUT = Path('apps/app/assets')

CREAM = (0xFB, 0xF6, 0xEC)      # colour.ground from theme.ts
INK = (0x1C, 0x17, 0x14)        # colour.ink

SIZE = 1024
# How close to white still counts as background.
COLOUR_TOLERANCE = 18
# Where the dog's eyes/nose sit in the source, in source pixels. Compositions
# are anchored on the face rather than the bounding box, so he doesn't drift
# when the crop changes.
FACE = (512, 430)

# Drawing width as a fraction of the canvas.
#   Android: 0.66 of the 108dp canvas, chosen from the mask previews. The hat
#            tip grazes the 66dp safe ring; circle, squircle and rounded-square
#            masks all clear it.
#   iOS:     nearly full-bleed, since iOS only rounds the corners.
ANDROID_ART = 0.66
IOS_ART = 0.88
# Vertical position of the face as a fraction of the canvas. Slightly above
# centre, which is where a face wants to sit optically.
FACE_Y = 0.46


def cutout() -> Image.Image:
    """The drawing on a transparent background, stray fragments dropped."""
    src = Image.open(SRC).convert('RGB')
    arr = np.array(src).astype(int)

    near_white = (arr > 255 - COLOUR_TOLERANCE).all(axis=2)
    # Background is near-white *connected to the border*, so enclosed light
    # areas -- the chest patch, the eyes -- are not mistaken for background.
    labels, _ = ndimage.label(near_white)
    edge = set(labels[0]) | set(labels[-1]) | set(labels[:, 0]) | set(labels[:, -1])
    edge.discard(0)
    background = np.isin(labels, sorted(edge))

    blobs, count = ndimage.label(~background)
    if count > 1:
        sizes = ndimage.sum(~background, blobs, range(1, count + 1))
        keep = int(np.argmax(sizes)) + 1
        subject = blobs == keep
    else:
        subject = ~background

    out = src.convert('RGBA')
    alpha = Image.fromarray((subject * 255).astype(np.uint8))
    # A hard mask leaves a stair-stepped edge against the cream. Half a pixel
    # of blur is enough to hide it and too little to eat the black outline.
    out.putalpha(alpha.filter(ImageFilter.GaussianBlur(0.6)))
    return out


def place(art: Image.Image, width: float, size: int = SIZE) -> Image.Image:
    """The drawing on a transparent canvas, scaled and anchored on the face."""
    scale = size * width / art.width
    scaled = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    fx, fy = FACE[0] * scale, FACE[1] * scale
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(scaled, (round(size / 2 - fx), round(size * FACE_Y - fy)), scaled)
    return canvas


def on(colour: tuple, layer: Image.Image) -> Image.Image:
    return Image.alpha_composite(Image.new('RGBA', layer.size, colour + (255,)), layer)


def monochrome(layer: Image.Image) -> Image.Image:
    """The same placement in one tone, for Android 13+ themed icons.

    A flat silhouette is an unreadable blob here -- hat, ears and face all
    merge into one shape. Android tints this layer and honours partial alpha,
    so opacity is taken from how dark each pixel is: outlines, eyes and nose
    stay solid while the sombrero and muzzle drop back, which keeps him
    legible down to 48px.
    """
    rgb = np.array(layer.convert('RGB')).astype(float)
    luminance = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    tone = np.clip(1 - luminance / 255, 0, 1) ** 0.7
    alpha = np.array(layer.getchannel('A')).astype(float) / 255 * tone
    flat = Image.new('RGBA', layer.size, INK + (255,))
    flat.putalpha(Image.fromarray((alpha * 255).astype(np.uint8)))
    return flat


def main() -> None:
    if not SRC.exists():
        sys.exit(f'missing source art: {SRC}')
    art = cutout()

    ios = on(CREAM, place(art, IOS_ART)).convert('RGB')
    ios.save(OUT / 'icon.png')
    ios.resize((48, 48), Image.LANCZOS).save(OUT / 'favicon.png')

    foreground = place(art, ANDROID_ART)
    foreground.save(OUT / 'android-icon-foreground.png')
    monochrome(foreground).save(OUT / 'android-icon-monochrome.png')
    Image.new('RGB', (SIZE, SIZE), CREAM).save(OUT / 'android-icon-background.png')

    check()


def check() -> None:
    """Fail loudly rather than shipping an icon the store will bounce."""
    icon = Image.open(OUT / 'icon.png')
    assert icon.size == (SIZE, SIZE), icon.size
    assert icon.mode == 'RGB', f'iOS icon must be opaque, got {icon.mode}'
    for name in ('android-icon-foreground.png', 'android-icon-monochrome.png'):
        layer = Image.open(OUT / name)
        assert layer.size == (SIZE, SIZE), (name, layer.size)
        assert layer.mode == 'RGBA', f'{name} must carry alpha, got {layer.mode}'
        assert layer.getchannel('A').getextrema()[0] == 0, f'{name} has no transparent pixels'
    print('wrote icon.png, favicon.png, android-icon-{foreground,monochrome,background}.png')


if __name__ == '__main__':
    main()

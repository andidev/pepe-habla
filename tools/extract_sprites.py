"""
Cut individual Pepe sprites out of the cartoon sticker sheets.

The sheets are flat cream with clear gaps between drawings, so: find the
background by flood-filling inward from the border, treat everything else as
foreground, dilate a little so a dog and the prop it is holding count as one
drawing, then label the connected blobs and crop each one.

Background removal inside a crop is done by flooding from that crop's border
rather than by matching the background colour globally — otherwise white parts
of the artwork (Pepe's chest, a sugar skull, a sombrero highlight) punch holes
in the sprite.

Usage:  python tools/extract_sprites.py images/originals/sheet.jpeg out_dir/
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

# A drawing must be at least this fraction of the sheet to count, which drops
# stray specks and JPEG noise without losing the smaller props.
MIN_AREA_FRACTION = 0.0015
# How close to the sampled background colour still counts as background.
COLOUR_TOLERANCE = 26
# Grow the foreground by this much before labelling, so a dog and the taco it
# is holding merge into one drawing instead of two.
DILATION = 7
PADDING = 12


def background_mask(rgb: np.ndarray) -> np.ndarray:
    """True where the pixel is background, found by flooding in from the border."""
    corners = np.vstack([rgb[0, :], rgb[-1, :], rgb[:, 0], rgb[:, -1]])
    bg_colour = np.median(corners, axis=0)

    close = np.all(np.abs(rgb.astype(np.int16) - bg_colour) <= COLOUR_TOLERANCE, axis=-1)

    # Only background-coloured pixels *connected to the border* are background.
    labels, _ = ndimage.label(close)
    border = np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]])
    outer = set(np.unique(border)) - {0}
    return np.isin(labels, list(outer))


def find_drawings(fg: np.ndarray, total: int) -> list[tuple[slice, slice]]:
    grown = ndimage.binary_dilation(fg, np.ones((DILATION, DILATION), bool))
    labels, count = ndimage.label(grown)
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        if (labels[sl] == i).sum() >= total * MIN_AREA_FRACTION:
            boxes.append(sl)
    # Reading order: top to bottom, then left to right, in rough rows.
    boxes.sort(key=lambda s: (round(s[0].start / 60), s[1].start))
    return boxes


def cut(img: Image.Image, sl, rgb: np.ndarray) -> Image.Image:
    ys, xs = sl
    top = max(ys.start - PADDING, 0)
    left = max(xs.start - PADDING, 0)
    bottom = min(ys.stop + PADDING, img.height)
    right = min(xs.stop + PADDING, img.width)

    crop = img.crop((left, top, right, bottom)).convert('RGBA')
    # Re-derive the background within this crop so interior whites survive.
    local_bg = background_mask(rgb[top:bottom, left:right])
    alpha = np.array(crop)[:, :, 3]
    alpha[local_bg] = 0
    out = np.array(crop)
    out[:, :, 3] = alpha
    return Image.fromarray(out)


def main(sheet: Path, out_dir: Path) -> None:
    img = Image.open(sheet).convert('RGB')
    rgb = np.array(img)
    fg = ~background_mask(rgb)

    out_dir.mkdir(parents=True, exist_ok=True)
    stem = sheet.stem[:8]
    boxes = find_drawings(fg, rgb.shape[0] * rgb.shape[1])

    for n, sl in enumerate(boxes, start=1):
        sprite = cut(img, sl, rgb)
        path = out_dir / f'{stem}-{n:02d}.png'
        sprite.save(path)
        print(f'{path.name}  {sprite.width}x{sprite.height}')

    print(f'{len(boxes)} sprites from {sheet.name}')


if __name__ == '__main__':
    main(Path(sys.argv[1]), Path(sys.argv[2]))


def drop_edge_bleed(img: Image.Image, min_share: float = 0.05) -> Image.Image:
    """Remove fragments of neighbouring drawings that bled into the crop.

    A real prop (the football, the salsa bowl) sits inside the frame. A fragment
    of the drawing next door is both small and touching the crop edge, so that
    pair of conditions targets the bleed without eating anything wanted.
    """
    a = np.array(img)
    labels, n = ndimage.label(a[:, :, 3] > 8)
    if n <= 1:
        return img

    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
    biggest = sizes.max()
    border = set(np.unique(np.concatenate(
        [labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]]))) - {0}

    for i in range(1, n + 1):
        if i in border and sizes[i - 1] < biggest * min_share:
            a[labels == i, 3] = 0
    return Image.fromarray(a)

"""
Cut individual Pepe sprites out of the cartoon sticker sheets.

The sheets are flat cream with clear gaps between drawings, so: find the
background by flood-filling inward from the border, treat everything else as
foreground, dilate a little so a dog and the prop it is holding count as one
drawing, then label the connected blobs and crop each one.

An earlier pass dilated by 7px, which was enough to bridge the gap between
neighbouring drawings and merge them into one crop. Dropping dilation to 3px
(just enough to still join a dog to a prop drawn touching it) was sufficient
to separate every merged pair on these three sheets — no blob ended up
needing to be split after the fact, so there is no splitting step here.

At dilation 3, drawings placed close together can still have overlapping
*padded* crop rectangles without ever being the same blob, which bled a
fragment of one drawing into its neighbour's crop. `cut` fixes this by
keeping only the pixels that belong to the target blob's own connected-
component label, in addition to the existing local background flood-fill.

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
DILATION = 3
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


def find_drawings(fg: np.ndarray, total: int) -> list[tuple[tuple[slice, slice], np.ndarray]]:
    """Return each drawing's crop box together with its label's own pixel mask.

    Carrying the mask (rather than just the box) lets `cut` blank out any pixel
    inside the padded crop rectangle that actually belongs to a *different*
    drawing — two dogs sitting a few pixels apart can have overlapping padded
    boxes without ever being the same blob, and a fixed pixel padding would
    otherwise bleed a sliver of the neighbour into both crops.
    """
    grown = ndimage.binary_dilation(fg, np.ones((DILATION, DILATION), bool))
    labels, count = ndimage.label(grown)

    boxes = []
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        filled = int((labels[sl] == i).sum())
        if filled < total * MIN_AREA_FRACTION:
            continue
        boxes.append((sl, labels == i))

    boxes.sort(key=lambda b: (round(b[0][0].start / 60), b[0][1].start))
    return boxes


def cut(img: Image.Image, sl, rgb: np.ndarray, member: np.ndarray) -> Image.Image:
    ys, xs = sl
    top = max(ys.start - PADDING, 0)
    left = max(xs.start - PADDING, 0)
    bottom = min(ys.stop + PADDING, img.height)
    right = min(xs.stop + PADDING, img.width)

    crop = img.crop((left, top, right, bottom)).convert('RGBA')
    # Re-derive the background within this crop so interior whites survive.
    local_bg = background_mask(rgb[top:bottom, left:right])
    out = np.array(crop)
    alpha = out[:, :, 3]
    alpha[local_bg] = 0
    # A neighbouring drawing can poke into the padding margin without ever
    # touching this blob; keep only pixels that are actually this drawing's own.
    alpha[~member[top:bottom, left:right]] = 0
    out[:, :, 3] = alpha
    return Image.fromarray(out)


def main(sheet: Path, out_dir: Path) -> None:
    img = Image.open(sheet).convert('RGB')
    rgb = np.array(img)
    fg = ~background_mask(rgb)

    out_dir.mkdir(parents=True, exist_ok=True)
    stem = sheet.stem[:8]
    boxes = find_drawings(fg, rgb.shape[0] * rgb.shape[1])

    for n, (sl, member) in enumerate(boxes, start=1):
        sprite = cut(img, sl, rgb, member)
        path = out_dir / f'{stem}-{n:02d}.png'
        sprite.save(path)
        print(f'{path.name}  {sprite.width}x{sprite.height}')

    print(f'{len(boxes)} sprites from {sheet.name}')


if __name__ == '__main__':
    main(Path(sys.argv[1]), Path(sys.argv[2]))

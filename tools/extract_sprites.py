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
        area = (sl[0].stop - sl[0].start) * (sl[1].stop - sl[1].start)
        member = labels == i
        # Two drawings bridged by a whisker fill very little of their shared box.
        if filled / area < 0.22:
            boxes.extend((sub_sl, member) for sub_sl in _split(member, sl))
        else:
            boxes.append((sl, member))

    boxes.sort(key=lambda b: (round(b[0][0].start / 60), b[0][1].start))
    return boxes


def _split(mask: np.ndarray, sl) -> list[tuple[slice, slice]]:
    """Cut a merged blob at its emptiest row or column."""
    sub = mask[sl]
    rows = sub.sum(axis=1)
    cols = sub.sum(axis=0)
    # Prefer whichever axis has a clear gap nearer its middle.
    best = None
    for axis, profile in ((0, rows), (1, cols)):
        mid = len(profile) // 2
        window = range(int(len(profile) * 0.25), int(len(profile) * 0.75))
        if not window:
            continue
        cut = min(window, key=lambda i: (profile[i], abs(i - mid)))
        if profile[cut] <= profile.max() * 0.05:
            score = abs(cut - mid)
            if best is None or score < best[0]:
                best = (score, axis, cut)
    if best is None:
        return [sl]

    _, axis, cut = best
    ys, xs = sl
    if axis == 0:
        return [(slice(ys.start, ys.start + cut), xs),
                (slice(ys.start + cut, ys.stop), xs)]
    return [(ys, slice(xs.start, xs.start + cut)),
            (ys, slice(xs.start + cut, xs.stop))]


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

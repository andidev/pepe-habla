"""
Build the launch splash image: the app's name above Pepe.

Two screens show this image one after the other. The native splash draws it
before any JavaScript runs; the JS splash in components/Welcome.tsx then draws
the same file in the same place and fades a greeting in underneath. Because it
is one image, the handover cannot shift or flicker -- which is also why the
name is baked in here rather than set as text: the native splash has no text,
and live text would render differently from a picture of it anyway.

iOS fits the image into an imageWidth-sized square centred on the screen, so
the image is square and everything is laid out inside it, centred as a group.
imageWidth is read from app.json, the one number both screens size from, and
the image is drawn at 3x it so the name stays sharp on a 3x screen.

Usage:  uv run --with pillow python tools/make_splash.py
        (after npm install, which provides the fonts)
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

APP = Path('apps/app')
POSE = APP / 'assets/pepe/pepe-happy.png'
OUT = APP / 'assets/splash.png'
FONTS = Path('node_modules/@expo-google-fonts')
TITLE_FONT = FONTS / 'fraunces/900Black/Fraunces_900Black.ttf'

SCALE = 3
INK = (0x1C, 0x17, 0x14)        # colour.ink from theme.ts
CHILE = (0xD1, 0x45, 0x3B)      # colour.chile

# In points. Pepe is drawn at the size the rest of the app uses for him.
TITLE_SIZE = 44
GAP = 16
PEPE_W, PEPE_H = 160, 220

# The name, as (word, colour). "Habla" in chile echoes the ¡Vamos! button and
# keeps the title from competing with the black greeting beneath Pepe.
TITLE = [('Pepe', INK), ('Habla', CHILE)]


def image_width() -> int:
    config = json.loads((APP / 'app.json').read_text())
    for plugin in config['expo']['plugins']:
        if isinstance(plugin, list) and plugin[0] == 'expo-splash-screen':
            return plugin[1]['imageWidth']
    sys.exit('app.json has no expo-splash-screen plugin')


def main() -> None:
    for path in (POSE, TITLE_FONT):
        if not path.exists():
            sys.exit(f'missing {path} (fonts come from npm install)')

    side = image_width() * SCALE
    font = ImageFont.truetype(str(TITLE_FONT), TITLE_SIZE * SCALE)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    # Lay the title out by its ink, not its line box, so the gap to Pepe is
    # the gap you see.
    text = ' '.join(word for word, _ in TITLE)
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    title_w, title_h = right - left, bottom - top
    group_h = title_h + (GAP + PEPE_H) * SCALE
    if title_w > side or group_h > side:
        sys.exit(f'title and Pepe need {title_w}x{group_h}px but imageWidth '
                 f'only gives {side}px; raise imageWidth in app.json')

    y = (side - group_h) // 2
    x = (side - title_w) // 2 - left
    for word, colour in TITLE:
        draw.text((x, y - top), word, font=font, fill=colour)
        x += draw.textlength(word + ' ', font=font)

    pepe = Image.open(POSE).convert('RGBA').resize(
        (PEPE_W * SCALE, PEPE_H * SCALE), Image.LANCZOS)
    canvas.alpha_composite(pepe, ((side - pepe.width) // 2, y + title_h + GAP * SCALE))

    canvas.save(OUT)
    print(f'wrote {OUT} ({side}x{side}, {side // SCALE}pt at {SCALE}x)')


if __name__ == '__main__':
    main()

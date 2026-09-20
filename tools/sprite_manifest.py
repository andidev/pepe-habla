"""
Name the extracted sprites and write the manifest the app reads.

Extraction produces numbered crops; this maps the ones we use to roles and to
vocabulary ids. Edit POSES and VOCAB after looking at the contact sheet — the
numbers change whenever extraction is retuned.

Usage:  python tools/sprite_manifest.py
"""
import json
import shutil
from pathlib import Path

SRC = Path('images/sprites')
OUT = Path('apps/app/assets/pepe')

# Emotional states. These drive the mascot; every one is required.
POSES = {
    'idle':     '9e3fbdef-02',
    'happy':    '9e3fbdef-01',
    'sad':      '5f7d7642-04',
    'excited':  '5f7d7642-02',
    'sleeping': '9e3fbdef-03',
    'hero':     '9e3fbdef-04',
}

# Costume drawings that illustrate a word. Keys are word ids from data/seed.
VOCAB = {
    'el-taco':      '5f7d7642-03',
    'la-guitarra':  '5f7d7642-01',
    'cocinar':      '0396b7e7-01',
    'el-sombrero':  '5f7d7642-18',
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {'poses': {}, 'vocab': {}}
    missing = []

    for role, stem in POSES.items():
        src = SRC / f'{stem}.png'
        if not src.exists():
            missing.append(f'pose {role} -> {stem}')
            continue
        name = f'pepe-{role}.png'
        shutil.copy(src, OUT / name)
        manifest['poses'][role] = name

    for word_id, stem in VOCAB.items():
        src = SRC / f'{stem}.png'
        if not src.exists():
            missing.append(f'vocab {word_id} -> {stem}')
            continue
        name = f'vocab-{word_id}.png'
        shutil.copy(src, OUT / name)
        manifest['vocab'][word_id] = name

    if missing:
        raise SystemExit('Missing sprites:\n  ' + '\n  '.join(missing))

    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'{len(manifest["poses"])} poses, {len(manifest["vocab"])} vocab sprites')


if __name__ == '__main__':
    main()

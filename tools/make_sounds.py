"""
Synthesise the app's sound effects.

Generating rather than sourcing them means no licensing to track, no binaries
arriving from anywhere, and the tone is a parameter we can tune instead of a
file we are stuck with. Standard library only, so it runs anywhere.

The design brief: short, warm, and never punishing. A wrong answer gets a soft
descending "donk", not a buzzer — this is a thing you are meant to do daily,
and a harsh failure sound is the fastest way to make someone stop.

Usage:  python tools/make_sounds.py apps/assets/audio/
"""
import array
import math
import sys
import wave
from pathlib import Path

RATE = 22050


def tone(freq, seconds, *, gain=0.5, harmonic=0.0, decay=5.0, attack=0.006):
    """One note: sine plus an optional octave, exponential decay, soft attack."""
    out = []
    n = int(RATE * seconds)
    for i in range(n):
        t = i / RATE
        env = math.exp(-decay * t)
        if t < attack:
            env *= t / attack                       # no click on the leading edge
        v = math.sin(2 * math.pi * freq * t)
        if harmonic:
            v += harmonic * math.sin(4 * math.pi * freq * t)
        out.append(v * env * gain / (1 + harmonic))
    return out


def sequence(notes, overlap=0.4):
    """Lay notes end to end, each starting slightly before the last one ends."""
    buf = []
    pos = 0
    for samples in notes:
        end = pos + len(samples)
        if end > len(buf):
            buf.extend([0.0] * (end - len(buf)))
        for i, v in enumerate(samples):
            buf[pos + i] += v
        pos += int(len(samples) * (1 - overlap))
    return buf


def write(path, samples):
    peak = max(abs(v) for v in samples) or 1.0
    scaled = array.array('h', (int(max(-1.0, min(1.0, v / peak * 0.85)) * 32767) for v in samples))
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(scaled.tobytes())
    print(f'{path.name}  {len(samples)/RATE:.2f}s')


# Equal temperament, A4 = 440.
def note(name):
    names = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    step = names[name[0]] + (12 * (int(name[-1]) - 4))
    return 440.0 * (2 ** (step / 12))


def main(out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)

    # Right: a bright rising third. Sparkle from the octave harmonic.
    write(out_dir / 'correct.wav', sequence([
        tone(note('E5'), 0.16, harmonic=0.3, decay=9),
        tone(note('A5'), 0.30, harmonic=0.35, decay=6),
    ]))

    # Wrong: soft, low, falling. Muted on purpose — no harmonic, slow decay.
    write(out_dir / 'wrong.wav', sequence([
        tone(note('G3'), 0.16, gain=0.45, decay=7),
        tone(note('E3'), 0.34, gain=0.45, decay=5),
    ], overlap=0.25))

    # Round finished: a small major arpeggio.
    write(out_dir / 'complete.wav', sequence([
        tone(note('C5'), 0.13, harmonic=0.25, decay=10),
        tone(note('E5'), 0.13, harmonic=0.25, decay=10),
        tone(note('G5'), 0.13, harmonic=0.3, decay=9),
        tone(note('C6'), 0.40, harmonic=0.4, decay=5),
    ], overlap=0.45))

    # Streak milestone: the same climb with a turn at the top.
    write(out_dir / 'streak.wav', sequence([
        tone(note('C5'), 0.11, harmonic=0.3, decay=11),
        tone(note('G5'), 0.11, harmonic=0.3, decay=11),
        tone(note('C6'), 0.11, harmonic=0.35, decay=11),
        tone(note('E6'), 0.10, harmonic=0.4, decay=12),
        tone(note('C6'), 0.10, harmonic=0.4, decay=12),
        tone(note('E6'), 0.44, harmonic=0.45, decay=4.5),
    ], overlap=0.42))

    # Tap: barely there. Pairs with a light haptic, which does most of the work.
    write(out_dir / 'tap.wav', tone(1150, 0.035, gain=0.22, decay=45, attack=0.002))


if __name__ == '__main__':
    main(Path(sys.argv[1] if len(sys.argv) > 1 else 'apps/assets/audio'))

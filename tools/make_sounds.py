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



def _phase_tone(freq, seconds, harmonics, *, gain, vibrato, vib_hz, vib_from,
                attack, release, sustain_tilt):
    """Additive synthesis with a running phase, so vibrato does not click."""
    out = []
    n = int(RATE * seconds)
    phase = 0.0
    for i in range(n):
        t = i / RATE
        f = freq
        if vibrato and t > vib_from:
            f = freq * (1 + vibrato * math.sin(2 * math.pi * vib_hz * (t - vib_from)))
        phase += 2 * math.pi * f / RATE

        if t < attack:
            env = t / attack
        elif t > seconds - release:
            env = max(0.0, (seconds - t) / release)
        else:
            env = 1.0
        env *= sustain_tilt(t)

        v = 0.0
        for k, a in enumerate(harmonics, start=1):
            if f * k > RATE / 2:
                break
            v += a * math.sin(phase * k)
        out.append(v * env * gain / sum(harmonics))
    return out


def trumpet(freq, seconds, *, gain=0.5, vibrato=0.0):
    """Mariachi trumpet: strong odd and even harmonics, vibrato late in the note.

    Brass gets brighter as it gets louder, hence the rich harmonic series and
    the slight swell. The vibrato only starts after the attack, the way a player
    settles into a held note.
    """
    return _phase_tone(
        freq, seconds,
        [1.0, 0.72, 0.56, 0.42, 0.30, 0.21, 0.14, 0.09, 0.05],
        gain=gain, vibrato=vibrato, vib_hz=5.6, vib_from=0.14,
        attack=0.022, release=0.05,
        sustain_tilt=lambda t: 0.82 + 0.18 * min(1.0, t / 0.18))


def pluck(freq, seconds, *, gain=0.5, damp=0.9955, bright=0.5):
    """Karplus-Strong: a plucked string, for the vihuela strum."""
    import random
    rng = random.Random(int(freq * 100))
    n_buf = max(2, int(RATE / freq))
    buf = [rng.uniform(-1.0, 1.0) for _ in range(n_buf)]
    for _ in range(3):                                # take the edge off the pick
        buf = [(buf[i] + buf[(i + 1) % n_buf]) / 2 for i in range(n_buf)]

    out = []
    idx = 0
    total = int(RATE * seconds)
    for i in range(total):
        cur = buf[idx]
        nxt = buf[(idx + 1) % n_buf]
        buf[idx] = damp * (bright * cur + (1 - bright) * nxt)
        env = 1.0 if i < total - 400 else (total - i) / 400
        out.append(cur * gain * env)
        idx = (idx + 1) % n_buf
    return out


def strum(freqs, seconds, *, spread=0.016, gain=0.34):
    """A chord raked across the strings rather than hit all at once."""
    layers = [(i * spread, pluck(f, seconds - i * spread, gain=gain)) for i, f in enumerate(freqs)]
    return mix(layers)


def mix(layers):
    """Overlay (start_seconds, samples) pairs."""
    total = max(int(start * RATE) + len(sam) for start, sam in layers)
    buf = [0.0] * total
    for start, sam in layers:
        off = int(start * RATE)
        for i, v in enumerate(sam):
            buf[off + i] += v
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

    # Level up: two trumpets a third apart over a vihuela strum — the mariachi
    # signature is the parallel thirds, not the tune. Written for the app rather
    # than quoted from anywhere.
    G = [note('G3'), note('B3'), note('D4'), note('G4'), note('B4')]
    write(out_dir / 'levelup.wav', mix([
        (0.00, strum(G, 0.95)),
        (0.05, trumpet(note('G5'), 0.09)), (0.05, trumpet(note('E5'), 0.09, gain=0.38)),
        (0.16, trumpet(note('G5'), 0.09)), (0.16, trumpet(note('E5'), 0.09, gain=0.38)),
        (0.27, trumpet(note('B5'), 0.11)), (0.27, trumpet(note('G5'), 0.11, gain=0.38)),
        (0.41, strum(G, 0.62, gain=0.26)),
        (0.41, trumpet(note('D6'), 0.62, vibrato=0.011)),
        (0.41, trumpet(note('B5'), 0.62, gain=0.40, vibrato=0.011)),
    ]))

    # An alternative "correct": marimba instead of a plain chime. Marimba bars
    # ring a strong fourth harmonic, which is what makes them sound wooden.
    write(out_dir / 'correct-marimba.wav', mix([
        (0.00, _phase_tone(note('E5'), 0.30, [1.0, 0.0, 0.0, 0.55, 0.0, 0.0, 0.12],
                           gain=0.5, vibrato=0, vib_hz=0, vib_from=0,
                           attack=0.003, release=0.20,
                           sustain_tilt=lambda t: math.exp(-7 * t))),
        (0.075, _phase_tone(note('A5'), 0.42, [1.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.10],
                            gain=0.5, vibrato=0, vib_hz=0, vib_from=0,
                            attack=0.003, release=0.28,
                            sustain_tilt=lambda t: math.exp(-5.5 * t))),
    ]))


if __name__ == '__main__':
    main(Path(sys.argv[1] if len(sys.argv) > 1 else 'apps/assets/audio'))

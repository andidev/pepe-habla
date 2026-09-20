"""
Synthesise the app's sound effects, played by a small mariachi band.

Nothing here is sampled or sourced. Each instrument is modelled well enough to
be recognisable, which means no licensing to track and every sound is a
parameter we can retune rather than a file we are stuck with.

The band:

  vihuela    a small round-backed 5-string guitar, strummed. Karplus-Strong.
  guitarrón  the big acoustic bass of a mariachi group. Same model, low and damped.
  trompeta   two trumpets a third apart — the parallel thirds are what actually
             make a phrase read as mariachi, more than any particular tune.
  marimba    Chiapas and Oaxaca. A struck wooden bar rings a strong fourth
             harmonic, and that is what makes it sound like wood.
  maracas    filtered noise with a fast decay.

Everything sits in A major, a common mariachi key, so the whole app shares one
tonal home instead of each sound arriving from somewhere else.

The brief: short, warm, never punishing. A wrong answer gets a soft descending
guitarrón, not a buzzer — this is meant to be a daily habit, and a harsh failure
sound is the quickest way to make someone stop opening the app.

Usage:  python tools/make_sounds.py apps/assets/audio/
"""
import array
import math
import random
import sys
import wave
from pathlib import Path

RATE = 22050


# --------------------------------------------------------------------------
# pitch

def note(name):
    """'A4' -> 440.0. Handles sharps: 'C#5'."""
    semitones = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    sharp = 1 if name[1:2] == '#' else 0
    octave = int(name[1 + sharp:])
    step = semitones[name[0]] + sharp + 12 * (octave - 4)
    return 440.0 * (2 ** (step / 12))


# --------------------------------------------------------------------------
# instruments

def _additive(freq, seconds, harmonics, *, gain, decay, attack,
              vibrato=0.0, vib_hz=5.6, vib_from=0.14, swell=False):
    """Additive synthesis over a running phase, so vibrato never clicks."""
    out = []
    phase = 0.0
    n = int(RATE * seconds)
    total = sum(harmonics) or 1.0
    for i in range(n):
        t = i / RATE
        f = freq * (1 + vibrato * math.sin(2 * math.pi * vib_hz * (t - vib_from))) \
            if (vibrato and t > vib_from) else freq
        phase += 2 * math.pi * f / RATE

        env = math.exp(-decay * t) if decay else 1.0
        if t < attack:
            env *= t / attack
        if t > seconds - 0.04:
            env *= max(0.0, (seconds - t) / 0.04)
        if swell:
            env *= 0.82 + 0.18 * min(1.0, t / 0.18)

        v = 0.0
        for k, a in enumerate(harmonics, start=1):
            if f * k > RATE / 2:
                break
            v += a * math.sin(phase * k)
        out.append(v * env * gain / total)
    return out


def trumpet(freq, seconds, *, gain=0.5, vibrato=0.0):
    """Brass: dense harmonics, a slight swell, vibrato only once the note settles."""
    return _additive(freq, seconds,
                     [1.0, 0.72, 0.56, 0.42, 0.30, 0.21, 0.14, 0.09, 0.05],
                     gain=gain, decay=0.0, attack=0.022,
                     vibrato=vibrato, swell=True)


def marimba(freq, seconds, *, gain=0.5, decay=6.5):
    """A struck wooden bar: fundamental plus a strong fourth harmonic."""
    return _additive(freq, seconds, [1.0, 0.0, 0.0, 0.55, 0.0, 0.0, 0.13],
                     gain=gain, decay=decay, attack=0.003)


def _string(freq, seconds, *, gain, damp, bright, smooth):
    """Karplus-Strong plucked string."""
    rng = random.Random(int(freq * 100))
    size = max(2, int(RATE / freq))
    buf = [rng.uniform(-1.0, 1.0) for _ in range(size)]
    for _ in range(smooth):                       # soften the pick attack
        buf = [(buf[i] + buf[(i + 1) % size]) / 2 for i in range(size)]

    out = []
    total = int(RATE * seconds)
    tail = min(500, total)
    idx = 0
    for i in range(total):
        cur = buf[idx]
        buf[idx] = damp * (bright * cur + (1 - bright) * buf[(idx + 1) % size])
        env = 1.0 if i < total - tail else (total - i) / tail
        out.append(cur * gain * env)
        idx = (idx + 1) % size
    return out


def vihuela(freq, seconds, *, gain=0.34):
    return _string(freq, seconds, gain=gain, damp=0.9955, bright=0.5, smooth=3)


def guitarron(freq, seconds, *, gain=0.75):
    """Low and quickly damped — a mariachi bass is plucked, not sustained."""
    return _string(freq, seconds, gain=gain, damp=0.9925, bright=0.62, smooth=6)


def maraca(seconds=0.085, *, gain=0.20):
    """Filtered noise. Differencing the samples tilts it bright, like a shaker."""
    rng = random.Random(7)
    prev = 0.0
    out = []
    n = int(RATE * seconds)
    for i in range(n):
        t = i / RATE
        s = rng.uniform(-1.0, 1.0)
        bright = s - prev
        prev = s
        env = math.exp(-42 * t) * min(1.0, t / 0.004)
        out.append(bright * env * gain)
    return out


def strum(freqs, seconds, *, spread=0.016, gain=0.34, instrument=vihuela):
    """A chord raked across the strings rather than hit all at once."""
    return mix([(i * spread, instrument(f, seconds - i * spread, gain=gain))
                for i, f in enumerate(freqs)])


# --------------------------------------------------------------------------
# arrangement

def mix(layers):
    """Overlay (start_seconds, samples) pairs."""
    total = max(int(start * RATE) + len(s) for start, s in layers)
    buf = [0.0] * total
    for start, samples in layers:
        off = int(start * RATE)
        for i, v in enumerate(samples):
            buf[off + i] += v
    return buf


def write(path, samples):
    peak = max(abs(v) for v in samples) or 1.0
    scaled = array.array('h', (int(max(-1.0, min(1.0, v / peak * 0.85)) * 32767)
                               for v in samples))
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(scaled.tobytes())
    print(f'{path.name:16} {len(samples)/RATE:.2f}s')


# --------------------------------------------------------------------------

A_MAJOR = ['A2', 'E3', 'A3', 'C#4', 'E4']       # vihuela voicing
D_MAJOR = ['D3', 'A3', 'D4', 'F#4', 'A4']


def main(out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    n = note

    # Tap — one damped nylon string, barely there. The haptic does the work.
    write(out_dir / 'tap.wav', vihuela(n('A5'), 0.055, gain=0.30))

    # Right — marimba rising a fourth onto the tonic, over a soft vihuela chord.
    write(out_dir / 'correct.wav', mix([
        (0.000, strum([n(x) for x in A_MAJOR], 0.40, gain=0.10, spread=0.010)),
        (0.000, marimba(n('E5'), 0.30, decay=7.5)),
        (0.075, marimba(n('A5'), 0.42, decay=5.5)),
    ]))

    # Wrong — guitarrón falling a fifth. Low, warm and brief: a shrug, not a buzzer.
    write(out_dir / 'wrong.wav', mix([
        (0.000, guitarron(n('A2'), 0.26, gain=0.70)),
        (0.130, guitarron(n('E2'), 0.42, gain=0.70)),
        (0.130, marimba(n('E3'), 0.30, gain=0.16, decay=9)),
    ]))

    # Round finished — marimba arpeggio, one shake, vihuela underneath.
    write(out_dir / 'complete.wav', mix([
        (0.000, strum([n(x) for x in A_MAJOR], 0.62, gain=0.13)),
        (0.000, marimba(n('A4'), 0.20, decay=9)),
        (0.090, marimba(n('C#5'), 0.20, decay=9)),
        (0.180, marimba(n('E5'), 0.20, decay=9)),
        (0.270, marimba(n('A5'), 0.52, decay=4.5)),
        (0.270, maraca()),
        (0.000, guitarron(n('A2'), 0.40, gain=0.42)),
    ]))

    # Streak — the same climb, carried further, with a trumpet landing on top.
    write(out_dir / 'streak.wav', mix([
        (0.000, strum([n(x) for x in A_MAJOR], 0.80, gain=0.13)),
        (0.000, guitarron(n('A2'), 0.34, gain=0.45)),
        (0.000, marimba(n('A4'), 0.16, decay=10)),
        (0.080, marimba(n('C#5'), 0.16, decay=10)),
        (0.160, marimba(n('E5'), 0.16, decay=10)),
        (0.240, marimba(n('A5'), 0.16, decay=10)),
        (0.320, marimba(n('C#6'), 0.46, decay=4.5)),
        (0.240, maraca()), (0.400, maraca(gain=0.14)),
        (0.330, trumpet(n('A5'), 0.44, gain=0.30, vibrato=0.010)),
        (0.400, guitarron(n('E3'), 0.44, gain=0.36)),
    ]))

    # Level up — the whole band. Two trumpets a third apart, three staccato hits
    # and a leap to a held high note. Written for the app, not quoted from a tune.
    chord = [n(x) for x in A_MAJOR]
    write(out_dir / 'levelup.wav', mix([
        (0.000, strum(chord, 1.05, gain=0.26)),
        (0.000, guitarron(n('A2'), 0.42, gain=0.80)),
        (0.000, maraca(gain=0.16)),
        (0.050, trumpet(n('A5'), 0.09)),  (0.050, trumpet(n('F#5'), 0.09, gain=0.38)),
        (0.160, trumpet(n('A5'), 0.09)),  (0.160, trumpet(n('F#5'), 0.09, gain=0.38)),
        (0.270, trumpet(n('C#6'), 0.11)), (0.270, trumpet(n('A5'), 0.11, gain=0.38)),
        (0.270, maraca(gain=0.13)),
        (0.410, strum(chord, 0.66, gain=0.20)),
        (0.410, guitarron(n('E3'), 0.30, gain=0.60)),
        (0.410, trumpet(n('E6'), 0.66, vibrato=0.011)),
        (0.410, trumpet(n('C#6'), 0.66, gain=0.40, vibrato=0.011)),
        (0.700, guitarron(n('A2'), 0.38, gain=0.55)),
        (0.700, maraca(gain=0.13)),
    ]))


if __name__ == '__main__':
    main(Path(sys.argv[1] if len(sys.argv) > 1 else 'apps/assets/audio'))

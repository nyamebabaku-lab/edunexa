# Original background music (highlife-flavoured, 104 BPM, D major) and a transition whoosh.
# Everything is synthesised here, so there are no rights issues.
import sys, wave, numpy as np
SR = 44100
rng = np.random.default_rng(7)
BPM = 104
BEAT = 60 / BPM
BAR = 4 * BEAT
E8 = BEAT / 2
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def t_(d): return np.arange(int(d * SR)) / SR

def pluck(m, d=0.9, amp=1.0):
    t = t_(d); f = hz(m); s = np.zeros_like(t)
    for k in range(1, 9):
        s += np.sin(2 * np.pi * f * k * t) * (0.9 ** k) * np.exp(-t * (3 + k * 2.2)) / k
    att = np.minimum(1, t / 0.004)
    return s * att * amp

def marimba(m, d=0.7, amp=1.0):
    t = t_(d); f = hz(m)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 5) + 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 18)
    return s * np.minimum(1, t / 0.003) * amp

def bass(m, d=0.5, amp=1.0):
    t = t_(d); f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    env = np.minimum(1, t / 0.008) * np.exp(-t * 3.2)
    return np.tanh(1.6 * s * env) * amp

def pad(notes, d, amp=1.0):
    t = t_(d); L = np.zeros_like(t); R = np.zeros_like(t)
    for m in notes:
        f = hz(m)
        L += np.sin(2 * np.pi * f * 0.998 * t) + 0.2 * np.sin(2 * np.pi * 2 * f * t)
        R += np.sin(2 * np.pi * f * 1.002 * t) + 0.2 * np.sin(2 * np.pi * 2 * f * t)
    env = np.minimum(1, t / 0.45) * np.minimum(1, (d - t) / 0.5)
    return np.stack([L, R]) * env * amp / len(notes)

def kick(amp=1.0):
    t = t_(0.35); f = 50 + 70 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11) * amp

def shaker(amp=1.0, d=0.07):
    t = t_(d); n = rng.standard_normal(len(t)); n = np.diff(n, prepend=0)
    return n * np.exp(-t * 60) * amp

def bell(m, amp=1.0):
    t = t_(0.5); f = hz(m); s = 0
    for r, a in [(1, 1), (2.76, 0.5), (5.4, 0.25)]:
        s = s + a * np.sin(2 * np.pi * f * r * t)
    return s * np.exp(-t * 14) * amp

CH = {  # chord: (root midi for bass, triad for pad/guitar)
    'D': (38, [62, 66, 69]), 'Bm': (35, [59, 62, 66]), 'G': (31, [59, 62, 67]),
    'A': (33, [61, 64, 69]), 'F#m': (30, [61, 66, 69]), 'Em': (28, [59, 64, 67]),
}
PROG_A = ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'Em', 'A']
PROG_B = ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D']
GUIT = [None, 0, 1, None, 2, 1, 0, 2]          # eighth-note highlife figure (index into triad, +12)
BELL = [1, 0, 1, 0, 1, 1, 0, 1]
LEAD = {  # pentatonic answers over section B
    0: [(0, 74), (1.5, 76), (2, 78), (3, 76)], 2: [(0, 73), (1, 76), (2.5, 78), (3, 81)],
    4: [(0, 79), (1.5, 78), (2, 76), (3, 74)], 6: [(0, 76), (1, 74), (2, 71), (3, 74)],
}

def section(prog, lead=False, guitar=True, drums=True):
    n = int(len(prog) * BAR * SR) + SR * 2
    out = np.zeros((2, n))
    def put(sig, at, pan=0.0):
        i = int(at * SR)
        if sig.ndim == 1:
            sig = np.stack([sig * (1 - pan) ** 0.5, sig * (1 + pan) ** 0.5]) / 1.414 * 1.414 / 1.414
        j = min(n, i + sig.shape[1]); out[:, i:j] += sig[:, : j - i]
    for b, name in enumerate(prog):
        t0 = b * BAR; root, tri = CH[name]
        put(pad([m - 12 for m in tri] + [tri[0]], BAR + 0.5, 0.16), t0)
        for at, iv in [(0, 0), (1.5, 7), (2, 0), (3.5, 7)]:
            put(bass(root + iv, 0.55, 0.42), t0 + at * BEAT)
        if guitar:
            for k, g in enumerate(GUIT):
                if g is not None:
                    put(pluck(tri[g] + 12, 0.8, 0.13 if k % 2 else 0.09), t0 + k * E8 + rng.uniform(0, 0.008), 0.35)
        if drums:
            put(kick(0.5), t0); put(kick(0.38), t0 + 2 * BEAT)
            for k in range(16):
                put(shaker(0.05 if k % 2 else 0.025), t0 + k * BEAT / 4, -0.2)
            for k, h in enumerate(BELL):
                if h: put(bell(84 if k % 4 else 81, 0.05), t0 + k * E8, -0.45)
        if lead and b in LEAD:
            for at, m in LEAD[b]:
                put(marimba(m, 0.8, 0.16), t0 + at * BEAT, 0.15)
    return out

def reverb(x, secs=1.2, mix=0.22):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-t * 4.5); ir[:, 0] = 0
    L = x.shape[1] + n; N = 1 << (L - 1).bit_length()
    wet = np.real(np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N))[:, : x.shape[1]]
    wet /= np.max(np.abs(wet)) + 1e-9
    return x + mix * wet * np.max(np.abs(x))

def write(path, x):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
    pcm = (x.T * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

total = float(sys.argv[1]); dest = sys.argv[2]
blocks = [section(PROG_A, guitar=False, drums=False)]   # gentle opening
i = 0
while sum(b.shape[1] - 2 * SR for b in blocks) < (total + 4) * SR:
    blocks.append(section(PROG_A, guitar=True, drums=True, lead=False))
    blocks.append(section(PROG_B, guitar=i % 2 == 0, drums=True, lead=True))
    i += 1
n = sum(b.shape[1] - 2 * SR for b in blocks) + 2 * SR
song = np.zeros((2, n)); pos = 0
for b in blocks:
    song[:, pos: pos + b.shape[1]] += b; pos += b.shape[1] - 2 * SR
song = song[:, : int((total + 0.5) * SR)]
song = reverb(song)
fade_in = np.minimum(1, np.arange(song.shape[1]) / (2.5 * SR))
fade_out = np.clip((song.shape[1] - np.arange(song.shape[1])) / (5 * SR), 0, 1)
write(dest, song * fade_in * fade_out)

# Whoosh for scene transitions: noise through a sweeping one-pole low-pass.
d = 0.9; t = t_(d); nz = rng.standard_normal((2, len(t)))
cut = 300 + 5000 * np.sin(np.pi * t / d) ** 2
a = np.exp(-2 * np.pi * cut / SR); y = np.zeros_like(nz); s = np.zeros(2)
for k in range(len(t)):
    s = (1 - a[k]) * nz[:, k] + a[k] * s; y[:, k] = s
y *= np.sin(np.pi * t / d) ** 1.5
y[0] *= np.linspace(1.2, 0.6, len(t)); y[1] *= np.linspace(0.6, 1.2, len(t))
write(dest.replace('.wav', '-whoosh.wav'), y)
print('ok', song.shape[1] / SR)
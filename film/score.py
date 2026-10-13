# Original score + sound design + final mix for the STOCKBACK film. Everything is synthesized here.
#   .venv/bin/python score.py   -> audio/mix.wav
import json, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly

here = os.path.dirname(os.path.abspath(__file__))
SR = 48000
TL = json.load(open(f"{here}/timeline.json"))
DUR = TL["duration"]
N = int(DUR * SR)
rng = np.random.default_rng(7)

music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); vo = np.zeros((N, 2))
send_m = np.zeros((N, 2)); send_s = np.zeros((N, 2))  # reverb sends


def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def bp(lo, hi, x, order=2): return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)
def lp(f, x, order=2): return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)
def hp(f, x, order=2): return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def put(bus, t0, sig, gain=1.0, pan=0.0, send=None, sendamt=0.0):
    i = int(t0 * SR)
    if i >= N or i + len(sig) <= 0: return
    if i < 0: sig = sig[-i:]; i = 0
    sig = sig[: N - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    bus[i:i + len(sig), 0] += sig * l * 1.414; bus[i:i + len(sig), 1] += sig * r * 1.414
    if send is not None and sendamt:
        send[i:i + len(sig), 0] += sig * l * sendamt; send[i:i + len(sig), 1] += sig * r * sendamt


def env_adsr(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e

# ---------------------------------------------------------------- instruments
def koto(f, dur=2.2, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    bend = 1 + 0.004 * np.exp(-t * 25)
    for k in range(1, 11):
        a = (1 / k ** 1.05) * abs(np.sin(k * np.pi * 0.21)) + 0.02
        fk = f * k * np.sqrt(1 + 0.00035 * k * k)
        s += a * np.sin(2 * np.pi * fk * np.cumsum(bend) / SR) * np.exp(-t * (1.6 + 1.25 * k) * (f / 400) ** 0.3)
    s += 0.25 * hp(1500, rng.standard_normal(n)) * np.exp(-t * 180)
    s *= np.minimum(1, t / 0.002)
    return 0.35 * vel * s


def pad(freqs, dur, vel=1.0, bright=6.0, a=1.6, r=2.2):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        for det in (-0.006, 0.0, 0.0065):
            ph = rng.uniform(0, 2 * np.pi)
            for k in range(1, 14):
                s += (1 / k) * np.exp(-k / bright) * np.sin(2 * np.pi * f * (1 + det) * k * t + ph * k)
    s *= (1 + 0.08 * np.sin(2 * np.pi * 0.21 * t)) * env_adsr(n, a, r)
    return 0.05 * vel * s / max(1, len(freqs))


def taiko(vel=1.0, big=False):
    dur = 2.4 if big else 1.2
    n = int(dur * SR); t = np.arange(n) / SR
    f = 52 + 95 * np.exp(-t * 22)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (2.2 if big else 4.2))
    sub = (np.sin(2 * np.pi * 38 * t) * np.exp(-t * 2.0)) if big else 0
    skin = lp(1400, rng.standard_normal(n)) * np.exp(-t * 55) * 0.5
    return vel * (body + 0.8 * sub + skin) * 0.9


def stamp(vel=1.0):
    n = int(0.5 * SR); t = np.arange(n) / SR
    thud = np.sin(2 * np.pi * np.cumsum(60 + 70 * np.exp(-t * 40)) / SR) * np.exp(-t * 14)
    slap = bp(300, 2600, rng.standard_normal(n)) * np.exp(-t * 70) * 0.8
    click = np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 900) * 0.3
    return vel * (thud + slap + click) * 0.8


def whoosh(dur=0.9, up=True, vel=1.0, lo=300, hi=5000):
    n = int(dur * SR); x = rng.standard_normal(n); out = np.zeros(n)
    chunks = 32; L = n // chunks; win = np.hanning(2 * L)
    for c in range(chunks):
        u = c / (chunks - 1); u = u if up else 1 - u
        fc = lo * (hi / lo) ** u
        a = max(0, c * L - L // 2); b = min(n, a + len(win))
        seg = bp(max(40, fc * 0.6), min(SR / 2 - 100, fc * 1.6), x[a:b]) * win[: b - a]
        out[a:b] += seg
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return vel * out * e * 0.5


def riser(dur=2.0, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
    noise = hp(800, rng.standard_normal(n)) * u ** 3
    tone = np.sin(2 * np.pi * np.cumsum(200 * (8 ** u)) / SR) * u ** 2 * 0.3
    return vel * (noise * 0.35 + tone) * 0.8


def bell(f, dur=2.5, vel=1.0, ratio=3.5):
    n = int(dur * SR); t = np.arange(n) / SR
    idx = 3.0 * np.exp(-t * 5)
    return vel * 0.3 * np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * ratio * t)) * np.exp(-t * 1.6) * np.minimum(1, t / 0.003)


def click(vel=1.0):
    n = int(0.05 * SR); t = np.arange(n) / SR
    return vel * 0.35 * (np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 260) + 0.5 * np.sin(2 * np.pi * 3100 * t) * np.exp(-t * 400))


def tick(vel=1.0, f=3600):
    n = int(0.02 * SR); t = np.arange(n) / SR
    return vel * 0.25 * np.sin(2 * np.pi * f * t) * np.exp(-t * 600)


def glitch(dur=0.55, vel=1.0):
    n = int(dur * SR); out = np.zeros(n); i = 0
    while i < n:
        L = int(rng.uniform(0.01, 0.05) * SR); f = rng.choice([180, 320, 760, 1400, 2900, 5200])
        t = np.arange(min(L, n - i)) / SR
        out[i:i + len(t)] = np.sign(np.sin(2 * np.pi * f * t)) * rng.uniform(0.2, 0.7)
        i += L + int(rng.uniform(0, 0.02) * SR)
    out = np.round(out * 6) / 6
    return vel * 0.22 * out


def crack(vel=1.0):
    n = int(0.9 * SR); t = np.arange(n) / SR
    s = hp(2000, rng.standard_normal(n)) * np.exp(-t * 60) * 0.8
    for k in range(9):
        o = int(rng.uniform(0, 0.25) * SR); L = int(0.012 * SR)
        if o + L < n: s[o:o + L] += hp(3000, rng.standard_normal(L)) * rng.uniform(0.3, 0.9)
    thump = np.sin(2 * np.pi * np.cumsum(45 + 60 * np.exp(-t * 30)) / SR) * np.exp(-t * 6)
    return vel * (s + thump) * 0.8


def heartbeat(vel=1.0):
    n = int(0.6 * SR); t = np.arange(n) / SR
    beat = lambda d: np.sin(2 * np.pi * 55 * (t - d)) * np.exp(-np.clip(t - d, 0, None) * 18) * (t >= d)
    return vel * (beat(0) + 0.7 * beat(0.18)) * 0.9


def shimmer(dur=2.0, vel=1.0, density=40):
    n = int(dur * SR); out = np.zeros(n)
    for _ in range(int(density * dur)):
        o = int(rng.uniform(0, max(0.01, dur - 0.3)) * SR); L = min(int(0.25 * SR), n - o); t = np.arange(L) / SR
        f = rng.uniform(2200, 6500)
        out[o:o + L] += np.sin(2 * np.pi * f * t) * np.exp(-t * 18) * rng.uniform(0.1, 0.4)
    return vel * out * 0.25


def breath_lead(f, dur, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 0.5)
    ph = 2 * np.pi * f * np.cumsum(vib) / SR
    tone = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    br = bp(f * 1.5, f * 3.5, rng.standard_normal(n)) * 0.25
    e = env_adsr(n, 0.14, min(0.5, dur * 0.4))
    return vel * 0.16 * (tone + br) * e

# ---------------------------------------------------------------- scales
IN = [62, 63, 67, 69, 70]                 # D In (miyako-bushi): D Eb G A Bb
BR = [62, 64, 66, 69, 71]                 # D major pentatonic
def scale_note(sc, deg, octv=0):
    return sc[deg % 5] + 12 * (deg // 5 + octv)

# ================================================================ MUSIC
# 0.75–13: dark drone + sparse koto + heartbeat
put(music, 0.75, pad([mtof(38), mtof(45), mtof(51)], 12.6, vel=1.6, bright=3, a=3.0, r=1.5), send=send_m, sendamt=0.4)
for t0, d in [(2.4, 0), (3.1, 2), (6.3, 3), (7.0, 1), (8.2, 4), (10.2, 2), (11.0, 0)]:
    put(music, t0, koto(mtof(scale_note(IN, d))), 0.8, pan=rng.uniform(-0.4, 0.4), send=send_m, sendamt=0.5)
for t0 in (9.6, 10.45, 11.3, 12.1): put(sfx, t0, heartbeat(), 0.9)

# 13–33.5: tension ostinato, 76 bpm eighths
bpm = 76; e8 = 60 / bpm / 2
pat = [0, 3, 4, 3, 0, 3, 2, 3]
for i, t0 in enumerate(np.arange(13.0, 33.4, e8)):
    deg = pat[i % 8] + (0 if (i // 16) % 2 == 0 else -1)
    put(music, t0, koto(mtof(scale_note(IN, deg, -1)), 1.2, 0.55 + 0.15 * (i % 2 == 0)), 0.55, pan=0.25 if i % 2 else -0.25, send=send_m, sendamt=0.3)
for t0 in np.arange(13.0, 33.4, e8 * 8): put(music, t0, taiko(0.5), 0.6, send=send_m, sendamt=0.35)
for t0, ch in [(13.0, [38, 45, 50]), (19.3, [34, 46, 50]), (25.6, [36, 43, 51]), (31.9, [38, 45, 50])]:
    put(music, t0, pad([mtof(n) for n in ch], 6.6, vel=1.2, bright=3.5, a=1.2, r=1.6), send=send_m, sendamt=0.4)
put(sfx, 33.4, riser(2.0, 1.0), 0.7)
put(music, 37.0, shimmer(2.3, 0.9), 0.8, send=send_m, sendamt=0.6)
put(sfx, 38.25, hp(4000, rng.standard_normal(int(1.0 * SR))) * np.linspace(0, 1, int(1.0 * SR)) ** 4 * 0.25, 0.8)

# 39.25: the turn. bright pentatonic, 90 bpm groove until the product
bpm2 = 90; b2 = 60 / bpm2
put(music, 39.25, pad([mtof(50), mtof(57), mtof(64), mtof(66)], 17.5, vel=1.6, bright=5, a=0.6, r=2.0), send=send_m, sendamt=0.45)
arp = [0, 2, 3, 4, 5, 4, 3, 2]
for i, t0 in enumerate(np.arange(41.0, 56.8, b2 / 2)):
    put(music, t0, koto(mtof(scale_note(BR, arp[i % 8], 0)), 1.4, 0.6), 0.55, pan=0.3 if i % 2 else -0.3, send=send_m, sendamt=0.35)
for i, t0 in enumerate(np.arange(41.0, 56.8, b2)):
    put(music, t0, taiko(0.55 if i % 2 == 0 else 0.3), 0.55, send=send_m, sendamt=0.3)
    put(music, t0 + b2 / 2, bp(5000, 11000, rng.standard_normal(int(0.06 * SR))) * np.exp(-np.arange(int(0.06 * SR)) / SR * 70) * 0.18, 1.0, pan=0.4)
for t0, m, d in [(44.0, 76, 1.2), (45.3, 74, 0.8), (46.2, 71, 1.6), (48.0, 69, 1.0), (49.1, 71, 0.8), (50.0, 74, 2.0)]:
    put(music, t0, breath_lead(mtof(m), d), 0.9, send=send_m, sendamt=0.6)

# 56–104: product bed (light, ducked)
prog = [[50, 57, 62, 66], [47, 54, 62, 66], [43, 50, 59, 62], [45, 52, 61, 64]]  # D, Bm, G, A
bar = b2 * 4
for i, t0 in enumerate(np.arange(56.0, 103.6, bar * 2)):
    put(music, t0, pad([mtof(n) for n in prog[i % 4]], bar * 2 + 1.5, vel=1.1, bright=4.5, a=1.0, r=1.5), send=send_m, sendamt=0.35)
for i, t0 in enumerate(np.arange(57.0, 103.4, b2 / 2)):
    deg = [0, 4, 2, 4][i % 4] + [0, -2, -1, 1][(i // 16) % 4]
    put(music, t0, koto(mtof(scale_note(BR, deg, 0)), 1.0, 0.35), 0.5, pan=0.35 if i % 2 else -0.35, send=send_m, sendamt=0.3)
for t0 in np.arange(57.0, 103.4, b2 * 2): put(music, t0, taiko(0.25), 0.5)

# 104–122: build for "under the hood"
for i, t0 in enumerate(np.arange(105.0, 117.0, b2 / 2)):
    put(music, t0, taiko(0.65 if i % 4 == 0 else 0.28), 0.6, send=send_m, sendamt=0.3)
for t0, ch in [(105.0, [47, 54, 59, 62]), (110.3, [43, 50, 59, 62]), (113.4, [45, 52, 57, 61])]:
    put(music, t0, pad([mtof(n) for n in ch], 5.6, vel=1.4, bright=6, a=0.4, r=1.2), send=send_m, sendamt=0.4)
put(sfx, 108.4, riser(1.9, 0.8), 0.6)
put(music, 117.0, pad([mtof(38), mtof(45)], 4.5, vel=1.3, bright=2.5, a=0.3, r=1.5), send=send_m, sendamt=0.5)

# 122–136: impact, warm and lifting
for i, (t0, ch) in enumerate(zip(np.arange(122.0, 136.0, bar), [[50, 57, 62, 66], [45, 52, 61, 64], [47, 54, 62, 66], [43, 50, 59, 62]] * 2)):
    put(music, t0, pad([mtof(n) for n in ch], bar + 1.2, vel=1.5, bright=6, a=0.5, r=1.2), send=send_m, sendamt=0.45)
for i, t0 in enumerate(np.arange(122.0, 135.6, b2 / 2)):
    put(music, t0, koto(mtof(scale_note(BR, [0, 2, 4, 5, 4, 2][i % 6], 0)), 1.2, 0.5), 0.5, pan=0.3 if i % 2 else -0.3, send=send_m, sendamt=0.3)
for i, t0 in enumerate(np.arange(122.0, 135.6, b2)): put(music, t0, taiko(0.5 if i % 2 == 0 else 0.25), 0.55, send=send_m, sendamt=0.3)

# 136–150: outro resolution and tail
put(music, 137.6, pad([mtof(50), mtof(57), mtof(62), mtof(64), mtof(66)], 11.5, vel=1.8, bright=6, a=0.2, r=5.0), send=send_m, sendamt=0.6)
for t0, m in [(141.6, 81), (142.2, 78), (142.8, 76), (143.4, 74), (144.4, 69), (145.6, 74)]:
    put(music, t0, koto(mtof(m), 3.0, 0.7), 0.7, pan=rng.uniform(-0.3, 0.3), send=send_m, sendamt=0.6)
put(music, 144.0, breath_lead(mtof(74), 3.6, 0.8), 0.8, send=send_m, sendamt=0.7)

# ================================================================ SOUND DESIGN
S = lambda t0, sig, g=1.0, pan=0.0, rv=0.25: put(sfx, t0, sig, g, pan, send_s, rv)
# hook
S(0.62, bell(1250, 0.4, 0.7, 2.1), 0.6); S(0.75, taiko(1.0, big=True), 1.0, rv=0.5); S(0.78, whoosh(1.0, False, 0.8, 200, 3000), 0.6)
S(1.35, whoosh(0.7, True, 0.6, 400, 4000), 0.5)
for i in range(9): S(1.6 + i * 0.13, tick(0.8, 2400 + i * 80), 0.7, pan=-0.2 + i * 0.05, rv=0.1)
S(4.4, glitch(0.55), 1.0, rv=0.1); S(5.0, whoosh(0.55, True, 0.5, 900, 6000), 0.5, pan=0.3)
S(9.0, whoosh(0.8, True, 0.6), 0.55)
S(12.3, whoosh(1.1, True, 1.0, 150, 2500), 0.9, rv=0.15)
# problem
S(13.2, shimmer(7.5, 0.6, 18), 0.5, rv=0.4)
for k in range(28):
    tt = 13.9 + 3.5 * (1 - (1 - k / 27) ** 2)
    S(tt, tick(0.7, 3000), 0.6, rv=0.05)
S(20.95, bell(2600, 1.2, 0.8, 1.41) + bell(3720, 1.2, 0.4, 1.41), 0.8, rv=0.4)
for i in range(4): S(21.95 + i * 0.25, whoosh(0.5, True, 0.5, 600, 3000), 0.45, pan=-0.3 + i * 0.2)
for i in range(15): S(25.5 + i * 0.07, click(0.6), 0.5, pan=-0.5 + (i % 5) * 0.25, rv=0.1)
for i in range(8): S(27.6 + i * 0.12, tick(0.5, 1200), 0.5, rv=0.1)
S(30.62, stamp(1.2), 1.0, rv=0.35); S(30.62, taiko(0.8), 0.7)
S(35.2, taiko(1.0, big=True), 0.9, rv=0.6)
# pain
S(39.25, taiko(1.2, big=True), 1.1, rv=0.6); S(39.25, stamp(1.3), 1.0, rv=0.4); S(39.3, whoosh(1.2, False, 0.8, 200, 3000), 0.6)
S(39.8, shimmer(1.4, 0.8, 30), 0.6, rv=0.5)
S(43.1, stamp(0.9), 0.85, pan=-0.45, rv=0.3)
S(45.6, bell(880, 2.5, 0.7, 3.5), 0.6, rv=0.5)
S(47.8, bell(1760, 1.5, 0.6, 1.41), 0.6, pan=0.45, rv=0.4); S(47.85, taiko(0.5), 0.5, pan=0.45)
for t0, p in [(44.7, -0.2), (47.1, 0.2)]: S(t0, whoosh(0.5, True, 0.5, 800, 5000), 0.45, pan=p)
for i, t0 in enumerate([51.6, 51.95, 52.3]): S(t0, whoosh(0.7, False, 0.6, 300, 4000), 0.55, pan=-0.4 + i * 0.4); S(t0 + 0.5, taiko(0.45), 0.5, pan=-0.4 + i * 0.4)
S(55.3, whoosh(1.3, True, 0.9, 150, 3000), 0.75)
# product: real cursor clicks and typing, mapped from the recording
take = json.load(open(f"{here}/rec/take.json"))
pr = TL["product"]
def film_of(rt):
    f = pr["start"]
    for r0, r1, sp in pr["remap"]:
        if r0 <= rt < r1: return f + (rt - r0) / sp
        f += (r1 - r0) / sp
    return None
for e in take["events"]:
    if e["type"] == "click":
        ft = film_of(e["t"] - take["t0"])
        if ft: S(ft, click(1.0), 0.75, pan=0.1, rv=0.08)
    if e["type"] == "type":
        a, b = e["t0"] - take["t0"], e["t1"] - take["t0"]
        for k in range(4):
            ft = film_of(a + (b - a) * k / 4)
            if ft: S(ft, tick(0.6, 1700 + k * 90), 0.6, rv=0.05)
done = film_of(25.86); rej = film_of(47.66)
S(done, stamp(0.9), 0.8, rv=0.3); S(done + 0.05, bell(1318.5, 2.2, 0.7, 3.5) + bell(1975.5, 2.2, 0.4, 3.5), 0.55, rv=0.5)
S(rej, taiko(0.6), 0.55); S(rej, tick(0.6, 300), 0.6)
for t0, *_ in pr["chapters"]: S(t0, whoosh(0.45, True, 0.35, 900, 4500), 0.35, pan=-0.6, rv=0.15)
S(103.5, whoosh(1.2, False, 0.8, 200, 3500), 0.6)
# tech
S(107.3, whoosh(2.6, True, 0.5, 200, 1500), 0.45, pan=-0.2)
S(110.3, taiko(1.1, big=True), 1.0, rv=0.5); S(110.3, stamp(0.9), 0.8, pan=0.4)
S(113.4, whoosh(1.6, True, 0.6, 200, 2000), 0.5)
S(114.6, glitch(0.35, 0.6), 0.6, pan=0.3); S(114.25, bell(1567.98, 1.5, 0.6, 3.5), 0.55, pan=-0.2, rv=0.4)
S(117.5, stamp(0.9), 0.85, pan=0.3, rv=0.3)
S(118.3, glitch(0.22, 0.6), 0.6, rv=0.1)
S(119.0, crack(1.2), 1.0, pan=0.3, rv=0.45); S(119.0, taiko(0.9, big=True), 0.8, rv=0.5)
S(121.4, whoosh(1.1, True, 1.0, 150, 2500), 0.8, rv=0.15)
# impact
S(122.0, whoosh(0.8, False, 0.5, 400, 3000), 0.4)
for t0, p in [(122.3, -0.4), (128.7, 0.4)]: S(t0, taiko(0.6), 0.55, pan=p)
for t0, p in [(123.4, -0.4), (125.7, -0.4), (126.5, -0.4), (129.3, 0.4), (130.6, 0.4), (132.4, 0.4)]:
    S(t0, stamp(0.55), 0.6, pan=p, rv=0.25); S(t0 + 0.04, bell(2093, 0.6, 0.35, 1.41), 0.35, pan=p)
S(135.3, whoosh(1.2, True, 0.7, 200, 3000), 0.6)
# outro
S(137.6, taiko(1.3, big=True), 1.1, rv=0.7); S(137.6, stamp(1.3), 1.0, rv=0.5)
S(138.1, shimmer(1.6, 0.8, 30), 0.6, rv=0.6)
for t0, m in [(140.0, 62), (140.45, 66), (140.9, 69)]: S(t0, koto(mtof(m + 12), 2.5, 0.9), 0.8, rv=0.5); S(t0, taiko(0.45), 0.45)

# ================================================================ VOICE
vd = json.load(open(f"{here}/audio/vo/durations.json"))
for lid, t0 in TL["vo"]:
    x, sr = sf.read(f"{here}/audio/vo/{lid}.wav")
    if x.ndim > 1: x = x.mean(axis=1)
    x = resample_poly(x, SR, sr)
    x = hp(80, x)
    put(vo, t0, x, 1.0, 0.0)

# ================================================================ MIX
def ir(dur=2.6, damp=3000):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for c in range(2):
        r = lp(damp, rng.standard_normal(n)) * np.exp(-t * 3.0 / dur * 2.3)
        r[: int(0.012 * SR)] = 0
        out[:, c] = r
    return out / np.abs(out).sum(axis=0).max() * 18

R = ir()
def reverb(x): return np.stack([fftconvolve(x[:, c], R[:, c])[:N] for c in range(2)], axis=1)

music_w = music + reverb(send_m) * 0.9
sfx_w = sfx + reverb(send_s) * 0.9
vo_w = vo + reverb(vo * 0.05) * 0.5

# sidechain duck from the voice
venv = np.abs(vo[:, 0])
k = int(0.12 * SR); venv = np.convolve(venv, np.ones(k) / k, mode="same")
duck = 1 - 0.62 * np.clip(venv / 0.035, 0, 1)
a_rel = np.exp(-1 / (0.35 * SR))
d = duck.copy()
for i in range(1, N):  # smooth release
    d[i] = min(duck[i], d[i - 1] * a_rel + duck[i] * (1 - a_rel)) if duck[i] > d[i - 1] else duck[i]
music_w *= d[:, None]; sfx_w *= (0.75 + 0.25 * d)[:, None]

def norm(x, peak): return x / (np.abs(x).max() + 1e-9) * peak
mix = norm(vo_w, 0.85) + norm(music_w, 0.42) + norm(sfx_w, 0.55)
# fade out tail
t = np.arange(N) / SR
mix *= np.clip((DUR - t) / 1.2, 0, 1)[:, None] ** 0.5
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
os.makedirs(f"{here}/audio", exist_ok=True)
sf.write(f"{here}/audio/mix_raw.wav", mix.astype(np.float32), SR, subtype="FLOAT")
sf.write(f"{here}/audio/stem_vo.wav", norm(vo_w, 0.9).astype(np.float32), SR, subtype="FLOAT")
sf.write(f"{here}/audio/stem_music.wav", norm(music_w, 0.9).astype(np.float32), SR, subtype="FLOAT")
sf.write(f"{here}/audio/stem_sfx.wav", norm(sfx_w, 0.9).astype(np.float32), SR, subtype="FLOAT")
print("mix written", mix.shape, "peak", float(np.abs(mix).max()))

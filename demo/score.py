# Original score + sound design + final mix for the Zen demo film. Everything is synthesized here.
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
IN = [62, 63, 67, 69, 70]                 # In scale: tension
BR = [62, 64, 66, 69, 71]                 # major pentatonic: drive
def scale_note(sc, deg, octv=0):
    return sc[deg % 5] + 12 * (deg // 5 + octv)

S = lambda t0, sig, g=1.0, pan=0.0, rv=0.25: put(sfx, t0, sig, g, pan, send_s, rv)
segs = TL["segments"]

# ================================================================ INTRO 0-6: dark, three slams, the seal
put(music, 0.0, pad([mtof(38), mtof(45), mtof(51)], 4.3, vel=1.5, bright=3, a=0.4, r=0.8), send=send_m, sendamt=0.4)
for i, t0 in enumerate([0.35, 1.55, 2.75]):
    S(t0, taiko(1.0, big=(i == 1)), 1.0, rv=0.4); S(t0, whoosh(0.35, False, 0.6, 400, 4000), 0.5)
    put(music, t0 + 0.05, koto(mtof(scale_note(IN, [0, 3, 1][i], 0)), 1.6, 0.8), 0.7, send=send_m, sendamt=0.5)
for t0 in (1.0, 2.2, 3.3): S(t0, heartbeat(0.8), 0.7)
S(3.2, riser(0.8, 1.0), 0.7)
S(4.0, taiko(1.3, big=True), 1.15, rv=0.6); S(4.0, stamp(1.3), 1.0, rv=0.4); S(4.05, shimmer(1.4, 0.9, 30), 0.6, rv=0.6)

# ================================================================ DRIVE: 100 bpm from the first product frame to the outro
bpm = 100; b = 60 / bpm
start = 5.9; end = [s for s in segs if s["kind"] == "outro"][0]["f0"]
prog = [[50, 57, 62, 66], [47, 54, 62, 66], [43, 50, 59, 62], [45, 52, 61, 64]]  # D Bm G A
bar = 4 * b
for i, t0 in enumerate(np.arange(start, end, bar * 2)):
    put(music, t0, pad([mtof(n) for n in prog[i % 4]], bar * 2 + 1.2, vel=1.25, bright=5, a=0.25, r=1.0), send=send_m, sendamt=0.35)
arp = [0, 2, 4, 5, 7, 5, 4, 2]
for i, t0 in enumerate(np.arange(start, end, b / 2)):
    put(music, t0, koto(mtof(scale_note(BR, arp[i % 8] + (0 if (i // 32) % 2 == 0 else 1), 0)), 1.0, 0.5), 0.55, pan=0.3 if i % 2 else -0.3, send=send_m, sendamt=0.25)
for i, t0 in enumerate(np.arange(start, end, b)):
    put(music, t0, taiko(0.7 if i % 4 == 0 else (0.45 if i % 2 == 0 else 0.25)), 0.6, send=send_m, sendamt=0.25)
    put(music, t0 + b / 2, bp(5000, 11000, rng.standard_normal(int(0.05 * SR))) * np.exp(-np.arange(int(0.05 * SR)) / SR * 80) * 0.22, 1.0, pan=0.35)

# ================================================================ SOUND DESIGN synced to the real take
for ft in TL["clicks"]: S(ft, click(1.0), 0.8, pan=0.1, rv=0.06)
for a, b2 in TL["typing"]:
    for k in range(4): S(a + (b2 - a) * k / 4, tick(0.6, 1700 + k * 90), 0.6, rv=0.05)
h = TL["hits"]
S(h["claimed"], stamp(1.0), 0.85, rv=0.3); S(h["claimed"] + 0.05, bell(1318.5, 2.0, 0.7, 3.5) + bell(1975.5, 2.0, 0.4, 3.5), 0.55, rv=0.5)
S(h["cashed"], bell(1760, 1.6, 0.7, 1.41), 0.6, rv=0.4); S(h["cashed"], shimmer(1.0, 0.7, 30), 0.45, rv=0.5)
S(h["voided"], crack(1.0), 0.85, pan=0.2, rv=0.4); S(h["voided"], taiko(0.9, big=True), 0.75, rv=0.5)
for s in segs:
    if s["f0"] > 6: S(s["f0"] - 0.45, whoosh(0.9, True, 0.8, 200, 3500), 0.6, rv=0.15)
pr = [s for s in segs if s["kind"] == "proof"][0]
for i in range(3): S(pr["f0"] + 0.9 + i * 1.4, stamp(0.5), 0.45, pan=-0.2 + i * 0.2, rv=0.2)
ev = [s for s in segs if s["kind"] == "envio"][0]
for i in range(len(TL["envio"]["events"])): S(ev["f0"] + 0.5 + i * 0.32, tick(0.7, 2400 + i * 120), 0.7, pan=-0.3 + i * 0.1, rv=0.1)

# ================================================================ OUTRO: the seal, resolve
o = [s for s in segs if s["kind"] == "outro"][0]["f0"]
S(o + 0.4, taiko(1.3, big=True), 1.1, rv=0.7); S(o + 0.4, stamp(1.3), 1.0, rv=0.5); S(o + 0.5, shimmer(1.6, 0.8, 30), 0.6, rv=0.6)
put(music, o + 0.4, pad([mtof(50), mtof(57), mtof(62), mtof(64), mtof(66)], DUR - o, vel=1.7, bright=6, a=0.2, r=3.0), send=send_m, sendamt=0.6)
for t0, m in [(o + 2.2, 74), (o + 2.6, 78), (o + 3.0, 81), (o + 3.5, 86)]:
    put(music, t0, koto(mtof(m), 2.6, 0.8), 0.75, pan=rng.uniform(-0.3, 0.3), send=send_m, sendamt=0.6)

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

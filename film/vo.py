# Generates one WAV per voiceover line with Kokoro (open-source TTS) and records durations.
#   .venv/bin/python vo.py
import json, os
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

here = os.path.dirname(os.path.abspath(__file__))
script = json.load(open(os.path.join(here, "script.json")))
k = Kokoro(os.path.join(here, "models/kokoro-v1.0.onnx"), os.path.join(here, "models/voices-v1.0.bin"))
out = os.path.join(here, "audio/vo")
os.makedirs(out, exist_ok=True)

durs = {}
for line in script["lines"]:
    samples, sr = k.create(line["text"], voice=line.get("voice", script["voice"]), speed=line.get("speed", script["speed"]), lang="en-us")
    # trim leading/trailing silence, keep a 40 ms cushion
    a = np.abs(samples)
    idx = np.where(a > 0.01)[0]
    s0, s1 = max(0, idx[0] - int(0.04 * sr)), min(len(samples), idx[-1] + int(0.08 * sr))
    samples = samples[s0:s1]
    sf.write(os.path.join(out, f"{line['id']}.wav"), samples, sr)
    durs[line["id"]] = round(len(samples) / sr, 3)
    print(f"{line['id']:6s} {durs[line['id']]:5.2f}s  {line['text']}")

json.dump({"sr": sr, "durations": durs}, open(os.path.join(out, "durations.json"), "w"), indent=1)
print("total speech", round(sum(durs.values()), 1), "s")

# One WAV per voiceover line with Kokoro (open-source TTS), plus measured durations.
import json, os
import numpy as np, soundfile as sf
from kokoro import KPipeline

here = os.path.dirname(os.path.abspath(__file__))
script = json.load(open(os.path.join(here, "script.json")))
pipe = KPipeline(lang_code="a")
out = os.path.join(here, "audio/vo"); os.makedirs(out, exist_ok=True)
durs = {}
for line in script["lines"]:
    parts = [a for _, _, a in pipe(line["text"], voice=line.get("voice", script["voice"]), speed=line.get("speed", script["speed"]))]
    s = np.concatenate([np.asarray(p) for p in parts]); sr = 24000
    idx = np.where(np.abs(s) > 0.01)[0]
    s = s[max(0, idx[0] - int(0.03 * sr)): min(len(s), idx[-1] + int(0.08 * sr))]
    sf.write(os.path.join(out, f"{line['id']}.wav"), s, sr)
    durs[line["id"]] = round(len(s) / sr, 3)
    print(f"{line['id']:10s} {durs[line['id']]:5.2f}s  {line['text']}")
json.dump({"sr": 24000, "durations": durs}, open(os.path.join(out, "durations.json"), "w"), indent=1)
print("total speech", round(sum(durs.values()), 1), "s")

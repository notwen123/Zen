# STOCKBACK demo film (2:30)

Watch on YouTube: https://youtu.be/70fX_mN6MuE

`release/STOCKBACK-demo.mp4`: 1080p30, -14 LUFS, captions in `release/STOCKBACK-demo.srt`.

Everything is produced from this folder with open-source tools. The style and method, reusable for any product, is written up in [HANKO-REEL.md](HANKO-REEL.md) (the ink-and-seal film system).

| Step | Command | What it does |
|---|---|---|
| Record | `WALLET_JSON=… node record.mjs` | Drives the live site (stockbacks.vercel.app) and makes a real claim on Robinhood Chain testnet. Captures full-res CDP screencast frames plus a log of every cursor move, click and keystroke. |
| Voice | `.venv/bin/python vo.py` | Kokoro TTS (`af_heart`), one WAV per line from `script.json` |
| Score | `.venv/bin/python score.py` | Original music and sound design synthesized in numpy: koto, taiko, pads, stamps, whooshes, and clicks synced to the recording. Reverb, voice ducking, mix. |
| Picture | `node render.mjs` | `index.html` + `film.js`: deterministic motion design rendered frame by frame (4,500 frames). The recording is composited with camera moves, a drawn cursor and chapter cards. |
| Finish | `./finish.sh` | Two-pass loudness normalization, H.264/AAC encode, SRT captions |

`timeline.json` is the single source of truth for scene timing, voiceover placement, the recording's time remap, camera keyframes and chapter cards.

The product footage is a real session: claim tx `0x1fc40e3e608da143515f62a81830072265914606311f56ec34ca7adfee7afa97` (Stylus-verified, 18.7425 sbNKE minted). The merchant is simulated; brand assets are testnet mocks.

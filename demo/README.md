# Zen demo film (1:35)

Recorded from the live app on Monad testnet and rendered from code, in the same ink-and-seal theme as the app.

1. `node record.mjs` drives the live site with a virtual PRF passkey. It makes a real claim, cash-out, merchant refund and locker decrypt, and records CDP screencast frames plus a cursor and click log on a clock that pauses during waits.
2. `python vo.py` generates the voice-over with Kokoro (open-source TTS).
3. `node build-timeline.mjs` assembles the segments, voice-over placement and track/bounty badges.
4. `python score.py` synthesizes the koto and taiko score and the sound effects synced to real clicks, then mixes it.
5. `node render.mjs` renders `index.html` and `film.js` frame by frame in headless Chromium.
6. `./finish.sh` produces `out/Zen-demo.mp4` at -14 LUFS, plus captions.

The proof inserts are real: MonadVision pages for the recorded transactions, and Envio HyperSync events for the recorded claim (`envio-proof.json`).

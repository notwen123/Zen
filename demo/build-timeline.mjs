// Builds timeline.json: film segments (intro, real take, proof inserts, outro), voiceover placement, badges.
// Single source of truth for the renderer (film.js) and the score (score.py).
import { readFileSync, writeFileSync } from "node:fs";

const take = JSON.parse(readFileSync(new URL("./rec/take.json", import.meta.url)));
const vo = JSON.parse(readFileSync(new URL("./audio/vo/durations.json", import.meta.url))).durations;
const envio = JSON.parse(readFileSync(new URL("./envio-proof.json", import.meta.url)));
const M = take.marks;

const segs = [];
let f = 0;
const add = (s, dur) => { segs.push({ ...s, dur, f0: +f.toFixed(3), f1: +(f + dur).toFixed(3) }); f += dur; };
add({ kind: "intro" }, 6.0);
add({ kind: "take", t0: 0, url: "/" }, M.cashed + 2.0); // landing -> merchant -> passkey -> claim -> cash out
add({ kind: "proof", img: "proof-cash.png", tx: take.proof.cashTx }, 5.6);
add({ kind: "take", t0: M.refund - 0.2 }, M.locker - (M.refund - 0.2)); // merchant refund -> LP loss
add({ kind: "envio" }, 5.8);
add({ kind: "take", t0: M.locker }, take.duration - M.locker);
add({ kind: "outro" }, 7.5);
const duration = +f.toFixed(3);

// film time of a take time
const film = (rt) => {
  const takes = segs.filter((s) => s.kind === "take");
  const hit = takes.find((s) => rt >= s.t0 && rt < s.t0 + s.dur) ?? takes.find((s) => rt >= s.t0 && rt <= s.t0 + s.dur + 1e-6);
  return hit ? hit.f0 + (rt - hit.t0) : null;
};
const seg = (k, i = 0) => segs.filter((s) => s.kind === k)[i];

const lines = [
  ["intro1", 0.45],
  ["intro2", 4.5],
  ["merchant", film(M.merchant) + 0.3],
  ["signin", film(M.signin) + 0.1],
  ["locked", film(M.verified) - 0.6],
  ["claims", film(M.claims) + 0.2],
  ["quote", film(M.quote) - 0.2],
  ["proofcash", seg("proof").f0 + 0.5],
  ["refund", film(M.refund) + 0.1],
  ["pools", film(M.pools) + 0.15],
  ["envio", seg("envio").f0 + 0.6],
  ["locker", film(M.locker) + 0.4],
  ["outro", seg("outro").f0 + 1.4],
].map(([id, t]) => [id, +t.toFixed(3)]);

// overlap check: each line should end before the next starts
for (let i = 0; i < lines.length - 1; i++) {
  const end = lines[i][1] + vo[lines[i][0]];
  if (end > lines[i + 1][1] - 0.15) console.warn(`VO overlap: ${lines[i][0]} ends ${end.toFixed(2)} > ${lines[i + 1][0]} at ${lines[i + 1][1]}`);
}

// badges: [film start, film end, tag kind, tag, text]
const B = (a, b, kind, tag, text) => ({ f0: +a.toFixed(2), f1: +b.toFixed(2), kind, tag, text });
const badges = [
  B(film(M.landing) + 0.6, film(M.merchant) - 0.3, "live", "Live", "zen-monad.pages.dev · Monad testnet"),
  B(film(M.merchant) + 0.4, film(M.signin) - 0.3, "info", "Merchant-signed", "Ed25519 receipt · simulated merchant"),
  B(film(M.passkey) - 0.2, film(M.verified) - 0.4, "bounty", "Mera · UX", "Passkey account. No wallet, no seed phrase"),
  B(film(M.funded) + 0.2, film(M.verified) - 0.4, "info", "Auto-funded", "Test MON from the faucet, server-side"),
  B(film(M.locked) - 0.3, film(M.claims) - 0.3, "track", "Finance #12", "Equity locked until the return window closes"),
  B(film(M.claims) + 0.3, film(M.quote) - 0.3, "info", "Return-window seal", "Stamps when the equity is free to settle"),
  B(film(M.quote) + 0.2, film(M.cashed) + 1.8, "track", "Finance #12", "InstantExitPool prices refund risk · ERC-4626"),
  B(film(M.refund) + 0.3, film(M.pools) - 0.3, "track", "Finance #12", "VoidOracle: signed refund → claim voided"),
  B(film(M.pools) + 0.3, film(M.locker) - 0.4, "track", "Onchain P&L", "Realized loss booked by the pool"),
  B(film(M.locker) + 0.3, seg("outro").f0 - 0.3, "bounty", "Mera · PRF", "Second key (HKDF) → AES-GCM receipt locker"),
];

// clicks and typing in film time (cursor rendering + sound design)
const clicks = take.events.filter((e) => e.type === "click").map((e) => film(e.t)).filter((x) => x != null);
const typing = take.events.filter((e) => e.type === "type").map((e) => [film(e.t0), film(e.t1)]).filter(([a]) => a != null);
const hits = { claimed: film(M.locked), cashed: film(M.cashed), voided: film(M.voided) };

const urls = [
  [0, "/"], [M.merchant, "/merchant"], [M.signin, "/app/scan"], [M.claims, "/app/portfolio"],
  [M.refund - 0.2, "/merchant"], [M.pools, "/app/lp"], [M.locker, "/app/locker"],
];
writeFileSync(
  new URL("./timeline.json", import.meta.url),
  JSON.stringify({ fps: 30, duration, segments: segs, vo: lines, badges, clicks, typing, hits, urls, envio, proof: take.proof }, null, 1),
);
console.log(`duration ${duration}s`, segs.map((s) => `${s.kind}@${s.f0}`).join(" "));
console.log(lines.map(([id, t]) => `${id}@${t}(${vo[id]})`).join(" "));

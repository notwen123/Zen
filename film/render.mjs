// Renders the film frame by frame.  node render.mjs [--at 3.5,40,80] [--from 0 --to 150] [--workers 6]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const dir = import.meta.dirname;
const TL = JSON.parse(readFileSync(`${dir}/timeline.json`, "utf8"));
const TAKE = JSON.parse(readFileSync(`${dir}/rec/take.json`, "utf8"));
writeFileSync(`${dir}/data.js`, `window.TIMELINE=${JSON.stringify(TL)};window.TAKE=${JSON.stringify({ t0: TAKE.t0, viewport: TAKE.viewport, frames: TAKE.frames, events: TAKE.events })};`);

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const fps = TL.fps;
let jobs;
if (arg("at")) jobs = arg("at").split(",").map((s) => ({ t: +s, out: `${dir}/out/still-${s}.jpg` }));
else {
  const from = +arg("from", 0), to = +arg("to", TL.duration);
  mkdirSync(`${dir}/frames`, { recursive: true });
  jobs = [];
  for (let f = Math.round(from * fps); f < Math.round(to * fps); f++) jobs.push({ t: f / fps, out: `${dir}/frames/${String(f).padStart(5, "0")}.jpg` });
}
mkdirSync(`${dir}/out`, { recursive: true });

const workers = +arg("workers", 6);
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`, args: ["--allow-file-access-from-files"] });
const started = Date.now();
let done = 0;
// contiguous chunks per worker keep image caches warm
const chunk = Math.ceil(jobs.length / workers);
await Promise.all(Array.from({ length: workers }, async (_, w) => {
  const mine = jobs.slice(w * chunk, (w + 1) * chunk);
  if (!mine.length) return;
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  await page.goto(pathToFileURL(`${dir}/index.html`).href, { waitUntil: "networkidle" });
  await page.evaluate(() => window.READY);
  // warm up every scene once so lazily-built DOM is identical in every worker
  for (const t of [9.5, 20, 40, 60, 110, 125, 140]) await page.evaluate((t) => window.render(t), t);
  for (const j of mine) {
    await page.evaluate((t) => window.render(t), j.t);
    await page.screenshot({ path: j.out, type: "jpeg", quality: 93 });
    if (++done % 150 === 0) console.log(`${done}/${jobs.length}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  await page.close();
}));
await browser.close();
console.log(`rendered ${jobs.length} frames in ${((Date.now() - started) / 1000).toFixed(0)}s`);

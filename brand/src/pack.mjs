// After render: pitch deck PDF + a contact sheet of every PNG in the pack.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const png = join(import.meta.dirname, "../png");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome` });

// Main deck: the 11 deck/ slides.
const deckSlides = readdirSync(join(png, "deck")).filter((f) => f.endsWith(".png")).sort().map((f) => `deck/${f.replace(/\.png$/, "")}`);
await pdf(deckSlides, "STOCKBACK-deck.pdf");

// Pitch deck: story order, mixing pitch frames and explainers.
const deck = ["pitch/01-cover", "pitch/02-problem-receipts", "pitch/03-problem-loyalty", "pitch/04-solution", "explainers/01-how-it-works", "explainers/03-evidence-tiers", "explainers/02-trust-boundary", "explainers/04-stylus-benchmark", "pitch/05-built", "pitch/06-honest-roadmap", "pitch/07-close"];
await pdf(deck, "STOCKBACK-pitch.pdf");

// JPEG frames at 2560×1440 keep the PDF small enough to email.
async function pdf(deck, name) {
const tmp = join(png, ".deck");
mkdirSync(tmp, { recursive: true });
deck.forEach((d, i) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(png, `${d}.png`), "-vf", "scale=2560:1440:flags=lanczos", "-q:v", "3", join(tmp, `${i}.jpg`)]));
const deckHtml = join(png, ".deck.html");
writeFileSync(deckHtml, `<style>@page{size:1920px 1080px;margin:0}body{margin:0}img{display:block;width:1920px;height:1080px;page-break-after:always}</style>${deck.map((_, i) => `<img src=".deck/${i}.jpg">`).join("")}`);
const page = await browser.newPage();
await page.goto(pathToFileURL(deckHtml).href, { waitUntil: "load" });
await page.pdf({ path: join(png, name), width: "1920px", height: "1080px", printBackground: true });
await page.close();
rmSync(deckHtml);
rmSync(tmp, { recursive: true });
console.log(`✓ ${name}`, deck.length, "pages");
}

// Contact sheet
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith(".png") && !f.startsWith("contact") ? [join(d, f)] : []));
const files = walk(png).sort();
const sheet = join(png, ".sheet.html");
writeFileSync(sheet, `<link rel="stylesheet" href="../src/base.css"><body class="grain" style="padding:60px;overflow:visible;height:auto">
<h1 class="display" style="font-size:64px">STOCKBACK brand pack</h1><p style="margin:12px 0 40px;font-size:20px;color:var(--charcoal)">${files.length} images. Regenerate: <span class="mono">cd brand && npm run render && node src/pack.mjs</span></p>
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:28px;align-items:end">${files
  .map((f) => `<figure><div style="background:repeating-conic-gradient(#e8e1d2 0 25%,#f4efe3 0 50%) 0 0/16px 16px;display:grid;place-items:center;padding:8px"><img src="${relative(png, f)}" style="max-width:100%;max-height:300px"></div><figcaption class="mono" style="font-size:12px;margin-top:8px">${relative(png, f)}</figcaption></figure>`)
  .join("")}</div></body>`);
const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
await page.goto(pathToFileURL(sheet).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(png, "contact-sheet.png"), fullPage: true });
console.log("✓ contact-sheet.png");
await browser.close();
rmSync(sheet);

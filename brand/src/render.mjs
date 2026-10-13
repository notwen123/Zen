// Renders every artboard in boards.mjs to PNG under brand/png/.
//   node src/render.mjs            all boards
//   node src/render.mjs poster     only boards whose name contains "poster"
// Chromium: CHROME_PATH, else the Playwright cache.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import QRCode from "qrcode";
import { boards } from "./boards.mjs";
import { FACTS } from "./kit.mjs";

const src = import.meta.dirname;
const out = join(src, "../png");
const only = process.argv[2];

// QR to the live product, generated once and embedded by boards that need it.
writeFileSync(join(src, "art/qr-site.svg"), await QRCode.toString(FACTS.site, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#171717", light: "#00000000" } }));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
});
let n = 0;
for (const b of boards.filter((b) => !only || b.name.includes(only))) {
  const page = await browser.newPage({ viewport: { width: b.w, height: b.h }, deviceScaleFactor: b.scale ?? 2 });
  const file = join(src, `.tmp-${b.name.replace(/\//g, "_")}.html`);
  writeFileSync(file, b.html);
  await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const path = join(out, `${b.name}.png`);
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, omitBackground: !!b.transparent });
  await page.close();
  n++;
  console.log(`✓ ${b.name}.png  ${b.w * (b.scale ?? 2)}×${b.h * (b.scale ?? 2)}`);
}
await browser.close();
const { readdirSync, rmSync } = await import("node:fs");
for (const f of readdirSync(src)) if (f.startsWith(".tmp-")) rmSync(join(src, f));
console.log(`${n} PNGs → brand/png/`);

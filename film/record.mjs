// Records the live product (stockbacks.vercel.app) as full-resolution CDP screencast frames,
// plus an event log of cursor moves, clicks, typing and story marks for post-production.
//   WALLET_JSON=<path to [{address, private_key}]> node record.mjs
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { walletScript } from "./wallet.mjs";

const BASE = process.env.BASE ?? "https://stockbacks.vercel.app";
const OUT = new URL("./rec/", import.meta.url).pathname;
const W = 1440, H = 900, DSF = 2;
const wallet = JSON.parse(readFileSync(process.env.WALLET_JSON, "utf8"))[0];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}frames`, { recursive: true });

const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome` });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
await ctx.addInitScript(walletScript({ key: wallet.private_key, address: wallet.address }));
const page = await ctx.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- connect the wallet OFF camera (no modal in the film)
await page.goto(BASE + "/");
await page.getByRole("button", { name: "Connect wallet" }).first().click();
await page.getByRole("button", { name: /MetaMask/ }).click();
await page.waitForURL("**/app/dashboard", { timeout: 30000 });
await page.goto(BASE + "/merchant");
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
await sleep(1500);

// ---------- screencast
const cdp = await ctx.newCDPSession(page);
const frames = [];
let n = 0;
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const file = `frames/${String(n++).padStart(5, "0")}.jpg`;
  writeFileSync(OUT + file, Buffer.from(data, "base64"));
  frames.push({ t: metadata.timestamp, file, scrollY: metadata.scrollOffsetY });
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W * DSF, maxHeight: H * DSF, everyNthFrame: 1 });
const now = () => Date.now() / 1000;
const t0 = now();
const events = [];
const mark = (name) => events.push({ type: "mark", name, t: now() });

// Cursor: we move the real mouse along the same eased path the post-production cursor will draw,
// so hover states in the recording line up with the drawn cursor.
let cur = { x: W * 0.62, y: H * 0.55 };
await page.mouse.move(cur.x, cur.y);
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
async function moveTo(x, y) {
  const d = Math.hypot(x - cur.x, y - cur.y);
  const dur = Math.min(1.1, Math.max(0.45, d / 900));
  const ev = { type: "move", t0: now(), t1: 0, from: [cur.x, cur.y], to: [x, y] };
  const steps = Math.round(dur * 60);
  for (let i = 1; i <= steps; i++) {
    const u = ease(i / steps);
    // gentle arc, like a hand
    const ax = cur.x + (x - cur.x) * u - Math.sin(Math.PI * u) * (y - cur.y) * 0.08;
    const ay = cur.y + (y - cur.y) * u + Math.sin(Math.PI * u) * (x - cur.x) * 0.08;
    await page.mouse.move(ax, ay);
    await sleep((dur * 1000) / steps);
  }
  ev.t1 = now();
  events.push(ev);
  cur = { x, y };
}
async function center(locator) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
}
async function click(locator, { pause = 350 } = {}) {
  const [x, y] = await center(locator);
  await moveTo(x, y);
  await sleep(pause);
  events.push({ type: "click", t: now(), x, y });
  await page.mouse.down();
  await sleep(90);
  await page.mouse.up();
}
async function smoothScroll(dy, dur = 900) {
  const ev = { type: "scroll", t0: now(), t1: 0, dy };
  const steps = 30;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await sleep(dur / steps);
  }
  ev.t1 = now();
  events.push(ev);
}

// ================================================================ the take
mark("pos");
await sleep(1600);

// amount: ₹2,499
const amount = page.locator('label:has-text("Amount") input');
await click(amount);
await amount.selectText();
const typeEv = { type: "type", t0: now(), text: "2499" };
await page.keyboard.type("2499", { delay: 150 });
typeEv.t1 = now();
events.push(typeEv);
await sleep(700);

mark("issue");
await click(page.getByRole("button", { name: /Issue signed receipt/ }));
await page.locator('[aria-label="QR code of the signed receipt"] svg').waitFor({ timeout: 20000 });
mark("receipt");
await sleep(1200);
// look at the QR
const [qx, qy] = await center(page.locator('[aria-label="QR code of the signed receipt"]'));
await moveTo(qx + 40, qy + 30);
await sleep(1600);
const href = await page.getByRole("link", { name: /Claim in STOCKBACK/ }).getAttribute("href");

mark("toScan");
await click(page.getByRole("link", { name: /Claim in STOCKBACK/ }));
await page.getByRole("button", { name: /Verify signature/ }).waitFor({ timeout: 30000 });
await sleep(1500);
mark("scan");

await click(page.getByRole("button", { name: /Verify signature/ }));
mark("verifying");
await page.getByText("Claim preview").waitFor({ timeout: 40000 });
mark("preview");
await sleep(2600);

await click(page.getByRole("button", { name: /Claim ownership/ }));
mark("claiming");
await page.getByText("Ownership created").first().waitFor({ timeout: 120000 });
mark("done");
await sleep(3200);
const tx = await page.evaluate(() => window.__e2eLastTx);

// the real transaction on the explorer
mark("explorer");
const viewTx = page.getByRole("link", { name: /View transaction/ });
const [vx, vy] = await center(viewTx);
await moveTo(vx, vy);
await sleep(300);
events.push({ type: "click", t: now(), x: vx, y: vy });
await page.goto(`https://explorer.testnet.chain.robinhood.com/tx/${tx}`);
await page.waitForLoadState("domcontentloaded");
await page.getByText(/Success/i).first().waitFor({ timeout: 30000 }).catch(() => {});
await sleep(3800);
mark("explorerShown");

// portfolio
mark("portfolio");
await page.goto(BASE + "/app/portfolio");
await page.getByText(/YOUR OWNERSHIP|Your ownership/i).first().waitFor({ timeout: 30000 }).catch(() => {});
await sleep(3500);
mark("portfolioShown");

// replay the same sealed receipt
mark("replay");
await page.goto(BASE + href);
await page.getByRole("button", { name: /Verify signature/ }).waitFor({ timeout: 30000 });
await sleep(1000);
await click(page.getByRole("button", { name: /Verify signature/ }));
await page.getByText(/already been claimed/i).waitFor({ timeout: 30000 });
mark("rejected");
await sleep(3000);
mark("end");

await cdp.send("Page.stopScreencast");
await sleep(300);
writeFileSync(`${OUT}take.json`, JSON.stringify({ t0, viewport: [W, H], dsf: DSF, tx, href, frames, events }, null, 1));
await browser.close();
console.log(`frames ${frames.length}, duration ${(frames.at(-1).t - t0).toFixed(1)}s, tx ${tx}`);

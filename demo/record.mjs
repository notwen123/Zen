// Records the LIVE product (zen-monad.pages.dev) end to end on Monad testnet as full-resolution CDP screencast
// frames, plus an event log (cursor moves, clicks, typing, story marks) in a *virtual* clock that only runs while
// recording is on. Waits (minimum hold, confirmations past a cap, page loads) are cut out at the source.
// A virtual WebAuthn authenticator with PRF stands in for the user's passkey; everything else is real.
//   node record.mjs
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "https://zen-monad.pages.dev";
const OUT = new URL("./rec/", import.meta.url).pathname;
const W = 1440, H = 900, DSF = 2;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}frames`, { recursive: true });

const browser = await chromium.launch({
  executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`,
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
let page = await ctx.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const AUTH = { protocol: "ctap2", ctap2Version: "ctap2_1", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true };
let cdp = await ctx.newCDPSession(page);
await cdp.send("WebAuthn.enable");
await cdp.send("WebAuthn.addVirtualAuthenticator", { options: AUTH });

// ---------------------------------------------------------------- virtual clock + screencast
let acc = 0, onSince = null;
const real = () => Date.now() / 1000;
const now = () => acc + (onSince === null ? 0 : real() - onSince);
const on = () => { if (onSince === null) onSince = real(); };
const off = () => { if (onSince !== null) { acc += real() - onSince; onSince = null; } };

const frames = [];
let n = 0;
function onFrame(session) {
  session.on("Page.screencastFrame", async ({ data, sessionId }) => {
    if (onSince !== null && session === cdp) {
      const file = `frames/${String(n++).padStart(5, "0")}.jpg`;
      writeFileSync(OUT + file, Buffer.from(data, "base64"));
      frames.push({ t: now(), file });
    }
    await session.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
}
onFrame(cdp);
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: W * DSF, maxHeight: H * DSF, everyNthFrame: 1 });

const events = [];
const marks = {};
const mark = (name) => { marks[name] = now(); events.push({ type: "mark", name, t: now() }); console.log(`${now().toFixed(1).padStart(6)}s  ${name}`); };
const proof = {};

// ---------------------------------------------------------------- cursor + input (mouse follows the drawn cursor's path)
let cur = { x: W * 0.62, y: H * 0.55 };
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
async function moveTo(x, y) {
  const d = Math.hypot(x - cur.x, y - cur.y);
  const dur = Math.min(0.9, Math.max(0.35, d / 1100));
  const ev = { type: "move", t0: now(), t1: 0, from: [cur.x, cur.y], to: [x, y] };
  const steps = Math.round(dur * 60);
  for (let i = 1; i <= steps; i++) {
    const u = ease(i / steps);
    await page.mouse.move(cur.x + (x - cur.x) * u - Math.sin(Math.PI * u) * (y - cur.y) * 0.08, cur.y + (y - cur.y) * u + Math.sin(Math.PI * u) * (x - cur.x) * 0.08);
    await sleep((dur * 1000) / steps);
  }
  ev.t1 = now();
  events.push(ev);
  cur = { x, y };
}
async function center(loc) {
  await loc.scrollIntoViewIfNeeded();
  await sleep(150);
  const b = await loc.boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
}
async function click(loc, pause = 250) {
  const [x, y] = await center(loc);
  await moveTo(x, y);
  await sleep(pause);
  events.push({ type: "click", t: now(), x, y });
  await page.mouse.down();
  await sleep(80);
  await page.mouse.up();
}
async function hover(loc, dx = 0, dy = 0) {
  const [x, y] = await center(loc);
  await moveTo(x + dx, y + dy);
}
async function scroll(dy, dur = 800) {
  const steps = 30;
  events.push({ type: "scroll", t0: now(), dy });
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await sleep(dur / steps); }
}
/** Keep recording a wait for at most `cap` seconds, cut the rest. */
async function waitCapped(loc, cap = 1.5, timeout = 120000) {
  const t = real();
  const done = loc.first().waitFor({ timeout });
  const capped = sleep(cap * 1000).then(() => "cap");
  if ((await Promise.race([done.then(() => "done"), capped])) === "cap") { off(); await done; await sleep(250); on(); }
  else if (real() - t < 0.3) await sleep(200);
}
/** The screencast only emits frames on repaint, so a page that finished painting while recording was off would
 *  never appear. Take a full screenshot as the first frame whenever recording resumes. */
async function snap() {
  const file = `frames/${String(n++).padStart(5, "0")}.jpg`;
  writeFileSync(OUT + file, await page.screenshot({ type: "jpeg", quality: 90 }));
  frames.push({ t: now(), file });
}
async function offscreen(fn) { off(); await fn(); await page.evaluate(() => document.fonts.ready); await sleep(600); on(); await snap(); }
const sidebarMon = () => page.locator("aside").innerText().then((t) => Number((t.match(/([\d.]+) MON/) || [])[1] ?? 0)).catch(() => 0);

// ================================================================ the take
// 1. Landing
await offscreen(async () => { await page.goto(BASE + "/", { waitUntil: "load", timeout: 60000 }); await sleep(2500); });
mark("landing");
await sleep(2200);
await hover(page.getByRole("link", { name: /Scan a receipt/i }).first(), 0, 0).catch(() => {});
await sleep(900);
await scroll(700, 1400);
await sleep(900);

// 2. Merchant issues a signed receipt
await offscreen(async () => { await page.goto(BASE + "/merchant", { waitUntil: "load", timeout: 60000 }); });
mark("merchant");
await sleep(900);
const amount = page.locator('label:has-text("Amount") input');
await click(amount);
await amount.selectText();
const te = { type: "type", t0: now(), text: "2499" };
await page.keyboard.type("2499", { delay: 120 });
te.t1 = now();
events.push(te);
await sleep(400);
await click(page.getByRole("button", { name: /Issue signed receipt/ }));
await waitCapped(page.locator('[aria-label="QR code of the signed receipt"] svg'), 1.2);
mark("receipt");
await hover(page.locator('[aria-label="QR code of the signed receipt"]'), 30, 20);
await sleep(1400);
const rel = await page.getByRole("link", { name: /Claim in Zen/ }).getAttribute("href");
const link = rel.startsWith("http") ? rel : BASE + rel;

// 3. Passkey account (Mera) + automatic funding
await offscreen(async () => { await page.goto(link, { waitUntil: "load", timeout: 60000 }); await page.getByRole("button", { name: /Create your account/i }).waitFor(); });
mark("signin");
await sleep(1300);
await click(page.getByRole("button", { name: /Create your account/i }));
mark("passkey");
await waitCapped(page.locator("aside").getByText(/Signed in with passkey/i), 1.5);
for (let i = 0; i < 40 && (await sidebarMon()) < 0.1; i++) { if (i === 3) off(); await sleep(500); }
on();
mark("funded");
await hover(page.locator("aside").getByText(/MON/).first(), 0, 0).catch(() => {});
await sleep(1500);

// 4. Verify the merchant signature, claim locked equity
await click(page.getByRole("button", { name: /verify signature/i }));
await waitCapped(page.getByRole("button", { name: /claim locked equity/i }), 1.2);
mark("verified");
await sleep(1500);
await click(page.getByRole("button", { name: /claim locked equity/i }));
await waitCapped(page.getByText(/locked until/i), 2.0);
mark("locked");
proof.claimTx = await page.locator('a[href*="/tx/"]').first().getAttribute("href").catch(() => null);
proof.claimId = ((await page.locator("main").innerText()).match(/CLAIM #(\d+)/i) || [])[1];
await hover(page.getByText(/locked until/i).first());
await sleep(2200);

// 5. My claims: the seal, then cash out to the LP pool
await click(page.getByRole("link", { name: "My claims", exact: true }));
await waitCapped(page.getByRole("button", { name: /Cash out now|Sellable in/i }), 1.0);
mark("claims");
await hover(page.locator('[role="img"][aria-label*="return window"]').first()).catch(() => {});
await sleep(2200);
off();
await page.getByRole("button", { name: /Cash out now/i }).waitFor({ timeout: 120000 });
for (let i = 0; i < 130 && (await page.getByRole("button", { name: /Cash out now/i }).isDisabled()); i++) await sleep(1000);
await sleep(600);
on();
mark("quote");
await hover(page.getByText(/You get/i).first(), -60, 0).catch(() => {});
await sleep(2000);
await click(page.getByRole("button", { name: /Cash out now/i }));
mark("cashing");
await waitCapped(page.getByText(/Cashed out for/i), 2.0);
mark("cashed");
proof.cashTx = await page.locator('a[href*="/tx/"]').last().getAttribute("href").catch(() => null);
await hover(page.getByText(/Cashed out for/i).first());
await sleep(2000);

// 6. Merchant issues a refund on the claim the pool now holds -> LP loss. The merchant has its own browser and
//    its own passkey account (created and auto-funded off camera), as in real life.
const shopperPage = page, shopperCdp = cdp, shopperCur = cur;
off();
await cdp.send("Page.stopScreencast");
const mctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
page = await mctx.newPage();
cdp = await mctx.newCDPSession(page);
await cdp.send("WebAuthn.enable");
await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { ...AUTH } });
onFrame(cdp);
cur = { x: W * 0.62, y: H * 0.55 };
await page.mouse.move(cur.x, cur.y);
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: W * DSF, maxHeight: H * DSF, everyNthFrame: 1 });
await offscreen(async () => {
  await page.goto(BASE + "/merchant", { waitUntil: "load", timeout: 60000 });
  await page.locator("td", { hasText: new RegExp(`^#${proof.claimId}$`) }).first().waitFor({ timeout: 90000 });
});
const row = () => page.locator("tr", { has: page.locator("td", { hasText: new RegExp(`^#${proof.claimId}$`) }) }).first();
// the merchant's passkey account is created off camera; it receives test MON automatically
await offscreen(async () => {
  await row().scrollIntoViewIfNeeded();
  await row().getByRole("button", { name: /issue refund/i }).click();
  await sleep(9000);
});
mark("refund");
await hover(row(), -200, 0);
await sleep(1600);
await click(row().getByRole("button", { name: /issue refund/i }));
await waitCapped(page.getByText(new RegExp(`Claim #${proof.claimId}: voided`)), 2.0);
mark("voided");
proof.refundTx = await page.locator('a[href*="/tx/"]').last().getAttribute("href").catch(() => null);
await sleep(2200);

// back to the shopper's browser for the rest of the take
off();
await cdp.send("Page.stopScreencast");
page = shopperPage; cdp = shopperCdp; cur = shopperCur;
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: W * DSF, maxHeight: H * DSF, everyNthFrame: 1 });

// 7. Liquidity pools: the loss is booked
await offscreen(async () => { await page.goto(BASE + "/app/lp", { waitUntil: "load", timeout: 60000 }); await page.getByText(/Realized losses/).first().waitFor({ timeout: 60000 }); await sleep(2500); });
mark("pools");
await sleep(1200);
await hover(page.getByText(/Realized losses/).first(), 0, 14);
await sleep(2600);

// 8. Receipt locker: decrypt with the passkey-derived key (same passkey after a reload -> same key)
await offscreen(async () => {
  await page.goto(BASE + "/app/locker", { waitUntil: "load", timeout: 60000 });
  await page.getByRole("button", { name: /Unlock with passkey/i }).click();
  await page.getByRole("button", { name: /Open with passkey key/i }).first().waitFor({ timeout: 60000 });
});
mark("locker");
await sleep(1200);
const opens = page.getByRole("button", { name: /Open with passkey key/i });
await click(opens.first());
await sleep(1200);
if (await opens.count()) { await click(opens.first()); await sleep(800); }
await hover(page.locator("main pre").first(), 0, -40).catch(() => {});
await sleep(2600);
mark("end");
off();

await cdp.send("Page.stopScreencast");
writeFileSync(OUT + "take.json", JSON.stringify({ viewport: [W, H], dsf: DSF, duration: acc, frames, events, marks, proof }, null, 1));
console.log(`take: ${frames.length} frames, ${acc.toFixed(1)} s`, proof);
await browser.close();

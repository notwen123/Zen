import { BENCH, CAP, FACTS, brush, footer, kakuin, page, receiptLines, seal, wordmark } from "./kit.mjs";

export const boards = [];
const add = (name, w, h, html, opts = {}) => boards.push({ name, w, h, html, ...opts });

// ============================================================== LOGO
const center = "display:grid;place-items:center;height:100%";
add("logo/seal-stamped", 512, 512, page(`<div style="${center}">${seal(440)}</div>`, { cls: "", transparent: true }), { transparent: true });
add("logo/seal-flat", 512, 512, page(`<div style="${center}">${seal(440, { ink: false })}</div>`, { cls: "", transparent: true }), { transparent: true });
add("logo/wordmark-ink", 1200, 260, page(`<div style="${center}">${wordmark(84)}</div>`, { cls: "", transparent: true }), { transparent: true });
add(
  "logo/wordmark-reverse",
  1200,
  260,
  page(`<div style="${center}">${wordmark(84, { color: "var(--washi)", paper: "var(--sumi)" })}</div>`, { cls: "", transparent: true }),
  { transparent: true },
);
add(
  "logo/lockup-stacked",
  800,
  800,
  page(`<div style="${center};text-align:center"><div>${seal(330)}
    <p style="margin-top:44px;font-family:var(--display);font-weight:700;font-size:70px;letter-spacing:.2em">STOCKBACK</p>
    <p style="margin-top:18px;font-family:var(--display);font-size:30px;letter-spacing:.06em;color:var(--charcoal)">Scan. Prove. Own.</p></div></div>`, { cls: "", transparent: true }),
  { transparent: true },
);
const icon = (bg, s) =>
  page(`<div style="${center}"><div style="width:100%;height:100%;border-radius:22%;background:${bg};display:grid;place-items:center;position:relative;overflow:hidden">${s}</div></div>`, {
    cls: "",
    transparent: true,
  });
add("logo/app-icon", 512, 512, icon("var(--washi)", seal(360)), { transparent: true });
add("logo/app-icon-dark", 512, 512, icon("var(--sumi)", seal(360, { paper: "var(--sumi)" })), { transparent: true });
for (const px of [32, 180, 192, 512]) add(`logo/favicon-${px}`, px, px, page(`<div style="${center}">${seal(px * 0.94, { ink: false })}</div>`, { cls: "", transparent: true }), { transparent: true, scale: 1 });

// ============================================================== POSTERS (4:5, 2160×2700)
const P = [1080, 1350];

add(
  "posters/01-scan-prove-own",
  ...P,
  page(
    `<img src="art/landscape.png" class="abs" style="right:-520px;top:0;height:100%;width:auto;opacity:.97">
    <div class="fill" style="background:linear-gradient(90deg,var(--washi) 0%,var(--washi) 34%,rgba(244,239,227,.86) 50%,rgba(244,239,227,0) 74%)"></div>
    <div class="abs" style="left:76px;top:76px">${wordmark(26)}</div>
    <div class="abs vertical mincho" style="right:96px;top:470px;font-size:54px;font-weight:800;color:var(--sumi);letter-spacing:.34em;line-height:1">読証有</div>
    <h1 class="abs display" style="left:68px;top:300px;font-size:208px">Scan.<br>Prove.<br>Own.</h1>
    <div class="abs" style="left:668px;top:742px">${seal(190, { rotate: -9 })}</div>
    <p class="abs" style="left:76px;top:1000px;width:520px;font-size:30px;line-height:1.35;color:var(--charcoal)">A sealed receipt becomes a share of the brand you bought from.</p>
    <div class="abs" style="left:76px;right:76px;bottom:64px">${footer()}</div>`,
  ),
);

add(
  "posters/02-every-receipt-sealed",
  ...P,
  page(
    `<div class="abs" style="left:76px;top:76px">${wordmark(26)}</div>
    <h1 class="abs display" style="left:72px;top:160px;font-size:120px;line-height:.98">Every receipt,<br>sealed.</h1>

    <div class="abs receipt" style="left:90px;top:575px;width:390px;padding:28px 30px 32px;font-size:16.5px;transform:rotate(-4deg);opacity:.9">
      <p style="text-align:center;font-family:var(--display);font-weight:800;font-size:26px;letter-spacing:.2em">RECEIPT</p>
      <div class="dash" style="margin:16px 0"></div>
      ${receiptLines([["Store", "042 Mumbai"], ["Receipt", "INV-58213"], ["Date", "02 OCT 2026"], "---"])}
      <div class="row" style="font-size:24px"><span>TOTAL</span><span style="position:relative">₹<s style="text-decoration-color:var(--shu);text-decoration-thickness:3px">2,000</s> 20,000</span></div>
      <p style="margin-top:22px;font-family:var(--sans);font-size:17px;color:var(--shu-deep)">Photo, edited in under a second.</p>
    </div>

    <div class="abs receipt" style="left:540px;top:520px;width:440px;padding:30px 32px 34px;font-size:16.5px;transform:rotate(2.5deg)">
      <p style="text-align:center;font-family:var(--display);font-weight:800;font-size:26px;letter-spacing:.2em">RECEIPT</p>
      <div class="dash" style="margin:16px 0"></div>
      ${receiptLines([["Store", "042 Mumbai"], ["Receipt", "INV-58214"], ["Date", "02 OCT 2026"], "---"])}
      <div class="row" style="font-size:24px"><span>TOTAL</span><span>₹2,000</span></div>
      <div class="dash" style="margin:16px 0"></div>
      <p style="font-size:12.5px;line-height:1.5;word-break:break-all;opacity:.7">ed25519 7f3a9c0e41b2d5…e8c4a1f09b</p>
      <p style="margin-top:12px;font-family:var(--sans);font-size:16px;line-height:1.35;padding-right:70px">Signed by the merchant. Change one digit and the signature breaks.</p>
      <div class="abs" style="right:-44px;bottom:-30px">${kakuin(138, { rotate: -8 })}</div>
    </div>

    <p class="abs" style="left:76px;top:1078px;width:900px;font-size:24px;line-height:1.45;color:var(--charcoal)">
      People spot an AI-edited receipt <b style="color:var(--sumi)">50.1%</b> of the time, which is chance.* STOCKBACK trusts the merchant's signature, not the pixels.
    </p>
    <p class="abs fine" style="left:76px;top:1172px;font-size:13px;opacity:.75">* Wu et al., “When the Forger Is the Judge”, arXiv:2604.25213 (2026). In the demo, the merchant is simulated.</p>
    <div class="abs" style="left:76px;right:76px;bottom:56px">${footer()}</div>`,
  ),
);

// ============================================================== SHARED PIECES
const fmt = (n) => n.toLocaleString("en-US");
const short = (h) => `${h.slice(0, 6)}…${h.slice(-4)}`;

/** Horizontal grouped bars, Solidity (ai) vs Stylus (shu), on a linear scale up to the per-tx cap. */
function benchChart(width, { row = 82, bar = 22, label = 170, font = 17 } = {}) {
  const plot = width - label - 150;
  const x = (v) => Math.max(4, (v / CAP) * plot);
  const rows = BENCH.map(
    (b) => `<div style="display:grid;grid-template-columns:${label}px 1fr;align-items:center;height:${row}px">
      <span style="font-size:${font + 2}px">${b.n} signature${b.n > 1 ? "s" : ""}</span>
      <div style="display:grid;gap:2px">
        <div style="display:flex;align-items:center;gap:12px;height:${bar}px">
          ${
            b.sol
              ? `<span style="width:${x(b.sol)}px;height:100%;background:var(--ai);border-radius:0 4px 4px 0"></span><span class="mono" style="font-size:${font - 1}px">${fmt(b.sol)}</span>`
              : `<span style="width:${plot}px;height:100%;border-radius:0 4px 4px 0;background:repeating-linear-gradient(45deg,rgba(47,111,159,.35) 0 6px,transparent 6px 12px);outline:1.5px dashed var(--ai);outline-offset:-1.5px"></span><span style="font-size:${font - 1}px;color:var(--ai);white-space:nowrap">over the cap</span>`
          }
        </div>
        <div style="display:flex;align-items:center;gap:12px;height:${bar}px">
          <span style="width:${x(b.sty)}px;height:100%;background:var(--shu);border-radius:0 4px 4px 0"></span><span class="mono" style="font-size:${font - 1}px">${fmt(b.sty)}</span>
        </div>
      </div>
    </div>`,
  ).join("");
  return `<div style="position:relative;width:${width}px">
    <div style="position:absolute;left:${label + plot}px;top:-26px;bottom:0;border-left:1.5px dashed rgba(23,23,23,.45)"></div>
    <span style="position:absolute;left:${label + plot + 8}px;top:-30px;font-size:${font - 2}px;color:var(--charcoal);white-space:nowrap">32M gas per-tx cap</span>
    ${rows}
    <div style="display:flex;gap:28px;margin-top:22px;font-size:${font}px;padding-left:${label}px">
      <span style="display:flex;align-items:center;gap:10px"><i style="width:22px;height:12px;background:var(--ai);border-radius:2px"></i>Solidity, best available Ed25519</span>
      <span style="display:flex;align-items:center;gap:10px"><i style="width:22px;height:12px;background:var(--shu);border-radius:2px"></i>Stylus (Rust)</span>
    </div>
  </div>`;
}

const tick = (ok, size = 40) =>
  ok
    ? `<span style="flex:none;width:${size}px;height:${size}px;border-radius:50%;background:var(--shu);display:grid;place-items:center"><svg viewBox="0 0 24 24" width="${size * 0.55}" height="${size * 0.55}"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#f4efe3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
    : `<span style="flex:none;width:${size}px;height:${size}px;border-radius:50%;border:2px solid var(--sumi);display:grid;place-items:center;font-size:${size * 0.5}px">✕</span>`;

const qr = (size, pad = 22) =>
  `<div style="background:var(--washi);padding:${pad}px;display:inline-block;line-height:0"><img src="art/qr-site.svg" width="${size}" height="${size}" alt=""></div>`;

// ============================================================== POSTERS 03–06
add(
  "posters/03-stylus-9x",
  ...P,
  page(
    `<div class="abs" style="left:76px;top:76px">${wordmark(26)}</div>
    <p class="abs" style="left:76px;top:176px;font-size:26px;color:var(--charcoal)">Checking Ed25519 signatures on Arbitrum Stylus</p>
    <h1 class="abs display" style="left:66px;top:214px;font-size:300px;line-height:1">9.2<span style="font-size:.62em;font-weight:700;margin-left:.06em">x</span></h1>
    <p class="abs display" style="left:76px;top:516px;font-size:64px;font-weight:700;line-height:1.05">less gas than<br>the best Solidity.</p>
    <div class="abs" style="left:76px;top:760px">${benchChart(928)}</div>
    <p class="abs fine" style="left:76px;top:1160px;width:900px;font-size:14px">Gas per transaction, measured with eth_estimateGas on Robinhood Chain testnet with identical calldata. Solidity fits 50 signatures; Stylus fits 100 in 6.58M gas. Data: benchmarks/results/BENCHMARKS.md</p>
    <div class="abs" style="left:76px;right:76px;bottom:44px">${footer()}</div>`,
  ),
);

add(
  "posters/04-counted-once",
  ...P,
  page(
    `<div class="abs" style="left:76px;top:76px">${wordmark(26)}</div>
    <h1 class="abs display" style="left:70px;top:190px;font-size:150px">Counted<br>once.</h1>
    <div class="abs" style="left:76px;top:560px;right:76px;background:var(--sumi);color:var(--washi);padding:38px 44px;font-family:var(--mono);font-size:27px;line-height:1.5">
      nullifier = keccak256(<br>&nbsp;&nbsp;tag, merchantId, receiptHash<br>)
      <div class="abs" style="right:36px;top:-58px">${seal(116, { rotate: 10 })}</div>
    </div>
    <div class="abs" style="left:76px;right:76px;top:820px;display:grid;gap:26px;font-size:28px">
      <div style="display:flex;align-items:center;gap:22px">${tick(true)}<span>First claim of the receipt. <span class="muted">Shares minted.</span></span></div>
      <div style="display:flex;align-items:center;gap:22px">${tick(false)}<span>Same receipt, another wallet. <span class="muted">Already used.</span></span></div>
      <div style="display:flex;align-items:center;gap:22px">${tick(false)}<span>Same receipt, edited amount. <span class="muted">Signature breaks.</span></span></div>
    </div>
    <p class="abs" style="left:76px;top:1090px;width:880px;font-size:24px;line-height:1.45;color:var(--charcoal)">The nullifier ignores who claims, how much and when. One receipt counts once, for anyone, enforced on-chain.</p>
    <div class="abs" style="left:76px;right:76px;bottom:56px">${footer()}</div>`,
  ),
);

add(
  "posters/05-owned-not-pointed",
  ...P,
  page(
    `<img src="art/blossom-strip.png" class="abs" style="left:-80px;right:-80px;bottom:-60px;width:calc(100% + 160px);opacity:.95">
    <div class="abs" style="left:76px;top:76px">${wordmark(26)}</div>
    <h1 class="abs display" style="left:70px;top:190px;font-size:150px">Owned,<br>not pointed.</h1>
    <div class="abs" style="left:76px;right:76px;top:560px;display:grid;grid-template-columns:1fr 1fr;gap:44px;font-size:25px;line-height:1.4">
      <div>
        <p class="mincho" style="font-size:34px;font-weight:700;color:var(--stone)">Points</p>
        <div class="rule" style="margin:16px 0 20px"></div>
        <p style="color:var(--stone)">Can expire.<br>Can be devalued.<br>Locked to one program.</p>
      </div>
      <div>
        <p class="mincho" style="font-size:34px;font-weight:700">Vault shares</p>
        <div style="height:2px;background:var(--shu);margin:16px 0 20px"></div>
        <p>No expiry.<br>No admin can dilute or freeze them.<br>Standard ERC-4626, in your wallet.</p>
      </div>
    </div>
    <p class="abs fine" style="left:76px;top:860px;width:880px;font-size:15px">Shares track the vault's asset, whose value can rise or fall. People belong to 14.8 loyalty programs on average and use 6.7 (Bond Loyalty Report 2020, cited in arXiv:2512.00738).</p>
    <div class="abs" style="left:76px;right:76px;top:960px">${footer()}</div>`,
  ),
);

add(
  "posters/06-live-now",
  ...P,
  page(
    `<div class="fill" style="background:var(--sumi)"></div>
    <img src="art/landscape.png" class="abs" style="left:0;bottom:0;width:100%;opacity:.16;filter:grayscale(1) invert(1)">
    <div class="abs" style="left:76px;top:76px">${wordmark(26, { color: "var(--washi)", paper: "var(--sumi)" })}</div>
    <h1 class="abs display" style="left:70px;top:190px;font-size:150px;color:var(--washi)">Live.<br>Try it.</h1>
    <div class="abs" style="left:76px;top:560px">${qr(300, 26)}</div>
    <div class="abs" style="left:450px;top:574px;right:76px;color:var(--washi)">
      <p style="font-size:30px;font-weight:600">stockbacks.vercel.app</p>
      <p style="margin-top:10px;font-size:22px;opacity:.8;line-height:1.4">Issue a signed receipt at the simulated till, then claim it with any wallet on Robinhood Chain testnet.</p>
    </div>
    <div class="abs" style="left:76px;right:76px;top:960px;color:var(--washi);display:grid;grid-template-columns:1fr 1fr;gap:26px 40px;font-size:19px;line-height:1.35">
      <div><p style="opacity:.6">Registry</p><p class="mono">${short(FACTS.registry)}</p></div>
      <div><p style="opacity:.6">Stylus verifier</p><p class="mono">${short(FACTS.stylus)}</p></div>
      <div><p style="opacity:.6">Merchant-signed claim</p><p class="mono">${short(FACTS.sealedTx)}</p></div>
      <div><p style="opacity:.6">Tests</p><p>83 Solidity, 5 Rust, 42 web</p></div>
    </div>
    <div class="abs" style="right:70px;top:120px">${seal(150, { rotate: -8, paper: "var(--sumi)" })}</div>
    <div class="abs" style="left:76px;right:76px;bottom:56px">${footer({ color: "rgba(244,239,227,.85)", url: false })}</div>`,
    { cls: "" },
  ),
);

// ============================================================== SOCIAL (exact platform sizes)
add(
  "social/og-1200x630",
  1200,
  630,
  page(
    `<img src="art/landscape.png" class="abs" style="right:-260px;top:-40px;height:110%">
    <div class="fill" style="background:linear-gradient(90deg,var(--washi) 44%,rgba(244,239,227,0) 78%)"></div>
    <div class="abs" style="left:64px;top:60px">${wordmark(24)}</div>
    <h1 class="abs display" style="left:60px;top:170px;font-size:104px">Every receipt,<br>sealed.</h1>
    <p class="abs" style="left:64px;top:420px;width:520px;font-size:25px;line-height:1.38;color:var(--charcoal)">Scan a merchant-signed receipt. Own a share of the brand you bought from.</p>
    <p class="abs" style="left:64px;bottom:44px;font-size:17px;color:var(--charcoal)"><b>stockbacks.vercel.app</b> &nbsp; Live on Robinhood Chain testnet</p>
    <div class="abs" style="right:64px;bottom:40px">${seal(96, { rotate: -8 })}</div>`,
  ),
  { scale: 1 },
);
add(
  "social/x-header-1500x500",
  1500,
  500,
  page(
    `<img src="art/sky.png" class="abs cover" style="inset:0;object-position:center 60%">
    <div class="abs" style="left:520px;right:120px;top:150px;text-align:center">
      ${wordmark(46)}
      <p class="mincho" style="margin-top:26px;font-size:40px;font-weight:700">Scan. Prove. Own.</p>
      <p style="margin-top:14px;font-size:19px;color:var(--charcoal)">Every receipt, sealed. Live on Robinhood Chain testnet.</p>
    </div>`,
  ),
  { scale: 1 },
);
add(
  "social/linkedin-1584x396",
  1584,
  396,
  page(
    `<img src="art/sky.png" class="abs cover" style="inset:0;object-position:center 64%">
    <div class="abs" style="left:560px;right:100px;top:110px;text-align:center">
      ${wordmark(42)}
      <p class="mincho" style="margin-top:22px;font-size:34px;font-weight:700">Every receipt, sealed.</p>
      <p style="margin-top:10px;font-size:18px;color:var(--charcoal)">Merchant-signed receipts become brand-vault shares, verified in Rust on Arbitrum Stylus.</p>
    </div>`,
  ),
  { scale: 1 },
);
add(
  "social/square-1080",
  1080,
  1080,
  page(
    `<img src="art/blossom-strip.png" class="abs" style="left:-60px;bottom:-40px;width:1200px;opacity:.9">
    <div class="abs" style="left:0;right:0;top:120px;display:grid;place-items:center">${seal(360, { rotate: -8 })}</div>
    <h1 class="abs display" style="left:0;right:0;top:560px;text-align:center;font-size:92px">Every receipt,<br>sealed.</h1>
    <p class="abs" style="left:0;right:0;top:775px;text-align:center;font-size:24px;color:var(--charcoal)">stockbacks.vercel.app</p>`,
  ),
  { scale: 1 },
);
add(
  "social/story-1080x1920",
  1080,
  1920,
  page(
    `<img src="art/landscape.png" class="abs" style="right:-700px;top:0;height:62%;opacity:.95">
    <div class="fill" style="background:linear-gradient(180deg,rgba(244,239,227,0) 30%,var(--washi) 58%)"></div>
    <div class="abs" style="left:80px;top:140px">${wordmark(30)}</div>
    <div class="abs vertical mincho" style="left:84px;top:300px;font-size:84px;font-weight:800;letter-spacing:.3em">読証有</div>
    <h1 class="abs display" style="left:76px;top:1000px;font-size:150px">Scan.<br>Prove.<br>Own.</h1>
    <div class="abs" style="left:80px;top:1500px;display:flex;gap:40px;align-items:center">${qr(220, 18)}<p style="font-size:30px;line-height:1.35">Scan to try the<br>live testnet demo.</p></div>
    <div class="abs" style="right:80px;top:1060px">${seal(170, { rotate: -10 })}</div>
    <p class="abs fine" style="left:80px;bottom:80px;font-size:20px">Testnet demo. Mock brand assets, not securities.</p>`,
  ),
  { scale: 1 },
);

// ============================================================== EXPLAINERS (16:9, 3840×2160)
const W = [1920, 1080];
const exCss = `
  .h { font-family:var(--display); font-weight:800; font-size:72px; line-height:1; letter-spacing:-.01em }
  .lede { font-size:26px; color:var(--charcoal); line-height:1.4 }
  .card { background:#fbf8f1; border:1.5px solid rgba(23,23,23,.14); padding:30px 28px }
  .card h3 { font-family:var(--display); font-weight:700; font-size:32px; line-height:1.1 }
  .card p { margin-top:12px; font-size:19px; line-height:1.45; color:var(--charcoal) }
  .num { font-family:var(--display); font-weight:800; font-size:44px; color:var(--shu); line-height:1 }
  .key { display:inline-flex; align-items:center; gap:8px; font-size:16px; padding:6px 10px; background:var(--washi-deep); margin-top:14px }
`;
const head = (title, lede, top = 80) =>
  `<div class="abs" style="left:96px;top:${top}px;right:96px;display:flex;justify-content:space-between;align-items:flex-start">
    <div><h1 class="h">${title}</h1>${lede ? `<p class="lede" style="margin-top:20px;max-width:1080px">${lede}</p>` : ""}</div>
    <div style="margin-top:10px">${wordmark(22)}</div>
  </div>`;
const exFoot = `<p class="abs fine" style="left:96px;bottom:46px;right:96px;display:flex;justify-content:space-between"><span>stockbacks.vercel.app</span><span>Robinhood Chain testnet. Simulated merchant, mock brand assets.</span></p>`;
const keyIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/></svg>`;

const STEPS = [
  ["Till signs", "The merchant signs every field: merchant, brand, receipt ID, amount, time, expiry.", "Merchant key"],
  ["You scan", "The receipt travels as a QR code. Nothing personal is in it.", null],
  ["Attester checks", "Verifies the merchant signature, expiry, brand and prior use. Then signs a claim of hashes only.", "Attester key"],
  ["Stylus verifies", "Rust on Arbitrum checks the Ed25519 signature, at up to 9.2x less gas than Solidity.", null],
  ["Registry decides", "Burns the receipt's nullifier, applies eligibility, caps and the sponsor budget.", null],
  ["You own", "Shares of the brand's vault are minted to your wallet. No admin can touch them.", null],
];
add(
  "explainers/01-how-it-works",
  ...W,
  page(
    `${head("From receipt to ownership", "Six steps. The last three happen inside one transaction on Robinhood Chain.")}
    <div class="abs" style="left:96px;right:96px;top:330px;display:grid;grid-template-columns:repeat(6,1fr);gap:18px">
      ${STEPS.map(
        ([t, b, k], i) => `<div class="card" style="position:relative;min-height:440px;${i >= 3 ? "border-color:rgba(200,58,47,.45)" : ""}">
          <span class="num">${i + 1}</span>
          <h3 style="margin-top:22px">${t}</h3><p>${b}</p>
          ${k ? `<span class="key">${keyIcon}${k}</span>` : ""}
          ${i === 0 ? `<div class="abs" style="right:18px;top:18px">${kakuin(64, { rotate: -6 })}</div>` : ""}
          ${i === 5 ? `<div class="abs" style="right:18px;top:16px">${seal(66, { rotate: -8 })}</div>` : ""}
        </div>`,
      ).join("")}
    </div>
    <div class="abs" style="left:calc(96px + 3 * (100% - 192px + 18px) / 6);right:96px;top:796px">
      <div style="height:2px;background:var(--shu)"></div>
      <p style="margin-top:14px;font-size:21px">One transaction: <span class="mono" style="font-size:19px">submitClaim</span> on Robinhood Chain testnet</p>
    </div>
    <div class="abs" style="left:96px;top:796px;width:calc(3 * (100% - 192px + 18px) / 6 - 18px)">
      <div style="height:2px;background:rgba(23,23,23,.35)"></div>
      <p style="margin-top:14px;font-size:21px;color:var(--charcoal)">Off-chain, in seconds</p>
    </div>
    ${exFoot}`,
    { css: exCss },
  ),
);

add(
  "explainers/02-trust-boundary",
  ...W,
  page(
    `${head("Who holds which key", "Each party can only do its own job. No key ever reaches the browser.")}
    <div class="abs" style="left:96px;right:96px;top:320px;display:grid;grid-template-columns:1fr 70px 1fr 70px 1fr;align-items:stretch">
      <div class="card"><h3>Merchant till</h3><span class="key">${keyIcon}Merchant private key</span>
        <p>Signs each receipt at the moment of sale. In this demo the till is simulated and public.</p></div>
      <div style="display:grid;place-items:center;font-size:40px;color:var(--stone)">→</div>
      <div class="card"><h3>STOCKBACK attester</h3><span class="key">${keyIcon}Merchant public key</span> <span class="key">${keyIcon}Attester key</span>
        <p>Accepts a receipt only if the merchant signature verifies, it hasn't expired, the brand is supported and it was never claimed. Then signs a hashes-only claim.</p></div>
      <div style="display:grid;place-items:center;font-size:40px;color:var(--stone)">→</div>
      <div class="card" style="border-color:rgba(200,58,47,.45)"><h3>Robinhood Chain</h3><span class="key" style="background:transparent;border:1px dashed var(--stone)">No secrets</span>
        <p>Stylus verifies the attester signature. The registry burns the nullifier and enforces caps and budget. Vaults have no admin.</p></div>
    </div>
    <div class="abs" style="left:96px;right:96px;top:760px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
      <div style="border-left:3px solid var(--shu);padding-left:22px"><p class="mincho" style="font-size:28px;font-weight:700">If the attester key leaks</p>
        <p style="margin-top:10px;font-size:20px;line-height:1.45;color:var(--charcoal)">At most 100,000 demo units per brand per day, until the sponsor budget runs out. Existing holders are unaffected. The key can be rotated on the Stylus allowlist without a redeploy.</p></div>
      <div style="border-left:3px solid var(--sumi);padding-left:22px"><p class="mincho" style="font-size:28px;font-weight:700">What this does not prove</p>
        <p style="margin-top:10px;font-size:20px;line-height:1.45;color:var(--charcoal)">That one person holds one wallet. Replay is blocked per receipt; Sybil resistance is future work. The QR is a bearer token, like a paper receipt.</p></div>
    </div>
    ${exFoot}`,
    { css: exCss },
  ),
);

const TIERS = [
  ["Merchant-signed receipt", "The receipt is unaltered since the merchant signed it. Merchant simulated in the demo.", "Live demo", true],
  ["Attested photo or OCR", "The attester signed what it was given. A real purchase is not independently established.", "Live demo", false],
  ["Payment or order proof", "Provenance from the payment or order source itself, for example zkTLS.", "Roadmap", false],
];
add(
  "explainers/03-evidence-tiers",
  ...W,
  page(
    `${head("Not every proof proves the same thing", "STOCKBACK labels every claim with the evidence behind it. A photo is never treated as proof of purchase.")}
    <div class="abs" style="left:96px;right:96px;top:360px;display:grid;grid-template-columns:repeat(3,1fr);gap:24px">
      ${TIERS.map(
        ([t, b, st, strong], i) => `<div class="card" style="min-height:420px;${st === "Roadmap" ? "background:transparent;border-style:dashed" : ""};position:relative">
          <div style="display:flex;justify-content:space-between;align-items:center"><span class="num" style="font-size:96px;${strong ? "" : "color:var(--stone)"}">${i + 1}</span>
          <span style="font-size:17px;padding:6px 12px;border:1.5px ${st === "Roadmap" ? "dashed" : "solid"} var(--sumi)">${st}</span></div>
          <h3 style="margin-top:28px;font-size:38px">${t}</h3><p style="font-size:22px">${b}</p>
          ${strong ? `<div class="abs" style="right:26px;bottom:24px">${kakuin(92, { rotate: -7 })}</div>` : ""}
        </div>`,
      ).join("")}
    </div>
    <p class="abs fine" style="left:96px;top:830px;width:1300px;font-size:18px">Why it matters: people pick an AI-edited receipt at chance (0.501) and forensic detectors reach AUC 0.53–0.60 (Wu et al., arXiv:2604.25213, 2026).</p>
    ${exFoot}`,
    { css: exCss },
  ),
);

add(
  "explainers/04-stylus-benchmark",
  ...W,
  page(
    `${head("9.2x less gas with Stylus", "Strict Ed25519 verification of attestation signatures. Gas per transaction, measured on Robinhood Chain testnet.")}
    <div class="abs" style="left:96px;top:390px">${benchChart(1400, { row: 104, bar: 30, label: 220, font: 21 })}</div>
    <div class="abs" style="right:96px;top:400px;width:300px;display:grid;gap:34px">
      <div><p class="display" style="font-size:72px">5.3x</p><p style="font-size:19px;color:var(--charcoal)">cheaper for 1 signature</p></div>
      <div><p class="display" style="font-size:72px">9.2x</p><p style="font-size:19px;color:var(--charcoal)">cheaper for 50</p></div>
      <div><p class="display" style="font-size:72px">100</p><p style="font-size:19px;color:var(--charcoal)">signatures in one transaction, which Solidity can't fit</p></div>
    </div>
    <p class="abs fine" style="left:96px;bottom:90px;font-size:17px">eth_estimateGas, identical calldata, both verifiers deployed on chain 46630. ECDSA through the EVM precompile is cheaper still; Stylus earns its place for schemes the EVM lacks. Data: benchmarks/results/BENCHMARKS.md</p>
    ${exFoot}`,
    { css: exCss },
  ),
);

const CHECKS = [
  ["Claimant", "The signed claimant must be the wallet sending the transaction."],
  ["Deadline", "The claim expires; it can't outlive the merchant receipt."],
  ["Nullifier", "keccak256(tag, merchantId, receiptHash) must be unused, then it is burned."],
  ["Signature", "The Stylus verifier checks the attester's Ed25519 signature."],
  ["Eligibility", "Brand active, INR, ₹100 to ₹5,00,000, bought within 30 days."],
  ["Reward", "Rate x multiplier, clipped per claim; daily wallet and brand caps."],
  ["Budget", "Paid only from what the brand's sponsor deposited."],
  ["Shares", "The brand asset is deposited into its ERC-4626 vault in your name."],
];
add(
  "explainers/05-one-transaction",
  ...W,
  page(
    `${head("Inside one claim transaction", "Every check runs on-chain, in order. If any fails, nothing changes and the receipt is not burned.")}
    <div class="abs" style="left:96px;right:96px;top:330px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px">
      ${CHECKS.map(
        ([t, b], i) => `<div class="card" style="min-height:230px"><div style="display:flex;align-items:center;gap:14px"><span class="num" style="font-size:36px">${i + 1}</span><h3 style="font-size:30px">${t}</h3></div><p style="font-size:19px">${b}</p></div>`,
      ).join("")}
    </div>
    <p class="abs" style="left:96px;top:860px;font-size:22px;color:var(--charcoal)">Contract: <span class="mono" style="font-size:20px">ReceiptCommitmentRegistry.submitClaim</span> at <span class="mono" style="font-size:20px">${short(FACTS.registry)}</span>, covered by 83 Foundry tests including fuzz and invariants.</p>
    ${exFoot}`,
    { css: exCss },
  ),
);

// ============================================================== PITCH FRAMES (16:9)
const stat = (big, label, color = "var(--sumi)") =>
  `<div><p class="display" style="font-size:118px;color:${color}">${big}</p><p style="margin-top:16px;font-size:24px;line-height:1.4;color:var(--charcoal);max-width:460px">${label}</p></div>`;

add(
  "pitch/01-cover",
  ...W,
  page(
    `<img src="art/landscape.png" class="abs" style="right:-120px;top:0;height:100%">
    <div class="fill" style="background:linear-gradient(90deg,var(--washi) 30%,rgba(244,239,227,.7) 48%,rgba(244,239,227,0) 70%)"></div>
    <div class="abs" style="left:110px;top:100px">${wordmark(30)}</div>
    <h1 class="abs display" style="left:104px;top:300px;font-size:170px">Every receipt,<br>sealed.</h1>
    <p class="abs" style="left:110px;top:690px;width:760px;font-size:32px;line-height:1.4;color:var(--charcoal)">Merchant-signed receipts become shares of the brand you bought from, verified in Rust on Arbitrum Stylus.</p>
    <div class="abs" style="left:780px;top:520px">${seal(150, { rotate: -9 })}</div>
    <p class="abs" style="left:110px;bottom:84px;font-size:22px">Arbitrum Open House Singapore Buildathon &nbsp;&nbsp; <b>stockbacks.vercel.app</b></p>`,
    { css: exCss },
  ),
);
add(
  "pitch/02-problem-receipts",
  ...W,
  page(
    `${head("Receipts stopped being evidence", "Any reward, refund or warranty flow that trusts a photo now pays out on forgeries.")}
    <div class="abs" style="left:96px;right:96px;top:400px;display:grid;grid-template-columns:repeat(3,1fr);gap:60px">
      ${stat("50.1%", "of people pick the AI-edited receipt in a side-by-side test. That is chance.", "var(--shu)")}
      ${stat("0.53–0.60", "AUC of the best forensic detectors on those forgeries. Barely better than guessing.")}
      ${stat("< 1 s", "and a few cents to change one number on a receipt photo.")}
    </div>
    <p class="abs fine" style="left:96px;bottom:110px;font-size:17px">Wu et al., “When the Forger Is the Judge: GPT-Image-2 Cannot Recognize Its Own Faked Documents”, arXiv:2604.25213 (2026).</p>
    ${exFoot}`,
    { css: exCss },
  ),
);
add(
  "pitch/03-problem-loyalty",
  ...W,
  page(
    `${head("Points don't feel like ownership", "Loyalty programs are closed, confusing and can be changed under you.")}
    <div class="abs" style="left:96px;right:96px;top:400px;display:grid;grid-template-columns:repeat(3,1fr);gap:60px">
      ${stat("6.7 / 14.8", "programs people actually use, out of the ones they belong to.")}
      ${stat("73%", "of consumers find loyalty programs too complicated.", "var(--shu)")}
      ${stat("~60%", "of coalition loyalty programs fail within ten years.")}
    </div>
    <p class="abs fine" style="left:96px;bottom:110px;font-size:17px">Bond Brand Loyalty Report 2020, as cited in Oamen et al., “Orchestrating Rewards in the Era of Intelligence-Driven Commerce”, arXiv:2512.00738.</p>
    ${exFoot}`,
    { css: exCss },
  ),
);
add(
  "pitch/04-solution",
  ...W,
  page(
    `${head("Seal the receipt. Own the brand.", "")}
    <div class="abs" style="left:96px;right:96px;top:300px;display:grid;grid-template-columns:repeat(3,1fr);gap:28px">
      ${[
        ["読", "Scan", "The merchant's till signs the receipt. You scan its QR. No photo needs to be trusted."],
        ["証", "Prove", "The signature is checked, the receipt is counted once, and Stylus verifies the claim on-chain."],
        ["有", "Own", "You receive shares of that brand's vault. No admin can dilute, freeze or expire them."],
      ]
        .map(
          ([k, t, b]) => `<div class="card" style="min-height:520px;padding:44px 40px">
          <p class="mincho" style="font-size:150px;font-weight:800;line-height:1;color:var(--shu)">${k}</p>
          <h3 style="margin-top:36px;font-size:52px">${t}</h3><p style="font-size:24px">${b}</p></div>`,
        )
        .join("")}
    </div>
    ${exFoot}`,
    { css: exCss },
  ),
);
add(
  "pitch/05-built",
  ...W,
  page(
    `${head("Built, deployed, tested", "Everything below runs today on Robinhood Chain testnet.")}
    <div class="abs" style="left:96px;right:96px;top:340px;display:grid;grid-template-columns:repeat(4,1fr);gap:56px 48px">
      ${stat("9", "contracts: 8 Solidity plus a Rust verifier on Stylus")}
      ${stat("83", "Foundry tests, including fuzz and invariants")}
      ${stat("47", "more tests: 5 Rust, 20 receipt-signing, 22 live integration")}
      ${stat("9.2x", "less gas than Solidity for Ed25519", "var(--shu)")}
    </div>
    <div class="abs" style="left:96px;right:96px;top:730px;display:grid;grid-template-columns:repeat(3,1fr);gap:48px;font-size:21px;line-height:1.4">
      <div><p class="muted">Registry</p><p class="mono">${FACTS.registry}</p></div>
      <div><p class="muted">Stylus verifier</p><p class="mono">${FACTS.stylus}</p></div>
      <div><p class="muted">Merchant-signed claim</p><p class="mono" style="word-break:break-all">${short(FACTS.sealedTx)}</p></div>
    </div>
    ${exFoot}`,
    { css: exCss },
  ),
);
add(
  "pitch/06-honest-roadmap",
  ...W,
  page(
    `${head("What's real, what's next", "We'd rather show the edges than hide them.")}
    <div class="abs" style="left:96px;right:96px;top:330px;display:grid;grid-template-columns:repeat(3,1fr);gap:28px">
      <div class="card" style="min-height:520px;border-color:rgba(200,58,47,.45)"><h3 style="font-size:40px">Implemented</h3><p style="font-size:22px;line-height:1.6">Merchant-signed receipts (simulated merchant)<br>Photo and OCR attestation<br>One claim per receipt<br>Caps and sponsor budgets<br>Stylus Ed25519 verification<br>Admin-less ERC-4626 vaults<br>USDG funding adapter</p></div>
      <div class="card" style="min-height:520px"><h3 style="font-size:40px">Next</h3><p style="font-size:22px;line-height:1.6">Hold period with refund voiding<br>Real merchant keys in a POS or HSM<br>Merchant key registry and revocation<br>k-of-n attesters, rotation runbook<br>Stronger Sybil resistance<br>Multisig and timelock</p></div>
      <div class="card" style="min-height:520px;background:transparent;border-style:dashed"><h3 style="font-size:40px">Not claimed</h3><p style="font-size:22px;line-height:1.6">Merchant partnerships<br>Users or traction<br>Measured fraud reduction<br>Retention effects<br>Real securities: all brand assets are testnet mocks</p></div>
    </div>
    ${exFoot}`,
    { css: exCss },
  ),
);
add(
  "pitch/07-close",
  ...W,
  page(
    `<img src="art/sky.png" class="abs cover" style="inset:0;object-position:center 70%;opacity:.95">
    <div class="fill" style="background:radial-gradient(ellipse 66% 64% at 50% 42%,rgba(244,239,227,.97) 55%,rgba(244,239,227,0) 100%)"></div>
    <div class="abs" style="left:0;right:0;top:150px;text-align:center">
      ${seal(170, { rotate: -8 })}
      <h1 class="display" style="margin-top:40px;font-size:132px">Scan. Prove. Own.</h1>
    </div>
    <div class="abs" style="left:0;right:0;top:640px;display:flex;justify-content:center;align-items:center;gap:44px">
      ${qr(210, 18)}
      <div style="text-align:left"><p style="font-size:36px;font-weight:600">stockbacks.vercel.app</p><p style="margin-top:10px;font-size:22px;color:var(--charcoal)">Live on Robinhood Chain testnet.<br>github.com/notwen123/STOCKBACK</p></div>
    </div>`,
    { css: exCss },
  ),
);

// ============================================================== BRAND GUIDELINES
const swatch = (hex, name, use, dark = false) =>
  `<div><div style="height:200px;background:${hex};${hex === "#f4efe3" ? "border:1.5px solid rgba(23,23,23,.15)" : ""}"></div>
  <p class="mincho" style="margin-top:16px;font-size:26px;font-weight:700">${name}</p>
  <p class="mono" style="font-size:16px;margin-top:4px">${hex.toUpperCase()}</p>
  <p style="font-size:17px;margin-top:6px;color:var(--charcoal);line-height:1.4">${use}</p></div>`;
add(
  "guidelines/01-logo",
  ...W,
  page(
    `${head("The seal", "In Japan a hanko seal is a signature on paper. Ours stands for the signature that makes a receipt count.")}
    <div class="abs" style="left:96px;top:320px;display:grid;grid-template-columns:420px 420px 1fr;gap:40px;right:96px">
      <div class="card" style="height:420px;display:grid;place-items:center">${seal(260)}</div>
      <div class="card" style="height:420px;display:grid;place-items:center;background:var(--sumi);border:0">${seal(260, { paper: "var(--sumi)" })}</div>
      <div class="card" style="height:420px;display:grid;place-items:center;gap:30px">${wordmark(56)}<div style="background:var(--sumi);padding:26px 34px">${wordmark(40, { color: "var(--washi)", paper: "var(--sumi)" })}</div></div>
    </div>
    <div class="abs" style="left:96px;right:96px;top:790px;display:grid;grid-template-columns:repeat(4,1fr);gap:40px;font-size:19px;line-height:1.45;color:var(--charcoal)">
      <p><b style="color:var(--sumi)">Stamped</b> seal for posters and hero moments. <b style="color:var(--sumi)">Flat</b> seal below 64 px and in the UI.</p>
      <p>Keep clear space of half the seal's width on every side.</p>
      <p>Only vermilion on washi or sumi. Never recolour, outline, add shadows or rotate more than 12°.</p>
      <p>Never pair the seal with real brand logos in marketing. Demo vaults use brand names only.</p>
    </div>
    ${exFoot}`,
    { css: exCss },
  ),
);
add(
  "guidelines/02-colour-type",
  ...W,
  page(
    `${head("Colour and type", "")}
    <div class="abs" style="left:96px;right:96px;top:230px;display:grid;grid-template-columns:repeat(6,1fr);gap:24px">
      ${swatch("#f4efe3", "Washi", "Paper. Every background.")}
      ${swatch("#171717", "Sumi", "Ink. Type and lines.")}
      ${swatch("#c83a2f", "Shu", "Vermilion. The seal and one emphasis per layout.")}
      ${swatch("#8f211d", "Deep shu", "Small text on washi that must be red.")}
      ${swatch("#8a8378", "Stone", "Muted text and rules.")}
      ${swatch("#2f6f9f", "Ai", "Indigo. Second data series only.")}
    </div>
    <div class="abs" style="left:96px;right:96px;top:640px;display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:48px">
      <div><p class="display" style="font-size:96px">Shippori Mincho</p><p style="margin-top:12px;font-size:19px;color:var(--charcoal)">Display and the kanji 読 証 有 印. Weights 700–800, tight leading.</p></div>
      <div><p style="font-size:56px;font-weight:500;line-height:1.1">Instrument Sans</p><p style="margin-top:12px;font-size:19px;color:var(--charcoal)">Body and interface. Sentence case, plain verbs.</p></div>
      <div><p class="mono" style="font-size:44px;line-height:1.2">IBM Plex Mono</p><p style="margin-top:12px;font-size:19px;color:var(--charcoal)">Only for real data: hashes, addresses, gas.</p></div>
    </div>
    ${exFoot}`,
    { css: exCss },
  ),
);

// ============================================================== DECK (11 slides, 16:9, visual-first)
const dkCss = exCss + `
  .t { font-family:var(--display); font-weight:800; font-size:86px; line-height:.98; letter-spacing:-.015em }
  .sub { font-size:28px; color:var(--charcoal); line-height:1.35 }
  .big { font-family:var(--display); font-weight:800; line-height:.92; letter-spacing:-.02em }
  .cap { font-size:22px; color:var(--charcoal); line-height:1.35 }
  .src { font-size:15px; color:var(--stone) }
  .frame { background:#fbf8f1; box-shadow:0 40px 70px -40px rgba(23,23,23,.55); border:1px solid rgba(23,23,23,.1) }
  .frame .bar { height:30px; display:flex; gap:7px; align-items:center; padding:0 12px; border-bottom:1px solid rgba(23,23,23,.1) }
  .frame .bar i { width:10px; height:10px; border-radius:50%; background:rgba(23,23,23,.18) }
  .box { position:absolute; background:#fbf8f1; border:1.5px solid rgba(23,23,23,.2); padding:18px 20px }
  .box b { display:block; font-family:var(--display); font-size:25px; line-height:1.1 }
  .box span { display:block; margin-top:6px; font-size:16px; color:var(--charcoal); line-height:1.35 }
`;
const slide = (n, label, body, { title, sub, dark = false } = {}) =>
  page(
    `${dark ? `<div class="fill" style="background:var(--sumi)"></div>` : ""}
    <div class="abs" style="left:96px;top:64px;right:96px;display:flex;justify-content:space-between;align-items:center;font-size:18px;color:${dark ? "rgba(244,239,227,.7)" : "var(--stone)"}">
      <span><span class="mono" style="color:var(--shu)">${String(n).padStart(2, "0")}</span>&nbsp;&nbsp;${label}</span>${wordmark(18, dark ? { color: "var(--washi)", paper: "var(--sumi)" } : {})}</div>
    ${title ? `<h1 class="abs t" style="left:92px;top:130px;right:96px;${dark ? "color:var(--washi)" : ""}">${title}</h1>` : ""}
    ${sub ? `<p class="abs sub" style="left:96px;top:${title.includes("<br>") ? 330 : 240}px;max-width:1100px">${sub}</p>` : ""}
    ${body}`,
    { css: dkCss },
  );
const D = (n, name, html) => add(`deck/${String(n).padStart(2, "0")}-${name}`, ...W, html);

// 01 Intro
D(1, "intro", page(
  `<img src="art/landscape.png" class="abs" style="right:-60px;top:0;height:100%">
  <div class="fill" style="background:linear-gradient(90deg,var(--washi) 32%,rgba(244,239,227,.75) 50%,rgba(244,239,227,0) 72%)"></div>
  <div class="abs" style="left:110px;top:96px">${wordmark(30)}</div>
  <h1 class="abs big" style="left:102px;top:280px;font-size:184px">Every receipt,<br>sealed.</h1>
  <div class="abs" style="left:800px;top:500px">${seal(170, { rotate: -9 })}</div>
  <p class="abs sub" style="left:110px;top:720px;font-size:36px">Proof of purchase becomes proof of ownership.</p>
  <p class="abs" style="left:110px;bottom:80px;font-size:20px;color:var(--charcoal)">Arbitrum Open House Singapore Buildathon 2026 &nbsp;&nbsp;<b style="color:var(--sumi)">stockbacks.vercel.app</b></p>`,
  { css: dkCss },
));

// 02 Problem: forgery
D(2, "problem-forgery", slide(2, "The problem", `
  <div class="abs receipt" style="left:130px;top:370px;width:580px;padding:40px 44px 46px;font-size:23px;transform:rotate(-3deg)">
    <p style="text-align:center;font-family:var(--display);font-weight:800;font-size:34px;letter-spacing:.2em">RECEIPT</p>
    <div class="dash" style="margin:18px 0"></div>
    ${receiptLines([["Store", "042 Mumbai"], ["Receipt", "INV-58213"], ["Date", "02 OCT 2026"], "---"])}
    <div class="row" style="font-size:32px;align-items:center"><span>TOTAL</span><span style="position:relative">₹<s style="text-decoration-color:var(--shu);text-decoration-thickness:4px">2,000</s> <b style="color:var(--shu-deep)">20,000</b>
      <svg class="abs" style="left:-24px;top:-30px;width:250px;height:100px;overflow:visible" viewBox="0 0 250 100"><ellipse cx="135" cy="50" rx="128" ry="40" fill="none" stroke="#c83a2f" stroke-width="4" stroke-dasharray="2 0" transform="rotate(-4 125 50)"/></svg></span></div>
    <p style="margin-top:30px;font-family:var(--sans);font-size:22px;color:var(--shu-deep)">Edited by an image model in under a second.</p>
  </div>
  <div class="abs" style="left:880px;top:340px;right:96px;display:grid;gap:70px">
    <div><p class="big" style="font-size:220px;color:var(--shu)">50.1%</p><p class="cap" style="font-size:28px">of people can spot the fake. A coin flip.</p></div>
    <div style="display:grid;grid-template-columns:.8fr 1.2fr;gap:40px">
      <div><p class="big" style="font-size:96px">+244%</p><p class="cap">digital document forgeries, year on year</p></div>
      <div><p class="big" style="font-size:96px;white-space:nowrap;letter-spacing:-.03em">0.53–0.60</p><p class="cap">best forensic detectors (AUC). Barely above chance.</p></div>
    </div>
  </div>
  <p class="abs src" style="left:96px;bottom:54px">Wu et al., arXiv:2604.25213 (2026), incl. Entrust 2025 Identity Fraud Report.</p>`,
  { title: "A receipt photo proves nothing." }));

// 03 Problem: points
const cards = Array.from({ length: 15 }, (_, i) =>
  `<div style="height:124px;border-radius:12px;${i < 7 ? "background:var(--sumi)" : "border:2px dashed rgba(23,23,23,.28)"};position:relative">${i < 7 ? `<span class="abs" style="left:14px;bottom:12px;width:38px;height:6px;border-radius:3px;background:var(--shu)"></span>` : ""}</div>`,
).join("");
D(3, "problem-points", slide(3, "The problem", `
  <div class="abs" style="left:96px;top:330px;width:860px;display:grid;grid-template-columns:repeat(5,1fr);gap:20px">${cards}</div>
  <p class="abs cap" style="left:96px;top:790px;width:860px;font-size:28px"><b style="color:var(--sumi)">14.8</b> loyalty programs joined. <b style="color:var(--sumi)">6.7</b> actually used. The rest sit forgotten.</p>
  <div class="abs" style="left:1090px;top:320px;right:96px;display:grid;gap:80px">
    <div><p class="big" style="font-size:180px;color:var(--shu)">73%</p><p class="cap" style="font-size:26px">find loyalty programs too complicated</p></div>
    <div><p class="big" style="font-size:180px">~60%</p><p class="cap" style="font-size:26px">of coalition programs fail within ten years</p></div>
  </div>
  <p class="abs src" style="left:96px;bottom:54px">Bond Brand Loyalty Report 2020, cited in Oamen et al., arXiv:2512.00738.</p>`,
  { title: "Points never feel like yours." }));

// 04 Painkiller
const arrow = `<svg width="150" height="40" viewBox="0 0 150 40"><path d="M4 22c40-8 80-10 128-4" stroke="#c83a2f" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M118 6l22 14-24 12" stroke="#c83a2f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
D(4, "painkiller", slide(4, "The painkiller", `
  <div class="abs" style="left:96px;right:96px;top:320px;display:grid;grid-template-columns:1fr 150px 1fr 150px 1fr;align-items:center">
    <div style="display:grid;place-items:center">
      <div class="receipt" style="width:380px;padding:32px 32px 40px;font-size:19px;position:relative">
        <p style="text-align:center;font-family:var(--display);font-weight:800;font-size:24px;letter-spacing:.2em">RECEIPT</p><div class="dash" style="margin:12px 0"></div>
        ${receiptLines([["Receipt", "R-TM9X…FD23"], ["Total", "₹2,000"]])}<div class="dash" style="margin:12px 0"></div>
        <p style="font-size:12px;opacity:.6">ed25519 7f3a9c…a1f09b</p>
        <div class="abs" style="right:-36px;bottom:-30px">${kakuin(130)}</div>
      </div>
    </div>
    <div style="display:grid;place-items:center">${arrow}</div>
    <div style="display:grid;place-items:center;position:relative">
      <div style="width:260px;height:260px;border-radius:50%;border:2px solid var(--sumi);display:grid;place-items:center;text-align:center">
        <div><p class="mono" style="font-size:16px;color:var(--charcoal)">Stylus · Rust</p><p class="big" style="font-size:52px;margin-top:8px">verify()</p><p style="font-size:17px;margin-top:8px;color:var(--charcoal)">signature · once · caps</p></div>
      </div>
    </div>
    <div style="display:grid;place-items:center">${arrow}</div>
    <div style="display:grid;place-items:center;text-align:center">${seal(250, { rotate: -8 })}<p class="mono" style="margin-top:18px;font-size:20px">+15 sbNKE · vault shares</p></div>
  </div>
  <div class="abs" style="left:96px;right:96px;top:760px;display:grid;grid-template-columns:1fr 150px 1fr 150px 1fr;text-align:center">
    ${[["読", "Scan", "The merchant signs the receipt"], ["証", "Prove", "Checked once, on Arbitrum"], ["有", "Own", "Brand shares in your wallet"]]
      .map(([k, t, b], i) => `${i ? "<div></div>" : ""}<div><p class="mincho" style="font-size:64px;font-weight:800;color:var(--shu);line-height:1">${k}</p><p class="mincho" style="font-size:36px;font-weight:700;margin-top:10px">${t}</p><p class="cap" style="margin-top:6px">${b}</p></div>`)
      .join("")}
  </div>`,
  { title: "Seal the receipt. Own the brand." }));

// 05 Uniqueness
const miniBars = `<div style="display:grid;gap:10px;width:190px"><span style="height:26px;width:190px;background:var(--ai);border-radius:0 4px 4px 0"></span><span style="height:26px;width:21px;background:var(--shu);border-radius:0 4px 4px 0"></span></div>`;
const vault = `<svg width="150" height="150" viewBox="0 0 100 100"><rect x="8" y="8" width="84" height="84" rx="6" fill="#171717"/><circle cx="50" cy="50" r="26" fill="none" stroke="#f4efe3" stroke-width="4"/><path d="M50 30v40M30 50h40" stroke="#f4efe3" stroke-width="3"/><circle cx="50" cy="50" r="9" fill="#c83a2f"/></svg>`;
const formula = `<div style="background:var(--sumi);color:var(--washi);font-family:var(--mono);font-size:19px;line-height:1.5;padding:18px 22px;width:220px">keccak256(<br>&nbsp;tag,<br>&nbsp;merchant,<br>&nbsp;receipt)</div>`;
D(5, "uniqueness", slide(5, "Why it's different", `
  <div class="abs" style="left:96px;right:96px;top:290px;display:grid;grid-template-columns:1fr 1fr;gap:28px">
    ${[
      [kakuin(150), "Signature, not pixels", "Change one digit and the claim fails."],
      [formula, "Counted once, for anyone", "The receipt's nullifier burns on-chain."],
      [vault, "Yours. No admin.", "Admin-less ERC-4626 vault shares."],
      [miniBars, "9.2x cheaper to verify", "Ed25519 in Rust on Arbitrum Stylus."],
    ]
      .map(([v, t, b]) => `<div class="card" style="display:grid;grid-template-columns:240px 1fr;align-items:center;gap:30px;min-height:300px;padding:36px 40px"><div style="display:grid;place-items:center">${v}</div><div><h3 style="font-size:44px">${t}</h3><p style="font-size:24px">${b}</p></div></div>`)
      .join("")}
  </div>`,
  { title: "Four guarantees. One transaction." }));

// 06 Market
const mk = [
  ["2025", 13.6, false],
  ["2026", 15.3, false],
  ["2033", 31.1, true],
];
const mkBars = `<div style="display:flex;align-items:flex-end;gap:30px;height:400px">${mk
  .map(
    ([y, v, proj]) => `<div style="display:grid;justify-items:center;gap:10px"><span class="mono" style="font-size:20px">$${v}B</span>
    <span style="width:110px;height:${(v / 31.1) * 330}px;border-radius:4px 4px 0 0;${proj ? "background:repeating-linear-gradient(45deg,rgba(200,58,47,.45) 0 8px,transparent 8px 16px);outline:2px dashed var(--shu);outline-offset:-2px" : "background:var(--shu)"}"></span>
    <span style="font-size:19px;color:var(--charcoal)">${y}${proj ? " (proj.)" : ""}</span></div>`,
  )
  .join("")}</div>`;
D(6, "market", slide(6, "Market", `
  <div class="abs" style="left:96px;right:96px;top:350px;display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:64px;align-items:end">
    <div><p class="big" style="font-size:190px;color:var(--shu)">24.07B</p><p class="cap" style="font-size:27px;margin-top:14px">UPI payments in India in September 2026 alone. Singapore's PayNow and SGQR leave the same merchant trail. Each one is a purchase that could be sealed.</p><p class="src" style="margin-top:12px">NPCI UPI product statistics</p></div>
    <div>${mkBars}<p class="cap" style="font-size:24px;margin-top:20px">Loyalty software market, growing 10.7% a year</p><p class="src" style="margin-top:12px">Grand View Research, 2026</p></div>
    <div><p class="big" style="font-size:160px">+244%</p><p class="cap" style="font-size:24px;margin-top:14px">digital document forgeries, year on year. Verified receipts become a need.</p><p class="src" style="margin-top:12px">Entrust 2025, via arXiv:2604.25213</p></div>
  </div>
  <p class="abs" style="left:96px;right:96px;top:250px;font-size:26px;color:var(--charcoal)"><b style="color:var(--sumi)">Global protocol, rail-first launch.</b> Currency is set per brand, geography is a policy adapter, budgets fund in USDG. We start where payments are already digital: Singapore and India.</p>
  <p class="abs src" style="left:96px;bottom:54px">Third-party figures, shown as context. STOCKBACK has no users or revenue yet.</p>`,
  { title: "The rails already exist." }));

// 07 Architecture
const box = (x, y, w, h, t, s, style = "") => `<div class="box" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${style}"><b>${t}</b><span>${s}</span></div>`;
const line = (x1, y1, x2, y2, label = "", c = "#171717") =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="2" marker-end="url(#ah${c === "#171717" ? "" : "r"})"/>${label ? `<text x="${x1 === x2 ? x1 + 14 : (x1 + x2) / 2}" y="${x1 === x2 ? (y1 + y2) / 2 + 5 : (y1 + y2) / 2 - 12}" text-anchor="${x1 === x2 ? "start" : "middle"}" font-family="IBM Plex Mono" font-size="15" fill="#3a3632">${label}</text>` : ""}`;
D(7, "architecture", slide(7, "Architecture", `
  <div class="abs" style="left:96px;top:250px;width:1728px;height:740px">
    <div class="abs" style="left:0;top:0;width:470px;height:720px;background:var(--washi-deep)"></div>
    <p class="abs" style="left:24px;top:14px;font-size:18px;color:var(--charcoal)">Off-chain, seconds</p>
    <div class="abs" style="left:530px;top:0;width:1198px;height:720px;border:2px solid rgba(200,58,47,.5)"></div>
    <p class="abs" style="left:554px;top:14px;font-size:18px;color:var(--shu-deep)">Robinhood Chain testnet (Arbitrum), one transaction</p>
    <svg class="abs" style="left:0;top:0;overflow:visible" width="1728" height="720">
      <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#171717"/></marker>
      <marker id="ahr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#c83a2f"/></marker></defs>
      ${line(235, 190, 235, 278, "QR")}
      ${line(235, 520, 235, 432, "attestation")}
      ${line(470, 355, 896, 355, "submitClaim(claim, attestation)", "#c83a2f")}
      ${line(1096, 280, 1096, 192)}
      ${line(1010, 280, 830, 192)}
      ${line(1182, 280, 1362, 192)}
      ${line(1096, 430, 1096, 548)}
      ${line(1296, 613, 1366, 613)}
      ${line(826, 613, 896, 613)}
    </svg>
    ${box(30, 60, 410, 130, "Merchant POS", "Signs every receipt field, Ed25519. Simulated in the demo.")}
    ${box(30, 280, 410, 150, "Web app + wallet", "Scans the QR, previews every check, sends one transaction.")}
    ${box(30, 520, 410, 160, "Attester API", "Verifies the merchant signature, expiry, brand and prior use. Signs an EIP-712 claim of hashes only.")}
    ${box(586, 60, 240, 130, "EligibilityPolicy", "Brand, INR, amount, 30-day window")}
    ${box(896, 60, 400, 130, "Stylus ReceiptProver", "Rust. Strict Ed25519, attester allowlist.", "border-color:var(--shu)")}
    ${box(1366, 60, 300, 130, "RewardPolicy", "Rate, per-claim and daily caps")}
    ${box(896, 280, 400, 150, "ReceiptCommitmentRegistry", "Claimant, deadline, commitment, nullifier. Orchestrates everything.", "border-width:2.5px;border-color:var(--sumi)")}
    ${box(586, 548, 240, 130, "USDG adapter", "Sponsor funds in USDG")}
    ${box(896, 548, 400, 130, "RewardPool", "Pays only the sponsor's budget")}
    ${box(1366, 548, 300, 130, "BrandVault x3", "ERC-4626, no admin. Your shares.")}
  </div>`,
  { title: "Architecture" }));

// 08 Workflow (real screenshots of the live app)
const shot = (src, pos = "center top") =>
  `<div class="frame" style="width:560px"><div class="bar" style="padding-left:58px"><i></i><i></i><i></i></div><img src="art/shots/${src}" style="display:block;width:560px;height:370px;object-fit:cover;object-position:${pos}"></div>`;
D(8, "workflow", slide(8, "Workflow", `
  <div class="abs" style="left:96px;right:96px;top:330px;display:grid;grid-template-columns:repeat(3,560px);justify-content:space-between">
    ${[
      ["pos.png", "right center", "The till prints a signed QR", "/merchant"],
      ["preview.png", "center top", "Signature verified", "/app/scan"],
      ["portfolio.png", "center top", "Vault shares in your wallet", "/app/portfolio"],
    ]
      .map(
        ([f, p, t, r], i) => `<div style="position:relative">${shot(f, p)}
        <div class="abs" style="left:-18px;top:-26px">${seal(64, { glyph: String(i + 1), rotate: -8 })}</div>
        <p class="mincho" style="margin-top:30px;font-size:32px;font-weight:700">${t}</p><p class="mono" style="margin-top:6px;font-size:17px;color:var(--stone)">stockbacks.vercel.app${r}</p></div>`,
      )
      .join("")}
  </div>
  <p class="abs cap" style="left:96px;bottom:70px;font-size:22px">About 30 seconds end to end. Tampered or replayed QR codes are rejected before anything is signed.</p>`,
  { title: "The workflow, live." }));

// 09 Built & measured
D(9, "proof", slide(9, "Proof", `
  <div class="abs" style="left:96px;top:390px">${benchChart(1100, { row: 112, bar: 32, label: 200, font: 21 })}</div>
  <div class="abs" style="left:1350px;right:96px;top:330px;display:grid;gap:56px">
    <div><p class="big" style="font-size:96px;color:var(--shu)">9.2x</p><p class="cap">less gas than Solidity</p></div>
    <div><p class="big" style="font-size:96px">130</p><p class="cap">tests across 9 contracts (8 Solidity, 1 Rust on Stylus) and the web app</p></div>
    <div><p class="big" style="font-size:80px;white-space:nowrap">100 USDG</p><p class="cap">funded the Nike budget on-chain, swapped to 10,000 mNKE</p></div>
  </div>
  <p class="abs src" style="left:96px;bottom:54px">Gas measured with eth_estimateGas on Robinhood Chain testnet. Merchant-signed claim: ${short(FACTS.sealedTx)}. USDG funding: ${short(FACTS.usdgTx)} (mock USDG). Registry: ${short(FACTS.registry)}.</p>`,
  { title: "Built, deployed, measured." }));

// 10 Impact & benefits
const ben = (items) => items.map((t) => `<div style="display:flex;align-items:center;gap:18px;font-size:25px;line-height:1.3">${tick(true, 34)}<span>${t}</span></div>`).join("");
D(10, "impact", slide(10, "Impact", `
  <div class="abs" style="left:96px;right:96px;top:300px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
    <div class="card" style="position:relative;min-height:600px;padding:44px 48px;overflow:hidden">
      <img src="art/phone.webp" class="abs" style="right:-30px;bottom:-60px;height:520px;opacity:.95">
      <h3 style="font-size:54px">Shoppers</h3>
      <div style="display:grid;gap:22px;margin-top:34px;max-width:480px">${ben(["A share of the brand, not a point", "No expiry, no admin can dilute it", "No personal data on-chain", "One wallet for every brand"])}</div>
    </div>
    <div class="card" style="position:relative;min-height:600px;padding:44px 48px;overflow:hidden">
      <div class="abs" style="right:40px;bottom:40px">${kakuin(220, { rotate: -8 })}</div>
      <h3 style="font-size:54px">Brands</h3>
      <div style="display:grid;gap:22px;margin-top:34px;max-width:560px">${ben(["Pay only for signed, verified purchases", "Budgets and daily caps they set", "No coalition operator taking a 10–30% cut", "Fund rewards in USDG, in any market"])}</div>
    </div>
  </div>`,
  { title: "Everyone keeps what's theirs." }));

// 11 Roadmap & close
D(11, "roadmap-close", slide(11, "Next", `
  <div class="abs" style="left:96px;right:96px;top:350px">
    <div style="position:relative;height:30px"><div class="abs" style="left:15px;right:15px;top:14px;height:2px;background:rgba(23,23,23,.25)"></div>
      <div class="abs" style="left:15px;width:33%;top:14px;height:2px;background:var(--shu)"></div></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:40px;margin-top:-30px">
      ${[
        ["Now", "Live on testnet", "Merchant-signed receipts, Stylus verifier, admin-less vaults, USDG adapter", true],
        ["Next", "Production-ready", "Hold period with refund voiding, real POS keys, k-of-n attesters", false],
        ["Later", "At scale", "zkTLS payment proofs, mainnet with issuer-authorized assets", false],
      ]
        .map(
          ([n, t, b, on]) => `<div><span style="display:block;width:30px;height:30px;border-radius:50%;${on ? "background:var(--shu)" : "background:var(--washi);border:2px solid var(--sumi)"}"></span>
          <p class="mincho" style="margin-top:26px;font-size:56px;font-weight:800">${n}</p><p style="font-size:27px;font-weight:600;margin-top:6px">${t}</p><p class="cap" style="margin-top:10px;font-size:24px">${b}</p></div>`,
        )
        .join("")}
    </div>
  </div>
  <div class="abs" style="left:96px;right:96px;bottom:90px;display:flex;align-items:center;gap:48px;border-top:1px solid rgba(23,23,23,.18);padding-top:44px">
    ${qr(170, 14)}
    <div><p class="big" style="font-size:84px">Scan. Prove. Own.</p><p style="margin-top:12px;font-size:24px"><b>stockbacks.vercel.app</b> &nbsp; github.com/notwen123/STOCKBACK</p></div>
    <div style="margin-left:auto">${seal(150, { rotate: -8 })}</div>
  </div>`,
  { title: "Where it goes next." }));

// ============================================================== YOUTUBE THUMBNAILS (1280×720, rendered at 2x)
const T = [1280, 720];
const splat = (n, cx, cy, r0, r1, sz, seed = 1) => Array.from({ length: n }, (_, i) => {
  const R = (k) => { const x = Math.sin(i * 127.1 + k * 311.7 + seed * 17) * 43758.5453; return x - Math.floor(x); };
  const a = R(1) * Math.PI * 2, r = r0 + (r1 - r0) * Math.pow(R(2), 0.7), z = sz * (0.25 + 0.75 * R(3));
  return `<ellipse cx="${cx + Math.cos(a) * r}" cy="${cy + Math.sin(a) * r}" rx="${z}" ry="${z * 0.8}" transform="rotate(${(a * 180) / Math.PI} ${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r})" fill="#c83a2f"/>`;
}).join("");

// A — the hook: a forged receipt, the claim in giant type
add(
  "thumbnail/A-this-receipt-is-fake",
  ...T,
  page(
    `<div class="fill" style="background:radial-gradient(ellipse 80% 90% at 30% 50%,#f7f2e7 0%,#e4dac6 100%)"></div>
    <div class="abs receipt" style="left:60px;top:80px;width:450px;padding:36px 38px 44px;font-size:20px;transform:rotate(-6deg)">
      <p style="text-align:center;font:800 40px var(--display);letter-spacing:.22em">RECEIPT</p>
      <div class="dash" style="margin:16px 0"></div>
      ${receiptLines([["Store", "042 Mumbai"], ["Receipt", "INV-58213"], ["Date", "02 OCT 2026"], "---"])}
      <div class="row" style="font-size:34px;align-items:center;position:relative"><span>TOTAL</span>
        <span style="position:relative;color:var(--shu-deep);font-weight:500">₹20,000
          <svg class="abs" style="left:-34px;top:-30px;overflow:visible" width="230" height="100" viewBox="0 0 330 120"><path d="M18 66C14 30 98 10 178 12c86 2 140 22 136 54-4 34-82 50-164 48C66 112 22 96 18 66z" fill="none" stroke="#c83a2f" stroke-width="9" stroke-linecap="round"/></svg></span></div>
      <div style="margin-top:28px;height:62px;background:repeating-linear-gradient(90deg,#171717 0 3px,transparent 3px 6px,#171717 6px 7px,transparent 7px 11px)"></div>
      <div class="abs" style="right:10px;bottom:-40px;transform:rotate(14deg)">
        <div style="border:8px solid var(--shu);padding:4px 22px;font:800 64px var(--display);color:var(--shu);letter-spacing:.06em;border-radius:12px;background:rgba(244,239,227,.85)">FAKE</div></div>
    </div>
    <div class="abs" style="left:620px;top:84px;right:40px">
      <h1 class="display" style="font-size:124px;line-height:.9">This receipt<br>is <span style="color:var(--shu)">fake.</span></h1>
      <p style="margin-top:30px;font:600 40px var(--sans);line-height:1.15">You couldn't tell.</p>
    </div>
    <div class="abs" style="left:620px;bottom:44px;display:flex;align-items:center;gap:18px">${seal(70, { rotate: -8 })}<span style="font:700 34px var(--display);letter-spacing:.2em">STOCKBACK</span></div>`,
  ),
);

// B — the reveal: black field, red seal, the promise
add(
  "thumbnail/B-photos-lie",
  ...T,
  page(
    `<div class="fill" style="background:#0f0f0f"></div>
    <svg class="abs" style="left:0;top:0" width="1280" height="720">${splat(46, 330, 360, 170, 420, 20, 3)}</svg>
    <div class="abs" style="left:110px;top:140px">${seal(440, { rotate: -10, paper: "#0f0f0f" })}</div>
    <div class="abs" style="left:660px;top:70px;right:40px">
      <h1 class="display" style="font-size:124px;line-height:.9;color:var(--washi)">Photos<br>lie.</h1>
      <h1 class="display" style="font-size:124px;line-height:.9;color:var(--shu);margin-top:16px">Seals<br>don't.</h1>
    </div>
    <p class="abs" style="left:664px;bottom:34px;font:600 28px var(--sans);color:rgba(244,239,227,.7);letter-spacing:.04em">STOCKBACK · live on Arbitrum</p>`,
    { cls: "" },
  ),
);

// C — the Claude / motion-design angle: code on the left, the film frame on the right
const code = `<span style="color:#8a8378">// one frame of the film, as code</span>
<span style="color:#e58a80">const</span> slam = P(t, <span style="color:#d9b26a">39.0</span>, <span style="color:#d9b26a">39.25</span>);
<span style="color:#e58a80">const</span> [sx, sy] = shake(t, <span style="color:#d9b26a">39.25</span>, <span style="color:#d9b26a">26</span>);
css($(<span style="color:#9fc28a">"bigSeal"</span>), {
  transform: <span style="color:#9fc28a">\`scale(\${slam})\`</span>
});
reveal = A(t, <span style="color:#d9b26a">39.25</span>, <span style="color:#d9b26a">40.1</span>, E.outExpo);
<span style="color:#e58a80">await</span> page.screenshot({ frame });`;
add(
  "thumbnail/C-this-film-is-code",
  ...T,
  page(
    `<div class="fill" style="background:var(--washi)"></div>
    <div class="abs" style="left:0;top:0;width:560px;height:720px;background:#141414;padding:150px 40px 0 44px">
      <pre class="mono" style="font-size:16px;line-height:1.8;color:#ece6d8;white-space:pre">${code}</pre>
    </div>
    <img class="abs" src="art/thumb-seal.jpg" style="left:540px;top:120px;width:700px;height:394px;object-fit:cover;box-shadow:0 40px 70px -30px rgba(0,0,0,.6);transform:rotate(2deg);border:8px solid #fbf8f1">
    <svg class="abs" style="left:470px;top:300px;overflow:visible" width="140" height="60" viewBox="0 0 150 40"><path d="M4 22c40-8 80-10 128-4" stroke="#c83a2f" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M114 4l26 15-28 14" stroke="#c83a2f" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
    <h1 class="abs display" style="left:44px;top:40px;font-size:88px;color:var(--washi);line-height:1">This film</h1>
    <h1 class="abs display" style="left:600px;top:560px;font-size:96px;line-height:1">is <span style="color:var(--shu)">code.</span></h1>
    <p class="abs" style="left:44px;bottom:40px;font:600 26px var(--sans);color:rgba(236,230,216,.8)">Made with Claude Code</p>
    <div class="abs" style="right:44px;top:34px;display:flex;align-items:center;gap:12px">${seal(48, { ink: false })}<span style="font:700 24px var(--display);letter-spacing:.2em">STOCKBACK</span></div>`,
  ),
);

// ============================================================== README HERO (1600×640, rendered at 2x)
add(
  "readme/hero",
  1600,
  640,
  page(
    `<img src="art/landscape.png" class="abs" style="right:-180px;top:-40px;height:720px">
    <div class="fill" style="background:linear-gradient(90deg,var(--washi) 36%,rgba(244,239,227,.8) 52%,rgba(244,239,227,0) 74%)"></div>
    <div class="abs" style="left:88px;top:70px">${wordmark(26)}</div>
    <h1 class="abs display" style="left:82px;top:150px;font-size:118px;line-height:.95">Every receipt,<br>sealed.</h1>
    <div class="abs" style="left:700px;top:270px">${seal(120, { rotate: -9 })}</div>
    <p class="abs" style="left:88px;top:420px;width:640px;font-size:27px;line-height:1.4;color:var(--charcoal)">Merchant-signed receipts become shares of the brand you bought from, verified in Rust on Arbitrum Stylus.</p>
    <div class="abs" style="left:88px;bottom:56px;display:flex;gap:14px;font:500 17px var(--sans)">
      ${["Live on Robinhood Chain testnet", "9.2x less gas with Stylus", "Once per receipt, on-chain"].map((x) => `<span style="border:1.5px solid rgba(23,23,23,.35);padding:8px 14px;background:rgba(244,239,227,.8)">${x}</span>`).join("")}
    </div>`,
  ),
);

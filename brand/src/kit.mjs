// Shared drawing kit for every artboard: the hanko seal, wordmark, receipt and small furniture.
let uid = 0;

/** The STOCKBACK hanko. `ink` adds a stamped texture: rough edge + paper showing through. */
export function seal(size, { ink = true, rotate = 0, color = "var(--shu)", glyph = "S", paper = "var(--washi)" } = {}) {
  const id = `ink${++uid}`;
  const filter = ink
    ? `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="${uid * 7}" result="warp"/>
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="edge"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="${uid * 13}" result="fibre"/>
        <feColorMatrix in="fibre" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -18 13.1" result="mask"/>
        <feComposite in="edge" in2="mask" operator="in"/>
      </filter>`
    : "";
  const mark =
    glyph === "S"
      ? `<path d="M42 21.5c-2.6-2.4-6-3.6-9.6-3.6-5.6 0-9.4 2.9-9.4 7.1 0 9.2 19.3 5.5 19.3 14.6 0 4.5-4.2 7.6-10.1 7.6-4 0-7.8-1.4-10.6-4.1" fill="none" stroke="${paper}" stroke-width="4.2" stroke-linecap="round"/>`
      : `<text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="Shippori Mincho" font-weight="800" font-size="30" fill="${paper}">${glyph}</text>`;
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" style="transform:rotate(${rotate}deg);overflow:visible" aria-hidden="true">
    <defs>${filter}</defs>
    <g ${ink ? `filter="url(#${id})"` : ""}>
      <path d="M32 3.5c15.9 0 28.6 12.6 28.4 28.6-.2 15.7-12.8 28.3-28.6 28.4C16.1 60.6 3.4 47.9 3.5 32 3.6 16.2 16.2 3.4 32 3.5z" fill="${color}"/>
      ${mark}
    </g>
  </svg>`;
}

/** Square merchant hanko (角印) stamped on receipts: a frame with the kanji 印 (seal). */
export function kakuin(size, { rotate = -6 } = {}) {
  const id = `kaku${++uid}`;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" style="transform:rotate(${rotate}deg);overflow:visible" aria-hidden="true">
    <defs><filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="${uid}" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G" result="e"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" seed="${uid * 3}" result="f"/>
      <feColorMatrix in="f" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -15 10.9" result="m"/>
      <feComposite in="e" in2="m" operator="in"/>
    </filter></defs>
    <g filter="url(#${id})" fill="none" stroke="#c83a2f">
      <rect x="6" y="6" width="88" height="88" rx="6" stroke-width="6"/>
      <rect x="15" y="15" width="70" height="70" rx="2" stroke-width="1.6"/>
      <text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-family="Shippori Mincho" font-weight="800" font-size="54" fill="#c83a2f" stroke="none">印</text>
    </g>
  </svg>`;
}

export function wordmark(size = 40, { color = "var(--sumi)", sealColor = "var(--shu)", paper } = {}) {
  return `<span style="display:inline-flex;align-items:center;gap:${size * 0.42}px;color:${color}">
    ${seal(size * 1.15, { ink: false, color: sealColor, paper: paper ?? "var(--washi)" })}
    <span style="font-family:var(--display);font-weight:700;font-size:${size}px;letter-spacing:.2em;line-height:1">STOCKBACK</span>
  </span>`;
}

/** Bottom strip used on every marketing asset: where to find it + the honest status. */
export function footer({ color = "var(--charcoal)", url = true } = {}) {
  return `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px;color:${color};font-size:17px;line-height:1.4">
    <span>${url ? `<b style="font-weight:600">stockbacks.vercel.app</b><br>` : ""}Live on Robinhood Chain testnet</span>
    <span style="text-align:right;opacity:.85">Testnet demo. Mock brand assets,<br>not securities, no brand partnership.</span>
  </div>`;
}

export function receiptLines(lines) {
  return lines
    .map((l) => (l === "---" ? `<div class="dash" style="margin:14px 0"></div>` : `<div class="row"><span style="opacity:.6">${l[0]}</span><span>${l[1]}</span></div>`))
    .join("");
}

/** Hand-inked brush stroke (for underlines and connectors). */
export function brush(w, h = 18, color = "var(--shu)") {
  return `<svg width="${w}" height="${h}" viewBox="0 0 520 40" preserveAspectRatio="none" aria-hidden="true"><path d="M6 26c60-12 150-18 250-16 90 2 170 7 258-4" stroke="${color}" stroke-width="11" stroke-linecap="round" fill="none"/></svg>`;
}

export const page = (body, { css = "", cls = "grain", transparent = false } = {}) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="base.css"><style>${css}</style></head>
<body class="${cls} ${transparent ? "transparent" : ""}">${body}</body></html>`;

// Real, measured numbers (benchmarks/results/onchain-46630.md). Never edit by hand.
export const BENCH = [
  { n: 1, sol: 736502, sty: 140063 },
  { n: 10, sol: 6214368, sty: 724659 },
  { n: 50, sol: 30555405, sty: 3327511 },
  { n: 100, sol: null, sty: 6583441 },
];
export const CAP = 32_000_000;

export const FACTS = {
  registry: "0x4273b12cD4A65c2180d4e65Bcb4254825cE64120",
  stylus: "0x9ae8a390121ba71545e9923b333d60e7e3ccd3bd",
  sealedTx: "0xabd3b62b5ef8f02d5f8226c54ee237be9080b57c9b1bdf2529252279a30c5388",
  usdgTx: "0x3d8de1490c0756b92e7e9a046419c1c14aa8913e4545a22171c2362715656c6d",
  site: "https://stockbacks.vercel.app",
};

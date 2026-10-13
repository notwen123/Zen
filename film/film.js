// STOCKBACK film: every element is a pure function of time t (seconds). render(t) is deterministic,
// so frames can be rendered in any order and in parallel.
const TL = window.TIMELINE, TAKE = window.TAKE;
const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const E = {
  lin: (u) => u,
  in3: (u) => u * u * u,
  out3: (u) => 1 - Math.pow(1 - u, 3),
  out5: (u) => 1 - Math.pow(1 - u, 5),
  inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  outExpo: (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
  inExpo: (u) => (u <= 0 ? 0 : Math.pow(2, 10 * u - 10)),
  outBack: (u) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
};
const A = (t, a, b, ease = E.out3) => ease(P(t, a, b));
// in/out envelope: fade in over [a,a+fi], out over [b-fo,b]
const env = (t, a, b, fi = 0.4, fo = 0.4) => Math.min(A(t, a, a + fi), 1 - A(t, b - fo, b));
const css = (el, o) => { for (const k in o) el.style[k] = o[k]; };
let seed = 7;
const rnd = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7 + seed) * 43758.5453; return x - Math.floor(x); };
const shake = (t, t0, amp = 16, dur = 0.45) => {
  if (t < t0 || t > t0 + dur) return [0, 0];
  const d = 1 - (t - t0) / dur;
  return [Math.sin(t * 91) * amp * d * d, Math.cos(t * 77) * amp * d * d];
};

// ---------------------------------------------------------------- shared art
function sealSVG(size, { paper = "#f4efe3", rough = true, id = "s" } = {}) {
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" style="overflow:visible">
  <defs><filter id="${id}f" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="3" result="w"/>
    <feDisplacementMap in="SourceGraphic" in2="w" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="e"/>
    <feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="3" seed="9" result="f"/>
    <feColorMatrix in="f" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -18 13.1" result="m"/>
    <feComposite in="e" in2="m" operator="in"/></filter></defs>
  <g ${rough ? `filter="url(#${id}f)"` : ""}>
    <path d="M32 3.5c15.9 0 28.6 12.6 28.4 28.6-.2 15.7-12.8 28.3-28.6 28.4C16.1 60.6 3.4 47.9 3.5 32 3.6 16.2 16.2 3.4 32 3.5z" fill="#c83a2f"/>
    <path d="M42 21.5c-2.6-2.4-6-3.6-9.6-3.6-5.6 0-9.4 2.9-9.4 7.1 0 9.2 19.3 5.5 19.3 14.6 0 4.5-4.2 7.6-10.1 7.6-4 0-7.8-1.4-10.6-4.1" fill="none" stroke="${paper}" stroke-width="4.2" stroke-linecap="round"/>
  </g></svg>`;
}
function kakuinSVG(size, id = "k") {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" style="overflow:visible"><defs><filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="3" seed="5" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G" result="e"/>
    <feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="3" seed="11" result="f"/><feColorMatrix in="f" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -15 10.9" result="m"/>
    <feComposite in="e" in2="m" operator="in"/></filter></defs>
    <g filter="url(#${id})" fill="none" stroke="#c83a2f"><rect x="6" y="6" width="88" height="88" rx="6" stroke-width="6"/><rect x="15" y="15" width="70" height="70" rx="2" stroke-width="1.6"/>
    <text x="50" y="53" text-anchor="middle" dominant-baseline="central" font-family="Shippori Mincho" font-weight="800" font-size="54" fill="#c83a2f" stroke="none">印</text></g></svg>`;
}
const splatDots = (n, cx, cy, r0, r1, sz, s = 1) =>
  Array.from({ length: n }, (_, i) => {
    const a = rnd(i, 1 + s) * Math.PI * 2, r = lerp(r0, r1, Math.pow(rnd(i, 2 + s), 0.7)), z = lerp(sz * 0.25, sz, rnd(i, 3 + s));
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, z, a, d: r };
  });

// ================================================================ HOOK 0–13.2
const hookLines = [...document.querySelectorAll("#hr .hl")];
$("barcode").innerHTML = Array.from({ length: 46 }, (_, i) => `<i style="width:${1 + Math.round(rnd(i, 9) * 4)}px;background:#171717;opacity:${0.75 + rnd(i, 4) * 0.25}"></i>`).join("");
const hookSplash = splatDots(26, 960, 540, 30, 260, 26, 1);
$("splash").innerHTML = hookSplash.map((d, i) => `<circle class="sp" cx="${d.x}" cy="${d.y}" r="${d.z}" fill="#c83a2f"/>`).join("");
const spEls = [...document.querySelectorAll("#splash .sp")];
function hook(t) {
  // ink drop falls, hits, opens the paper
  const fall = P(t, 0.25, 0.75);
  css($("drop"), { top: `${lerp(-60, 528, E.in3(fall))}px`, opacity: t < 0.75 ? 1 : 0, transform: `scaleY(${1 + fall * 0.5})` });
  const open = A(t, 0.75, 1.9, E.outExpo);
  css($("hookDark"), { clipPath: `circle(${(1 - open) * 1300}px at 960px 540px)`, opacity: 1 });
  $("hookDark").style.webkitMaskImage = `radial-gradient(circle at 960px 540px, transparent ${open * 1400}px, black ${open * 1400 + 2}px)`;
  $("hookDark").style.clipPath = "none";
  spEls.forEach((el, i) => {
    const d = hookSplash[i], u = A(t, 0.75, 1.25, E.out5), fade = 1 - A(t, 1.3, 2.3);
    el.setAttribute("cx", 960 + (d.x - 960) * u); el.setAttribute("cy", 540 + (d.y - 540) * u);
    el.setAttribute("r", d.z * u); el.setAttribute("opacity", t < 0.75 ? 0 : fade);
  });
  // receipt prints
  const rIn = A(t, 1.35, 2.2, E.out5);
  const [sx, sy] = shake(t, 4.45, 10, 0.35);
  css($("hr"), { opacity: rIn, transform: `translate(${sx}px,${(1 - rIn) * 90 + sy}px) rotate(${(1 - rIn) * -4}deg)` });
  hookLines.forEach((el, i) => { const u = A(t, 1.6 + i * 0.13, 1.95 + i * 0.13); css(el, { opacity: u, clipPath: u >= 1 ? "none" : `inset(-60px ${(1 - u) * 100}% -60px -60px)` }); });
  // the glitch: 2,000 -> 20,000
  const g = t >= 4.4 && t < 4.95;
  const tot = $("hTotal");
  tot.textContent = t < 4.4 ? "₹2,000.00" : t < 4.95 ? (Math.floor(t * 30) % 2 ? "₹20,0O0.00" : "₹2,00 0.00") : "₹20,000.00";
  css(tot, {
    color: t >= 4.4 ? "#8f211d" : "#171717",
    textShadow: g ? `${(rnd(Math.floor(t * 30), 3) - 0.5) * 14}px 0 rgba(200,58,47,.8), ${(rnd(Math.floor(t * 30), 5) - 0.5) * -14}px 0 rgba(47,111,159,.7)` : "none",
    transform: g ? `translateX(${(rnd(Math.floor(t * 30), 7) - 0.5) * 12}px) skewX(${(rnd(Math.floor(t * 30), 8) - 0.5) * 12}deg)` : "none",
  });
  $("hCircle").querySelector("path").style.strokeDashoffset = 1 - A(t, 5.0, 5.6, E.inOut);
  css($("hEdit"), { opacity: env(t, 6.3, 9.0, 0.5, 0.4), transform: `translateY(${(1 - A(t, 6.3, 6.9)) * 16}px)` });
  // which one is real? the receipt splits into two identical ones
  const split = A(t, 9.0, 9.9, E.inOut);
  const scale = lerp(1, 0.74, split);
  css($("hr"), { left: `${lerp(620, 300, split)}px`, top: `${lerp(130, 200, split)}px`, transform: `${$("hr").style.transform} scale(${scale})`, transformOrigin: "center top" });
  if (t >= 9.0) {
    // B is a perfect visual clone of the edited receipt (fake), A shows the same: no way to tell
    const c = $("hr2");
    if (!c.dataset.ok) { c.innerHTML = $("hr").innerHTML; c.style.cssText = $("hr").style.cssText; c.className = "rc"; c.dataset.ok = 1; c.querySelector("svg")?.remove(); c.querySelectorAll(".hl").forEach((e) => (e.style.opacity = 1, e.style.clipPath = "none")); c.querySelector("#hTotal").id = ""; }
    css(c, { opacity: split, left: `${lerp(620, 940, split)}px`, top: `${lerp(130, 200, split)}px`, width: "680px", height: "auto", padding: "56px 60px 64px", fontSize: "27px", transform: `scale(${scale})`, transformOrigin: "center top" });
    c.querySelectorAll("span").forEach((s) => { if (s.textContent.includes("2,000.00") && s.closest(".row")?.style.fontSize === "42px") { s.textContent = "₹20,000.00"; s.style.color = "#171717"; } });
  } else $("hr2").style.opacity = 0;
  $("hCircle").style.opacity = 1 - split;
  css($("hQ"), { opacity: A(t, 9.4, 10.0), transform: `translateY(${(1 - A(t, 9.4, 10.2)) * 24}px)` });
  css($("hA"), { left: "595px", top: "930px", opacity: A(t, 10.0, 10.4) });
  css($("hB"), { left: "1235px", top: "930px", opacity: A(t, 10.15, 10.55) });
}

// ================================================================ PROBLEM 12.6–36.2
const detectors = [
  ["People, side by side", 0.501], ["The generator judging itself", 0.532], ["DocTamper", 0.585], ["TruFor", 0.599],
];
$("bars").innerHTML = `
  <p class="m" style="font-size:26px;color:#8f211d;letter-spacing:.12em">DETECTING AI-EDITED RECEIPTS · AUC</p>
  <div id="barRows" style="margin-top:40px;position:relative;height:560px"></div>`;
$("barRows").innerHTML =
  detectors.map(([n, v], i) => `<div class="br" style="position:absolute;left:0;right:0;top:${i * 165}px;height:120px">
      <p style="font-size:34px;color:#3a3632">${n}</p>
      <div style="position:relative;margin-top:14px;height:60px"><div class="bf" style="position:absolute;left:0;top:0;height:60px;background:#c83a2f;border-radius:0 6px 6px 0;width:0"></div>
      <span class="bv m" style="position:absolute;top:10px;font-size:34px"></span></div></div>`).join("") +
  `<div id="chance" style="position:absolute;top:-20px;bottom:-10px;border-left:3px dashed #171717"><span class="m" style="position:absolute;left:12px;top:-14px;font-size:24px;white-space:nowrap">chance (0.5)</span></div>`;
const BW = 1440, bx = (v) => ((v - 0.45) / 0.2) * BW; // axis from 0.45 to 0.65
$("cards").innerHTML = Array.from({ length: 15 }, (_, i) => {
  const used = i < 7;
  return `<div class="cd" style="position:absolute;left:${(i % 5) * 200}px;top:${Math.floor(i / 5) * 200}px;width:176px;height:112px;border-radius:14px;${used ? "background:#171717" : "background:#171717"}">
    <span style="position:absolute;left:16px;bottom:16px;width:${40 + rnd(i, 3) * 40}px;height:8px;border-radius:4px;background:#c83a2f"></span>
    <span style="position:absolute;right:16px;top:16px;width:26px;height:26px;border-radius:50%;border:3px solid rgba(244,239,227,.4)"></span></div>`;
}).join("");
const cds = [...document.querySelectorAll("#cards .cd")];
function problem(t) {
  // coin + 50.1%
  const inA = env(t, 13.2, 22.0, 0.6, 0.6);
  const flip = t < 21.0 ? (t - 13.0) * 2.4 * 360 * E.out3(P(t, 13.0, 21.0)) / E.out3(1) : 0;
  const land = A(t, 20.6, 21.0, E.outBack);
  const rot = t < 20.6 ? (t - 13.0) * 720 : lerp(((20.6 - 13.0) * 720) % 360, 540, land);
  const hop = t < 20.6 ? Math.abs(Math.sin((t - 13) * 2.6)) * 70 : 0;
  css($("coinWrap"), { opacity: inA, transform: `translateY(${-hop}px) scale(${lerp(0.6, 1, A(t, 13.2, 13.9, E.outBack))})` });
  css($("coin"), { transform: `rotateY(${rot}deg) rotateX(${12 * Math.sin(t * 1.3)}deg)` });
  const n = 50.1 * A(t, 13.9, 17.4, E.out5);
  $("pct").textContent = `${n.toFixed(1)}%`;
  css($("bigNum"), { opacity: inA, transform: `translateY(${(1 - A(t, 13.4, 14.2)) * 40}px)` });
  css($("pctLbl"), { opacity: A(t, 15.0, 15.8) });
  // detector bars
  const bIn = env(t, 21.7, 25.4, 0.5, 0.5);
  css($("bars"), { opacity: bIn, display: bIn > 0 ? "block" : "none" });
  $("chance").style.left = `${bx(0.5)}px`;
  document.querySelectorAll("#barRows .br").forEach((row, i) => {
    const u = A(t, 22.0 + i * 0.25, 23.2 + i * 0.25, E.out5);
    const w = bx(detectors[i][1]) * u;
    row.querySelector(".bf").style.width = `${Math.max(0, w)}px`;
    const bv = row.querySelector(".bv"); bv.style.left = `${w + 18}px`; bv.textContent = (0.45 + (detectors[i][1] - 0.45) * u).toFixed(3);
    row.style.opacity = A(t, 21.9 + i * 0.25, 22.3 + i * 0.25);
  });
  // loyalty cards
  const cIn = env(t, 25.4, 34.0, 0.4, 0.6);
  css($("cards"), { opacity: cIn });
  cds.forEach((el, i) => {
    const u = A(t, 25.5 + i * 0.07, 26.3 + i * 0.07, E.outBack);
    const forgot = i >= 7 ? A(t, 27.6 + (i - 7) * 0.12, 28.3 + (i - 7) * 0.12) : 0;
    css(el, {
      transform: `translateY(${(1 - u) * 160}px) rotate(${(1 - u) * (rnd(i, 1) - 0.5) * 30}deg)`,
      opacity: u * (1 - forgot * 0.82),
      background: forgot > 0.5 ? "transparent" : "#171717",
      outline: forgot > 0.5 ? "3px dashed #8a8378" : "none",
    });
  });
  css($("cardTxt"), { opacity: env(t, 27.9, 34.0, 0.5, 0.6), transform: `translateY(${(1 - A(t, 27.9, 28.6)) * 30}px)` });
  // EXPIRED stamp slams on card 3
  const st = P(t, 30.4, 30.62);
  const [sx, sy] = shake(t, 30.62, 14, 0.4);
  css($("cards"), { transform: `translate(${sx}px,${sy}px)` });
  css($("expired"), { opacity: t < 30.4 ? 0 : clamp(st * 3) * (1 - A(t, 33.6, 34.0)), transform: `translate(${sx}px,${sy}px) rotate(-14deg) scale(${lerp(2.6, 1, E.in3(st))})` });
  $("probSrc").textContent = t < 25.2 ? "Wu et al., arXiv:2604.25213 (2026)" : "Bond Loyalty Report 2020, via arXiv:2512.00738";
  $("probSrc").style.opacity = env(t, 14.0, 33.8, 0.6, 0.4);
  // ink flood to black
  const f = A(t, 33.5, 35.4, E.in3);
  $("flood").style.opacity = t > 33.5 ? 1 : 0;
  $("floodC").setAttribute("r", f * 1500);
  $("floodC").setAttribute("cx", 760); $("floodC").setAttribute("cy", 520);
}

// ================================================================ PAIN 35.4–57.2
const PX = 12, PY = 16;
$("pix").innerHTML = Array.from({ length: PX * PY }, (_, i) => `<i style="position:absolute;left:${(i % PX) * 25}px;top:${Math.floor(i / PX) * 26.25}px;width:23px;height:24px;background:${rnd(i, 5) > 0.86 ? "#c83a2f" : "#f4efe3"}"></i>`).join("");
const pxEls = [...document.querySelectorAll("#pix i")];
const painSplat = splatDots(60, 960, 440, 160, 620, 22, 4);
$("splat").innerHTML = painSplat.map((d) => `<ellipse class="ps" cx="${d.x}" cy="${d.y}" rx="${d.z}" ry="${d.z * 0.8}" fill="#c83a2f"/>`).join("");
const psEls = [...document.querySelectorAll("#splat .ps")];
$("bigSeal").innerHTML = sealSVG(400, { id: "big" });
$("wm").innerHTML = [..."STOCKBACK"].map((c) => `<span style="display:inline-block">${c}</span>`).join("");
const wmEls = [...document.querySelectorAll("#wm span")];
$("flow").innerHTML = `
  <div class="fl" style="position:absolute;left:200px;top:40px;width:440px;text-align:center">
    <div style="height:300px;display:grid;place-items:center"><div class="rc" style="position:relative;width:300px;padding:34px 30px 40px;font-size:18px;text-align:left">
      <p style="text-align:center;font:800 26px var(--d);letter-spacing:.2em">RECEIPT</p><div class="dash"></div>
      <div class="row"><span style="opacity:.6">Total</span><span>₹2,499</span></div>
      <div class="row" style="margin-top:6px"><span style="opacity:.6">Sig</span><span>ed25519 7f3a…09b</span></div>
      <div id="flK" style="position:absolute;right:-56px;bottom:-56px">${kakuinSVG(120, "fk")}</div></div></div>
    <p style="margin-top:40px;font:700 44px var(--d)">Merchant seals</p></div>
  <div class="fl" style="position:absolute;left:740px;top:40px;width:440px;text-align:center">
    <div id="flRing" style="width:300px;height:300px;margin:0 auto;border-radius:50%;border:4px solid #171717;display:grid;place-items:center">
      <div><p class="m" style="font-size:17px;color:#3a3632">Stylus · Rust</p><p class="d" style="font-size:58px;margin-top:10px">verify()</p></div></div>
    <p style="margin-top:40px;font:700 44px var(--d)">Arbitrum verifies</p></div>
  <div class="fl" style="position:absolute;left:1280px;top:40px;width:440px;text-align:center">
    <div id="flSeal" style="width:300px;height:300px;margin:0 auto">${sealSVG(300, { id: "fs" })}</div>
    <p style="margin-top:40px;font:700 44px var(--d)">You own</p>
    <p class="m" style="margin-top:8px;font-size:22px;color:#8f211d">+18.74 sbNKE · vault shares</p></div>
  <svg style="position:absolute;left:0;top:0;overflow:visible" width="1920" height="600">
    <path class="fa" d="M612 200c50-14 100-16 150-6" stroke="#c83a2f" stroke-width="7" stroke-linecap="round" fill="none" pathLength="1" stroke-dasharray="1"/>
    <path class="fa" d="M745 180l22 14-24 12" stroke="#c83a2f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" pathLength="1" stroke-dasharray="1"/>
    <path class="fa" d="M1152 200c50-14 100-16 150-6" stroke="#c83a2f" stroke-width="7" stroke-linecap="round" fill="none" pathLength="1" stroke-dasharray="1"/>
    <path class="fa" d="M1285 180l22 14-24 12" stroke="#c83a2f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" pathLength="1" stroke-dasharray="1"/>
  </svg>`;
const flEls = [...document.querySelectorAll("#flow .fl")], faEls = [...document.querySelectorAll("#flow .fa")];
$("kanji").innerHTML = [["読", "Scan."], ["証", "Prove."], ["有", "Own."]].map(([k, e]) =>
  `<div class="kj" style="text-align:center;width:300px"><p style="font:800 260px var(--d);color:#c83a2f;line-height:1">${k}</p><p class="ke" style="font:800 76px var(--d);margin-top:40px">${e}</p></div>`).join("");
const kjEls = [...document.querySelectorAll("#kanji .kj")];
function pain(t) {
  // pixels dissolve
  const pIn = A(t, 36.1, 36.6);
  pxEls.forEach((el, i) => {
    const u = A(t, 37.0 + rnd(i, 6) * 0.9, 38.4 + rnd(i, 6) * 0.9, E.in3);
    const a = rnd(i, 7) * Math.PI * 2, d = 200 + rnd(i, 8) * 900;
    css(el, { transform: `translate(${Math.cos(a) * d * u}px,${Math.sin(a) * d * u - u * 120}px) rotate(${u * 200 * (rnd(i, 9) - 0.5)}deg) scale(${1 - u * 0.6})`, opacity: pIn * (1 - u) });
  });
  css($("pain1"), { opacity: env(t, 36.4, 38.9, 0.5, 0.4), transform: `translateY(${(1 - A(t, 36.4, 37.0)) * 20}px)` });
  // seal slam at 39.25, paper floods in from the seal
  const slam = P(t, 39.0, 39.25);
  const [sx, sy] = shake(t, 39.25, 26, 0.55);
  const reveal = A(t, 39.25, 40.1, E.outExpo);
  css($("paper"), { webkitMaskImage: `radial-gradient(circle at 960px 440px, black ${reveal * 1500}px, transparent ${reveal * 1500 + 2}px)`, opacity: t < 39.25 ? 0 : 1 });
  psEls.forEach((el, i) => {
    const d = painSplat[i], u = A(t, 39.25, 39.7, E.out5);
    el.setAttribute("cx", 960 + (d.x - 960) * u); el.setAttribute("cy", 440 + (d.y - 440) * u);
    el.setAttribute("opacity", t < 39.25 ? 0 : 1 - A(t, 40.2, 41.6));
    el.setAttribute("transform", `rotate(${(d.a * 180) / Math.PI} ${960 + (d.x - 960) * u} ${440 + (d.y - 440) * u})`);
  });
  // seal: slam, then rises for the wordmark, then shrinks away for the flow
  const up = A(t, 39.9, 40.6, E.inOut), away = A(t, 41.8, 42.4, E.inOut);
  const sScale = t < 39.25 ? lerp(4, 1, E.in3(slam)) : 1;
  css($("bigSeal"), {
    opacity: t < 39.0 ? 0 : 1 - away,
    transform: `translate(${sx}px,${sy - up * 70}px) scale(${sScale * lerp(1, 0.62, up) * lerp(1, 0.3, away)}) rotate(${lerp(-24, -6, E.out3(slam))}deg)`,
  });
  wmEls.forEach((el, i) => {
    const u = A(t, 39.8 + i * 0.05, 40.5 + i * 0.05, E.out5);
    css(el, { opacity: u * (1 - away), transform: `translateY(${(1 - u) * 40 + sy - up * 40}px)`, letterSpacing: `${lerp(0.6, 0.2, u)}em` });
  });
  css($("wm"), { top: `${lerp(700, 640, up)}px` });
  css($("tag"), { opacity: env(t, 40.8, 42.3, 0.5, 0.35), top: `${lerp(830, 770, up)}px` });
  // merchant seals -> Arbitrum verifies -> you own
  const fIn = env(t, 42.3, 51.4, 0.5, 0.6);
  css($("flow"), { opacity: fIn });
  const beats = [42.5, 45.3, 47.7];
  flEls.forEach((el, i) => { const u = A(t, beats[i], beats[i] + 0.7, E.outBack); css(el, { opacity: u, transform: `translateY(${(1 - u) * 50}px)` }); });
  const k = P(t, 43.1, 43.3);
  css($("flK"), { opacity: t < 43.1 ? 0 : 1, transform: `scale(${lerp(2.4, 1, E.in3(k))}) rotate(-8deg)` });
  const ring = A(t, 45.6, 46.4);
  css($("flRing"), { borderColor: ring > 0.5 ? "#c83a2f" : "#171717", boxShadow: `0 0 0 ${ring * 26}px rgba(200,58,47,${0.25 * (1 - ring)})` });
  css($("flSeal"), { transform: `translateY(${(1 - A(t, 47.8, 48.5, E.outBack)) * -80}px) rotate(${lerp(-30, -6, A(t, 47.8, 48.5))}deg)` });
  faEls.forEach((el, i) => (el.style.strokeDashoffset = 1 - A(t, i < 2 ? 44.7 + i * 0.25 : 47.1 + (i - 2) * 0.25, i < 2 ? 45.2 + i * 0.25 : 47.6 + (i - 2) * 0.25, E.inOut)));
  // 読 証 有
  kjEls.forEach((el, i) => {
    const u = A(t, 51.6 + i * 0.35, 52.4 + i * 0.35, E.out3);
    const e = A(t, 53.6 + i * 0.3, 54.2 + i * 0.3, E.out3);
    const out = A(t, 55.4, 56.2, E.inOut);
    css(el.firstElementChild, { clipPath: `inset(0 0 ${(1 - u) * 100}% 0)` });
    css(el.lastElementChild, { opacity: e, transform: `translateY(${(1 - e) * 20}px)` });
    css(el, { opacity: 1 - out, transform: `scale(${1 + out * 0.15}) translateY(${-out * 40}px)` });
  });
}

// ================================================================ PRODUCT 55.4–106.6
const PR = TL.product;
const frameT = TAKE.frames.map((f) => f.t - TAKE.t0);
const frameAt = (rt) => { let lo = 0, hi = frameT.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (frameT[m] <= rt) lo = m; else hi = m - 1; } return lo; };
// film time -> raw take time
function raw(ft) {
  let f = PR.start;
  for (const [r0, r1, sp] of PR.remap) {
    const len = (r1 - r0) / sp;
    if (ft <= f + len) return r0 + Math.max(0, ft - f) * sp;
    f += len;
  }
  return PR.remap.at(-1)[1];
}
const PEND = (() => { let f = PR.start; for (const [r0, r1, sp] of PR.remap) f += (r1 - r0) / sp; return f; })();
const K = 1600 / 1440, WX = 160, WY = 70; // viewport css px -> stage px
const toStage = (x, y) => [WX + x * K, WY + y * K];
// Camera shots are visible rectangles in stage space, clamped once per keyframe (never per frame),
// then interpolated linearly in (cx, cy, w) with a smootherstep curve. Linear interpolation keeps
// every intermediate rectangle inside the content, so the frame never jitters against an edge.
const CW = 1600, CH = 1000;
function shotRect(z, x, y) {
  if (z <= 1.001) return { cx: 960, cy: 540, w: 1920 };
  const w = 1920 / z, h = w * 9 / 16;
  let [cx, cy] = toStage(x, y);
  cx = w >= CW ? WX + CW / 2 : clamp(cx, WX + w / 2, WX + CW - w / 2);
  cy = h >= CH ? WY + CH / 2 : clamp(cy, WY + h / 2, WY + CH - h / 2);
  return { cx, cy, w };
}
const smoother = (u) => u * u * u * (u * (u * 6 - 15) + 10);
const SHOTS = PR.camera.map(([a, b, z, x, y]) => ({ a, b, r: shotRect(z, x, y) }));
function camera(rt) {
  let st = SHOTS[0].r;
  for (const s of SHOTS) {
    if (rt < s.a) break;
    // stretch quick moves so every glide lasts at least 1.3 s
    const b = s.b > s.a ? Math.max(s.b, s.a + 1.3) : s.a;
    const u = b > s.a ? smoother(P(rt, s.a, b)) : 1;
    st = { cx: lerp(st.cx, s.r.cx, u), cy: lerp(st.cy, s.r.cy, u), w: lerp(st.w, s.r.w, u) };
  }
  return st;
}
const easeM = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
function cursorAt(rt) {
  let pos = [TAKE.viewport[0] * 0.62, TAKE.viewport[1] * 0.55];
  for (const e of TAKE.events) {
    if (e.type !== "move") continue;
    const a = e.t0 - TAKE.t0, b = e.t1 - TAKE.t0;
    if (rt < a) break;
    const u = easeM(P(rt, a, b));
    const [fx, fy] = e.from, [tx, ty] = e.to;
    pos = [fx + (tx - fx) * u - Math.sin(Math.PI * u) * (ty - fy) * 0.08, fy + (ty - fy) * u + Math.sin(Math.PI * u) * (tx - fx) * 0.08];
  }
  let click = 9;
  for (const e of TAKE.events) if (e.type === "click") { const d = rt - (e.t - TAKE.t0); if (d >= 0 && d < click) click = d; }
  return { pos, click };
}
const imgA = $("recA"), imgB = $("recB");
let lastSrc = { A: "", B: "" };
async function setImg(img, key, src) { if (lastSrc[key] !== src) { lastSrc[key] = src; img.src = src; } await img.decode().catch(() => {}); }
async function product(t) {
  const rt = t < PR.start ? 0 : raw(t);
  // window entrance / exit
  const wIn = A(t, 55.9, 57.1, E.out5), wOut = A(t, PEND + 0.1, PEND + 1.4, E.inOut);
  // recording frame, with synthetic smooth scroll across the recorder's scroll jumps
  let fi = frameAt(rt);
  let jump = PR.scrollJumps.find(([tj, , , d]) => rt >= tj && rt < tj + d);
  const f = TAKE.frames[fi];
  if (jump) {
    const pre = TAKE.frames[frameAt(jump[0] - 0.02)];
    await Promise.all([setImg(imgA, "A", `rec/${pre.file}`), setImg(imgB, "B", `rec/${f.file}`)]);

  } else {
    await setImg(imgB, "B", `rec/${f.file}`);
  }
  $("urlTxt").textContent = PR.urls.filter(([a]) => rt >= a).at(-1)[1];
  // camera matrix: stage -> screen
  const c = camera(rt);
  const intro = lerp(0.82, 1, wIn), outro = lerp(1, 0.7, wOut);
  const zz = (1920 / c.w) * intro * outro;
  const tx = 960 - c.cx * zz, ty = 540 - c.cy * zz + (1 - wIn) * 160 - wOut * 60;
  css($("cam"), { transform: `translate(${tx}px,${ty}px) scale(${zz})`, opacity: wIn * (1 - wOut) });
  // recording drawn on canvas with high-quality resampling at the exact sub-pixel transform
  const cv = $("recCv"), g = cv.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1920, 1080);
  g.globalAlpha = wIn * (1 - wOut);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.setTransform(zz, 0, 0, zz, tx, ty);
  g.save(); g.beginPath(); g.roundRect(WX, WY, CW, CH, [0, 0, 16, 16]); g.clip();
  g.fillStyle = "#f4efe3"; g.fillRect(WX, WY, CW, CH);
  if (jump) {
    const [tj, s0, s1, d] = jump, v = s0 + (s1 - s0) * E.inOut(P(rt, tj, tj + d));
    g.drawImage(imgA, WX, WY + (s0 - v) * K, CW, CH);
    g.drawImage(imgB, WX, WY + (s1 - v) * K, CW, CH);
  } else g.drawImage(imgB, WX, WY, CW, CH);
  g.restore();
  // cursor, in screen space through the same matrix
  const cur = cursorAt(rt);
  const [sxp, syp] = toStage(cur.pos[0], cur.pos[1]);
  const press = cur.click < 0.22 ? 1 - Math.sin((cur.click / 0.22) * Math.PI) * 0.18 : 1;
  css($("cursor"), { transform: `translate(${sxp * zz + tx}px,${syp * zz + ty}px)`, opacity: A(t, 57.2, 57.6) * wIn * (1 - wOut) });
  $("arrow").setAttribute("transform", `scale(${1.25 * press * Math.sqrt(zz)})`);
  const rp = cur.click < 0.5 ? cur.click / 0.5 : 1;
  $("ripple").setAttribute("r", (8 + E.out3(rp) * 42) * Math.sqrt(zz));
  $("ripple").setAttribute("opacity", cur.click < 0.5 ? 1 - rp : 0);
  // overlays
  css($("live"), { opacity: env(t, 57.4, PEND + 0.4, 0.5, 0.5), transform: `translateY(${(1 - A(t, 57.4, 57.9)) * 20}px)` });
  const ch = PR.chapters.filter(([a]) => t >= a).at(-1);
  if (ch) {
    const next = PR.chapters.find(([a]) => a > ch[0]);
    const end = next ? next[0] - 0.15 : PEND + 0.3;
    const u = env(t, ch[0], end, 0.45, 0.3);
    $("chapN").textContent = ch[1]; $("chapT").textContent = ch[2];
    css($("chap"), { opacity: u, transform: `translateX(${(1 - A(t, ch[0], ch[0] + 0.5, E.out5)) * -60}px)` });
  } else $("chap").style.opacity = 0;
}

// ================================================================ TECH 104.8–122.6
const CAP = 32e6, RW = 1300, gx = (g) => (g / 34e6) * RW;
$("race").innerHTML = `
  <div id="capL" style="position:absolute;left:${gx(CAP)}px;top:-40px;height:380px;border-left:3px dashed #171717"><span class="m" style="position:absolute;left:12px;top:-6px;font-size:20px;white-space:nowrap">32M per-tx cap</span></div>
  ${[["Solidity", "#2f6f9f", "sol"], ["Stylus · Rust", "#c83a2f", "sty"]].map(([n, c, id], i) => `
  <div style="position:absolute;left:0;top:${30 + i * 160}px;width:${RW}px">
    <p style="font:700 40px var(--d)">${n}</p>
    <div style="position:relative;margin-top:14px;height:56px">
      <div id="${id}B" style="position:absolute;left:0;top:0;height:56px;width:0;background:${c};border-radius:0 8px 8px 0"></div>
      <span id="${id}V" class="m" style="position:absolute;top:6px;font-size:30px;white-space:nowrap;background:#f1ebde;padding:2px 8px;z-index:2"></span></div></div>`).join("")}`;
$("crackWrap").innerHTML = `
  <div class="rc" id="cr" style="left:700px;top:180px;width:520px;padding:40px 46px 50px;font-size:24px">
    <p style="text-align:center;font:800 38px var(--d);letter-spacing:.22em">RECEIPT</p><div class="dash"></div>
    <div class="row"><span style="opacity:.6">Merchant</span><span>DEMO-POS-NIKE-001</span></div>
    <div class="row" style="margin-top:8px"><span style="opacity:.6">Receipt</span><span>R-TM9XYC…FD23</span></div><div class="dash"></div>
    <div class="row" style="font-size:36px"><span>TOTAL</span><span id="crT">₹2,499.00</span></div></div>
  <div id="crL" style="position:absolute;left:1120px;top:470px;width:220px;height:220px;clip-path:polygon(0 0,52% 0,44% 38%,58% 61%,47% 100%,0 100%)">${kakuinSVG(220, "ck1")}</div>
  <div id="crR" style="position:absolute;left:1120px;top:470px;width:220px;height:220px;clip-path:polygon(52% 0,100% 0,100% 100%,47% 100%,58% 61%,44% 38%)">${kakuinSVG(220, "ck2")}</div>
  <p id="crX" class="m" style="position:absolute;left:0;right:0;top:820px;text-align:center;font-size:34px;color:#8f211d;letter-spacing:.14em;opacity:0">SIGNATURE INVALID · CLAIM REJECTED</p>`;
function tech(t) {
  const sIn = env(t, 104.7, 116.9, 0.6, 0.5);
  ["techK", "techN", "race"].forEach((id, i) => css($(id), { opacity: env(t, 104.7 + i * 0.15, 116.9, 0.6, 0.5), transform: `translateY(${(1 - A(t, 104.7 + i * 0.15, 105.6 + i * 0.15, E.out5)) * 40}px)` }));
  const hundred = t >= 113.2;
  $("techN").textContent = hundred ? "100 signatures" : "50 signatures";
  const solT = hundred ? lerp(30555405, 61e6, A(t, 113.4, 115.0, E.inOut)) : 30555405 * A(t, 107.3, 110.0, E.inOut);
  const styT = hundred ? lerp(3327511, 6583441, A(t, 113.4, 114.2, E.out3)) : 3327511 * A(t, 107.3, 108.4, E.out3);
  const over = solT > CAP;
  const sw = Math.min(gx(solT), gx(CAP) + 120);
  css($("solB"), { width: `${sw}px`, background: over ? "repeating-linear-gradient(45deg,#2f6f9f 0 14px,rgba(47,111,159,.35) 14px 28px)" : "#2f6f9f" });
  css($("solV"), { left: `${sw + 20}px`, color: over ? "#8f211d" : "#171717" });
  $("solV").textContent = over ? "doesn't fit" : Math.round(solT).toLocaleString("en-US");
  css($("styB"), { width: `${gx(styT)}px` });
  css($("styV"), { left: `${gx(styT) + 20}px` });
  $("styV").textContent = `${Math.round(styT).toLocaleString("en-US")}${hundred && t > 114.2 ? "  ✓ fits" : ""}`;
  const nx = P(t, 110.3, 110.55);
  css($("ninex"), { opacity: t < 110.3 ? 0 : sIn, transform: `scale(${lerp(2.2, 1, E.in3(nx))})`, transformOrigin: "left center" });
  // the seal breaks
  const cIn = env(t, 117.1, 122.3, 0.5, 0.5);
  css($("crackWrap"), { opacity: cIn });
  const dg = t >= 118.5;
  $("crT").textContent = t < 118.3 ? "₹2,499.00" : t < 118.5 ? (Math.floor(t * 30) % 2 ? "₹2,9 9.00" : "₹2,4 9.00") : "₹2,999.00";
  $("crT").style.color = dg ? "#8f211d" : "#171717";
  const k = P(t, 117.5, 117.7);
  const br = A(t, 119.0, 119.6, E.out3);
  const [sx, sy] = shake(t, 119.0, 12, 0.4);
  css($("crL"), { opacity: t < 117.5 ? 0 : 1, transform: `translate(${-br * 40 + sx}px,${br * 30 + sy}px) rotate(${-8 - br * 14}deg) scale(${lerp(2.2, 1, E.in3(k))})` });
  css($("crR"), { opacity: t < 117.5 ? 0 : 1, transform: `translate(${br * 40 + sx}px,${br * 50 + sy}px) rotate(${-8 + br * 16}deg) scale(${lerp(2.2, 1, E.in3(k))})` });
  css($("crX"), { opacity: A(t, 119.2, 119.7), transform: `translateY(${(1 - A(t, 119.2, 119.8)) * 16}px)` });
}

// ================================================================ IMPACT 121.6–136.6
const item = (txt, i, side) => `<div class="it ${side}" style="display:flex;align-items:center;gap:26px;margin-top:46px">
  <span class="ck" style="flex:none;width:64px;height:64px;border-radius:50%;background:#c83a2f;display:grid;place-items:center">
    <svg viewBox="0 0 24 24" width="36" height="36"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#f4efe3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
  <span style="font:500 40px var(--s);line-height:1.2">${txt}</span></div>`;
$("colL").innerHTML = `<div class="hd" style="display:flex;align-items:center;gap:26px">${sealSVG(110, { id: "ls" })}<p class="d" style="font-size:96px">Shoppers</p></div>` +
  ["A share of what you buy", "No expiry", "No admin can take it back"].map((s, i) => item(s, i, "L")).join("");
$("colR").innerHTML = `<div class="hd" style="display:flex;align-items:center;gap:26px">${kakuinSVG(110, "rk")}<p class="d" style="font-size:96px">Brands</p></div>` +
  ["Reward only verified purchases", "Budgets and caps they control", "No coalition operator's cut"].map((s, i) => item(s, i, "R")).join("");
function impact(t) {
  const out = A(t, 135.3, 136.4, E.inOut);
  css($("divider"), { transform: `scaleY(${A(t, 122.0, 122.8, E.inOut)})`, opacity: 1 - out });
  const hdL = $("colL").querySelector(".hd"), hdR = $("colR").querySelector(".hd");
  [[hdL, 122.3], [hdR, 128.7]].forEach(([el, a]) => { const u = A(t, a, a + 0.6, E.out5); css(el, { opacity: u * (1 - out), transform: `translateY(${(1 - u) * 30}px)` }); });
  const beats = { L: [123.4, 125.7, 126.5], R: [129.3, 130.6, 132.4] };
  for (const s of ["L", "R"]) document.querySelectorAll(`.it.${s}`).forEach((el, i) => {
    const a = beats[s][i], u = A(t, a, a + 0.5, E.out5), st = P(t, a, a + 0.18);
    css(el, { opacity: u * (1 - out), transform: `translateX(${(1 - u) * 30}px)` });
    css(el.querySelector(".ck"), { transform: `scale(${t < a ? 0 : lerp(2, 1, E.in3(st))}) rotate(-8deg)` });
  });
}

// ================================================================ OUTRO 135.6–150
$("oSeal").innerHTML = sealSVG(200, { id: "os" });
$("oWm").innerHTML = [..."STOCKBACK"].map((c) => `<span style="display:inline-block">${c}</span>`).join("");
const owEls = [...document.querySelectorAll("#oWm span")];
$("oSpo").innerHTML = ["Scan.", "Prove.", "Own."].map((w) => `<span>${w}</span>`).join("");
const spoEls = [...document.querySelectorAll("#oSpo span")];
$("petals").innerHTML = Array.from({ length: 26 }, (_, i) => `<svg class="pt" viewBox="0 0 12 16" width="${16 + rnd(i, 1) * 16}" height="${22 + rnd(i, 1) * 20}" style="position:absolute;left:0;top:0"><path d="M6 0C10 3 12 8 6 16 0 8 2 3 6 0z" fill="${rnd(i, 2) > 0.4 ? "#e58a80" : "#c83a2f"}"/></svg>`).join("");
const ptEls = [...document.querySelectorAll("#petals .pt")];
function outro(t) {
  css($("sky"), { opacity: 0.9 * A(t, 135.8, 137.4) });
  css($("glow"), { opacity: A(t, 135.8, 137.0) });
  ptEls.forEach((el, i) => {
    const sp = 70 + rnd(i, 3) * 70, x0 = rnd(i, 4) * 2100 - 90, ph = rnd(i, 5) * 20;
    const y = ((t - 135 + ph) * sp) % 1300 - 120, x = x0 + Math.sin((t + ph) * (0.6 + rnd(i, 6))) * 60 - (t - 135) * 18;
    css(el, { transform: `translate(${x}px,${y}px) rotate(${(t + ph) * 60 * (rnd(i, 7) - 0.5)}deg)`, opacity: 0.7 * A(t, 136.0, 137.5) });
  });
  const slam = P(t, 137.35, 137.6);
  const [sx, sy] = shake(t, 137.6, 14, 0.45);
  css($("oSeal"), { opacity: t < 137.35 ? 0 : 1, transform: `translate(${sx}px,${sy}px) scale(${lerp(3.2, 1, E.in3(slam))}) rotate(${lerp(-30, -8, slam)}deg)` });
  owEls.forEach((el, i) => {
    const u = A(t, 138.1 + i * 0.045, 138.8 + i * 0.045, E.out5);
    css(el, { opacity: u, transform: `translateY(${(1 - u) * 36}px)`, letterSpacing: `${lerp(0.5, 0.2, u)}em` });
  });
  [140.0, 140.45, 140.9].forEach((a, i) => { const u = A(t, a, a + 0.45, E.out5); css(spoEls[i], { opacity: u, transform: `translateY(${(1 - u) * 30}px)`, color: i === 2 ? "#c83a2f" : "#171717" }); });
  css($("oUrl"), { opacity: A(t, 142.4, 143.1) });
  css($("oLive"), { opacity: A(t, 142.9, 143.6) });
  css($("oDisc"), { opacity: A(t, 143.6, 144.4) * 0.95 });
}

// ================================================================ transitions + master
const BRUSH = (() => { // ragged brush band, 2600 wide, covers full height
  const pts = []; const H = 1080;
  for (let i = 0; i <= 40; i++) pts.push([2600 - 120 + rnd(i, 11) * 120, (i / 40) * H]);
  for (let i = 40; i >= 0; i--) pts.push([rnd(i, 12) * 140, (i / 40) * H]);
  return pts;
})();
function wipe(t, a, b) { // left -> right brush stroke, fully covering at (a+b)/2
  const u = P(t, a, b);
  if (u <= 0 || u >= 1) return $("wipeP").setAttribute("d", "");
  const x = lerp(-2700, 1920 + 100, E.inOut(u));
  $("wipeP").setAttribute("d", "M" + BRUSH.map(([px, py]) => `${px + x},${py}`).join("L") + "Z");
}
const SCENES = { hook, problem, pain, product, tech, impact, outro };
window.render = async (t) => {
  for (const [name, [a, b]] of Object.entries(TL.scenes)) {
    const on = t >= a && t < b;
    const el = $(name);
    el.style.display = on ? "block" : "none";
  }
  // scene ownership by time (later scenes paint on top inside overlaps)
  if (t < 13.2) hook(t);
  if (t >= 12.6 && t < 36.2) problem(t);
  if (t >= 35.4 && t < 57.2) pain(t);
  if (t >= 55.4 && t < 106.6) await product(t);
  if (t >= 104.8 && t < 122.6) tech(t);
  if (t >= 121.6 && t < 136.6) impact(t);
  if (t >= 135.6) outro(t);
  // which scene is visible during overlaps
  $("hook").style.display = t < 12.85 ? "block" : "none";
  $("problem").style.display = t >= 12.85 && t < 35.8 ? "block" : "none";
  $("pain").style.display = t >= 35.8 && t < 57.2 ? "block" : "none";
  $("product").style.display = t >= 55.9 && t < PEND + 1.5 ? "block" : "none";
  $("pain").style.zIndex = 2; $("product").style.zIndex = 3;
  $("tech").style.display = t >= PEND + 1.0 && t < 121.95 ? "block" : "none";
  $("impact").style.display = t >= 121.95 && t < 136.0 ? "block" : "none";
  $("outro").style.display = t >= 135.8 ? "block" : "none";
  if (t >= PEND + 1.0 && t < PEND + 1.5) { $("tech").style.zIndex = 1; $("product").style.zIndex = 3; }
  // brush wipes
  if (t > 12.3 && t < 13.4) wipe(t, 12.3, 13.4); else if (t > 121.4 && t < 122.5) wipe(t, 121.4, 122.5); else wipe(t, 0, 0);
  // global: living grain, final fade
  $("grain").style.transform = `translate(${rnd(Math.floor(t * 12), 1) * 120 - 60}px,${rnd(Math.floor(t * 12), 2) * 120 - 60}px)`;
  $("black").style.opacity = A(t, 147.6, 149.6, E.inOut);
};
window.READY = document.fonts.ready.then(() => true);

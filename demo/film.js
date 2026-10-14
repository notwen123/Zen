// Zen demo film. Every element is a pure function of film time t: render(t) is deterministic, so frames render
// in parallel and in any order. The product footage is a real recorded take on Monad testnet (rec/take.json).
const TL = window.TIMELINE, TAKE = window.TAKE;
const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const E = {
  out3: (u) => 1 - Math.pow(1 - u, 3),
  out5: (u) => 1 - Math.pow(1 - u, 5),
  in3: (u) => u * u * u,
  inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  outExpo: (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
  outBack: (u) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
};
const A = (t, a, b, e = E.out3) => e(P(t, a, b));
const env = (t, a, b, fi = 0.35, fo = 0.35) => Math.min(A(t, a, a + fi), 1 - A(t, b - fo, b));
const css = (el, o) => { for (const k in o) el.style[k] = o[k]; };
const rnd = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7 + 7) * 43758.5453; return x - Math.floor(x); };
const shake = (t, t0, amp = 14, dur = 0.4) => {
  if (t < t0 || t > t0 + dur) return [0, 0];
  const d = 1 - (t - t0) / dur;
  return [Math.sin(t * 91) * amp * d * d, Math.cos(t * 77) * amp * d * d];
};
const seal = (size, id) => `<svg viewBox="0 0 64 64" width="${size}" height="${size}" style="overflow:visible"><defs><filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="3" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="2.4" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g filter="url(#${id})"><path d="M32 3.5c15.9 0 28.6 12.6 28.4 28.6-.2 15.7-12.8 28.3-28.6 28.4C16.1 60.6 3.4 47.9 3.5 32 3.6 16.2 16.2 3.4 32 3.5z" fill="#c83a2f"/><path d="M21.5 20.5c6.8.4 13.8.2 21-.4-6.6 7.6-13.4 15.3-21.2 23.6 7.4-.5 14.4-.4 21.4.2" fill="none" stroke="#F4EFE3" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

const segAt = (t) => TL.segments.find((s) => t >= s.f0 && t < s.f1) ?? TL.segments.at(-1);

// ================================================================ INTRO 0–6: the problem in three slams, then the seal
const words = [
  [0.35, "Reward paid.", "Day 0: the shopper earns stock."],
  [1.55, "Item returned.", "Day 9: the purchase is refunded."],
  [2.75, "Reward kept.", "Someone just paid for nothing."],
];
const splash = Array.from({ length: 22 }, (_, i) => { const a = rnd(i, 1) * Math.PI * 2, r = 80 + rnd(i, 2) * 380; return { x: 960 + Math.cos(a) * r, y: 540 + Math.sin(a) * r, z: 6 + rnd(i, 3) * 22 }; });
$("splash").innerHTML = splash.map((d) => `<circle cx="${d.x}" cy="${d.y}" r="${d.z}" fill="#c83a2f"/>`).join("");
$("introSeal").innerHTML = seal(200, "is");
function intro(t) {
  const w = [...words].reverse().find((x) => t >= x[0]);
  const on = w && t < 4.0;
  if (on) {
    const u = A(t, w[0], w[0] + 0.25, E.out5);
    $("kw").textContent = w[1];
    $("kwSub").textContent = w[2];
    const [sx, sy] = shake(t, w[0] + 0.05, 10, 0.3);
    css($("kw"), { opacity: u, transform: `translate(${sx}px,${sy}px) scale(${lerp(1.35, 1, u)})`, color: w === words[1] ? "#e58a80" : "#f4efe3" });
    css($("kwSub"), { opacity: A(t, w[0] + 0.2, w[0] + 0.5) });
  } else { $("kw").style.opacity = 0; $("kwSub").style.opacity = 0; }
  [...$("splash").children].forEach((c, i) => { const u = A(t, 1.55, 1.95, E.out5); c.setAttribute("opacity", t >= 1.55 && t < 3.2 ? (1 - A(t, 2.4, 3.2)) * 0.9 : 0); c.setAttribute("transform", `translate(${(960 - splash[i].x) * (1 - u)} ${(540 - splash[i].y) * (1 - u)})`); });
  // paper floods in from the seal
  const slam = P(t, 3.75, 4.0), open = A(t, 4.0, 4.7, E.outExpo);
  css($("introDark"), { opacity: t < 4.0 ? 1 : 1 - open });
  const [sx, sy] = shake(t, 4.0, 22, 0.5);
  css($("introSeal"), { opacity: t < 3.75 ? 0 : 1, transform: `translate(${sx}px,${sy}px) scale(${t < 4 ? lerp(3.2, 1, E.in3(slam)) : 1}) rotate(${lerp(-26, -7, slam)}deg)` });
  css($("introWm"), { opacity: A(t, 4.25, 4.7), transform: `translateY(${(1 - A(t, 4.25, 4.8, E.out5)) * 40}px)`, letterSpacing: `${lerp(0.5, 0.18, A(t, 4.25, 4.9))}em` });
  css($("introTag"), { opacity: A(t, 4.6, 5.1), transform: `translateY(${(1 - A(t, 4.6, 5.2)) * 20}px)` });
  const out = A(t, 5.5, 6.0, E.inOut);
  css($("intro"), { opacity: 1 - out });
}

// ================================================================ PRODUCT: real take, auto-camera, drawn cursor
const VW = TAKE.viewport[0], VH = TAKE.viewport[1];
const K = 1526 / VW, WX = 197, WY = 43 + 40; // content origin on stage (below the 40 px bar)
css($("win"), { left: "197px", top: "43px", width: "1526px", height: `${VH * K + 40}px` });
css($("view"), { width: `${VW * K}px`, height: `${VH * K}px` });
const frameT = TAKE.frames.map((f) => f.t);
const frameAt = (rt) => { let lo = 0, hi = frameT.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (frameT[m] <= rt) lo = m; else hi = m - 1; } return lo; };
const toStage = (x, y) => [WX + x * K, WY + y * K];
const takeSegs = TL.segments.filter((s) => s.kind === "take");
const rawOf = (t, s) => s.t0 + (t - s.f0);

// Camera track (in take time): zoom toward each click, zero-phase smoothed so it never jitters.
const CAM_DT = 1 / 30, CAM_N = Math.ceil(TAKE.duration / CAM_DT) + 2;
const clicks = TAKE.events.filter((e) => e.type === "click");
const camTarget = (rt) => {
  const c = clicks.find((e) => rt >= e.t - 1.1 && rt <= e.t + 1.4);
  if (!c) return { z: 1, x: VW / 2, y: VH / 2 };
  return { z: 1.32, x: c.x, y: c.y };
};
const cam = (() => {
  const raw = Array.from({ length: CAM_N }, (_, i) => camTarget(i * CAM_DT));
  const a = 1 - Math.exp(-CAM_DT / 0.32);
  const pass = (arr) => { const o = [arr[0]]; for (let i = 1; i < arr.length; i++) o.push({ z: lerp(o[i - 1].z, arr[i].z, a), x: lerp(o[i - 1].x, arr[i].x, a), y: lerp(o[i - 1].y, arr[i].y, a) }); return o; };
  return pass(pass(raw).reverse()).reverse();
})();
function camera(rt) {
  const c = cam[Math.min(cam.length - 1, Math.max(0, Math.round(rt / CAM_DT)))];
  // keep the zoomed view inside the content
  const viewW = 1920 / c.z, viewH = 1080 / c.z;
  let [cx, cy] = toStage(c.x, c.y);
  const minX = WX + Math.min(viewW, VW * K) / 2 - (viewW > VW * K ? (viewW - VW * K) / 2 : 0);
  const maxX = WX + VW * K - Math.min(viewW, VW * K) / 2 + (viewW > VW * K ? (viewW - VW * K) / 2 : 0);
  const minY = WY - 40 + Math.min(viewH, VH * K + 40) / 2 - (viewH > VH * K + 40 ? (viewH - VH * K - 40) / 2 : 0);
  const maxY = WY + VH * K - Math.min(viewH, VH * K + 40) / 2 + (viewH > VH * K + 40 ? (viewH - VH * K - 40) / 2 : 0);
  cx = c.z <= 1.001 ? 960 : clamp(cx, minX, maxX); cy = c.z <= 1.001 ? 540 : clamp(cy, minY, maxY);
  // blend toward the neutral framing as zoom approaches 1
  const k = clamp((c.z - 1) / 0.32);
  return { z: c.z, cx: lerp(960, cx, k), cy: lerp(540, cy, k) };
}
const easeM = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
function cursorAt(rt) {
  let pos = [VW * 0.62, VH * 0.55];
  for (const e of TAKE.events) {
    if (e.type !== "move") continue;
    if (rt < e.t0) break;
    const u = easeM(P(rt, e.t0, e.t1));
    const [fx, fy] = e.from, [tx, ty] = e.to;
    pos = [fx + (tx - fx) * u - Math.sin(Math.PI * u) * (ty - fy) * 0.08, fy + (ty - fy) * u + Math.sin(Math.PI * u) * (tx - fx) * 0.08];
  }
  let click = 9;
  for (const e of clicks) { const d = rt - e.t; if (d >= 0 && d < click) click = d; }
  return { pos, click };
}
const imgs = new Map();
async function img(src) {
  if (!imgs.has(src)) { const i = new Image(); i.src = src; imgs.set(src, i); }
  const i = imgs.get(src);
  await i.decode().catch(() => {});
  return i;
}
async function product(t, s) {
  const rt = rawOf(t, s);
  const f = TAKE.frames[frameAt(rt)];
  const im = await img(`rec/${f.file}`);
  const path = [...TL.urls].reverse().find(([a]) => rt >= a)?.[1] ?? "/";
  $("path").textContent = path === "/" ? "" : path;
  const c = camera(rt);
  // window entrance after the intro, gentle push between segments
  const first = s === takeSegs[0];
  const enter = first ? A(t, s.f0 - 0.4, s.f0 + 0.6, E.out5) : A(t, s.f0, s.f0 + 0.35, E.out3);
  const z = c.z * (first ? lerp(0.86, 1, enter) : lerp(0.97, 1, enter));
  const tx = 960 - c.cx * z, ty = 540 - c.cy * z + (first ? (1 - enter) * 140 : 0);
  css($("cam"), { transform: `translate(${tx}px,${ty}px) scale(${z})`, opacity: first ? enter : 1 });
  const cv = $("recCv"), g = cv.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1920, 1080);
  g.globalAlpha = first ? enter : 1;
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.setTransform(z, 0, 0, z, tx, ty);
  g.save(); g.beginPath(); g.roundRect(WX, WY, VW * K, VH * K, [0, 0, 14, 14]); g.clip();
  g.drawImage(im, WX, WY, VW * K, VH * K);
  g.restore();
  const cur = cursorAt(rt);
  const [sx, sy] = toStage(cur.pos[0], cur.pos[1]);
  const press = cur.click < 0.2 ? 1 - Math.sin((cur.click / 0.2) * Math.PI) * 0.18 : 1;
  css($("cursor"), { transform: `translate(${sx * z + tx}px,${sy * z + ty}px)`, opacity: first ? enter : 1 });
  $("arrow").setAttribute("transform", `scale(${1.3 * press * Math.sqrt(z)})`);
  const rp = cur.click < 0.5 ? cur.click / 0.5 : 1;
  $("ripple").setAttribute("r", (8 + E.out3(rp) * 44) * Math.sqrt(z));
  $("ripple").setAttribute("opacity", cur.click < 0.5 ? 1 - rp : 0);
}

// ================================================================ PROOF: MonadVision tx page with highlights
const PK = 1526 / 1440;
const boxes = [ // CSS px on the 1440x900 explorer page (Status, ERC-20 payout, ERC-721 claim transfer)
  [292, 377, 250, 42],
  [292, 664, 560, 42],
  [292, 712, 720, 42],
];
async function proof(t, s) {
  const u = t - s.f0;
  $("pimg").src = s.img;
  const tx = (s.tx || "").split("/tx/")[1] || "";
  $("ppath").textContent = "/tx/" + tx.slice(0, 10) + "…" + tx.slice(-6);
  const e = A(t, s.f0, s.f0 + 0.45, E.out5);
  const z = lerp(1, 1.12, E.inOut(P(u, 0.8, s.f1 - s.f0)));
  const fy = lerp(540, 640, E.inOut(P(u, 0.8, s.f1 - s.f0)));
  css($("pcam"), { transform: `translate(${960 - 960 * z}px,${540 - fy * z}px) scale(${z})`, opacity: e });
  const i = Math.min(2, Math.floor(Math.max(0, u - 0.9) / 1.4));
  const b = boxes[i], local = u - 0.9 - i * 1.4;
  css($("hl"), { left: `${b[0] * PK}px`, top: `${b[1] * PK + 40}px`, width: `${b[2] * PK}px`, height: `${b[3] * PK}px`, opacity: u < 0.9 ? 0 : A(local, 0, 0.25) });
}

// ================================================================ PROOF: Envio HyperSync
$("eclaim").textContent = TL.envio.claimId;
$("eq").textContent = `query ${TL.envio.queryMs} ms · Monad testnet 10143`;
$("erows").innerHTML = TL.envio.events.map((e) => `<div class="er" style="display:grid;grid-template-columns:170px 260px 330px 1fr;gap:20px;padding:14px 0;border-bottom:1px solid rgba(244,239,227,.12)">
  <span style="color:rgba(244,239,227,.55)">#${e.block}</span><span style="color:${/Voided|Refund|Resolved/.test(e.event) ? "#e58a80" : "#f4efe3"};font-weight:600">${e.event}</span>
  <span style="color:rgba(244,239,227,.7)">${e.contract}</span><span style="color:rgba(244,239,227,.55)">${e.tx.slice(0, 18)}…${e.tx.slice(-6)}</span></div>`).join("");
const erows = [...document.querySelectorAll("#erows .er")];
function envio(t, s) {
  css($("envio"), { opacity: A(t, s.f0, s.f0 + 0.3) * (1 - A(t, s.f1 - 0.3, s.f1)) });
  erows.forEach((el, i) => { const u = A(t, s.f0 + 0.5 + i * 0.32, s.f0 + 0.85 + i * 0.32, E.out5); css(el, { opacity: u, transform: `translateX(${(1 - u) * -40}px)` }); });
}

// ================================================================ OUTRO
$("oSeal").innerHTML = seal(200, "os");
const chips = [["track", "Onchain Finance & Trading · #12"], ["bounty", "Mera UX"], ["bounty", "Mera PRF"], ["bounty", "Envio"]];
$("oChips").innerHTML = chips.map(([k, x]) => `<span class="oc" style="font:700 22px var(--m);padding:10px 18px;border-radius:5px;${k === "track" ? "background:#171717;color:#f4efe3" : "background:#c83a2f;color:#f4efe3"}">${x}</span>`).join("");
const ocs = [...document.querySelectorAll("#oChips .oc")];
function outro(t, s) {
  const u = t - s.f0;
  const slam = P(u, 0.15, 0.4);
  const [sx, sy] = shake(u, 0.4, 16, 0.45);
  css($("oSeal"), { opacity: u < 0.15 ? 0 : 1, transform: `translate(${sx}px,${sy}px) scale(${lerp(3, 1, E.in3(slam))}) rotate(${lerp(-28, -7, slam)}deg)` });
  css($("oWm"), { opacity: A(u, 0.6, 1.0), letterSpacing: `${lerp(0.45, 0.18, A(u, 0.6, 1.2))}em` });
  css($("oLine"), { opacity: A(u, 1.3, 1.8), transform: `translateY(${(1 - A(u, 1.3, 1.9)) * 20}px)` });
  ocs.forEach((el, i) => { const v = A(u, 2.2 + i * 0.18, 2.6 + i * 0.18, E.outBack); css(el, { opacity: clamp(v), transform: `scale(${lerp(0.7, 1, v)})` }); });
  css($("oUrl"), { opacity: A(u, 3.2, 3.7) });
  css($("oGit"), { opacity: A(u, 3.5, 4.0) });
  css($("oDisc"), { opacity: A(u, 3.8, 4.4) * 0.9 });
}

// ================================================================ master
const BRUSH = (() => { const pts = [], H = 1080; for (let i = 0; i <= 40; i++) pts.push([2600 - 120 + rnd(i, 11) * 120, (i / 40) * H]); for (let i = 40; i >= 0; i--) pts.push([rnd(i, 12) * 140, (i / 40) * H]); return pts; })();
function wipe(t, a, b) {
  const u = P(t, a, b);
  if (u <= 0 || u >= 1) return $("wipeP").setAttribute("d", "");
  const x = lerp(-2700, 2020, E.inOut(u));
  $("wipeP").setAttribute("d", "M" + BRUSH.map(([px, py]) => `${px + x},${py}`).join("L") + "Z");
}
const LAYERS = ["intro", "product", "proof", "envio", "outro"];
window.render = async (t) => {
  const s = segAt(t);
  const show = { intro: t < 6.0, product: s.kind === "take" || (t >= 5.6 && t < 6.0), proof: s.kind === "proof", envio: s.kind === "envio", outro: s.kind === "outro" };
  for (const k of LAYERS) $(k).style.display = show[k] ? "block" : "none";
  if (show.intro) intro(t);
  if (show.product) await product(t, s.kind === "take" ? s : takeSegs[0]);
  if (s.kind === "proof") await proof(t, s);
  if (s.kind === "envio") envio(t, s);
  if (s.kind === "outro") outro(t, s);
  // brush wipes at segment changes after the intro
  const cut = TL.segments.find((x) => x.f0 > 6 && Math.abs(t - x.f0) < 0.45);
  wipe(t, cut ? cut.f0 - 0.45 : 0, cut ? cut.f0 + 0.45 : 0);
  // badge
  const bd = TL.badges.find((b) => t >= b.f0 && t < b.f1);
  if (bd && s.kind === "take") {
    $("btag").textContent = bd.tag; $("btag").className = "tag " + bd.kind; $("btxt").textContent = bd.text;
    const v = env(t, bd.f0, bd.f1, 0.3, 0.25);
    css($("badge"), { opacity: v, transform: `translateY(${(1 - A(t, bd.f0, bd.f0 + 0.35, E.out5)) * 24}px)` });
  } else $("badge").style.opacity = 0;
  css($("live"), { opacity: s.kind === "take" ? A(t, 6.6, 7.2) : 0 });
  $("grain").style.transform = `translate(${rnd(Math.floor(t * 12), 1) * 120 - 60}px,${rnd(Math.floor(t * 12), 2) * 120 - 60}px)`;
  $("black").style.opacity = A(t, TL.duration - 1.2, TL.duration - 0.1, E.inOut);
};
window.READY = document.fonts.ready.then(() => true);

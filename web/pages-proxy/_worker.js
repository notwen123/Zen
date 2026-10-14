// Cloudflare Pages front door for Zen: every request is forwarded to the Worker that runs the Next.js app
// (OpenNext on Workers; Pages can't run its Node-crypto API routes). Path, query, method and body pass
// through, so passkeys bind to this pages.dev hostname.
const ORIGIN = "https://zen-monad.zen-web.workers.dev";
const HOP = ["host", "content-length", "accept-encoding", "connection", "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor", "x-forwarded-proto", "x-real-ip"];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    for (const h of HOP) headers.delete(h);
    headers.set("x-zen-public-host", url.host); // Next.js rewrites x-forwarded-host, so use our own header
    const res = await fetch(new URL(url.pathname + url.search, ORIGIN), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      redirect: "manual",
    });
    // Buffer and re-emit: streaming certain responses straight through a Pages function stalled.
    const out = new Headers(res.headers);
    out.delete("content-encoding");
    out.delete("content-length");
    const loc = out.get("location");
    if (loc && loc.startsWith(ORIGIN)) out.set("location", loc.replace(ORIGIN, url.origin));
    return new Response(request.method === "HEAD" ? null : await res.arrayBuffer(), { status: res.status, headers: out });
  },
};

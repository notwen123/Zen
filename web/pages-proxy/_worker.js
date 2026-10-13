// Cloudflare Pages front door for Zen: every request is forwarded to the Worker that runs the Next.js app
// (OpenNext on Workers; Pages can't run its Node-crypto API routes). Path, query, method, headers and body
// pass through unchanged, so passkeys bind to this pages.dev hostname.
const ORIGIN = "https://zen-monad.zen-web.workers.dev";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("x-zen-public-host", url.host); // Next.js rewrites x-forwarded-host, so use our own header
    const res = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });
    // Keep redirects on the pages.dev host.
    const loc = res.headers.get("location");
    if (loc && loc.startsWith(ORIGIN)) {
      const h = new Headers(res.headers);
      h.set("location", loc.replace(ORIGIN, url.origin));
      return new Response(res.body, { status: res.status, headers: h });
    }
    return res;
  },
};

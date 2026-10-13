import "server-only";

// ponytail: in-memory per-IP limiter, resets per server instance; use a shared store (e.g. Redis) if hosted at scale.
export function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (req: Request) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > limit;
  };
}

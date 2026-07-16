import type { MiddlewareHandler } from "hono";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

/** IP → attempt timestamps (ms). */
const attemptsByIp = new Map<string, number[]>();

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return c.req.header("x-real-ip") ?? "unknown";
}

/** Clear rate-limit state (tests). */
export function resetLoginRateLimit(): void {
  attemptsByIp.clear();
}

/**
 * In-memory login rate limit: 20 attempts / 15 minutes per IP → 429.
 */
export function rateLimitLogin(): MiddlewareHandler {
  return async (c, next) => {
    const ip = clientIp(c);
    const now = Date.now();
    const recent = (attemptsByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

    if (recent.length >= MAX_ATTEMPTS) {
      attemptsByIp.set(ip, recent);
      return c.json({ error: "Too many login attempts" }, 429);
    }

    recent.push(now);
    attemptsByIp.set(ip, recent);
    await next();
  };
}

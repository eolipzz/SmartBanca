import { NextResponse, type NextRequest } from "next/server";

const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; reset: number }>();

export function proxy(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const isAuth = request.nextUrl.pathname.startsWith("/api/auth");
  const limit = isAuth ? 10 : 120;
  const key = `${ip}:${isAuth ? "auth" : "global"}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  const current = !bucket || bucket.reset < now ? { count: 1, reset: now + WINDOW_MS } : { ...bucket, count: bucket.count + 1 };
  buckets.set(key, current);

  if (current.count > limit) {
    return NextResponse.json({ error: "Muitas solicitações. Tente novamente em instantes." }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(Math.max(0, limit - current.count)));
  return response;
}

export const config = { matcher: ["/api/:path*"] };

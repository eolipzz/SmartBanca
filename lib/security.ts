import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const configured=process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const allowed=new Set([new URL(configured).origin,new URL(request.url).origin]);
  const forwardedHost=request.headers.get("x-forwarded-host");
  const forwardedProto=request.headers.get("x-forwarded-proto")||"https";
  if(forwardedHost) allowed.add(`${forwardedProto}://${forwardedHost}`);
  if(process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`);
  if (origin && !allowed.has(origin)) throw new Error("INVALID_ORIGIN");
}

export function securityError(error: unknown) {
  if (error instanceof Error && error.message === "INVALID_ORIGIN") return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  return null;
}

export function hashToken(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function newToken() { return randomBytes(32).toString("base64url"); }

export async function consumeAuthRateLimit(key: string, limit = 8) {
  const hash = hashToken(key);
  const result = await pool.query<{ attempts:number; blocked_until:Date|null }>(`INSERT INTO auth_rate_limit(key_hash,attempts,window_started_at) VALUES($1,1,now()) ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN auth_rate_limit.window_started_at < now()-interval '15 minutes' THEN 1 ELSE auth_rate_limit.attempts+1 END,window_started_at=CASE WHEN auth_rate_limit.window_started_at < now()-interval '15 minutes' THEN now() ELSE auth_rate_limit.window_started_at END,blocked_until=CASE WHEN auth_rate_limit.attempts+1 >= $2 THEN now()+interval '15 minutes' ELSE auth_rate_limit.blocked_until END RETURNING attempts,blocked_until`,[hash,limit]);
  const row=result.rows[0]; return !row.blocked_until || row.blocked_until <= new Date();
}

export async function clearAuthRateLimit(key:string){await pool.query("DELETE FROM auth_rate_limit WHERE key_hash=$1",[hashToken(key)]);}

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "sb_session_v2";
function secret() { const value = process.env.JWT_SECRET; if (!value || value.length < 32) throw new Error("JWT_SECRET deve ter ao menos 32 caracteres"); return new TextEncoder().encode(value); }

export async function createSession(user: { id: string; role: string }) {
  const token = await new SignJWT({ role: user.role }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime("8h").sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 8 });
}

export async function getSession() {
  try { const token = (await cookies()).get(COOKIE)?.value; if (!token) return null; const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] }); return payload.sub ? { id: payload.sub, role: String(payload.role ?? "user") } : null; } catch { return null; }
}

export async function clearSession() { (await cookies()).delete(COOKIE); }

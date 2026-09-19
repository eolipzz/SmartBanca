import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { queryOne, withUser } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { assertSameOrigin, clearAuthRateLimit, consumeAuthRateLimit, securityError } from "@/lib/security";

const schema = z.object({ email: z.email().toLowerCase(), password: z.string().min(1).max(128) });
type User = { id: string; name: string; password_hash: string; role: string; failed_login_attempts: number; locked_until: Date | null };
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { email, password } = schema.parse(await request.json());
    const ip=request.headers.get("x-forwarded-for")?.split(",")[0]??"local";
    if(!await consumeAuthRateLimit(`${ip}:${email}`)) return NextResponse.json({error:"Muitas tentativas. Aguarde 15 minutos."},{status:429});
    const user = await queryOne<User>("SELECT * FROM lookup_login_user($1)", [email]);
    if (user?.locked_until && user.locked_until > new Date()) return NextResponse.json({ error: "Acesso temporariamente bloqueado. Tente novamente mais tarde." }, { status: 423 });
    const valid = user ? await bcrypt.compare(password, user.password_hash) : await bcrypt.compare(password, "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5pS7ZkD1KvNWKNDshZO6zO3m3xN8KNe");
    if (!user || !valid) {
      if (user) await withUser(user.id, client => client.query("UPDATE app_user SET failed_login_attempts = failed_login_attempts + 1, locked_until = CASE WHEN failed_login_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END WHERE id = $1", [user.id]));
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }
    await withUser(user.id, client => client.query("UPDATE app_user SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [user.id]));
    await clearAuthRateLimit(`${ip}:${email}`);
    await createSession(user);
    return NextResponse.json({ id: user.id, name: user.name });
  } catch (error) { return securityError(error)??apiError(error); }
}

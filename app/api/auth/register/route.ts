import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool, withUser } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { assertSameOrigin, consumeAuthRateLimit, hashToken, newToken, securityError } from "@/lib/security";
import { sendMail } from "@/lib/email";

const schema = z.object({ name: z.string().trim().min(2).max(80), email: z.email().toLowerCase(), password: z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/) });
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip=request.headers.get("x-forwarded-for")?.split(",")[0]??"local";
    if(!await consumeAuthRateLimit(`${ip}:register`,5)) return NextResponse.json({error:"Muitas contas criadas. Aguarde 15 minutos."},{status:429});
    const data = schema.parse(await request.json());
    const hash = await bcrypt.hash(data.password, 12);
    const result = await pool.query<{ id: string; role: string }>("INSERT INTO app_user (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, role", [data.name, data.email, hash]);
    const token=newToken();
    await withUser(result.rows[0].id,client=>client.query("INSERT INTO auth_token(user_id,token_hash,purpose,expires_at) VALUES($1,$2,'verify_email',now()+interval '24 hours')",[result.rows[0].id,hashToken(token)]));
    const verificationUrl=`${process.env.NEXT_PUBLIC_APP_URL??"http://localhost:3000"}/recuperar?verify=${encodeURIComponent(token)}`;
    await sendMail({to:data.email,subject:"Confirme seu e-mail no SmartBanca",text:`Confirme sua conta em até 24 horas: ${verificationUrl}`});
    await createSession(result.rows[0]);
    return NextResponse.json({ id: result.rows[0].id, name: data.name, devVerificationUrl:process.env.NODE_ENV!=="production"?verificationUrl:undefined }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") return NextResponse.json({ error: "Este e-mail já está em uso." }, { status: 409 });
    return securityError(error)??apiError(error);
  }
}

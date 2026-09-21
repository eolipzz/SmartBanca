import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { apiError } from "@/lib/http";
import { assertSameOrigin, securityError } from "@/lib/security";

const schema = z.object({ password: z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    assertSameOrigin(request);
    const { password } = schema.parse(await request.json());
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await withUser(session.id, client => client.query<{ change_own_password: boolean }>("SELECT change_own_password($1)", [passwordHash]));
    if (!result.rows[0]?.change_own_password) return NextResponse.json({ error: "Não foi possível alterar a senha." }, { status: 400 });
    return NextResponse.json({ message: "Senha pessoal criada com sucesso." });
  } catch (error) { return securityError(error) ?? apiError(error); }
}

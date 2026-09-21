import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { apiError } from "@/lib/http";
import { assertSameOrigin, securityError } from "@/lib/security";

const createSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.email().toLowerCase(), temporaryPassword: z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/) });
export type AdminUser = { id: string; name: string; email: string; role: "user" | "admin" | "support"; must_change_password: boolean; account_active: boolean; created_at: string; last_login_at: string | null };

async function adminSession() {
  const session = await getSession();
  return session?.role === "admin" ? session : null;
}

export async function GET() {
  const session = await adminSession();
  if (!session) return NextResponse.json({ error: "Acesso administrativo negado." }, { status: 403 });
  try {
    const result = await withUser(session.id, client => client.query<AdminUser>("SELECT * FROM admin_list_users()"));
    return NextResponse.json(result.rows);
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  const session = await adminSession();
  if (!session) return NextResponse.json({ error: "Acesso administrativo negado." }, { status: 403 });
  try {
    assertSameOrigin(request);
    const data = createSchema.parse(await request.json());
    const hash = await bcrypt.hash(data.temporaryPassword, 12);
    const result = await withUser(session.id, client => client.query<AdminUser>("SELECT * FROM admin_create_user($1,$2,$3)", [data.name, data.email, hash]));
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 });
    return securityError(error) ?? apiError(error);
  }
}

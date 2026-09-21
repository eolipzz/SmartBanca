import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { sendMail } from "@/lib/email";
import { apiError } from "@/lib/http";
import { assertSameOrigin, hashToken, newToken, securityError } from "@/lib/security";
import type { AdminUser } from "@/app/api/admin/users/route";

export async function POST(request: Request, context: RouteContext<"/api/admin/users/[id]/reset">) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Acesso administrativo negado." }, { status: 403 });
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const token = newToken();
    const user = await withUser(session.id, async client => {
      const users = await client.query<AdminUser>("SELECT * FROM admin_list_users()");
      const selected = users.rows.find(item => item.id === id && item.role === "user");
      if (!selected) return null;
      const created = await client.query<{ admin_create_reset_token: boolean }>("SELECT admin_create_reset_token($1,$2)", [id, hashToken(token)]);
      return created.rows[0]?.admin_create_reset_token ? selected : null;
    });
    if (!user) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const resetUrl = `${appUrl}/recuperar?token=${encodeURIComponent(token)}`;
    const emailed = await sendMail({ to: user.email, subject: "Crie uma nova senha do SmartBanca", text: `Use este link em até 30 minutos para criar uma nova senha: ${resetUrl}` }).catch(() => false);
    return NextResponse.json({ resetUrl, emailed });
  } catch (error) { return securityError(error) ?? apiError(error); }
}

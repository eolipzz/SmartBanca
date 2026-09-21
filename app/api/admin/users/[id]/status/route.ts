import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { apiError } from "@/lib/http";
import { assertSameOrigin, securityError } from "@/lib/security";

const schema = z.object({ active: z.boolean() });
export async function PATCH(request: Request, context: RouteContext<"/api/admin/users/[id]/status">) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Acesso administrativo negado." }, { status: 403 });
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const { active } = schema.parse(await request.json());
    const result = await withUser(session.id, client => client.query<{ admin_set_user_active: boolean }>("SELECT admin_set_user_active($1,$2)", [id, active]));
    if (!result.rows[0]?.admin_set_user_active) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    return NextResponse.json({ active });
  } catch (error) { return securityError(error) ?? apiError(error); }
}

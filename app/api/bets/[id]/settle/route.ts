import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { apiError } from "@/lib/http";
import { assertSameOrigin, securityError } from "@/lib/security";

const schema = z.object({ status: z.enum(["green_total", "green_partial", "red_total", "red_partial", "void"]), effectiveReturn: z.coerce.number().min(0).optional() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try { assertSameOrigin(request); const { id } = await context.params; const input = schema.parse(await request.json()); const row = await withUser(session.id, async client => { const owned = await client.query("SELECT id FROM bet WHERE id=$1 AND user_id=$2 AND status='pending'", [id, session.id]); if (!owned.rowCount) return null; return (await client.query("SELECT * FROM settle_bet($1::uuid, $2::bet_status, $3::numeric)", [id, input.status, input.effectiveReturn ?? null])).rows[0]; }); if (!row) return NextResponse.json({ error: "Aposta não encontrada." }, { status: 404 }); return NextResponse.json(row); } catch (e) { return securityError(e)??apiError(e); }
}

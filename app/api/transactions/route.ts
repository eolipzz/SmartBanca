import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { apiError } from "@/lib/http";
import { assertSameOrigin, securityError } from "@/lib/security";
const schema = z.object({ type: z.enum(["deposit", "withdrawal"]), amount: z.coerce.number().positive().max(100_000_000), occurredAt: z.iso.datetime().optional(), note: z.string().trim().max(200).optional() });
export async function GET() { const session = await getSession(); if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 }); try { const rows = await withUser(session.id, async c => (await c.query("SELECT id,type,amount,occurred_at,note FROM bank_transaction WHERE user_id=$1 ORDER BY occurred_at DESC LIMIT 500", [session.id])).rows); return NextResponse.json(rows); } catch(e){return apiError(e);} }
export async function POST(request: Request) { const session = await getSession(); if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 }); try { assertSameOrigin(request); const d = schema.parse(await request.json()); const row = await withUser(session.id, async c => (await c.query("INSERT INTO bank_transaction(user_id,type,amount,occurred_at,note) VALUES($1,$2,$3,COALESCE($4::timestamptz,now()),$5) RETURNING *", [session.id,d.type,d.amount,d.occurredAt??null,d.note??null])).rows[0]); return NextResponse.json(row,{status:201}); } catch(e){return securityError(e)??apiError(e);} }

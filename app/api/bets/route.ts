import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { apiError } from "@/lib/http";
import { assertSameOrigin, securityError } from "@/lib/security";

const createSchema = z.object({ placedAt: z.iso.datetime(), sport: z.string().trim().min(2).max(40), eventMarket: z.string().trim().max(160).optional(), stake: z.coerce.number().positive().max(10_000_000), initialOdd: z.coerce.number().min(1.01).max(1000) });
export async function GET() {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try { const rows = await withUser(session.id, async client => (await client.query("SELECT id, placed_at, settled_at, sport, event_market, stake, initial_odd, potential_return, status, effective_return FROM bet WHERE user_id=$1 ORDER BY placed_at DESC LIMIT 500", [session.id])).rows); return NextResponse.json(rows); } catch (e) { return apiError(e); }
}
export async function POST(request: Request) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try { assertSameOrigin(request); const data = createSchema.parse(await request.json()); const row = await withUser(session.id, async client => (await client.query("INSERT INTO bet (user_id, placed_at, sport, event_market, stake, initial_odd) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [session.id, data.placedAt, data.sport, data.eventMarket ?? null, data.stake, data.initialOdd])).rows[0]); return NextResponse.json(row, { status: 201 }); } catch (e) { return securityError(e)??apiError(e); }
}

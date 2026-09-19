import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { apiError } from "@/lib/http";
import { assertSameOrigin, securityError } from "@/lib/security";

const schema = z.object({ name: z.string().trim().min(2).max(80) });
export async function GET() { const session=await getSession(); if(!session) return NextResponse.json({error:"Não autenticado."},{status:401}); try { const user=await withUser(session.id,async c=>(await c.query("SELECT id,name,email,avatar_data IS NOT NULL AS has_avatar FROM app_user WHERE id=$1",[session.id])).rows[0]); return NextResponse.json(user); } catch(e){ return apiError(e); } }
export async function PATCH(request:Request) { const session=await getSession(); if(!session) return NextResponse.json({error:"Não autenticado."},{status:401}); try { assertSameOrigin(request); const {name}=schema.parse(await request.json()); const user=await withUser(session.id,async c=>(await c.query("UPDATE app_user SET name=$1,updated_at=now() WHERE id=$2 RETURNING id,name,email,avatar_data IS NOT NULL AS has_avatar",[name,session.id])).rows[0]); return NextResponse.json(user); } catch(e){ return securityError(e)??apiError(e); } }

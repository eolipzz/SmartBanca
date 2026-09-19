import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { assertSameOrigin, securityError } from "@/lib/security";
export async function POST(request:Request) { try{assertSameOrigin(request);await clearSession(); return NextResponse.json({ ok: true });}catch(e){return securityError(e)??NextResponse.json({error:"Falha ao sair."},{status:500});} }

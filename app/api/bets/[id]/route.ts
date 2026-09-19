import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { apiError } from "@/lib/http";
import { assertSameOrigin, securityError } from "@/lib/security";

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){const session=await getSession();if(!session)return NextResponse.json({error:"Não autenticado."},{status:401});try{assertSameOrigin(request);const{id}=await params;const result=await withUser(session.id,c=>c.query("DELETE FROM bet WHERE id=$1 AND user_id=$2 AND status='pending'",[id,session.id]));return result.rowCount?NextResponse.json({ok:true}):NextResponse.json({error:"Somente apostas pendentes podem ser excluídas."},{status:409});}catch(e){return securityError(e)??apiError(e)}}

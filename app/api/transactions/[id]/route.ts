import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { apiError } from "@/lib/http";
import { assertSameOrigin, securityError } from "@/lib/security";

const schema=z.object({amount:z.coerce.number().positive().max(100_000_000),note:z.string().trim().max(200).optional()});
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const session=await getSession();if(!session)return NextResponse.json({error:"Não autenticado."},{status:401});try{assertSameOrigin(request);const{id}=await params;const d=schema.parse(await request.json());const row=await withUser(session.id,async c=>(await c.query("UPDATE bank_transaction SET amount=$1,note=$2 WHERE id=$3 AND user_id=$4 RETURNING id,type,amount,occurred_at,note",[d.amount,d.note??null,id,session.id])).rows[0]);return row?NextResponse.json(row):NextResponse.json({error:"Movimentação não encontrada."},{status:404});}catch(e){return securityError(e)??apiError(e)}}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){const session=await getSession();if(!session)return NextResponse.json({error:"Não autenticado."},{status:401});try{assertSameOrigin(request);const{id}=await params;const result=await withUser(session.id,c=>c.query("DELETE FROM bank_transaction WHERE id=$1 AND user_id=$2",[id,session.id]));return result.rowCount?NextResponse.json({ok:true}):NextResponse.json({error:"Movimentação não encontrada."},{status:404});}catch(e){return securityError(e)??apiError(e)}}

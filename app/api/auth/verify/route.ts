import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { apiError } from "@/lib/http";
import { assertSameOrigin, hashToken, securityError } from "@/lib/security";

const schema=z.object({token:z.string().min(32).max(256)});
export async function POST(request:Request){
  try{
    assertSameOrigin(request); const data=schema.parse(await request.json());
    const result=await pool.query<{verify_email_with_token:boolean}>("SELECT verify_email_with_token($1)",[hashToken(data.token)]);
    if(!result.rows[0]?.verify_email_with_token) return NextResponse.json({error:"Este link expirou ou já foi utilizado."},{status:400});
    return NextResponse.json({message:"E-mail confirmado."});
  }catch(error){return securityError(error)??apiError(error);}
}

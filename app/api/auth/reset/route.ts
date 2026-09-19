import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "@/lib/db";
import { apiError } from "@/lib/http";
import { assertSameOrigin, hashToken, securityError } from "@/lib/security";

const schema=z.object({token:z.string().min(32).max(256),password:z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/)});
export async function POST(request:Request){
  try{
    assertSameOrigin(request); const data=schema.parse(await request.json());
    const passwordHash=await bcrypt.hash(data.password,12);
    const result=await pool.query<{reset_password_with_token:boolean}>("SELECT reset_password_with_token($1,$2)",[hashToken(data.token),passwordHash]);
    if(!result.rows[0]?.reset_password_with_token) return NextResponse.json({error:"Este link expirou ou já foi utilizado."},{status:400});
    return NextResponse.json({message:"Senha alterada com sucesso."});
  }catch(error){return securityError(error)??apiError(error);}
}

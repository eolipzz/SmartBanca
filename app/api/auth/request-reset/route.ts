import { NextResponse } from "next/server";
import { z } from "zod";
import { pool, withUser } from "@/lib/db";
import { assertSameOrigin, consumeAuthRateLimit, hashToken, newToken, securityError } from "@/lib/security";
import { sendMail } from "@/lib/email";
import { apiError } from "@/lib/http";

const schema=z.object({email:z.email().toLowerCase()});
export async function POST(request:Request){
  try{
    assertSameOrigin(request);
    const data=schema.parse(await request.json());
    const ip=request.headers.get("x-forwarded-for")?.split(",")[0]??"local";
    if(!await consumeAuthRateLimit(`${ip}:reset:${data.email}`,4)) return NextResponse.json({error:"Aguarde antes de solicitar outro link."},{status:429});
    const found=await pool.query<{id:string}>("SELECT id FROM lookup_login_user($1)",[data.email]);
    let devUrl:string|undefined;
    if(found.rows[0]){
      const token=newToken();
      await withUser(found.rows[0].id,client=>client.query("INSERT INTO auth_token(user_id,token_hash,purpose,expires_at) VALUES($1,$2,'reset_password',now()+interval '30 minutes')",[found.rows[0].id,hashToken(token)]));
      const url=`${process.env.NEXT_PUBLIC_APP_URL??"http://localhost:3000"}/recuperar?token=${encodeURIComponent(token)}`;
      await sendMail({to:data.email,subject:"Redefina sua senha do SmartBanca",text:`Abra este link em até 30 minutos: ${url}`});
      if(process.env.NODE_ENV!=="production") devUrl=url;
    }
    return NextResponse.json({message:"Se o e-mail estiver cadastrado, enviaremos um link.",devUrl});
  }catch(error){return securityError(error)??apiError(error);}
}

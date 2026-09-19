import { getSession } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { NextResponse } from "next/server";

const cell=(value:unknown)=>`"${String(value??"").replaceAll('"','""')}"`;
export async function GET(){const session=await getSession();if(!session)return NextResponse.json({error:"Não autenticado."},{status:401});const [bets,transactions]=await withUser(session.id,async c=>Promise.all([c.query("SELECT placed_at,sport,event_market,stake,initial_odd,status,effective_return FROM bet WHERE user_id=$1 ORDER BY placed_at DESC",[session.id]),c.query("SELECT occurred_at,type,amount,note FROM bank_transaction WHERE user_id=$1 ORDER BY occurred_at DESC",[session.id])]));const lines=["TIPO,DATA,DESCRICAO,MODALIDADE,VALOR,ODD,STATUS,RETORNO",...bets.rows.map(b=>["APOSTA",b.placed_at,b.event_market,b.sport,b.stake,b.initial_odd,b.status,b.effective_return].map(cell).join(",")),...transactions.rows.map(t=>["MOVIMENTACAO",t.occurred_at,t.note,"",t.amount,"",t.type,""].map(cell).join(","))];return new NextResponse("\uFEFF"+lines.join("\r\n"),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=smartbanca-dados.csv"}})}

"use client";
import { useMemo } from "react";

type BetPoint={settledAt:string|null;status:string;result:number};
type TransactionPoint={occurredAt:string;type:"Depósito"|"Saque";amount:number};
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});

export function BankEvolution({bets,transactions}:{bets:BetPoint[];transactions:TransactionPoint[]}){
  const chart=useMemo(()=>{
    const events=[...transactions.map(item=>({at:new Date(item.occurredAt).getTime(),change:item.type==="Depósito"?item.amount:-item.amount})),...bets.filter(item=>item.settledAt&&item.status!=="Pendente").map(item=>({at:new Date(item.settledAt!).getTime(),change:item.result}))].sort((a,b)=>a.at-b.at);
    const points=events.reduce<{at:number;balance:number}[]>((current,event)=>[...current,{at:event.at,balance:(current.at(-1)?.balance??0)+event.change}],[]);
    if(!points.length)return {points:[],path:"",min:0,max:0,current:0};
    const values=[0,...points.map(point=>point.balance)]; const min=Math.min(...values); const max=Math.max(...values); const span=Math.max(1,max-min); const start=points[0].at; const end=Math.max(start+1,points.at(-1)!.at);
    const normalized=[{at:start,balance:0},...points].map(point=>({x:24+(point.at-start)/(end-start)*652,y:170-(point.balance-min)/span*130,...point}));
    return {points,path:normalized.map((point,index)=>`${index?"L":"M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "),min,max,current:points.at(-1)!.balance};
  },[bets,transactions]);
  const direction=chart.current>0?"subiu":chart.current<0?"caiu":"não mudou";
  return <article className="panel equity-chart"><div className="panel-heading"><div><h2>O caminho da sua banca</h2><p>A linha sobe quando entra dinheiro e desce quando sai.</p></div>{chart.points.length?<strong>{money.format(chart.current)}</strong>:null}</div>{chart.points.length?<><div className={`chart-reading ${chart.current>=0?"positive-reading":"negative-reading"}`}><strong>Em resumo: sua banca {direction} {money.format(Math.abs(chart.current))} desde o início.</strong><span>Foram consideradas {chart.points.length} movimentações entre depósitos, saques e apostas encerradas.</span></div><div className="equity-plot"><span>Maior saldo: {money.format(chart.max)}</span><svg viewBox="0 0 700 195" role="img" aria-label={`A banca variou de ${money.format(chart.min)} até ${money.format(chart.max)} e terminou em ${money.format(chart.current)}`}><defs><linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f04444" stopOpacity=".28"/><stop offset="1" stopColor="#f04444" stopOpacity="0"/></linearGradient></defs><path d={`${chart.path} L676,180 L24,180 Z`} fill="url(#equity-fill)"/><path d={chart.path} fill="none" stroke="#f05a5a" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/></svg><div className="chart-range"><small>Começo<br/><b>{new Date(chart.points[0].at).toLocaleDateString("pt-BR")}</b></small><small>Menor saldo<br/><b>{money.format(chart.min)}</b></small><small>Hoje<br/><b>{new Date(chart.points.at(-1)!.at).toLocaleDateString("pt-BR")}</b></small></div></div></>:<div className="chart-empty"><strong>A evolução começa no primeiro depósito.</strong><span>Depois, cada saque e resultado encerrado atualiza esta linha.</span></div>}</article>;
}

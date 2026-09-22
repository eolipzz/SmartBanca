"use client";

import { useMemo, useState } from "react";

type BetPoint = { settledAt: string | null; status: string; result: number };
type TransactionPoint = { occurredAt: string; type: "Depósito" | "Saque"; amount: number };
type RangeDays = 7 | 30 | 90 | 365;
type Activity = "all" | "bets" | "movements";
type EvolutionEvent = { at: number; change: number; kind: Exclude<Activity, "all"> };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const rangeOptions: RangeDays[] = [7, 30, 90, 365];

function rangeLabel(days: RangeDays) {
  if (days === 90) return "3 meses";
  if (days === 365) return "12 meses";
  return `${days} dias`;
}

export function BankEvolution({ bets, transactions }: { bets: BetPoint[]; transactions: TransactionPoint[] }) {
  const [rangeDays, setRangeDays] = useState<RangeDays>(7);
  const [activity, setActivity] = useState<Activity>("all");

  const chart = useMemo(() => {
    const allEvents: EvolutionEvent[] = [
      ...transactions.map(item => ({ at: new Date(item.occurredAt).getTime(), change: item.type === "Depósito" ? item.amount : -item.amount, kind: "movements" as const })),
      ...bets.filter(item => item.settledAt && item.status !== "Pendente").map(item => ({ at: new Date(item.settledAt!).getTime(), change: item.result, kind: "bets" as const })),
    ].filter(event => Number.isFinite(event.at) && Number.isFinite(event.change)).sort((a, b) => a.at - b.at);

    const relevantEvents = activity === "all" ? allEvents : allEvents.filter(event => event.kind === activity);
    const end = Date.now();
    const start = end - rangeDays * 24 * 60 * 60 * 1000;
    const opening = relevantEvents.reduce((total, event) => event.at < start ? total + event.change : total, 0);
    const periodEvents = relevantEvents.filter(event => event.at >= start && event.at <= end);
    let running = opening;
    const points = [{ at: start, balance: opening }, ...periodEvents.map(event => ({ at: event.at, balance: running += event.change })), { at: end, balance: running }];
    const values = points.map(point => point.balance);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = Math.max((rawMax - rawMin) * .18, Math.abs(rawMax) * .08, 10);
    const min = rawMin - padding;
    const max = rawMax + padding;
    const span = Math.max(1, max - min);
    const normalized = points.map(point => ({ ...point, x: 72 + ((point.at - start) / (end - start)) * 596, y: 30 + ((max - point.balance) / span) * 210 }));
    const path = normalized.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const net = running - opening;
    const ticks = Array.from({ length: 4 }, (_, index) => max - (span / 3) * index);
    const dates = Array.from({ length: 5 }, (_, index) => start + ((end - start) / 4) * index);
    return { dates, end, eventCount: periodEvents.length, net, normalized, opening, path, running, start, ticks };
  }, [activity, bets, rangeDays, transactions]);

  const positive = chart.net >= 0;
  const activityText = activity === "bets" ? "nas apostas" : activity === "movements" ? "nas movimentações" : "na banca";
  const lineColor = positive ? "#33d17a" : "#ff5f64";
  const lastPoint = chart.normalized.at(-1)!;

  return (
    <article className={`panel evolution-card ${positive ? "evolution-positive" : "evolution-negative"}`} aria-labelledby="evolution-title">
      <header className="evolution-heading"><div><h2 id="evolution-title">Meus lucros e perdas</h2><p>Veja, de forma simples, como sua banca mudou.</p></div><span className="evolution-info" title="Depósitos, saques e resultados encerrados formam esta linha" aria-label="Sobre este gráfico">i</span></header>
      <div className="evolution-filters" aria-label="Período do gráfico">{rangeOptions.map(days => <button key={days} type="button" className={rangeDays === days ? "active" : ""} aria-pressed={rangeDays === days} onClick={() => setRangeDays(days)}>{rangeLabel(days)}</button>)}</div>
      <label className="evolution-activity"><span>Atividade</span><select value={activity} onChange={event => setActivity(event.target.value as Activity)}><option value="all">Todas as atividades</option><option value="bets">Somente apostas encerradas</option><option value="movements">Somente depósitos e saques</option></select></label>
      <div className="evolution-result"><p>De {shortDate.format(chart.start)} a {shortDate.format(chart.end)}, você <strong>{positive ? "ganhou" : "perdeu"}</strong></p><b className={positive ? "positive" : "negative"}>{positive ? "+ " : "− "}{money.format(Math.abs(chart.net))}</b><span>{chart.eventCount === 0 ? `Nenhuma atividade registrada ${activityText} neste período.` : `${chart.eventCount} ${chart.eventCount === 1 ? "registro considerado" : "registros considerados"} ${activityText}.`}</span></div>
      <div className="evolution-plot"><svg viewBox="0 0 700 295" role="img" aria-label={`Entre ${shortDate.format(chart.start)} e ${shortDate.format(chart.end)}, o resultado foi ${money.format(chart.net)}.`}><defs><linearGradient id="evolution-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={lineColor} stopOpacity=".24"/><stop offset="1" stopColor={lineColor} stopOpacity="0"/></linearGradient></defs>{chart.ticks.map((tick, index) => { const y = 30 + index * 70; return <g key={`${tick}-${index}`}><line x1="72" y1={y} x2="668" y2={y} className="evolution-grid-line"/><text x="62" y={y + 4} textAnchor="end" className="evolution-axis-label">{compactMoney.format(tick)}</text></g>; })}<path d={`${chart.path} L668,240 L72,240 Z`} fill="url(#evolution-area)"/><path d={chart.path} fill="none" stroke={lineColor} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>{chart.normalized.slice(1, -1).map((point, index) => <circle key={`${point.at}-${index}`} cx={point.x} cy={point.y} r="4" fill="var(--surface)" stroke={lineColor} strokeWidth="2"/>)}<line x1={lastPoint.x} y1={lastPoint.y} x2={lastPoint.x} y2="240" stroke={lineColor} strokeDasharray="3 4" opacity=".55"/><circle cx={lastPoint.x} cy={lastPoint.y} r="7" fill="var(--surface)" stroke={lineColor} strokeWidth="3"/>{chart.dates.map((date, index) => <text key={date} x={72 + index * 149} y="276" textAnchor={index === 0 ? "start" : index === 4 ? "end" : "middle"} className="evolution-date-label">{shortDate.format(date)}</text>)}</svg></div>
      <footer className="evolution-footnote"><span>Saldo no início: <strong>{money.format(chart.opening)}</strong></span><span>Saldo ao final: <strong>{money.format(chart.running)}</strong></span></footer>
    </article>
  );
}

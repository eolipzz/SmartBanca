export type FinancialBet={stake:number;result:number;pending:boolean};
export type FinancialMovement={type:"deposit"|"withdrawal";amount:number};

export function calculateBank(bets:FinancialBet[],movements:FinancialMovement[]){
  const deposits=movements.filter(item=>item.type==="deposit").reduce((sum,item)=>sum+item.amount,0);
  const withdrawals=movements.filter(item=>item.type==="withdrawal").reduce((sum,item)=>sum+item.amount,0);
  const held=bets.filter(item=>item.pending).reduce((sum,item)=>sum+item.stake,0);
  const profit=bets.filter(item=>!item.pending).reduce((sum,item)=>sum+item.result,0);
  return {deposits,withdrawals,held,profit,available:deposits-withdrawals+profit-held};
}

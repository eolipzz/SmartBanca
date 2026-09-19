import test from "node:test";
import assert from "node:assert/strict";
import {calculateBank} from "../lib/finance.ts";

test("conta depósitos, saques, lucro e stake retida",()=>{
  assert.deepEqual(calculateBank([{stake:100,result:0,pending:true},{stake:50,result:40,pending:false}],[{type:"deposit",amount:500},{type:"withdrawal",amount:80}]),{deposits:500,withdrawals:80,held:100,profit:40,grossWins:40,grossLosses:0,available:360});
});

test("banca nova começa completamente zerada",()=>{
  assert.deepEqual(calculateBank([],[]),{deposits:0,withdrawals:0,held:0,profit:0,grossWins:0,grossLosses:0,available:0});
});

test("red reduz o saldo disponível",()=>{
  const bank=calculateBank([{stake:75,result:-75,pending:false}],[{type:"deposit",amount:200}]);
  assert.equal(bank.available,125);
  assert.equal(bank.grossLosses,75);
});

test("separa ganhos e perdas do resultado líquido",()=>{
  const bank=calculateBank([{stake:100,result:85,pending:false},{stake:60,result:-60,pending:false},{stake:30,result:-10,pending:false}],[]);
  assert.equal(bank.grossWins,85);
  assert.equal(bank.grossLosses,70);
  assert.equal(bank.profit,15);
});

import test from "node:test";
import assert from "node:assert/strict";
import {calculateBank} from "../lib/finance.ts";

test("conta depósitos, saques, lucro e stake retida",()=>{
  assert.deepEqual(calculateBank([{stake:100,result:0,pending:true},{stake:50,result:40,pending:false}],[{type:"deposit",amount:500},{type:"withdrawal",amount:80}]),{deposits:500,withdrawals:80,held:100,profit:40,available:360});
});

test("banca nova começa completamente zerada",()=>{
  assert.deepEqual(calculateBank([],[]),{deposits:0,withdrawals:0,held:0,profit:0,available:0});
});

test("red reduz o saldo disponível",()=>{
  assert.equal(calculateBank([{stake:75,result:-75,pending:false}],[{type:"deposit",amount:200}]).available,125);
});

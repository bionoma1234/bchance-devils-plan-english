import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const context = { Math, console };
context.globalThis = context;
vm.runInNewContext(readFileSync(new URL('../public/devils-plan/poker-engine.js', import.meta.url), 'utf8'), context);
const { deal, evaluate, best, compare } = context.DP3Poker;
function category(hand) { return evaluate(hand).name; }
assert.equal(category(['AS','KS','QS','JS','TS']),'Straight flush');
assert.equal(category(['AS','2D','3C','4H','5S']),'Straight');
assert.equal(category(['2S','2H','2D','2C','AS']),'Four of a kind');
assert.equal(category(['5S','5H','5D','9C','9S']),'Full house');
assert.equal(category(['AS','JS','8S','5S','2S']),'Flush');
assert.equal(category(['3S','4H','5D','6C','7S']),'Straight');
assert.equal(category(['8S','8H','8D','2C','KS']),'Three of a kind');
assert.equal(category(['8S','8H','KD','KC','AS']),'Two pair');
assert.equal(category(['8S','8H','QD','2C','AS']),'One pair');
assert.equal(category(['3S','8H','QD','5C','AS']),'High card');
assert.ok(compare(evaluate(['AS','KS','QS','JS','TS']),evaluate(['AS','2D','3C','4H','5S']))>0);
for (let t=0;t<100;t++){
 const {board,shared}=deal();
 assert.equal(board.length,16); assert.equal(shared.length,3);
 assert.equal(new Set([...board,...shared]).size,19);
 const optimum=best(board,shared);
 assert.equal(optimum.hand.length,5);
 for(let i=0;i<15;i++)for(let j=i+1;j<16;j++) assert.ok(compare(optimum.evaluation,evaluate([board[i],board[j],...shared]))>=0);
}
console.log('PASS: Memory Poker unique dealing, hand ranks, best-hand evaluation');

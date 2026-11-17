import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;
const {GAME_NAMES, createMatch, act, advanceIfDue, view, countRectangles, evaluate, compareScores}=await import('../src/multiplayer.js');
function players(n){return Array.from({length:n},(_,i)=>({id:'p'+i,name:'Player '+i}));}
assert.equal(countRectangles([1,2,3,4],2,3),2);
assert.ok(compareScores(evaluate(['AS','KS','QS','JS','TS']),evaluate(['2S','3D','4H','5C','6S']))>0);
assert.equal(Object.keys(GAME_NAMES).length,5);
const poker=createMatch('poker',players(3));
assert.equal(poker.phase,'memorize');
assert.equal(view(poker,'p0').board.length,16);
assert.equal(view(poker,'p0').community.length,0);
assert.ok(advanceIfDue(poker,poker.deadline));
assert.equal(poker.phase,'pick');
assert.equal(view(poker,'p0').board,null);
assert.equal(view(poker,'p0').community.length,3);
assert.equal(act(poker,'p0',{type:'answer',positions:[0,0]}),false);
for(let i=0;i<3;i++)assert.equal(act(poker,'p'+i,{type:'answer',positions:[i,i+1]}),true);
assert.equal(poker.phase,'result');
assert.equal(poker.results.length,3);
assert.equal(act(poker,'p0',{type:'answer',positions:[0,1]}),false);
for(let i=0;i<3;i++)if(i!==0){}
assert.equal(act(poker,'p0',{type:'next'}),true);
assert.equal(poker.round,2);
const square=createMatch('square',players(2));
assert.equal(square.phase,'answer');
assert.equal(view(square,'p0').answer,undefined);
assert.equal(countRectangles(square.puzzle.values,square.puzzle.size,square.puzzle.target),square.puzzle.answer);
assert.equal(act(square,'p0',{type:'answer',guess:square.puzzle.answer}),true);
assert.equal(act(square,'p1',{type:'answer',guess:999}),true);
assert.equal(square.phase,'result');assert.equal(square.points.p0,1);assert.equal(square.points.p1,0);
const cube=createMatch('cube',players(2));
assert.equal(cube.puzzle.heights.length,cube.puzzle.size*cube.puzzle.size);
assert.equal(cube.puzzle.answer,cube.puzzle.heights.reduce((a,b)=>a+b,0));
assert.equal(act(cube,'p0',{type:'answer',guess:cube.puzzle.answer}),true);
assert.equal(act(cube,'p1',{type:'answer',guess:cube.puzzle.answer}),true);
assert.equal(cube.points.p0,1);assert.equal(cube.phase,'result');
const heavy=createMatch('heavy',players(2));
assert.equal(heavy.phase,'choose');
for(let round=1;round<=7;round++){
 const chip=['red','red','green','green','blue','blue','rainbow'][round-1];
 for(let i=0;i<2;i++)assert.equal(act(heavy,'p'+i,{type:'choose',card:round-1,chip}),true);
 assert.equal(heavy.phase,'place');
 let guard=0;
 while(heavy.phase==='place'&&guard++<12){
  const current=heavy.queue[0];const color=current.chip==='rainbow'?'red':current.chip;
  assert.equal(act(heavy,current.id,{type:'place',color}),true);
 }
 assert.equal(heavy.phase,'result');
 assert.equal(heavy.round,round);
 assert.equal(act(heavy,'p0',{type:'next'}),true);
}
assert.equal(heavy.phase,'complete');
assert.equal(heavy.winnerIds.length>=1,true);
const roulette=createMatch('roulette',players(6));
assert.equal(roulette.phase,'turn');
assert.throws(()=>createMatch('roulette',players(5)),/exactly six/i);
assert.equal(view(roulette,'p0').chambers,undefined);
assert.equal(act(roulette,'p0',{type:'roulette',action:'private',pair:0}),true);
assert.equal(view(roulette,'p0').privateNotes.length,1);
assert.equal(view(roulette,'p1').privateNotes.length,0);
assert.equal(roulette.credits.p0,14);
let guard=0;
while(roulette.phase==='turn'&&guard++<100)assert.equal(advanceIfDue(roulette,roulette.deadline),true);
assert.equal(roulette.phase,'complete');
assert.equal(roulette.winnerIds.length,4);
assert.equal(view(roulette,'p1').chambers.length,6);
console.log('PASS: five server-controlled games, poker secrecy, Heavy 13 round order, cube/square scoring and Russian Roulette private actions');

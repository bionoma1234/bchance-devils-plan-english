import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
globalThis.crypto ??= webcrypto;
const {createJakMatch,actJak,advanceJakIfDue,viewJak,JAK_GAMES,isJak}=await import('../src/jakbox.js');
const people=n=>Array.from({length:n},(_,i)=>({id:'fake-player-'+i,name:'Player '+i}));
const validResponse=(m)=>{
 switch(m.category){
  case 'hands':return true;
  case 'number':return 3;
  case 'point':return m.ids[0];
  case 'face':return '🤔';
  case 'text':return 'A tiny invisible pineapple';
  default:throw Error('Unrecognized task category '+m.category);
 }
};
assert.equal(Object.keys(JAK_GAMES).length,6);
assert.equal(isJak('jak:faker'),true);
assert.equal(JAK_GAMES['jak:faker'].min,3);
assert.equal(JAK_GAMES['jak:faker'].max,6);
assert.throws(()=>createJakMatch('jak:faker',people(2)),/3–6 players/);
assert.throws(()=>createJakMatch('jak:faker',people(7)),/3–6 players/);
let m=createJakMatch('jak:faker',people(3));
assert.equal(m.phase,'act');assert.equal(m.setNumber,1);assert.equal(m.taskNumber,1);
const faker=m.faker,detectives=m.ids.filter(id=>id!==faker);
const fakerView=viewJak(m,faker),detectiveView=viewJak(m,detectives[0]);
assert.equal(fakerView.isFaker,true);
assert.equal(fakerView.prompt,null);
assert.equal(fakerView.fakerId,undefined);
assert.equal(detectiveView.isFaker,false);
assert.equal(typeof detectiveView.prompt,'string');
assert.ok(detectiveView.prompt.length>12);
assert.equal(detectiveView.fakerId,undefined);
assert.equal(viewJak(m,detectives[1]).prompt,detectiveView.prompt);
assert.equal(Object.keys(viewJak(m,detectives[1])).includes('votes'),false);
for(const id of m.ids)assert.equal(actJak(m,id,{type:'respond',answer:validResponse(m)}),true);
assert.equal(actJak(m,faker,{type:'respond',answer:validResponse(m)}),false);
assert.equal(m.phase,'discussion');
assert.equal(viewJak(m,faker).prompt,m.prompt);
assert.equal(viewJak(m,faker).responses.length,3);
assert.equal(advanceJakIfDue(m,m.deadline),true);
assert.equal(m.phase,'vote');
assert.equal(actJak(m,faker,{type:'accuse',target:faker}),false);
assert.equal(actJak(m,detectives[0],{type:'accuse',target:faker}),true);
assert.equal(actJak(m,detectives[1],{type:'accuse',target:detectives[0]}),true);
assert.equal(actJak(m,faker,{type:'accuse',target:detectives[0]}),true);
assert.equal(m.phase,'result');
assert.equal(m.result.done,false);
assert.equal(m.result.faker,null);
assert.equal(viewJak(m,detectives[0]).fakerId,undefined);
assert.ok(Object.values(m.points).every(x=>x===0),'No score leak before reveal');
assert.equal(actJak(m,faker,{type:'next'}),true);
assert.equal(m.taskNumber,2);
assert.equal(m.faker,faker,'Same faker must persist across interrogations');
assert.equal(m.phase,'act');
assert.equal(m.category,'number');
assert.equal(actJak(m,faker,{type:'respond',answer:999}),false);
for(const id of m.ids)assert.equal(actJak(m,id,{type:'respond',answer:validResponse(m)}),true);
assert.equal(m.phase,'discussion');
advanceJakIfDue(m,m.deadline);assert.equal(m.phase,'vote');
for(const id of detectives)assert.equal(actJak(m,id,{type:'accuse',target:faker}),true);
assert.equal(actJak(m,faker,{type:'accuse',target:detectives[0]}),true);
assert.equal(m.phase,'result');assert.equal(m.result.done,true);
assert.equal(m.result.caught,true);
assert.equal(viewJak(m,detectives[0]).fakerId,faker);
assert.equal(viewJak(m,faker).fakerId,faker);
assert.ok(m.points[detectives[0]]>=500);
assert.ok(m.points[faker]>=250);
assert.equal(actJak(m,detectives[0],{type:'next'}),true);
assert.equal(m.setNumber,2);assert.notEqual(m.faker,faker,'Rotate secret roles');
assert.equal(m.phase,'act');
for(let set=2;set<=3;set++){
  const taskFaker=m.faker;
  const limit=m.ids.length===3?2:3;
  for(let attempt=1;attempt<=limit;attempt++){
    assert.equal(m.taskNumber,attempt);
    for(const id of m.ids)assert.equal(actJak(m,id,{type:'respond',answer:validResponse(m)}),true);
    assert.equal(m.phase,'discussion');
    assert.equal(advanceJakIfDue(m,m.deadline),true);
    assert.equal(m.phase,'vote');
    // Every detective chooses a non-Faker option; no unanimous catch.
    const other=m.ids.filter(x=>x!==taskFaker);
    for(const pid of m.ids){
      const target=pid===taskFaker?other[0]:other.find(x=>x!==pid)??taskFaker;
      assert.equal(actJak(m,pid,{type:'accuse',target}),true);
    }
    assert.equal(m.phase,'result');
    if(attempt<limit){
      assert.equal(m.result.done,false);
      assert.equal(viewJak(m,other[0]).fakerId,undefined);
      actJak(m,other[0],{type:'next'});
    }
  }
  assert.equal(m.result.done,true);assert.equal(m.result.caught,false);
  assert.ok(m.points[taskFaker]>=1100,'Surviving grants score');
  assert.equal(viewJak(m,m.ids[0]).fakerId,taskFaker);
  assert.equal(actJak(m,m.ids[0],{type:'next'}),true);
  if(set<3){assert.equal(m.setNumber,set+1);}else{assert.equal(m.phase,'complete');}
}
assert.equal(new Set(m.fakerOrder.slice(0,3)).size,3);
assert.ok(m.winnerIds.length>0);
const six=createJakMatch('jak:faker',people(6));
assert.equal(six.maxTasks,undefined);
for(const id of six.ids)assert.equal(actJak(six,id,{type:'respond',answer:validResponse(six)}),true);
assert.equal(six.phase,'discussion');
assert.equal(advanceJakIfDue(six,six.deadline),true);
assert.equal(advanceJakIfDue(six,six.deadline),true);
assert.equal(six.phase,'result');
assert.equal(six.result.done,false);
assert.equal(six.result.maxTasks,3);
console.log('PASS: Fake Out 3-6 players, private faker task, answer submission, discussions, votes, rotating roles, secrecy, timeouts, and finish');

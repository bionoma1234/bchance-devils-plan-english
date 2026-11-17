import assert from 'node:assert/strict';
const base=(process.env.JAKBOX_LIVE_BASE||'https://bchance-devils-plan-english.bionoma1954.workers.dev').replace(/\/$/,'');
const origin=base.replace(/^http/,'ws');
const timeout=12000;
async function withTimeout(p,ms=timeout){let timer;try{return await Promise.race([p,new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('Timed out after '+ms+' ms')),ms))]);}finally{clearTimeout(timer)}}
async function verifyPage(path,expected){
 const r=await withTimeout(fetch(base+path),15000);
 assert.equal(r.status,200,'HTTP '+r.status+' for '+path);
 const page=await r.text();
 assert.ok(page.includes(expected),'Missing expected content on '+path);
 console.log('LIVE OK '+path+' ('+page.length+' bytes)');
}
assert.equal(typeof WebSocket,'function','Node 22+ WebSocket is required');
await verifyPage('/jakbox/','Prompt Clash');
await verifyPage('/jakbox/room/','PRIVATE PARTY ROOM');
await verifyPage('/devils-plan/','Devil');
console.log('LIVE STEP api health request');
const health=await withTimeout(fetch(base+'/api/health'));
assert.equal(health.status,200);
assert.equal((await health.json()).ok,true);
console.log('LIVE STEP api health 200');
console.log('LIVE STEP creating JakBox room');
const created=await withTimeout(fetch(base+'/api/rooms',{
 method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({gameId:'jak:bluff'})
}));
assert.equal(created.status,201,'Room creation must return HTTP 201');
const data=await created.json();
assert.match(data.code,/^[A-HJ-NP-Z2-9]{6}$/);
assert.ok(data.hostToken);
console.log('LIVE STEP room created: '+data.code);
function client(name,token,session){
 const url=origin+'/api/rooms/'+data.code+'/socket?name='+encodeURIComponent(name)+'&sessionId='+session+'&hostToken='+encodeURIComponent(token||'');
 const ws=new WebSocket(url),messages=[],waiters=[];
 ws.addEventListener('open',()=>console.log('LIVE WS '+name+' connected'));
 ws.addEventListener('close',e=>console.log('LIVE WS '+name+' closed '+e.code+' '+e.reason));
 ws.addEventListener('message',event=>{
  let payload;try{payload=JSON.parse(event.data)}catch{return;}
  messages.push(payload);
  if(payload.type!=='state')console.log('LIVE WS '+name+' message: '+JSON.stringify(payload).slice(0,200));
  else console.log('LIVE WS '+name+' state: players '+payload.players?.length+' game '+payload.match?.gameId+' phase '+payload.match?.phase);
  for(const waiter of [...waiters]){
   if(waiter.test(payload)){waiters.splice(waiters.indexOf(waiter),1);waiter.resolve(payload);}
  }
 });
 ws.addEventListener('error',err=>{for(const waiter of waiters)waiter.reject(Error('WebSocket error '+name));waiters.length=0;});
 const wait=(test,ms=timeout)=>{
  const existing=messages.findLast(test);
  if(existing)return Promise.resolve(existing);
  return withTimeout(new Promise((resolve,reject)=>waiters.push({test,resolve,reject})),ms);
 };
 return {ws,wait,send:msg=>ws.send(JSON.stringify(msg)),close:()=>ws.close()};
}
const host=client('Host',data.hostToken,'jak-live-host-001');
const guest=client('Guest','','jak-live-guest-002');
try{
 console.log('LIVE STEP waiting for 2 player WebSockets');
 await Promise.all([
  host.wait(d=>d.type==='state'&&d.players.length===2),
  guest.wait(d=>d.type==='state'&&d.players.length===2)
 ]);
 console.log('LIVE STEP sending ready');
 host.send({type:'ready',ready:true});guest.send({type:'ready',ready:true});
 await host.wait(d=>d.type==='state'&&d.players.length===2&&d.players.every(p=>p.ready));
 console.log('LIVE STEP starting match');
 host.send({type:'start_match'});
 const game=await host.wait(d=>d.type==='state'&&d.match?.phase==='lie'&&d.match.gameId==='jak:bluff');
 assert.equal(game.match.ids.length,2);
 console.log('LIVE STEP submitting lies');
 host.send({type:'game_action',action:{type:'write',text:'A wild fake answer'}});
 guest.send({type:'game_action',action:{type:'write',text:'An unlikely answer'}});
 const voting=await host.wait(d=>d.type==='state'&&d.match?.phase==='vote');
 assert.equal(voting.match.options.length,3);
 assert.ok(voting.match.options.every(o=>!Object.hasOwn(o,'kind')&&!Object.hasOwn(o,'author')));
 assert.equal(Object.hasOwn(voting.match,'truth'),false);
 const gv=await guest.wait(d=>d.type==='state'&&d.match?.phase==='vote');
 const hostPick=voting.match.options.find(o=>o.id!==voting.match.blockedOptionId).id;
 const guestPick=gv.match.options.find(o=>o.id!==gv.match.blockedOptionId).id;
 console.log('LIVE STEP voting');
 host.send({type:'game_action',action:{type:'vote',choice:hostPick}});
 guest.send({type:'game_action',action:{type:'vote',choice:guestPick}});
 const result=await host.wait(d=>d.type==='state'&&d.match?.phase==='result');
 assert.equal(result.match.results.length,3);
 console.log('LIVE STEP next round');
 host.send({type:'next_round'});
 const next=await guest.wait(d=>d.type==='state'&&d.match?.phase==='lie'&&d.match.round===2);
 assert.equal(next.match.round,2);
 console.log('PASS LIVE: Two player WebSocket room, ready, host start, anonymous bluff submission, voting, scoring, new round');
}finally{
 host.close();guest.close();
}

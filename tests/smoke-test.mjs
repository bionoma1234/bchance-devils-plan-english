import * as JakEngines from '../src/jakbox.js';
import * as GameEngines from '../src/multiplayer.js';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

class MockResponse {
  constructor(body, options={}) { this.body=body; this.status=options.status||200; this.headers=options.headers||{}; this.webSocket=options.webSocket; }
  async json(){return JSON.parse(this.body)}
}
class MockStorage {
  data = new Map();
  async get(key){return this.data.get(key)}
  async put(key,value){if(typeof key==='object')for(const [k,v]of Object.entries(key))this.data.set(k,v);else this.data.set(key,value)}
}
class MockWS {
  sent=[];
  closed=false;
  serializeAttachment(a){this.attachment=a}
  deserializeAttachment(){return this.attachment}
  send(data){if(!this.closed)this.sent.push(JSON.parse(data))}
  close(){this.closed=true}
}
let lastPair;
function WebSocketPair(){lastPair={0:new MockWS,1:new MockWS};return lastPair}
class BaseDO{constructor(ctx,env){this.ctx=ctx;this.env=env}}
const source=fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
.replace("import { createMatch, act, advanceIfDue, view } from './multiplayer.js';",'const { createMatch, act, advanceIfDue, view } = globalThis.GameEngines;')
.replace("import { JAK_GAMES, isJak, createJakMatch, actJak, advanceJakIfDue, viewJak } from './jakbox.js';",'const { JAK_GAMES, isJak, createJakMatch, actJak, advanceJakIfDue, viewJak } = globalThis.JakEngines;')
.replace("import { DurableObject } from 'cloudflare:workers';",'const DurableObject = globalThis.BaseDO;')
.replace('export default {','const worker = {')
.replace('export class GameRoom','class GameRoom') + '\nglobalThis.exports={worker,GameRoom};';
const context={JakEngines,GameEngines,BaseDO,Response:MockResponse,Request,URL,crypto:webcrypto,WebSocketPair,Date,Math,console};
vm.runInNewContext(source,context);
const {worker,GameRoom}=context.exports;
const ctx={storage:new MockStorage(),websockets:[],getWebSockets(){return this.websockets.filter(x=>!x.closed)},acceptWebSocket(ws){this.websockets.push(ws)}};
const room=new GameRoom(ctx,{});
let r=await room.fetch(new Request('https://room.internal/init',{method:'POST',body:JSON.stringify({code:'ABCDEF',gameId:'square',hostToken:'SECRET'})}));
assert.equal(r.status,201);
r=await room.fetch(new Request('https://room.internal/info'));assert.equal((await r.json()).code,'ABCDEF');
let wsReq=(name,host,session)=>new Request(`https://room.internal/connect?name=${name}&hostToken=${host}&sessionId=${session}`,{headers:{Upgrade:'websocket'}});
r=await room.fetch(wsReq('Host','SECRET','host-session-12345'));assert.equal(r.status,101);const hostWs=ctx.websockets.at(-1);assert.equal(hostWs.sent.at(-1).isHost,true);
r=await room.fetch(wsReq('Guest','','guest-session-12345'));assert.equal(r.status,101);const guestWs=ctx.websockets.at(-1);assert.equal(guestWs.sent.at(-1).players.length,2);
await room.webSocketMessage(hostWs,JSON.stringify({type:'start_square'}));const snapshot=guestWs.sent.at(-1);assert.equal(snapshot.round.revealed,false);assert.equal(snapshot.round.correctAnswer,undefined);
const n=snapshot.round.size;
assert.equal(snapshot.round.kind,'target-sum');
assert.equal(snapshot.round.values.length,n*n);
assert.ok(snapshot.round.target>=3);
const count=(values,n,target)=>{let total=0;for(let a=0;a<n;a++)for(let b=0;b<n;b++)for(let c=a;c<n;c++)for(let d=b;d<n;d++){let sum=0;for(let r=a;r<=c;r++)for(let x=b;x<=d;x++)sum+=values[r*n+x];if(sum===target)total++;}return total;};
const correct=count(snapshot.round.values,n,snapshot.round.target);
await room.webSocketMessage(guestWs,JSON.stringify({type:'answer_square',guess:correct}));assert.equal(guestWs.sent.at(-1).round.answeredIds.length,1);assert.equal(guestWs.sent.at(-1).round.correctAnswer,undefined);
await room.webSocketMessage(hostWs,JSON.stringify({type:'reveal_square'}));assert.equal(guestWs.sent.at(-1).round.correctAnswer,correct);assert.equal(guestWs.sent.at(-1).round.results[0].correct,true);
await room.webSocketMessage(guestWs,JSON.stringify({type:'chat',text:'Hi all!'}));assert.equal(hostWs.sent.at(-1).chat[0].text,'Hi all!');
console.log('PASS: room initialization, host/guest, WebSockets, Square Count server scoring, and chat.');

await room.webSocketMessage(hostWs,JSON.stringify({type:'ready',ready:true}));
await room.webSocketMessage(guestWs,JSON.stringify({type:'ready',ready:true}));
assert.equal(hostWs.sent.at(-1).players.every(x=>x.ready),true);
await room.webSocketMessage(hostWs,JSON.stringify({type:'start_match'}));
let match=hostWs.sent.at(-1).match;
assert.equal(match.gameId,'square');
assert.equal(match.phase,'answer');
assert.equal(match.answer,undefined);
const matchCorrect=(()=>{
 let n=match.size,v=match.values,target=match.target,total=0;
 for(let a=0;a<n;a++)for(let b=0;b<n;b++)for(let c=a;c<n;c++)for(let d=b;d<n;d++){
 let sum=0;for(let y=a;y<=c;y++)for(let x=b;x<=d;x++)sum+=v[y*n+x];
 if(sum===target)total++;
 }return total;
})();
await room.webSocketMessage(hostWs,JSON.stringify({type:'game_action',action:{type:'answer',guess:matchCorrect}}));
await room.webSocketMessage(guestWs,JSON.stringify({type:'game_action',action:{type:'answer',guess:matchCorrect}}));
match=hostWs.sent.at(-1).match;
assert.equal(match.phase,'result');
assert.equal(match.answer,matchCorrect);
assert.equal(match.points['host-session-12345'],1);
await room.webSocketMessage(hostWs,JSON.stringify({type:'next_round'}));
assert.equal(guestWs.sent.at(-1).match.round,2);
console.log('PASS: shared ready state, protected match start, synchronized answers, authoritative scoring, and next round.');

const ctxJak={storage:new MockStorage(),websockets:[],getWebSockets(){return this.websockets.filter(x=>!x.closed)},acceptWebSocket(ws){this.websockets.push(ws)}};
const roomJak=new GameRoom(ctxJak,{});
let rr=await roomJak.fetch(new Request('https://room.internal/init',{method:'POST',body:JSON.stringify({code:'JKL234',gameId:'jak:clash',hostToken:'JAKSECRET'})}));
assert.equal(rr.status,201);
const mkJoin=(name,token,session)=>new Request('https://room.internal/connect?name='+name+'&hostToken='+token+'&sessionId='+session,{headers:{Upgrade:'websocket'}});
for(const [name,token,session] of [['One','JAKSECRET','jak-001-session'],['Two','','jak-002-session'],['Three','','jak-003-session']]){
 rr=await roomJak.fetch(mkJoin(name,token,session));assert.equal(rr.status,101);
}
const playersJak=ctxJak.websockets;
for(const ws of playersJak)await roomJak.webSocketMessage(ws,JSON.stringify({type:'ready',ready:true}));
await roomJak.webSocketMessage(playersJak[0],JSON.stringify({type:'start_match'}));
let snap=playersJak[0].sent.at(-1);
assert.equal(snap.room.gameId,'jak:clash');
assert.equal(snap.match.phase,'write');
const contestants=snap.match.contestants;
for(let i=0;i<2;i++){
 const ws=playersJak.find(x=>x.deserializeAttachment().sessionId===contestants[i]);
 await roomJak.webSocketMessage(ws,JSON.stringify({type:'game_action',action:{type:'write',text:'Funny '+i}}));
}
snap=playersJak[0].sent.at(-1);
assert.equal(snap.match.phase,'vote');
assert.ok(snap.match.options.every(o=>!Object.hasOwn(o,'author')));
const voting=playersJak.find(x=>!contestants.includes(x.deserializeAttachment().sessionId));
await roomJak.webSocketMessage(voting,JSON.stringify({type:'game_action',action:{type:'vote',choice:snap.match.options[0].id}}));
snap=playersJak[0].sent.at(-1);
assert.equal(snap.match.phase,'result');
assert.ok(Object.values(snap.match.points).some(x=>x>0));
await roomJak.webSocketMessage(playersJak[0],JSON.stringify({type:'next_round'}));
assert.equal(playersJak[0].sent.at(-1).match.round,2);
console.log('PASS: JakBox websocket room start, independent lobby, hidden responses, synchronized vote and host next');

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
.replace("import { DurableObject } from 'cloudflare:workers';",'const DurableObject = globalThis.BaseDO;')
.replace('export default {','const worker = {')
.replace('export class GameRoom','class GameRoom') + '\nglobalThis.exports={worker,GameRoom};';
const context={BaseDO,Response:MockResponse,Request,URL,crypto:webcrypto,WebSocketPair,Date,Math,console};
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
const n=snapshot.round.size;const correct=Array.from({length:n},(_,i)=>(n-i)**2).reduce((a,b)=>a+b,0);
await room.webSocketMessage(guestWs,JSON.stringify({type:'answer_square',guess:correct}));assert.equal(guestWs.sent.at(-1).round.answeredIds.length,1);assert.equal(guestWs.sent.at(-1).round.correctAnswer,undefined);
await room.webSocketMessage(hostWs,JSON.stringify({type:'reveal_square'}));assert.equal(guestWs.sent.at(-1).round.correctAnswer,correct);assert.equal(guestWs.sent.at(-1).round.results[0].correct,true);
await room.webSocketMessage(guestWs,JSON.stringify({type:'chat',text:'Hi all!'}));assert.equal(hostWs.sent.at(-1).chat[0].text,'Hi all!');
console.log('PASS: room initialization, host/guest, WebSockets, Square Count server scoring, and chat.');

import { createMatch, act, advanceIfDue, view } from './multiplayer.js';
import { JAK_GAMES, isJak, createJakMatch, actJak, advanceJakIfDue, viewJak } from './jakbox.js';
import { DurableObject } from 'cloudflare:workers';

const GAME_IDS = new Set(['heavy', 'roulette', 'poker', 'square', 'cube',...Object.keys(JAK_GAMES)]);
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CHAT_LIMIT = 30;
const ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000;
const ROOM_MAX_PLAYERS = { heavy: 8, roulette: 6, poker: 16, square: 16, cube: 6, ...Object.fromEntries(Object.entries(JAK_GAMES).map(([id,r])=>[id,r.max])) };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function code6() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, n => CODE_CHARS[n % CODE_CHARS.length]).join('');
}

function validCode(s) { return /^[A-HJ-NP-Z2-9]{6}$/.test(s); }
function safeName(s) { return String(s || 'Player').trim().slice(0, 24) || 'Player'; }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({ ok: true, service: 'Devil’s Plan English Multiplayer' });

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      let data;
      try { data = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }
      const gameId = GAME_IDS.has(data?.gameId) ? data.gameId : 'square';
      const hostToken = crypto.randomUUID();
      for (let attempt = 0; attempt < 10; attempt++) {
        const code = code6();
        const stub = env.ROOMS.getByName(code);
        const response = await stub.fetch('https://room.internal/init', {
          method: 'POST',
          body: JSON.stringify({ code, gameId, hostToken }),
        });
        if (response.status === 201) return json({ code, hostToken, gameId }, 201);
        if (response.status !== 409) return json({ error: 'Unable to create a room.' }, 500);
      }
      return json({ error: 'Unable to allocate a unique room code. Try again.' }, 503);
    }

    const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})(?:\/(socket))?$/);
    if (match) {
      const code = match[1];
      if (!validCode(code)) return json({ error: 'Invalid room code.' }, 400);
      const stub = env.ROOMS.getByName(code);
      if (match[2] === 'socket' && request.method === 'GET') {
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'WebSocket upgrade required.' }, 426);
        const origin = request.headers.get('Origin');
        if (origin && new URL(origin).host !== url.host) return json({ error: 'Cross-site connections are disabled.' }, 403);
        return stub.fetch(new Request(`https://room.internal/connect${url.search}`, request));
      }
      if (!match[2] && request.method === 'GET') return stub.fetch('https://room.internal/info');
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
    return env.ASSETS.fetch(request);
  },
};

export class GameRoom extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/init' && request.method === 'POST') {
      const existing = await this.ctx.storage.get('meta');
      if (existing && existing.expiresAt > Date.now()) return json({ error: 'Room code in use.' }, 409);
      if (existing && this.ctx.getWebSockets().length) return json({ error: 'Room still active.' }, 409);
      const data = await request.json();
      const meta = {
        code: data.code,
        gameId: data.gameId,
        hostToken: data.hostToken,
        createdAt: Date.now(),
        expiresAt: Date.now() + ROOM_LIFETIME_MS,
      };
      await this.ctx.storage.put({ meta, chat: [], round: null, match: null, ready: {} });
      return json({ ok: true }, 201);
    }

    const meta = await this.ctx.storage.get('meta');
    if (!meta || meta.expiresAt <= Date.now()) return json({ error: 'Room not found or expired.' }, 404);
    if (url.pathname === '/info') return json({ code: meta.code, gameId: meta.gameId, createdAt: meta.createdAt, maxPlayers: ROOM_MAX_PLAYERS[meta.gameId] });

    if (url.pathname !== '/connect' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return json({ error: 'Not found.' }, 404);
    }
    const name = safeName(url.searchParams.get('name'));
    const host = url.searchParams.get('hostToken') === meta.hostToken;
    const sessionId = String(url.searchParams.get('sessionId') || '').slice(0, 100);
    if (!/^[a-zA-Z0-9-]{12,100}$/.test(sessionId)) return json({ error: 'Invalid session.' }, 400);
    const existingSockets = this.ctx.getWebSockets();
    const sameUser = existingSockets.filter(ws => ws.deserializeAttachment()?.sessionId === sessionId);
    const livePlayers = new Set(existingSockets.map(ws => ws.deserializeAttachment()?.sessionId));
    if (!livePlayers.has(sessionId) && livePlayers.size >= ROOM_MAX_PLAYERS[meta.gameId]) {
      return json({ error: 'This room is full.' }, 403);
    }
    for (const old of sameUser) old.close(1000, 'Session replaced');
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ sessionId, name, host, lastChatAt: 0 });
    await this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  async stateForClient(ws) {
    const meta = await this.ctx.storage.get('meta');
    const chat = await this.ctx.storage.get('chat') || [];
    const round = await this.ctx.storage.get('round');
    const match = await this.ctx.storage.get('match') || null;
    const ready = await this.ctx.storage.get('ready') || {};
    const players = Array.from(new Map(this.ctx.getWebSockets().map(s => {
      const a = s.deserializeAttachment();
      return [a.sessionId, { id: a.sessionId, name: a.name, host: a.host, ready: !!ready[a.sessionId] }];
    })).values());
    let liveRound = null;
    if (round) {
      liveRound = {
        id: round.id,
        kind: Array.isArray(round.values) ? 'target-sum' : 'legacy-square',
        size: round.size,
        values: round.values,
        target: round.target,
        revealed: round.revealed,
        answeredIds: Object.keys(round.answers),
        ...(round.revealed ? {
          correctAnswer: correctRoundAnswer(round),
          results: Object.entries(round.answers).map(([id, guess]) => ({
            id,
            name: players.find(p => p.id === id)?.name || 'Disconnected player',
            guess,
            correct: guess === correctRoundAnswer(round),
          })),
        } : {}),
      };
    }
    return {
      type: 'state', room: { code: meta.code, gameId: meta.gameId, maxPlayers: ROOM_MAX_PLAYERS[meta.gameId] },
      isHost: Boolean(ws.deserializeAttachment()?.host),
      players, chat, round: liveRound, match: match ? (isJak(match.gameId) ? viewJak(match,ws.deserializeAttachment()?.sessionId) : view(match,ws.deserializeAttachment()?.sessionId)) : null,
    };
  }

  async broadcast() {
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(JSON.stringify(await this.stateForClient(ws))); } catch { /* stale connection */ }
    }
  }

  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    const client = ws.deserializeAttachment();
    if (!client || !msg || typeof msg.type !== 'string') return;
    const meta = await this.ctx.storage.get('meta');
    if (!meta || meta.expiresAt <= Date.now()) { ws.close(1000, 'Room expired'); return; }

    if (msg.type === 'chat') {
      const now = Date.now();
      const message = String(msg.text || '').trim().slice(0, 300);
      if (!message || now - (client.lastChatAt || 0) < 500) return;
      ws.serializeAttachment({ ...client, lastChatAt: now });
      const chat = (await this.ctx.storage.get('chat')) || [];
      chat.push({ id: crypto.randomUUID(), name: client.name, text: message, at: now });
      await this.ctx.storage.put('chat', chat.slice(-CHAT_LIMIT));
      await this.broadcast();
      return;
    }


    // Unified, server-authoritative multiplayer. Legacy square messages remain
    // available for rooms created by older clients.
    if (msg.type === 'ready') {
      const ready = await this.ctx.storage.get('ready') || {};
      ready[client.sessionId] = !!msg.ready;
      await this.ctx.storage.put('ready',ready);
      await this.broadcast();
      return;
    }
    if (msg.type === 'start_match' && client.host) {
      const existing = await this.ctx.storage.get('match');
      if (existing && existing.phase !== 'complete') return;
      const sockets = this.ctx.getWebSockets();
      const people = [...new Map(sockets.map(s => {
        const a=s.deserializeAttachment();
        return [a.sessionId,{id:a.sessionId,name:a.name}];
      })).values()];
      const ready = await this.ctx.storage.get('ready') || {};
      if (!people.length || people.some(p=>!ready[p.id])) {
        ws.send(JSON.stringify({type:'error',message:'Every connected player must press Ready before starting.'}));
        return;
      }
      try {
        const match=isJak(meta.gameId) ? createJakMatch(meta.gameId,people) : createMatch(meta.gameId,people);
        await this.ctx.storage.put('match',match);
        await this.scheduleMatch(match);
        await this.broadcast();
      } catch(e) {
        ws.send(JSON.stringify({type:'error',message:e?.message||'Unable to start this game.'}));
      }
      return;
    }
    if (msg.type === 'game_action' || msg.type === 'next_round') {
      const match = await this.ctx.storage.get('match');
      if (!match) return;
      const fnAct=isJak(match.gameId)?actJak:act;
      const fnDue=isJak(match.gameId)?advanceJakIfDue:advanceIfDue;
      const wasDue=fnDue(match);
      const accepted=msg.type==='next_round' ? (client.host && fnAct(match,client.sessionId,{type:'next'})) : fnAct(match,client.sessionId,msg.action);
      if (wasDue || accepted) {
        await this.ctx.storage.put('match',match);
        await this.scheduleMatch(match);
        await this.broadcast();
      } else if(!accepted) ws.send(JSON.stringify({type:'error',message:'Action unavailable, invalid, or already submitted.'}));
      return;
    }

    if (msg.type === 'start_square' && client.host) {
      const puzzle = generateTargetSumRound();
      await this.ctx.storage.put('round', { id: crypto.randomUUID(), ...puzzle, answers: {}, revealed: false });
      await this.broadcast();
      return;
    }
    if (msg.type === 'answer_square') {
      const round = await this.ctx.storage.get('round');
      if (!round || round.revealed || Object.hasOwn(round.answers, client.sessionId)) return;
      const guess = Number(msg.guess);
      if (!Number.isInteger(guess) || guess < 1 || guess > 500) return;
      round.answers[client.sessionId] = guess;
      await this.ctx.storage.put('round', round);
      await this.broadcast();
      return;
    }
    if (msg.type === 'reveal_square' && client.host) {
      const round = await this.ctx.storage.get('round');
      if (!round) return;
      round.revealed = true;
      await this.ctx.storage.put('round', round);
      await this.broadcast();
      return;
    }
    if (msg.type === 'clear_round' && client.host) {
      await this.ctx.storage.put('round', null);
      await this.broadcast();
    }
  }

  async scheduleMatch(match) {
    if (match?.deadline && match.deadline>Date.now() &&
        typeof this.ctx.storage.setAlarm === 'function') await this.ctx.storage.setAlarm(match.deadline);
  }

  async alarm() {
    const meta=await this.ctx.storage.get('meta');
    if (!meta || meta.expiresAt<=Date.now()) return;
    const match=await this.ctx.storage.get('match');
    if (!match) return;
    if ((isJak(match.gameId)?advanceJakIfDue:advanceIfDue)(match)) {
      await this.ctx.storage.put('match',match);
      await this.scheduleMatch(match);
      await this.broadcast();
    } else await this.scheduleMatch(match);
  }

  async webSocketClose() { await this.broadcast(); }
  async webSocketError() { await this.broadcast(); }
}

function sumSquares(n) { return Array.from({ length: n }, (_, i) => (n - i) ** 2).reduce((a, b) => a + b, 0); }

function countTargetRectangles(values, n, target) {
  let count=0;
  for(let r1=0;r1<n;r1++)for(let c1=0;c1<n;c1++)for(let r2=r1;r2<n;r2++)for(let c2=c1;c2<n;c2++){
    let sum=0;
    for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++)sum+=values[r*n+c];
    if(sum===target)count++;
  }
  return count;
}
function generateTargetSumRound() {
  let last;
  for(let attempts=0;attempts<150;attempts++){
    const size=4+Math.floor(Math.random()*2);
    const values=Array.from({length:size*size},()=>Math.floor(Math.random()*8));
    const r1=Math.floor(Math.random()*size), c1=Math.floor(Math.random()*size);
    const r2=r1+Math.floor(Math.random()*(size-r1)),c2=c1+Math.floor(Math.random()*(size-c1));
    let target=0;
    for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++)target+=values[r*size+c];
    const count=countTargetRectangles(values,size,target);
    last={size,values,target};
    if(target>=3 && count>=2 && count<=35)return last;
  }
  return last;
}
function correctRoundAnswer(round) {
  return Array.isArray(round.values) ? countTargetRectangles(round.values,round.size,round.target) : sumSquares(round.size);
}

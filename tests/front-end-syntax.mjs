import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const pages=['../public/devils-plan/index.html','../public/devils-plan/room/index.html','../public/jakbox/index.html','../public/jakbox/room/index.html'];
for(const filename of pages){
 const html=readFileSync(new URL(filename,import.meta.url),'utf8');
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(x=>x.trim());
 assert.ok(scripts.length>0,'No inline JS in '+filename);
 for(const script of scripts)assert.doesNotThrow(()=>new vm.Script(script,{filename}), 'Invalid browser JS in '+filename);
}
const lobby=readFileSync(new URL(pages[0],import.meta.url),'utf8');
const room=readFileSync(new URL(pages[1],import.meta.url),'utf8');
assert.match(lobby,/location\.assign\('\/devils-plan\/room\/\?code='/);
for(const term of ['start_match','next_round','game_action','roulette','poker','heavy','cube','square'])assert.ok(room.includes(term),'Missing shared room feature '+term);
console.log('PASS: front-end JavaScript syntax, lobby navigation, and five-game room controls');

const jakLobby=readFileSync(new URL('../public/jakbox/index.html',import.meta.url),'utf8');
const jakRoom=readFileSync(new URL('../public/jakbox/room/index.html',import.meta.url),'utf8');
const mainHub=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
for(const game of ['jak:clash','jak:bluff','jak:draw','jak:split','jak:tee','jak:faker']){
 assert.ok(jakLobby.includes(game),'JakBox card missing: '+game);
 assert.ok(jakRoom.includes(game),'JakBox room controller missing: '+game);
}
assert.match(jakLobby,/location\.assign\('\/jakbox\/room\/\?code='/);
assert.match(mainHub,/href="\/jakbox\/"/);
assert.match(jakRoom,/navigator\.clipboard\.writeText/);
assert.match(jakRoom,/onpointerdown/);
console.log('PASS: six JakBox game cards, party-room controls, mobile drawing, and BChance Games hub');

assert.match(jakRoom,/data-fake-accuse/);
assert.match(jakRoom,/data-fake-answer/);
assert.match(jakRoom,/m\.isFaker/);
console.log('PASS: Fake Out room actions, private-role display and JakBox sixth game card');

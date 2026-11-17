import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const pages=['../public/devils-plan/index.html','../public/devils-plan/room/index.html'];
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

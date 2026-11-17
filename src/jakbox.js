import { createFakerMatch, actFaker, advanceFakerIfDue, viewFaker } from './faker-game.js';
// JakBox: original party-game adaptations informed by public gameplay descriptions.
// Server-authoritative; no Jackbox code, assets or proprietary content.
export const JAK_GAMES=Object.freeze({
 'jak:clash':{name:'Prompt Clash',min:3,max:8},
 'jak:bluff':{name:'Truth Trap',min:2,max:8},
 'jak:draw':{name:'Sketch Bluff',min:3,max:8},
 'jak:split':{name:'Split Vote',min:3,max:8},
 'jak:tee':{name:'Shirt Showdown',min:3,max:8},
 'jak:faker':{name:'Fake Out',min:3,max:6},
});
export const isJak=id=>Object.hasOwn(JAK_GAMES,id);
const prompts=Object.freeze({
 clash:[
 'The most suspicious item to find in an office refrigerator',
 'A terrible name for a new roller coaster',
 'Something a robot should never say on a first date',
 'The one feature no one asked for in a smart toaster',
 'A very bad slogan for an airline',
 'The least inspiring fortune cookie message',
 'The strangest thing to put on a business card',
 'A surprising item in a pirate’s treasure chest',
 'The worst theme for a surprise party',
 'What an astronaut would complain about on a food review',
 'The most disappointing superpower',
 'A warning label that belongs on a haunted house',
 'An unfortunate name for an expensive perfume',
 'What your houseplants say about you while you sleep',
 'The worst name for an escape room'
 ],
 bluff:[
 {question:'In chemistry, the symbol for the element gold is _____.',truth:'Au'},
 {question:'The capital of New Zealand is _____.',truth:'Wellington'},
 {question:'The longest bone in the human body is the _____.',truth:'Femur'},
 {question:'The chemical element with atomic number 1 is _____.',truth:'Hydrogen'},
 {question:'The planet with the shortest year in our solar system is _____.',truth:'Mercury'},
 {question:'The world’s largest ocean is the _____.',truth:'Pacific Ocean'},
 {question:'The square root of 144 is _____.',truth:'12'},
 {question:'The largest planet in our solar system is _____.',truth:'Jupiter'},
 {question:'A polygon with eight sides is called an _____.',truth:'Octagon'},
 {question:'The first month of the year on the Gregorian calendar is _____.',truth:'January'},
 {question:'In music, the key with no sharps or flats in its signature is ____ major.',truth:'C'},
 {question:'The chemical symbol for sodium is _____.',truth:'Na'},
 {question:'The closest star to Earth is the _____.',truth:'Sun'},
 {question:'The largest land animal alive today is the African _____.',truth:'Elephant'},
 {question:'The language used to style webpages is abbreviated _____.',truth:'CSS'}
 ],
 draw:[
 'A sleepy volcano','A penguin running a bakery','A haunted umbrella','A detective pineapple',
 'A dancing mailbox','A robot trying to knit','A coffee cup on a roller coaster',
 'A cactus at the beach','A moon with sunglasses','A jellyfish playing guitar',
 'A very confused astronaut','A dragon brushing its teeth','A cloud with a secret',
 'A snail riding a skateboard','An octopus conducting an orchestra'
 ],
 split:[
 'A new app promises to find your lost socks, but it also _____. Would you install it?',
 'Your favorite restaurant offers free food forever if you agree to _____. Would you accept?',
 'An airline offers a first-class upgrade, but the seat next to you contains _____. Would you take it?',
 'You can become famous overnight, but every interview starts with _____. Would you do it?',
 'A magical vending machine gives you any snack, but first you must _____. Would you use it?',
 'A new job pays triple, but your official title becomes _____. Would you sign?',
 'You get a free vacation to anywhere, except you must bring _____. Would you go?',
 'Every time you laugh, _____ appears above your head. Would you keep this power?',
 'A friendly alien offers to improve your life by replacing _____ with something else. Do you agree?',
 'You can rewind any awkward conversation, but each rewind also _____. Would you use it?'
 ],
 tee:[
 'Create a wild illustration to go on a T-shirt. No prompt restrictions.',
 'Draw something that would make a stranger ask: “Where did you get that shirt?”'
 ]
});
const uid=()=>crypto.randomUUID(),rand=n=>Math.floor(Math.random()*n);
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
const text=v=>String(v??'').replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,130);
function safeDrawing(raw){
 if(!Array.isArray(raw)||raw.length>90)return null;
 let points=0;const strokes=[];
 for(const stroke of raw){
  if(!Array.isArray(stroke)||stroke.length<2||stroke.length>300)return null;
  points+=stroke.length;if(points>2400)return null;
  const s=[];
  for(const pt of stroke){
   if(!Array.isArray(pt)||pt.length!==2||!pt.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1000))return null;
   s.push([Math.round(pt[0]),Math.round(pt[1])]);
  }
  strokes.push(s);
 }
 return strokes;
}
function phase(m,p,duration=40){m.phase=p;m.deadline=Date.now()+duration*1000;}
function requireAll(m,store,participants){return participants.every(id=>Object.hasOwn(store,id));}
const otherIds=(m,id)=>m.ids.filter(x=>x!==id);
function startRound(m){
 m.round++;m.results=[];m.log=[];m.pending={};m.votes={};m.options=[];
 if(m.gameId==='jak:clash'){
  const start=((m.round-1)*2)%m.ids.length;
  m.contestants=[m.ids[start],m.ids[(start+1)%m.ids.length]];
  m.prompt=prompts.clash[(m.seed+m.round-1)%prompts.clash.length];
  phase(m,'write',55);
 }else if(m.gameId==='jak:bluff'){
  m.item=prompts.bluff[(m.seed+m.round-1)%prompts.bluff.length];
  phase(m,'lie',50);
 }else if(m.gameId==='jak:draw'){
  m.artist=m.ids[(m.round-1)%m.ids.length];
  m.prompt=prompts.draw[(m.seed+m.round-1)%prompts.draw.length];
  m.picture=[];phase(m,'draw',75);
 }else if(m.gameId==='jak:split'){
  m.author=m.ids[(m.round-1)%m.ids.length];
  m.scenario=prompts.split[(m.seed+m.round-1)%prompts.split.length];
  m.fill='';phase(m,'write',45);
 }
}
function finish(m){
 m.phase='complete';m.deadline=0;
 const best=Math.max(...m.ids.map(id=>m.points[id]));
 m.winnerIds=m.ids.filter(id=>m.points[id]===best);
}
function next(m){
 const limit=m.gameId==='jak:draw'||m.gameId==='jak:split'||m.gameId==='jak:tee'?m.ids.length:4;
 if(m.round>=limit)return finish(m);
 if(m.gameId==='jak:tee'){
  m.round++;
  m.votes={};
  phase(m,'battle',35);
  m.battlePair=[m.ids[(m.round-1)%m.ids.length],m.ids[m.round%m.ids.length]];
 }else startRound(m);
}
export function createJakMatch(gameId,players){
 if(gameId==='jak:faker')return createFakerMatch(players);
 const settings=JAK_GAMES[gameId];
 if(!settings)throw Error('Unrecognized JakBox game');
 if(players.length<settings.min||players.length>settings.max)throw Error(settings.name+' requires '+settings.min+'–'+settings.max+' players');
 const ids=players.map(x=>x.id);
 const m={id:uid(),gameId,ids,names:Object.fromEntries(players.map(x=>[x.id,x.name])),
 points:Object.fromEntries(ids.map(id=>[id,0])),phase:'',deadline:0,round:0,seed:rand(1000),
 pending:{},votes:{},options:[],winnerIds:[],results:[],log:[]};
 if(gameId==='jak:tee'){
  m.art={};m.slogans={};m.shirts={};m.round=0;phase(m,'draw',75);
 }else startRound(m);
 return m;
}
function proceed(m){
 if(m.gameId==='jak:clash'){
  if(m.phase==='write'){
   m.options=m.contestants.map(id=>({id:uid(),author:id,text:m.pending[id]||'(No answer)'}));
   phase(m,'vote',35);
  }else if(m.phase==='vote'){
   const counts=Object.fromEntries(m.contestants.map(id=>[id,0]));
   for(const target of Object.values(m.votes)){const option=m.options.find(o=>o.id===target);if(option)counts[option.author]++;}
   const high=Math.max(...Object.values(counts));
   for(const id of m.contestants)if(counts[id]===high&&high>0)m.points[id]+=300+counts[id]*100;
   m.results=m.contestants.map(id=>({id,answer:m.pending[id]||'',votes:counts[id],winner:counts[id]===high&&high>0}));
   phase(m,'result',0);m.deadline=0;
  }
 }else if(m.gameId==='jak:bluff'){
  if(m.phase==='lie'){
   m.options=shuffle([{id:uid(),kind:'truth',text:m.item.truth},...m.ids.map(id=>({id:uid(),kind:'lie',author:id,text:m.pending[id]||'A surprising secret'}))]);
   phase(m,'vote',40);
  }else if(m.phase==='vote'){
   const counts=Object.fromEntries(m.options.map(o=>[o.id,0]));
   for(const [id,target] of Object.entries(m.votes)){
    const option=m.options.find(o=>o.id===target);
    if(option?.kind==='truth')m.points[id]+=500;
    else if(option?.kind==='lie'&&option.author!==id) m.points[option.author]+=250;
    if(Object.hasOwn(counts,target))counts[target]++;
   }
   m.results=m.options.map(o=>({...o,votes:counts[o.id],author:o.kind==='truth'?null:o.author}));
   phase(m,'result',0);m.deadline=0;
  }
 }else if(m.gameId==='jak:draw'){
  if(m.phase==='draw'){phase(m,'fake',45);}
  else if(m.phase==='fake'){
   m.options=shuffle([{id:uid(),kind:'truth',text:m.prompt},...otherIds(m,m.artist).map(id=>({id:uid(),kind:'fake',author:id,text:m.pending[id]||'An impossible drawing'}))]);
   phase(m,'vote',35);
  }else if(m.phase==='vote'){
   const counts=Object.fromEntries(m.options.map(o=>[o.id,0]));
   for(const [id,target] of Object.entries(m.votes)){
    const option=m.options.find(o=>o.id===target);
    if(option?.kind==='truth'){m.points[id]+=500;m.points[m.artist]+=150;}
    else if(option?.kind==='fake'&&option.author!==id) m.points[option.author]+=250;
    if(Object.hasOwn(counts,target))counts[target]++;
   }
   m.results=m.options.map(o=>({...o,votes:counts[o.id],author:o.kind==='truth'?null:o.author}));
   phase(m,'result',0);m.deadline=0;
  }
 }else if(m.gameId==='jak:split'){
  if(m.phase==='write'){if(!m.fill)m.fill='a mysterious gift';phase(m,'vote',40);}
  else if(m.phase==='vote'){
   const votes=Object.values(m.votes),yes=votes.filter(x=>x==='yes').length,no=votes.filter(x=>x==='no').length;
   const split=Math.min(yes,no);
   m.points[m.author]+=split*350;
   m.results=[{id:m.author,fill:m.fill,yes,no,points:split*350}];
   phase(m,'result',0);m.deadline=0;
  }
 }else if(m.gameId==='jak:tee'){
  if(m.phase==='draw'){phase(m,'slogan',50);}
  else if(m.phase==='slogan'){phase(m,'compose',55);}
  else if(m.phase==='compose'){
   for(const id of m.ids)if(!m.shirts[id])m.shirts[id]={artId:id,sloganId:id};
   m.round=1;m.votes={};m.battlePair=[m.ids[0],m.ids[1]];
   phase(m,'battle',35);
  }else if(m.phase==='battle'){
   const [a,b]=m.battlePair;
   const counts={[a]:0,[b]:0};
   for(const option of Object.values(m.votes))if(Object.hasOwn(counts,option))counts[option]++;
   const high=Math.max(counts[a],counts[b]);
   const winners=[a,b].filter(id=>counts[id]===high&&high>0);
   for(const id of winners){
    m.points[id]+=500;
    const shirt=m.shirts[id];
    m.points[shirt.artId]+=150;m.points[shirt.sloganId]+=150;
   }
   m.results=[a,b].map(id=>({id,votes:counts[id],win:winners.includes(id),artId:m.shirts[id].artId,sloganId:m.shirts[id].sloganId}));
   phase(m,'result',0);m.deadline=0;
  }
 }
}
function participants(m){
 if(m.gameId==='jak:clash')return m.phase==='write'?m.contestants:otherIds(m,m.contestants[0]).filter(id=>id!==m.contestants[1]);
 if(m.gameId==='jak:bluff')return m.ids;
 if(m.gameId==='jak:draw')return m.phase==='draw'?[m.artist]:otherIds(m,m.artist);
 if(m.gameId==='jak:split')return m.phase==='write'?[m.author]:otherIds(m,m.author);
 if(m.gameId==='jak:tee')return m.phase==='battle'?m.ids.filter(id=>!m.battlePair.includes(id)):m.ids;
 return m.ids;
}
export function actJak(m,id,msg){
 if(m?.gameId==='jak:faker')return actFaker(m,id,msg);
 if(!m||!m.ids.includes(id)||!msg||typeof msg.type!=='string')return false;
 if(msg.type==='next'&&m.phase==='result'){next(m);return true;}
 if(m.phase==='result'||m.phase==='complete')return false;
 const allowed=participants(m);
 if(!allowed.includes(id))return false;
 if(m.phase==='draw'&&(m.gameId==='jak:draw'||m.gameId==='jak:tee')){
  if(msg.type!=='art')return false;
  if(m.gameId==='jak:draw'&&m.picture.length)return false;
  if(m.gameId==='jak:tee'&&Object.hasOwn(m.art,id))return false;
  const picture=safeDrawing(msg.strokes);if(!picture||!picture.length)return false;
  if(m.gameId==='jak:draw')m.picture=picture;else m.art[id]=picture;
  if(requireAll(m,m.gameId==='jak:draw'?{[m.artist]:m.picture}:m.art,allowed))proceed(m);
  return true;
 }
 if(m.gameId==='jak:tee'&&m.phase==='slogan'){
  if(msg.type!=='slogan'||Object.hasOwn(m.slogans,id))return false;
  const value=text(msg.text);if(!value)return false;
  m.slogans[id]=value;if(requireAll(m,m.slogans,m.ids))proceed(m);return true;
 }
 if(m.gameId==='jak:tee'&&m.phase==='compose'){
  if(msg.type!=='compose'||Object.hasOwn(m.shirts,id))return false;
  const a=String(msg.artId),b=String(msg.sloganId);
  if(!m.ids.includes(a)||!m.ids.includes(b))return false;
  m.shirts[id]={artId:a,sloganId:b};if(requireAll(m,m.shirts,m.ids))proceed(m);return true;
 }
 if(m.gameId==='jak:split'&&m.phase==='write'){
  if(msg.type!=='write'||id!==m.author||m.fill)return false;
  m.fill=text(msg.text);if(!m.fill)return false;proceed(m);return true;
 }
 if(['write','lie','fake'].includes(m.phase)){
  if(msg.type!=='write'||Object.hasOwn(m.pending,id))return false;
  const value=text(msg.text);if(!value)return false;
  if(m.gameId==='jak:bluff'&&value.toLowerCase()===m.item.truth.toLowerCase())return false;
  m.pending[id]=value;
  if(requireAll(m,m.pending,allowed))proceed(m);
  return true;
 }
 if(['vote','battle'].includes(m.phase)){
  if(msg.type!=='vote'||Object.hasOwn(m.votes,id))return false;
  const pick=String(msg.choice??'');
  if(m.gameId==='jak:split'){if(!['yes','no'].includes(pick))return false;}
  else if(m.gameId==='jak:tee'){if(!m.battlePair.includes(pick))return false;}
  else{
   const option=m.options.find(o=>o.id===pick);
   if(!option||option.author===id)return false;
  }
  m.votes[id]=pick;if(requireAll(m,m.votes,allowed))proceed(m);
  return true;
 }
 return false;
}
export function advanceJakIfDue(m,now=Date.now()){
 if(m?.gameId==='jak:faker')return advanceFakerIfDue(m,now);
 if(!m||!m.deadline||now<m.deadline)return false;
 if(['result','complete'].includes(m.phase))return false;
 proceed(m);return true;
}
export function viewJak(m,id){
 if(m?.gameId==='jak:faker')return viewFaker(m,id);
 if(!m)return null;
 const out={id:m.id,gameId:m.gameId,phase:m.phase,round:m.round,deadline:m.deadline,
 ids:m.ids,names:m.names,points:m.points,submittedIds:[],
 winnerIds:m.phase==='complete'?m.winnerIds:[],results:m.phase==='result'?m.results:undefined,me:id};
 const voting=['vote','battle'].includes(m.phase);
 if(m.gameId==='jak:clash'){
  out.prompt=m.prompt;out.contestants=m.contestants;
  out.submittedIds=m.phase==='write'?Object.keys(m.pending):Object.keys(m.votes);
  out.mySubmitted=m.phase==='write'?Object.hasOwn(m.pending,id):Object.hasOwn(m.votes,id);
  if(voting)out.options=m.options.map(o=>({id:o.id,text:o.text}));
  if(m.phase==='result')out.options=m.options;
 }else if(m.gameId==='jak:bluff'){
  out.question=m.item.question;out.submittedIds=m.phase==='lie'?Object.keys(m.pending):Object.keys(m.votes);
  out.mySubmitted=m.phase==='lie'?Object.hasOwn(m.pending,id):Object.hasOwn(m.votes,id);
  if(voting){out.options=m.options.map(o=>({id:o.id,text:o.text}));out.blockedOptionId=m.options.find(o=>o.author===id)?.id||null;}
  if(m.phase==='result'){out.options=m.options;out.truth=m.item.truth;}
 }else if(m.gameId==='jak:draw'){
  out.artist=m.artist;out.prompt=(id===m.artist||m.phase==='result'||m.phase==='complete')?m.prompt:undefined;
  out.picture=m.phase==='draw'&&id!==m.artist?undefined:m.picture;
  out.submittedIds=m.phase==='draw'?(m.picture?.length?[m.artist]:[]):m.phase==='fake'?Object.keys(m.pending):Object.keys(m.votes);
  out.mySubmitted=m.phase==='draw'?!!m.picture?.length:m.phase==='fake'?Object.hasOwn(m.pending,id):Object.hasOwn(m.votes,id);
  if(voting||m.phase==='result')out.options=m.options.map(o=>({id:o.id,text:o.text}));
  if(voting)out.blockedOptionId=m.options.find(o=>o.author===id)?.id||null;
 }else if(m.gameId==='jak:split'){
  out.author=m.author;out.scenario=m.scenario;out.fill=m.phase==='write'?(id===m.author?m.fill:''):m.fill;
  out.submittedIds=m.phase==='vote'?Object.keys(m.votes):m.fill?[m.author]:[];
  out.mySubmitted=m.phase==='write'?!!m.fill:Object.hasOwn(m.votes,id);
 }else if(m.gameId==='jak:tee'){
  out.submittedIds=m.phase==='draw'?Object.keys(m.art):m.phase==='slogan'?Object.keys(m.slogans):m.phase==='compose'?Object.keys(m.shirts):Object.keys(m.votes);
  out.mySubmitted=m.phase==='draw'?Object.hasOwn(m.art,id):m.phase==='slogan'?Object.hasOwn(m.slogans,id):m.phase==='compose'?Object.hasOwn(m.shirts,id):Object.hasOwn(m.votes,id);
  if(['compose','battle','result','complete'].includes(m.phase)){out.art=m.art;out.slogans=m.slogans;}
  if(['battle','result','complete'].includes(m.phase)){
   out.battlePair=m.battlePair;out.shirts=m.shirts;
  }
 }
 return out;
}

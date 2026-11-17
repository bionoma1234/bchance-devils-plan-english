// Server-authoritative, independently authored English multiplayer engines.
// All state changes and scoring live in Cloudflare Durable Objects.
export const GAME_NAMES={heavy:'Heavy 13',poker:'Memory Poker',square:'Square Count',cube:'Count the Cubes (Cube Century beta)',roulette:'Russian Roulette'};
const colors=['red','green','blue'],ranks='23456789TJQKA',suits='SHDC';
const rand=n=>Math.floor(Math.random()*n);
const uid=()=>crypto.randomUUID();
const allDone=m=>m.ids.every(id=>Object.hasOwn(m.answers||{},id));
const ints=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
function deck(){const d=[];for(const s of suits)for(const r of ranks)d.push(r+s);for(let i=d.length-1;i>0;i--){let j=rand(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;}
export function evaluate(cards){
 if(!Array.isArray(cards)||cards.length!==5||new Set(cards).size!==5)throw Error('Five distinct cards needed');
 const v=cards.map(c=>ranks.indexOf(c[0])+2);if(v.some(x=>x<2))throw Error('Invalid rank');
 const counts=new Map;for(const x of v)counts.set(x,(counts.get(x)||0)+1);
 const groups=[...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
 const sorted=[...v].sort((a,b)=>b-a),unique=[...new Set(sorted)];
 const seq=unique.includes(14)?[...unique,1]:unique;let straight=0;
 for(let i=0;i<=seq.length-5;i++)if(seq[i]-seq[i+4]===4){straight=seq[i];break;}
 const flush=cards.every(c=>c[1]===cards[0][1]);
 let score;
 if(straight&&flush)score=[8,straight];
 else if(groups[0][1]===4)score=[7,groups[0][0],groups[1][0]];
 else if(groups[0][1]===3&&groups[1][1]===2)score=[6,groups[0][0],groups[1][0]];
 else if(flush)score=[5,...sorted];
 else if(straight)score=[4,straight];
 else if(groups[0][1]===3)score=[3,groups[0][0],...groups.filter(g=>g[1]===1).map(g=>g[0]).sort((a,b)=>b-a)];
 else if(groups[0][1]===2&&groups[1][1]===2)score=[2,Math.max(groups[0][0],groups[1][0]),Math.min(groups[0][0],groups[1][0]),groups[2][0]];
 else if(groups[0][1]===2)score=[1,groups[0][0],...groups.filter(g=>g[1]===1).map(g=>g[0]).sort((a,b)=>b-a)];
 else score=[0,...sorted];
 return score;
}
export function compareScores(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const diff=(a[i]||0)-(b[i]||0);if(diff)return diff;}return 0;}
export function countRectangles(values,size,target){
 let matches=0;
 for(let a=0;a<size;a++)for(let b=0;b<size;b++)for(let c=a;c<size;c++)for(let d=b;d<size;d++){
  let total=0;for(let r=a;r<=c;r++)for(let col=b;col<=d;col++)total+=values[r*size+col];
  if(total===target)matches++;
 }
 return matches;
}
function squarePuzzle(){
 for(let tries=0;tries<100;tries++){
  const size=4+rand(2),values=Array.from({length:size*size},()=>rand(8));
  const a=rand(size),b=rand(size),c=a+rand(size-a),d=b+rand(size-b);
  let target=0;for(let r=a;r<=c;r++)for(let col=b;col<=d;col++)target+=values[r*size+col];
  const answer=countRectangles(values,size,target);
  if(target>2&&answer>=2&&answer<=35)return {size,values,target,answer};
 }
 const size=4,values=Array.from({length:16},()=>rand(5)),target=5;
 return {size,values,target,answer:countRectangles(values,size,target)};
}
function cubePuzzle(){
 const size=3+rand(2),heights=Array.from({length:size*size},()=>1+rand(4));
 return {size,heights,answer:heights.reduce((a,b)=>a+b,0)};
}
function clock(m,secs){m.deadline=Date.now()+secs*1000;}
export function createMatch(gameId,players){
 if(!GAME_NAMES[gameId]||!players.length)throw Error('Unknown game or no players');
 if(gameId==='roulette'&&players.length!==6)throw Error('Russian Roulette requires exactly six connected players');
 const ids=players.map(p=>p.id);
 const m={gameId,id:uid(),ids,names:Object.fromEntries(players.map(p=>[p.id,p.name])),points:Object.fromEntries(ids.map(id=>[id,0])),round:0,phase:'',deadline:0,log:[],answers:{},winnerIds:[]};
 if(gameId==='heavy'){m.hands=Object.fromEntries(ids.map(id=>[id,[0,1,2,3,4,5,6]]));m.chips=Object.fromEntries(ids.map(id=>[id,{red:2,green:2,blue:2,rainbow:1}]));m.stands={red:[],green:[],blue:[]};m.firstId=ids[0];}
 if(gameId==='roulette'){
  m.credits=Object.fromEntries(ids.map(id=>[id,16]));
  m.chambers=[1,1,0,0,0,0];for(let i=5;i>0;i--){let j=rand(i+1);[m.chambers[i],m.chambers[j]]=[m.chambers[j],m.chambers[i]];}
  m.pool=0;m.firstIndex=0;m.moveIndex=0;m.privateNotes=Object.fromEntries(ids.map(id=>[id,[]]));m.publicNotes=[];m.round=1;
  m.turnId=ids[0];m.phase='turn';clock(m,45);
 }else nextRound(m);
 return m;
}
function nextRound(m){
 const limit=m.gameId==='heavy'?7:3;
 if(m.round>=limit){m.phase='complete';m.deadline=0;const ranks=[...m.ids].sort((a,b)=>m.gameId==='heavy'?m.points[a]-m.points[b]:m.points[b]-m.points[a]);const top=m.points[ranks[0]];m.winnerIds=ranks.filter(id=>m.points[id]===top);return;}
 m.round++;m.answers={};m.results=[];m.log=[];
 if(m.gameId==='poker'){
  const d=deck();m.board=d.slice(0,16);m.community=d.slice(16,19);m.phase='memorize';clock(m,20);
 }else if(m.gameId==='square'){
  m.puzzle=squarePuzzle();m.phase='answer';clock(m,45);
 }else if(m.gameId==='cube'){
  m.puzzle=cubePuzzle();m.phase='answer';clock(m,45);
 }else if(m.gameId==='heavy'){
  m.phase='choose';m.choices={};m.queue=[];m.passed={};m.lastPenalized=null;clock(m,40);
 }
}
function scoreAnswers(m){
 if(m.phase!=='answer'&&m.phase!=='pick')return;
 if(m.gameId==='poker'){
  m.results=m.ids.map(id=>{
   const indices=m.answers[id];const valid=Array.isArray(indices)&&indices.length===2&&indices.every(n=>ints(n,0,15))&&indices[0]!==indices[1];
   const cards=valid?[m.board[indices[0]],m.board[indices[1]],...m.community]:[];
   return {id,indices:valid?indices:[],cards,rank:valid?evaluate(cards):null,valid};
  });
  const ranked=m.results.filter(x=>x.valid).sort((a,b)=>compareScores(b.rank,a.rank));
  if(ranked.length){const top=ranked[0].rank;for(const x of ranked)if(compareScores(x.rank,top)===0)m.points[x.id]++;}
 }else{
  const answer=m.puzzle.answer;
  m.results=m.ids.map(id=>({id,guess:m.answers[id]?.guess??null,correct:m.answers[id]?.guess===answer}));
  for(const r of m.results)if(r.correct)m.points[r.id]++;
 }
 m.phase='result';m.deadline=0;
}
function heavyTotal(m,color){return m.stands[color].reduce((n,x)=>n+x.card,0);}
function startPlacement(m){
 m.queue=m.ids.map(id=>({id,...m.choices[id]}));
 const order=[m.firstId,...m.ids.filter(x=>x!==m.firstId)];
 m.queue.sort((a,b)=>Number(b.chip==='rainbow')-Number(a.chip==='rainbow')||b.card-a.card||order.indexOf(a.id)-order.indexOf(b.id));
 m.phase='place';clock(m,30);
}
function heavyPlace(m,actor,stand){
 const head=m.queue[0];
 if(!head||head.id!==actor)return false;
 const color=head.chip==='rainbow'?stand:head.chip;
 if(!colors.includes(color)||(head.chip!=='rainbow'&&color!==head.chip))return false;
 const prior=m.stands[color];const after=heavyTotal(m,color)+head.card;
 if(after>=13){
  const penalty=prior.length;m.points[actor]+=penalty;
  m.stands[color]=[{id:actor,card:head.card}];m.lastPenalized=actor;
  m.log.push(m.names[actor]+' reached '+after+' on '+color+' and gained '+penalty+' penalty points.');
 }else{
  prior.push({id:actor,card:head.card});
  m.log.push(m.names[actor]+' placed '+head.card+' on '+color+' ('+after+'/13).');
 }
 m.queue.shift();
 if(!m.queue.length){m.phase='result';m.deadline=0;if(m.lastPenalized)m.firstId=m.lastPenalized; m.results=m.ids.map(id=>({id,penalty:m.points[id]}));}
 else clock(m,30);
 return true;
}
function advanceHeavy(m){
 const absent=m.ids.filter(id=>!m.choices[id]);
 for(const id of absent){
  const card=m.hands[id][0];const chip=Object.keys(m.chips[id]).find(c=>m.chips[id][c]>0);
  m.choices[id]={card,chip};m.hands[id].splice(m.hands[id].indexOf(card),1);m.chips[id][chip]--;
 }
 startPlacement(m);
}
function rouletteAction(m,id,action){
 const credits=m.credits[id];if(!action||typeof action.action!=='string')return false;
 const pair=Number(action.pair),adjacent=ints(pair,0,5);
 const check=()=>{const next=(pair+1)%6;return [pair,next];};
 let cost=0, info='', privateInfo='';
 switch(action.action){
  case 'public':cost=1;if(!adjacent) return false;break;
  case 'private':cost=2;if(!adjacent)return false;break;
  case 'rotate1':cost=3;break;
  case 'rotate2':cost=4;break;
  case 'manipulate':cost=Number(action.amount);if(!ints(cost,1,3)||!adjacent)return false;break;
  case 'pass':cost=0;break;
  default:return false;
 }
 if(cost>credits)return false;
 m.credits[id]-=cost;
 if(action.action==='public'||action.action==='private'){
  const [a,b]=check();const result='Seats '+String.fromCharCode(65+a)+' / '+String.fromCharCode(65+b)+': '+(m.chambers[a]?'loaded':'empty')+' / '+(m.chambers[b]?'loaded':'empty');
  if(action.action==='public')info=m.names[id]+' publicly investigated. '+result;
  else {info=m.names[id]+' completed a private action.';privateInfo=result;}
 }else if(action.action==='rotate1'||action.action==='rotate2'){
  const shift=action.action==='rotate1'?1:2;
  for(let j=0;j<shift;j++)m.chambers.unshift(m.chambers.pop());
  info=m.names[id]+' rotated the chamber positions '+shift+' step'+(shift>1?'s':'')+' clockwise.';
 }else if(action.action==='manipulate'){
  const after=m.pool+cost;
  info=m.names[id]+' contributed to a private manipulation.';
  if(after>=6){
   const [a,b]=check();[m.chambers[a],m.chambers[b]]=[m.chambers[b],m.chambers[a]];
   m.pool=0;privateInfo='Manipulation completed: seats '+String.fromCharCode(65+a)+' and '+String.fromCharCode(65+b)+' exchanged contents. Extra credits forfeited.';
  }else m.pool=after;
 }else info=m.names[id]+' completed a private turn.';
 if(privateInfo)m.privateNotes[id].push(privateInfo);
 m.publicNotes.push(info);m.publicNotes=m.publicNotes.slice(-35);
 m.moveIndex++;
 // One full rotation is a round. The starting player advances clockwise.
 if(m.moveIndex%6===0){m.firstIndex=(m.firstIndex+1)%6;m.round++;}
 const order=[...m.ids.slice(m.firstIndex),...m.ids.slice(0,m.firstIndex)];
 m.turnId=order[m.moveIndex%6];
 // Preserve chronological order even after first player changes.
 if(m.moveIndex%6===0)m.turnId=m.ids[m.firstIndex];
 const exhausted=m.ids.filter(id=>m.credits[id]===0).length;
 if(exhausted>=3||m.moveIndex>=90){
  m.phase='complete';m.deadline=0;
  m.results=m.ids.map((id,idx)=>({id,seat:String.fromCharCode(65+idx),eliminated:!!m.chambers[idx],credits:m.credits[id]}));
  m.winnerIds=m.results.filter(x=>!x.eliminated).map(x=>x.id);
  for(const id of m.winnerIds)m.points[id]=1;
 }else clock(m,45);
 return true;
}
export function act(m,id,msg){
 if(!m||!m.ids.includes(id)||!msg||typeof msg.type!=='string')return false;
 if(msg.type==='next'&&m.phase==='result'){nextRound(m);return true;}
 if(m.gameId==='roulette'){
  if(m.phase!=='turn'||m.turnId!==id||msg.type!=='roulette')return false;
  return rouletteAction(m,id,msg);
 }
 if(m.gameId==='heavy'){
  if(msg.type==='choose'&&m.phase==='choose'&&!m.choices[id]){
   const card=Number(msg.card),chip=String(msg.chip);
   if(!m.hands[id].includes(card)||!(m.chips[id][chip]>0))return false;
   m.choices[id]={card,chip};m.hands[id].splice(m.hands[id].indexOf(card),1);m.chips[id][chip]--;
   if(m.ids.every(p=>m.choices[p]))advanceHeavy(m);return true;
  }
  if(msg.type==='pass'&&m.phase==='place'&&m.queue[0]?.id===id&&m.queue.length>1&&!m.passed[id]){
   m.passed[id]=true;m.queue.push(m.queue.shift());m.log.push(m.names[id]+' passed to the end.');clock(m,30);return true;
  }
  if(msg.type==='place'&&m.phase==='place')return heavyPlace(m,id,String(msg.color));
  return false;
 }
 if(m.gameId==='poker'){
  if(msg.type!=='answer'||m.phase!=='pick'||Object.hasOwn(m.answers,id))return false;
  const positions=msg.positions;
  if(!Array.isArray(positions)||positions.length!==2||positions[0]===positions[1]||!positions.every(n=>ints(n,0,15)))return false;
  m.answers[id]=positions;
 }else{
  if(msg.type!=='answer'||m.phase!=='answer'||Object.hasOwn(m.answers,id))return false;
  const guess=Number(msg.guess);if(!ints(guess,0,999))return false;
  m.answers[id]={guess,at:Date.now()};
 }
 if(allDone(m))scoreAnswers(m);return true;
}
export function advanceIfDue(m,now=Date.now()){
 if(!m||!m.deadline||now<m.deadline)return false;
 if(m.gameId==='roulette'){
  if(m.phase==='turn')rouletteAction(m,m.turnId,{action:'pass'});else return false;
 }else if(m.gameId==='heavy'){
  if(m.phase==='choose')advanceHeavy(m);
  else if(m.phase==='place'){
   const h=m.queue[0];if(!h)return false;
   const color=h.chip==='rainbow'?[...colors].sort((a,b)=>heavyTotal(m,a)-heavyTotal(m,b))[0]:h.chip;
   heavyPlace(m,h.id,color);
  }else return false;
 }else if(m.gameId==='poker'&&m.phase==='memorize'){m.phase='pick';clock(m,60);}
 else if(['answer','pick'].includes(m.phase))scoreAnswers(m);
 else return false;
 return true;
}
export function view(m,id){
 if(!m)return null;
 const out={id:m.id,gameId:m.gameId,round:m.round,phase:m.phase,deadline:m.deadline,ids:m.ids,names:m.names,points:m.points,winnerIds:m.winnerIds,submittedIds:Object.keys(m.answers||{}),log:m.log||[],you:id,results: ['result','complete'].includes(m.phase)?m.results:undefined};
 if(m.gameId==='poker'){out.community=m.phase==='memorize'?[]:m.community;out.board=m.phase==='memorize'||m.phase==='result'||m.phase==='complete'?m.board:null;out.myAnswer=m.answers[id]||null;}
 if(['square','cube'].includes(m.gameId)){out.size=m.puzzle.size;out.values=m.puzzle.values;out.target=m.puzzle.target;out.heights=m.puzzle.heights;out.myAnswer=m.answers[id]?.guess??null;out.answer=['result','complete'].includes(m.phase)?m.puzzle.answer:undefined;}
 if(m.gameId==='heavy'){
  out.stands=m.stands;out.choices=m.phase==='choose'?undefined:m.choices;
  out.myChoice=m.choices[id]||null;out.myCards=m.hands[id];out.myChips=m.chips[id];
  out.currentId=m.phase==='place'?m.queue[0]?.id:null;out.queue=m.phase==='place'?m.queue.map(x=>x.id):[];
  out.canPass=m.phase==='place'&&m.queue[0]?.id===id&&m.queue.length>1&&!m.passed[id];
 }
 if(m.gameId==='roulette'){
  out.turnId=m.turnId;out.credits=m.credits[id];out.publicNotes=m.publicNotes;out.privateNotes=m.privateNotes[id]||[];out.seats=m.ids;out.pool='hidden';
  out.chambers=m.phase==='complete'?m.chambers:undefined;
 }
 return out;
}

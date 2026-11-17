// Fake Out: independent social-deduction game based on published Fakin' It core mechanics.
// Original questions and custom scoring. No third-party game code or media.
const TASKS=Object.freeze({
 hands:[
  'Have you ever pretended not to notice someone waving at you?',
  'Have you ever eaten dessert before breakfast?',
  'Have you ever rehearsed an ordinary phone call before making it?',
  'Have you ever laughed at a joke you did not understand?',
  'Have you ever talked to a houseplant?',
  'Have you ever forgotten why you walked into a room?',
  'Have you ever kept a souvenir from an embarrassing trip?',
  'Have you ever accidentally sent a message to the wrong group chat?'
 ],
 number:[
  'How many alarms do you normally set to wake up? Show 0–10 fingers.',
  'How many pairs of shoes do you rotate through in a typical month? Show 0–10 fingers.',
  'How many times have you watched your favorite movie? Show 0–10 fingers.',
  'How many houseplants do you currently own? Show 0–10 fingers.',
  'How many browser tabs do you usually leave open? Round to 0–10.',
  'How many unread messages are you willing to ignore for a day? Show 0–10 fingers.'
 ],
 point:[
  'Point to the player who would be the best secret agent.',
  'Point to the player most likely to survive on a deserted island.',
  'Point to the player who would make the best game-show host.',
  'Point to the player most likely to buy a gadget they never use.',
  'Point to the player most likely to be late to their own surprise party.',
  'Point to the player you would trust to assemble furniture without instructions.'
 ],
 face:[
  'Show the face you would make if a penguin entered your office.',
  'Show your face when a restaurant says the kitchen is closing.',
  'Make the face of a superhero who just forgot their own powers.',
  'Show your expression after waking up ten minutes before a flight.',
  'Show the look you give a friend who borrowed something and broke it.',
  'Make the face of a detective who just solved an extremely easy mystery.'
 ],
 text:[
  'Name a harmless thing that instantly makes you suspicious.',
  'What one item would you bring on a trip to the Moon?',
  'Name the worst surprise ingredient in a birthday cake.',
  'What would be the title of a movie about this friend group?',
  'What would you call a tiny pet dinosaur?',
  'Name an item that should never be sold in a vending machine.'
 ]
});
const CATEGORIES=['hands','number','point','face','text'];
const CATEGORY_NAMES={hands:'Hands of Truth',number:'Number Pressure',point:'You Gotta Point',face:'Face Value',text:'Text You Up'};
const FACE_CHOICES=['😀','😬','😮','😡','🥹','😎','🤨','😭','😵','🤔'];
const id=()=>crypto.randomUUID();
function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
const has=(o,k)=>Object.hasOwn(o,k);
function time(m,phase,seconds){m.phase=phase;m.deadline=Date.now()+seconds*1000;}
function nextTask(m){
  m.taskNumber++;
  const index=(m.setNumber-1)*3+(m.taskNumber-1);
  m.category=CATEGORIES[index%CATEGORIES.length];
  const choices=TASKS[m.category];
  m.prompt=choices[(m.seed+index*3)%choices.length];
  m.responses={};m.votes={};m.voteCounts={};
  m.result=null;
  time(m,'act',55);
}
function nextSet(m){
  if(m.setNumber>=3){
    m.phase='complete';m.deadline=0;
    const best=Math.max(...Object.values(m.points));
    m.winnerIds=m.ids.filter(id=>m.points[id]===best);
    return;
  }
  m.setNumber++;
  m.round=m.setNumber;
  m.faker=m.fakerOrder[m.setNumber-1];
  m.taskNumber=0;
  m.accusations={};
  m.fakerSurvived=0;
  nextTask(m);
}
export function createFakerMatch(players){
  if(!Array.isArray(players)||players.length<3||players.length>6)throw Error('Fake Out requires 3–6 players');
  const ids=players.map(p=>p.id);
  if(new Set(ids).size!==ids.length)throw Error('Duplicate player IDs');
  const m={id:id(),gameId:'jak:faker',ids,names:Object.fromEntries(players.map(p=>[p.id,p.name])),
    points:Object.fromEntries(ids.map(player=>[player,0])),phase:'',round:0,setNumber:0,
    taskNumber:0,deadline:0,seed:Math.floor(Math.random()*1000),fakerOrder:shuffle([...ids]),
    faker:null,prompt:'',category:'',responses:{},votes:{},winnerIds:[],results:[],
    log:[],result:null,accusations:{},fakerSurvived:0
  };
  nextSet(m);
  return m;
}
function validResponse(m,raw){
  if(m.category==='hands')return raw===true?'Yes':raw===false?'No':null;
  if(m.category==='number'){return Number.isInteger(raw)&&raw>=0&&raw<=10?String(raw):null;}
  if(m.category==='point')return typeof raw==='string'&&m.ids.includes(raw)?raw:null;
  if(m.category==='face')return typeof raw==='string'&&FACE_CHOICES.includes(raw)?raw:null;
  if(m.category==='text'){
    const value=String(raw??'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,130);
    return value||null;
  }
  return null;
}
function afterVoting(m){
  const counts=Object.fromEntries(m.ids.map(id=>[id,0]));
  for(const accused of Object.values(m.votes))if(has(counts,accused))counts[accused]++;
  const detectives=m.ids.filter(player=>player!==m.faker);
  const caught=detectives.every(player=>m.votes[player]===m.faker);
  const maxTasks=m.ids.length===3?2:3;
  // No earned points are published until the role is revealed.
  for(const player of detectives)if(m.votes[player]===m.faker)m.accusations[player]=(m.accusations[player]||0)+1;
  if(!caught)m.fakerSurvived++;
  const done=caught||m.taskNumber>=maxTasks;
  if(done){
    for(const player of detectives){
      m.points[player]+=(m.accusations[player]||0)*100+(caught?300:0);
    }
    m.points[m.faker]+=m.fakerSurvived*250+(caught?0:600);
  }
  m.result={caught,done,counts,taskNumber:m.taskNumber,maxTasks,secretPrompt:m.prompt,
    faker:done?m.faker:null,pointsAwarded:done};
  m.results=done?m.ids.map(pid=>({id:pid,role:pid===m.faker?'Faker':'Detective',score:m.points[pid]})):[];
  time(m,'result',0);m.deadline=0;
}
export function actFaker(m,player,msg){
  if(!m||m.gameId!=='jak:faker'||!m.ids.includes(player)||!msg||typeof msg.type!=='string')return false;
  if(msg.type==='next'&&m.phase==='result'){
    if(m.result?.done)nextSet(m);else nextTask(m);
    return true;
  }
  if(m.phase==='act'&&msg.type==='respond'&&!has(m.responses,player)){
    const result=validResponse(m,msg.answer);
    if(result===null)return false;
    m.responses[player]=result;
    if(m.ids.every(pid=>has(m.responses,pid)))time(m,'discussion',24);
    return true;
  }
  if(m.phase==='discussion'&&msg.type==='discuss_done'){
    // Any player may request ending the discussion early only when everyone agrees
    // via the timer; not exposed as a one-user action.
    return false;
  }
  if(m.phase==='vote'&&msg.type==='accuse'&&!has(m.votes,player)){
    const target=String(msg.target??'');
    if(!m.ids.includes(target)||target===player)return false;
    m.votes[player]=target;
    if(m.ids.every(pid=>has(m.votes,pid)))afterVoting(m);
    return true;
  }
  return false;
}
export function advanceFakerIfDue(m,now=Date.now()){
  if(!m||m.gameId!=='jak:faker'||!m.deadline||now<m.deadline)return false;
  if(m.phase==='act'){time(m,'discussion',24);return true;}
  if(m.phase==='discussion'){time(m,'vote',40);return true;}
  if(m.phase==='vote'){afterVoting(m);return true;}
  return false;
}
export function viewFaker(m,player){
  if(!m)return null;
  const finished=m.phase==='complete';
  const resultPhase=m.phase==='result';
  const revealRole=finished||(resultPhase&&m.result?.done);
  const selfFaker=m.faker===player;
  const v={
    id:m.id,gameId:m.gameId,round:m.setNumber,setNumber:m.setNumber,taskNumber:m.taskNumber,
    phase:m.phase,deadline:m.deadline,ids:m.ids,names:m.names,points:m.points,
    submittedIds:m.phase==='act'?Object.keys(m.responses):m.phase==='vote'?Object.keys(m.votes):m.ids,
    mySubmitted:m.phase==='act'?has(m.responses,player):m.phase==='vote'?has(m.votes,player):false,
    category:m.category,categoryName:CATEGORY_NAMES[m.category],
    responseStyle:m.category,me:player,
    isFaker:selfFaker,
    prompt:(selfFaker&&m.phase==='act')?null:m.prompt,
    winnerIds:finished?m.winnerIds:[],
    maxTasks:m.ids.length===3?2:3,
    result:resultPhase?{...m.result}:null,
    results:revealRole?m.results:undefined,
    fakerId:revealRole?m.faker:undefined,
    myVote:has(m.votes,player)?m.votes[player]:null,
    faceOptions:m.category==='face'?FACE_CHOICES:undefined
  };
  // Do not disclose any other player's role before the Faker is revealed.
  if(m.phase==='discussion'||m.phase==='vote'||resultPhase||finished){
    v.responses=m.ids.map(id=>({id,answer:m.responses[id]??'No answer'}));
  }
  if(finished){v.prompt=null;v.fakerId=undefined;}
  return v;
}

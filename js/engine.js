
'use strict';
const ENGINE={version:'1.0.0',protocol:'decision-empire/1.0',cpInterval:216e5,cpAmount:1,baseCP:8,capSoft:12,xpScale:300,xpCap:15,gamma:.97,daysPerTurn:90};
const mk=(l,m)=>({l,m,min:0,max:100,d:15});
const V={
population:{l:'Population',m:'People; grows with food and health',min:0,max:1e9,rel:.25,f:200},
treasury:{l:'Treasury',m:'Currency; negative means debt',min:-1e6,max:1e9,rel:.3,f:3000},
food_production:mk('Food production','Food output index 0-100'),
food_reserves:{l:'Food reserves',m:'Stored food; ~0.02 per person needed',min:0,max:1e7,rel:.4,f:50},
infrastructure:mk('Infrastructure','Roads, storage, buildings 0-100'),
technology:mk('Technology','Technological level 0-100'),
education:mk('Education','Literacy and skills 0-100'),
public_health:mk('Public health','Health of the population 0-100'),
stability:mk('Stability','Political stability 0-100'),
trust:mk('Public trust','Trust in leadership 0-100'),
military:mk('Military','Military strength 0-100'),
diplomacy:mk('Diplomacy','Standing with neighbors 0-100'),
environment:mk('Environment','Ecological condition 0-100'),
productivity:mk('Productivity','Economic productivity 0-100'),
institutions:mk('Institutions','Institutional quality 0-100'),
resources:{l:'Resources',m:'Raw material reserves',min:0,max:1e7,rel:.3,f:100},
research:{l:'Research',m:'Accumulated research progress',min:0,max:1e7,rel:.5,f:50},
threats:{l:'Threats',m:'External threat level 0-100 (high is bad)',min:0,max:100,d:20}};
const ACTIONS=[
{id:'irrigation',n:'Irrigation canals',c:3,d:'Build canals and granaries to raise food output.'},
{id:'school',n:'Found a scribal school',c:2,d:'Train literate administrators and teachers.'},
{id:'tax',n:'Reform taxation',c:3,d:'Create a predictable tax system.'},
{id:'militia',n:'Raise a standing militia',c:3,d:'Organized defense against raiders.'},
{id:'envoy',n:'Send envoys to neighbors',c:2,d:'Open trade and diplomatic contact.'},
{id:'scouts',n:'Scout and gather intelligence',c:1,d:'Improve information quality about neighbors and land.'},
{id:'roads',n:'Build roads and a market',c:4,d:'Connect settlements and enable commerce.'},
{id:'research',n:'Fund a research guild',c:3,d:'Support craftsmen and early science.'},
{id:'forest',n:'Forest conservation edict',c:2,d:'Limit logging to protect the environment.'},
{id:'delegate',n:'Delegate routine administration',c:2,d:'Free attention; introduces principal-agent risk.'}];
const NEED=['protocol','campaign_id','turn_id','base_state_hash','assessment','outcome','state_changes','config_changes','new_entities','modified_entities','new_events','scheduled_effects','npc_actions','timeline_developments','strategic_risks','opportunities','narrative'];
const ARR=NEED.slice(6,16).filter(k=>k!=='narrative');
const TYPES=['faction','npc','institution','technology','site'],STAT=['active','dormant','dissolved','dead','destroyed'],GONE=['dead','dissolved','destroyed'];
const SCHEMA=`{"protocol":"decision-empire/1.0","campaign_id":"<echo>","turn_id":<echo integer>,"base_state_hash":"<echo>",
"assessment":{"decision_quality":0..1,"expected_utility_delta":-100..100,"risk":0..1,"confidence":0..1,"strategic_coherence":0..1 (optional),"opportunity_cost":"str (optional)","long_term":"str (optional)","reasoning":"str"},
"outcome":{"status":"success|partial_success|failure|mixed","summary":"str"},
"state_changes":[{"path":"/vars/<variable>","operation":"increment|set","value":number,"reason":"str"}],
"config_changes":[{"path":"/params/<snake_case_name>","operation":"increment|set","value":number between -1000 and 1000,"reason":"str"}],
"new_entities":[{"id":"snake_case_unique","type":"faction|npc|institution|technology|site","name":"str","description":"str","trust":0..100 (optional),"visible":true|false (optional, default true),"hidden_traits":"str (optional, AI-only secret)"}],
"modified_entities":[{"id":"existing id","status":"active|dormant|dissolved|dead|destroyed (optional)","trust":0..100 (optional),"note":"str (optional)","visible":true (optional, reveals entity to player),"hidden_traits":"str (optional)"}],
"new_events":[{"title":"str","description":"str","severity":0..1}],
"scheduled_effects":[{"id":"unique_snake_case","trigger_turn":integer > current turn,"effect_type":"str","description":"str","repeat_every":integer 1..50 (optional; requires repeat_count),"repeat_count":integer 2..20 total firings (optional),"state_changes":[{"path":"/vars/<variable>","operation":"increment","value":number,"reason":"str"}] (optional)}],
"npc_actions":[{"actor_id":"ACTIVE entity id","action":"str","description":"str","target_id":"entity id (optional)"}],
"timeline_developments":[{"title":"str","description":"str"}],
"strategic_risks":["str"],"opportunities":["str"],"narrative":"str"}`;

const $=q=>document.querySelector(q);
const h=(t,p={},...k)=>{const e=document.createElement(t);for(const[a,v]of Object.entries(p)){if(a==='class')e.className=v;else if(a==='value'||a==='checked')e[a]=v;else if(a.startsWith('on'))e.addEventListener(a.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(a,v===true?'':v)}e.append(...k.flat(9).filter(x=>x!=null&&x!==false));return e};
const num=x=>typeof x==='number'&&isFinite(x),str=(x,m=600)=>typeof x==='string'&&x.length>0&&x.length<=m;
const f=n=>Math.round(n*100)/100,ID=/^[a-z][a-z0-9_]{2,40}$/;
const st=o=>JSON.stringify(o,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:1)):v);
const fnv=s=>{let x=0x811c9dc5;for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619)>>>0}return x.toString(16).padStart(8,'0')};
const mul=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const hashState=s=>fnv(st({t:s.turn,r:s.rev,v:s.vars,p:s.params,e:Object.values(s.entities).map(e=>[e.id,e.status]),sc:s.scheduled.map(x=>[x.id,x.done])}));
const maxD=(k,o)=>V[k].rel?Math.max(V[k].rel*Math.abs(o),V[k].f):V[k].d;

/* ---------- Engine ---------- */
const maxCP=xp=>ENGINE.baseCP+Math.floor(ENGINE.capSoft*(1-Math.exp(-xp/ENGINE.xpScale)));
const regen=(s,now=Date.now())=>{const c=s.cp;if(now<c.last){c.last=now;return false}
if(c.cur>=c.max){c.last=now;return false}
let n=Math.floor((now-c.last)/ENGINE.cpInterval);if(n<1)return false;n=Math.min(n,1000);
c.cur=Math.min(c.max,c.cur+n*ENGINE.cpAmount);c.last=c.cur>=c.max?now:c.last+n*ENGINE.cpInterval;return true};
const utility=v=>{const c=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));const fs=c(v.food_reserves/Math.max(1,v.population*.02));
const w=.4*v.public_health/100+.3*v.education/100+.3*fs,pr=Math.log1p(v.productivity/10)/Math.log1p(10);
const stb=(v.stability+v.trust)/200,sus=v.environment/100,sec=v.military/200+(1-v.threats/100)/2;
let u=100*(.3*Math.sqrt(w)+.25*Math.sqrt(pr)+.2*stb+.1*sus+.15*sec);
if(v.stability<15)u-=(15-v.stability)*1.5;if(fs<.2)u-=(.2-fs)*60;if(v.environment<15)u-=15-v.environment;
if(v.treasury<0)u-=Math.min(20,-v.treasury/500);if(v.population<50)u-=30;return +u.toFixed(3)};
const newState=name=>{const id='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const ent=(id,type,name,description,trust)=>({id,type,name,description,trust,status:'active',since:1});
const s={id,name,turn:1,rev:0,day:0,created:Date.now(),
vars:{population:1200,treasury:5000,food_production:55,food_reserves:40,infrastructure:15,technology:5,education:12,public_health:55,stability:62,trust:60,military:20,diplomacy:40,environment:80,productivity:20,institutions:18,resources:300,research:0,threats:25},
params:{trade_dependency:.05,agri_productivity:1,tax_rate:.15,civil_liberties:.8,research_efficiency:.5},
cp:{cur:8,max:8,last:Date.now(),xp:0},util:{last:0,cum:0,disc:0,series:[]},
entities:Object.fromEntries([ent('elders_council','institution','Council of Elders','Traditional governing body of the settlement.',60),ent('vash_clans','faction','Vash Clans','Semi-nomadic neighbors to the east; wary of newcomers.',40),ent('river_traders','faction','River Traders','Itinerant merchants who ply the river.',50)].map(e=>[e.id,e])),
scheduled:[{id:'first_harvest',trigger_turn:2,type:'harvest',description:'First full harvest: modest food and trust gain.',changes:[{path:'/vars/food_reserves',operation:'increment',value:15,reason:'Harvest'}],done:false,created:1}],
history:[],intel:20,delegations:[],strategic:{risks:[],opps:[]},draft:{sel:[],custom:'',cost:2,reason:''},pending:null};
s.util.last=utility(s.vars);return s};

const buildPacket=s=>{const d=s.draft;const AA=allActions(s),decs=d.sel.map(id=>AA.find(a=>a.id===id)).filter(Boolean).map(a=>({id:a.id,name:a.n,cp:a.c,description:a.d}));
(s.delegations||[]).forEach(g=>{const ag=s.entities[g.agent_id],a=ACTIONS.find(x=>x.id===g.action_id);if(ag&&a&&ag.status==='active')decs.push({id:'deleg_'+g.action_id,name:a.n+' (delegated)',cp:g.oversight==='high'?1:0,delegated_to:ag.id,oversight:g.oversight,description:a.d+' Executed by agent '+ag.name+' (trust '+ag.trust+'). Model principal-agent risk: low oversight allows misaligned or self-serving execution.'})});
if(d.custom.trim())decs.push({id:'custom',name:d.custom.trim().slice(0,400),cp:Math.max(1,Math.min(5,+d.cost||2)),description:'Player-defined decision'});
const cost=decs.reduce((a,x)=>a+x.cp,0);
if(!decs.length)return{err:'Select or enter at least one decision.'};
if(cost>s.cp.cur)return{err:`Total cost ${cost} CP exceeds available ${s.cp.cur} CP.`};
const hash=hashState(s),r=mul(parseInt(hash,16)>>>0);
return{turn:s.turn,hash,decisions:decs,cost,reason:d.reason.slice(0,1500),draws:[...Array(6)].map(()=>+r().toFixed(4)),at:Date.now()}};

const promptFor=(s,p)=>{const due=s.scheduled.filter(x=>!x.done&&x.trigger_turn<=s.turn),up=s.scheduled.filter(x=>!x.done&&x.trigger_turn>s.turn);
const hist=s.history.slice(-5).map(x=>({turn:x.turn,decisions:x.decisions.map(d=>d.name),outcome:x.status,summary:x.summary,events:x.events.map(e=>e.title)}));
const rules=Object.fromEntries(Object.entries(V).map(([k,v])=>[k,{meaning:v.m,range:[v.min,v.max],max_change_per_turn:v.rel?`max(${v.rel*100}% of current, ${v.f})`:v.d}]));
return `You are the neutral, rigorous, causally coherent WORLD ADJUDICATOR of a turn-based strategy simulation (DECISION EMPIRE). You need no prior chat context: everything required is below.
RULES FOR YOU
1. Judge the decisions using only information reasonably available to the player at the time; assess decision quality separately from outcome luck.
2. Respect the engine constraints below. You may NOT change decision points (CP), proficiency XP, utility, or any engine rule. The engine computes those.
3. Consider elapsed simulated time (${ENGINE.daysPerTurn} days this turn), delayed consequences, prior commitments and historical facts. Never contradict history; dead/dissolved/destroyed entities cannot act.
4. Use the supplied random draws (uniform 0..1) to resolve uncertain events; tie probabilities to your stated risk.
5. Do not automatically favor the player, do not guarantee success or failure, do not invent unlimited resources, do not invent arbitrary punishments. Every significant change needs a causal reason; include tradeoffs and opportunity costs.
6. Scheduled effects listed as DUE are applied automatically by the engine; do not duplicate them. You may propose new scheduled_effects (trigger_turn must exceed the current turn).
7. You may add or change mutable world parameters (/params/*), entities and events when causally warranted.
8. For delegated decisions, model principal-agent effects (agent incentives, trust, oversight level). Hidden traits are for you only; set visible:true on an entity when the player discovers it. If a library technology is achieved, create a technology entity using its library id.
9. Return ONLY one valid JSON object matching the schema. No markdown, no commentary, no code fences.
PROTOCOL: ${ENGINE.protocol} | engine ${ENGINE.version} | campaign_id ${s.id} | turn_id ${s.turn} | state_revision ${s.rev} | base_state_hash ${p.hash}
WORLD DATE: day ${s.day} (year ${Math.floor(s.day/360)+1}) | simulated time elapsed this turn: ${ENGINE.daysPerTurn} days
RANDOM DRAWS: ${JSON.stringify(p.draws)}
WORLD STATE (vars): ${JSON.stringify(s.vars)}
VARIABLE RULES: ${JSON.stringify(rules)}
MUTABLE PARAMETERS: ${JSON.stringify(s.params)}
ENTITIES (visible=false means hidden from the player; hidden = AI-only secret traits): ${JSON.stringify(Object.values(s.entities).map(({id,type,name,description,status,trust,visible,hidden})=>({id,type,name,description,status,trust,visible,hidden})))}
INTELLIGENCE QUALITY 0-100: ${s.intel??20} (higher = the player's picture is more accurate; reveal hidden entities and traits more readily)
DELEGATIONS: ${JSON.stringify(s.delegations||[])}
TECH LIBRARY: ${JSON.stringify(LIB.techs.map(t=>({id:t.id,name:t.name,requires:t.requires})))}
FACTION ARCHETYPES (optional inspiration): ${JSON.stringify(LIB.factions)}
PLAYER: CP available ${s.cp.cur}/${s.cp.max}, proficiency XP ${f(s.cp.xp)}, decision-quality trend ${JSON.stringify(s.util.series.slice(-5).map(x=>x.q))}
DUE SCHEDULED EFFECTS: ${JSON.stringify(due)}
UPCOMING SCHEDULED EFFECTS: ${JSON.stringify(up)}
KNOWN RISKS/OPPORTUNITIES: ${JSON.stringify(s.strategic)}
RECENT HISTORY: ${JSON.stringify(hist)}
SUBMITTED DECISIONS (total ${p.cost} CP): ${JSON.stringify(p.decisions)}
PLAYER REASONING: ${p.reason||'(none given)'}
RESPONSE SCHEMA (echo campaign_id, turn_id and base_state_hash exactly):
${SCHEMA}`};

const validate=(txt,s,dup)=>{const E=[];let r;try{r=JSON.parse(txt)}catch(e){return['Invalid JSON: '+e.message]}
if(!r||typeof r!=='object'||Array.isArray(r))return['Root must be a JSON object'];
for(const k of NEED)if(!(k in r))E.push('Missing field: '+k);if(E.length)return E;
const p=s.pending;if(!p)return['No turn packet prepared for the current turn.'];
if(r.protocol!==ENGINE.protocol)E.push(`protocol must be "${ENGINE.protocol}"`);
if(r.campaign_id!==s.id)E.push(`campaign_id mismatch: expected ${s.id}`);
if(r.turn_id!==s.turn)E.push(`Stale or future response: turn_id ${r.turn_id}, current turn is ${s.turn}`);
if(r.base_state_hash!==p.hash)E.push(`base_state_hash mismatch: expected ${p.hash}`);
if(dup)E.push('Duplicate: this turn was already adjudicated.');
const A=r.assessment;if(!A||typeof A!=='object')E.push('assessment must be an object');else{
for(const k of['decision_quality','risk','confidence'])if(!num(A[k])||A[k]<0||A[k]>1)E.push(`assessment.${k} must be a number 0..1`);
if(!num(A.expected_utility_delta)||Math.abs(A.expected_utility_delta)>100)E.push('assessment.expected_utility_delta must be -100..100');
if(!str(A.reasoning,2000))E.push('assessment.reasoning required (max 2000 chars)')}
const O=r.outcome;if(!O||!['success','partial_success','failure','mixed'].includes(O.status)||!str(O.summary,1000))E.push('outcome.status must be success|partial_success|failure|mixed and outcome.summary required');
for(const k of ARR)if(!Array.isArray(r[k]))E.push(k+' must be an array');else if(r[k].length>40)E.push(k+' has too many items (max 40)');
if(!str(r.narrative,3000))E.push('narrative must be a non-empty string');
if(E.length)return E;
const delta=(list,w,inc)=>{const t={};list.forEach((c,i)=>{const q=`${w}[${i}]`;if(!c||typeof c!=='object')return E.push(q+': not an object');
const m=/^\/vars\/([a-z_]+)$/.exec(c.path||'');if(!m||!Object.hasOwn(V,m[1]))return E.push(`${q}: path not allowed (${c.path})`);
if(!['increment','set'].includes(c.operation)||(inc&&c.operation!=='increment'))return E.push(`${q}: operation not allowed`);
if(!num(c.value))return E.push(q+': value must be a finite number');if(!str(c.reason,500))return E.push(q+': reason required');
const k=m[1],v=V[k],nv=c.operation==='set'?c.value:(t[k]??s.vars[k])+c.value;
if(nv<v.min||nv>v.max)return E.push(`${q}: ${k} would be ${nv}, outside ${v.min}..${v.max}`);t[k]=nv});
for(const k in t)if(Math.abs(t[k]-s.vars[k])>maxD(k,s.vars[k]))E.push(`${w}: total change to ${k} (${f(t[k]-s.vars[k])}) exceeds per-turn limit ${f(maxD(k,s.vars[k]))}`)};
delta(r.state_changes,'state_changes');
let nk=0;r.config_changes.forEach((c,i)=>{const q=`config_changes[${i}]`,m=/^\/params\/([a-z][a-z0-9_]{1,40})$/.exec(c&&c.path||'');
if(!m||/^(constructor|prototype)$/.test(m[1]))return E.push(`${q}: path must be /params/<snake_case>; engine rules and other paths are immutable`);
if(!['increment','set'].includes(c.operation)||!num(c.value)||Math.abs(c.value)>1000||!str(c.reason,500))return E.push(q+': invalid operation, value (|v|<=1000) or reason');
if(!Object.hasOwn(s.params,m[1])&&Object.keys(s.params).length+(++nk)>80)E.push(q+': too many parameters')});
const act=new Set(Object.values(s.entities).filter(e=>!GONE.includes(e.status)&&e.status!=='dormant').map(e=>e.id)),all=new Set(Object.keys(s.entities));
r.new_entities.forEach((e,i)=>{const q=`new_entities[${i}]`;if(!e||!ID.test(e.id||''))return E.push(q+': invalid id');if(all.has(e.id))return E.push(`${q}: id ${e.id} already exists`);
if(!TYPES.includes(e.type)||!str(e.name,60)||!str(e.description,500)||(e.trust!==undefined&&(!num(e.trust)||e.trust<0||e.trust>100))||(e.visible!==undefined&&typeof e.visible!=='boolean')||(e.hidden_traits!==undefined&&!str(e.hidden_traits,500)))return E.push(q+': invalid type/name/description/trust/visible/hidden_traits');all.add(e.id);act.add(e.id)});
r.modified_entities.forEach((m,i)=>{const q=`modified_entities[${i}]`,e=s.entities[m&&m.id];if(!e)return E.push(q+': unknown entity '+(m&&m.id));
if(GONE.includes(e.status))return E.push(`${q}: ${e.id} is ${e.status} and cannot be modified`);
if(m.status!==undefined&&!STAT.includes(m.status))E.push(q+': invalid status');if(m.trust!==undefined&&(!num(m.trust)||m.trust<0||m.trust>100))E.push(q+': trust must be 0..100');
if(m.note!==undefined&&!str(m.note,500))E.push(q+': invalid note');if(m.visible!==undefined&&m.visible!==true)E.push(q+': visible may only be set to true');if(m.hidden_traits!==undefined&&!str(m.hidden_traits,500))E.push(q+': invalid hidden_traits')});
r.new_events.forEach((e,i)=>{if(!e||!str(e.title,120)||!str(e.description,800)||!num(e.severity)||e.severity<0||e.severity>1)E.push(`new_events[${i}]: title, description, severity 0..1 required`)});
r.timeline_developments.forEach((e,i)=>{if(!e||!str(e.title,120)||!str(e.description,800))E.push(`timeline_developments[${i}]: title and description required`)});
const ids=new Set(s.scheduled.map(x=>x.id));
r.scheduled_effects.forEach((x,i)=>{const q=`scheduled_effects[${i}]`;if(!x||!ID.test(x.id||'')||ids.has(x.id))return E.push(q+': id invalid or already used');ids.add(x.id);
if(!Number.isInteger(x.trigger_turn)||x.trigger_turn<=s.turn||x.trigger_turn>s.turn+200)E.push(`${q}: trigger_turn must be an integer in (${s.turn}, ${s.turn+200}]`);
if(!str(x.effect_type,40)||!str(x.description,800))E.push(q+': effect_type and description required');
if(x.repeat_every!==undefined&&(!Number.isInteger(x.repeat_every)||x.repeat_every<1||x.repeat_every>50||!Number.isInteger(x.repeat_count)||x.repeat_count<2||x.repeat_count>20))E.push(q+': repeat_every (1..50) and repeat_count (2..20) required together');
if(x.state_changes!==undefined){if(!Array.isArray(x.state_changes))E.push(q+': state_changes must be an array');else delta(x.state_changes,q+'.state_changes',true)}});
r.npc_actions.forEach((a,i)=>{const q=`npc_actions[${i}]`;if(!a||!act.has(a.actor_id))return E.push(q+': actor_id must be an active entity');if(!str(a.action,100)||!str(a.description,800))E.push(q+': action and description required');
if(a.target_id!==undefined&&!all.has(a.target_id))E.push(q+': unknown target_id')});
['strategic_risks','opportunities'].forEach(k=>r[k].forEach((x,i)=>{if(!str(x,500))E.push(`${k}[${i}] must be a non-empty string`)}));
return E};

const applyTurn=(s,r)=>{const n=structuredClone(s),p=s.pending,A=r.assessment;
const ad=c=>{const k=c.path.slice(6),v=V[k],x=c.operation==='set'?c.value:n.vars[k]+c.value;n.vars[k]=Math.max(v.min,Math.min(v.max,k==='population'?Math.round(x):x))};
const rec={turn:s.turn,day:s.day,decisions:p.decisions,cost:p.cost,q:A.decision_quality,risk:A.risk,conf:A.confidence,eu:A.expected_utility_delta,status:r.outcome.status,summary:r.outcome.summary,assessment:A,narrative:r.narrative,events:r.new_events,devs:r.timeline_developments,npc:r.npc_actions,cfg:r.config_changes,fx:[]};
r.state_changes.forEach(ad);
for(const c of r.config_changes){const k=c.path.slice(8);n.params[k]=c.operation==='set'?c.value:(n.params[k]||0)+c.value}
for(const e of r.new_entities)n.entities[e.id]={id:e.id,type:e.type,name:e.name,description:e.description,status:'active',trust:num(e.trust)?e.trust:50,visible:e.visible!==false,hidden:e.hidden_traits||'',since:s.turn};
for(const m of r.modified_entities){const e=n.entities[m.id];if(m.status)e.status=m.status;if(num(m.trust))e.trust=m.trust;if(m.visible===true)e.visible=true;if(m.hidden_traits!==undefined)e.hidden=m.hidden_traits;(e.notes=e.notes||[]).push({t:s.turn,n:m.note||''})}
n.scheduled.filter(x=>!x.done&&x.trigger_turn<=s.turn).forEach(x=>{(x.changes||[]).forEach(ad);rec.fx.push(x.id);if(x.repeat_every&&x.remaining>0){x.remaining--;x.trigger_turn+=x.repeat_every}else{x.done=true;x.done_turn=s.turn}});
r.scheduled_effects.forEach(x=>n.scheduled.push({id:x.id,trigger_turn:x.trigger_turn,type:x.effect_type,description:x.description,changes:x.state_changes||[],done:false,created:s.turn,...(x.repeat_every?{repeat_every:x.repeat_every,remaining:x.repeat_count-1}:{})}));
const was=n.cp.cur>=n.cp.max;n.cp.cur=Math.max(0,n.cp.cur-p.cost);if(was)n.cp.last=Date.now();
const prev=s.history.at(-1),same=prev&&st(prev.decisions.map(d=>d.id).sort())===st(p.decisions.map(d=>d.id).sort());
let g=A.decision_quality<.3?-(.3-A.decision_quality)*5:Math.min(ENGINE.xpCap,10*Math.max(0,(A.decision_quality-.5)*2)*(.5+.5*A.confidence)*Math.min(1,p.cost/3)*(same?.5:1));
g=Math.max(-n.cp.xp,g);n.cp.xp+=g;n.cp.max=maxCP(n.cp.xp);rec.gain=g;
n.intel=Math.max(0,Math.min(100,(s.intel??20)-2+(p.decisions.some(d=>d.id==='scouts')?15:0)));n.turn++;n.rev++;n.day+=ENGINE.daysPerTurn;
const u=utility(n.vars);n.util.last=u;n.util.cum+=u;n.util.disc+=Math.pow(ENGINE.gamma,s.turn-1)*u;rec.u=u;rec.u0=s.util.last;rec.hash=p.hash;
n.util.series.push({t:n.turn,u,d:n.util.disc,cp:n.cp.max,q:A.decision_quality,v:{...n.vars}});
n.history.push(rec);n.pending=null;n.draft={sel:[],custom:'',cost:2,reason:''};n.strategic={risks:r.strategic_risks,opps:r.opportunities};return n};

const diff=(a,b)=>{const L=[];for(const k in V)if(a.vars[k]!==b.vars[k])L.push(`${V[k].l}: ${f(a.vars[k])} → ${f(b.vars[k])}`);
for(const k in b.params)if(a.params[k]!==b.params[k])L.push(`Parameter ${k}: ${a.params[k]??'(new)'} → ${b.params[k]}`);
for(const k in b.entities){const x=a.entities[k],y=b.entities[k];if(!x)L.push(`New ${y.type}: ${y.name}`);else if(x.status!==y.status||x.trust!==y.trust)L.push(`${y.name}: ${x.status}/${x.trust} → ${y.status}/${y.trust}`)}
b.scheduled.filter(x=>!a.scheduled.some(y=>y.id===x.id)).forEach(x=>L.push(`Scheduled for turn ${x.trigger_turn}: ${x.description}`));
const rec=b.history.at(-1);rec.fx.forEach(id=>L.push('Scheduled effect fires: '+id));
L.push(`CP ${a.cp.cur}/${a.cp.max} → ${b.cp.cur}/${b.cp.max}; proficiency XP ${rec.gain>=0?'+':''}${f(rec.gain)}; utility ${a.util.last} → ${b.util.last}`);return L};


const LIB={techs:[],factions:[]};
const allActions=s=>[...ACTIONS,...LIB.techs.filter(t=>!Object.hasOwn(s.entities,t.id)&&Object.entries(t.requires||{}).every(([k,v])=>s.vars[k]>=v)).map(t=>({id:'tech_'+t.id,n:'Pursue: '+t.name,c:t.cp,d:t.description+' (library id '+t.id+')'}))];
export {LIB,allActions,ENGINE,V,ACTIONS,NEED,ARR,TYPES,STAT,GONE,SCHEMA,$,h,num,str,f,ID,st,fnv,mul,hashState,maxD,maxCP,regen,utility,newState,buildPacket,promptFor,validate,applyTurn,diff};

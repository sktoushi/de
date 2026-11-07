import {LIB,allActions,ENGINE,V,ACTIONS,$,h,f,regen,newState,buildPacket,promptFor,validate,applyTurn,diff} from './engine.js';
import {DB} from './db.js';
const mig=s=>{s.intel??=20;s.delegations??=[];return s};
const loadLib=async()=>{for(const[k,u]of[['techs','data/technologies.json'],['factions','data/factions.json']])try{const r=await fetch(u);if(r.ok)LIB[k]=await r.json()}catch(e){}};
const archive=async(src,label)=>{const nid='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),c=structuredClone(src);c.id=nid;c.name=`${src.name} [${label} T${src.turn}]`;c.parent={id:src.id,turn:src.turn};c.pending=null;
const A=(await DB.all('adjud')).filter(a=>a.cid===src.id),N=(await DB.all('snaps')).filter(a=>a.cid===src.id);
await DB.tx(['campaigns','adjud','snaps'],(cs,ad,sn)=>{cs.put(c);A.forEach(a=>ad.put({...a,cid:nid,key:nid+':'+a.turn}));N.forEach(a=>{const st=structuredClone(a.state);st.id=nid;st.pending=null;sn.put({key:nid+':'+a.turn,cid:nid,turn:a.turn,state:st})})});CAMPS=await DB.all('campaigns')};
const save=s=>DB.tx(['campaigns'],c=>c.put(s)).catch(e=>flash('Save failed: '+e.message));

/* ---------- UI ---------- */
let S,CAMPS=[],SNAPS=[],view='dash',RESP='',VAL=null,MSG='',DEL=null;
const flash=m=>{MSG=m;const e=$('#msg');if(e)e.textContent=m};
const spark=(vals,c)=>{const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 200 50');s.setAttribute('preserveAspectRatio','none');
if(vals.length>1){const lo=Math.min(...vals),hi=Math.max(...vals),pl=document.createElementNS(ns,'polyline');
pl.setAttribute('points',vals.map((v,i)=>`${i/(vals.length-1)*200},${46-(hi===lo?20:(v-lo)/(hi-lo)*42)}`).join(' '));pl.setAttribute('fill','none');pl.setAttribute('stroke',c);pl.setAttribute('stroke-width','2');s.append(pl)}return s};
const cdText=()=>{const c=S.cp;if(c.cur>=c.max)return 'full';const ms=Math.max(0,c.last+ENGINE.cpInterval-Date.now()),m=Math.floor(ms/6e4);return `+${ENGINE.cpAmount} CP in ${Math.floor(m/60)}h ${m%60}m (${new Date(c.last+ENGINE.cpInterval).toLocaleTimeString()})`};
const pips=(c,m)=>h('div',{class:'pips'},[...Array(m)].map((_,i)=>h('i',{class:i<c?'on':''})));

const dash=()=>{const v=S.vars,u=S.util,spent=S.history.reduce((a,x)=>a+x.cost,0);
return h('div',{},h('h2',{},`${S.name} — Turn ${S.turn}`),h('div',{class:'m'},`Year ${Math.floor(S.day/360)+1}, day ${S.day%360}`),
h('div',{class:'card'},h('div',{class:'k'},'Decision capacity'),h('div',{class:'v'},`${S.cp.cur} / ${S.cp.max} CP`),pips(S.cp.cur,S.cp.max),h('div',{class:'m',id:'cd'},cdText()),h('div',{class:'m'},`Proficiency XP ${f(S.cp.xp)}`)),
h('div',{class:'grid'},
h('div',{class:'card'},h('div',{class:'k'},'Utility now'),h('div',{class:'v'},f(u.last))),
h('div',{class:'card'},h('div',{class:'k'},'Cumulative / discounted'),h('div',{class:'v'},`${f(u.cum)} / ${f(u.disc)}`)),
h('div',{class:'card'},h('div',{class:'k'},'Utility per CP spent'),h('div',{class:'v'},spent?f(u.cum/spent):'—')),
Object.entries(V).map(([k,d])=>h('div',{class:'card',title:d.m},h('div',{class:'k'},d.l),h('div',{class:'v'},f(v[k])),d.max===100?h('div',{class:'bar'},h('i',{style:`width:${v[k]}%`})):null))),
h('div',{class:'card'},h('div',{class:'k'},'Utility trend'),spark(u.series.map(x=>x.u),'#e0a43a'),h('div',{class:'k'},'Decision quality (AI estimate)'),spark(u.series.map(x=>x.q),'#4cc38a'),h('div',{class:'k'},'Max CP'),spark(u.series.map(x=>x.cp),'#8a9ab0')),
h('div',{class:'card'},h('b',{},'Risks'),h('ul',{},S.strategic.risks.map(x=>h('li',{},x))),h('b',{},'Opportunities'),h('ul',{},S.strategic.opps.map(x=>h('li',{},x)))),
h('div',{class:'card'},h('b',{},'Recent events'),...S.history.slice(-3).reverse().map(x=>h('p',{},`T${x.turn}: ${x.narrative}`))),
h('button',{class:'btn big',onclick:()=>go('decide')},'Prepare decisions'))};

const decide=()=>{const d=S.draft,tot=h('b'),upd=()=>{const c=d.sel.reduce((a,id)=>a+(allActions(S).find(x=>x.id===id)||{c:0}).c,0)+(d.custom.trim()?+d.cost:0);tot.textContent=`${c} / ${S.cp.cur} CP`;tot.style.color=c>S.cp.cur?'var(--r)':'var(--g)'},pr=()=>{upd();save(S)};
const el=h('div',{},h('h2',{},'Decision Center'),h('div',{class:'card'},'Selected cost: ',tot),
allActions(S).map(a=>h('label',{class:'card act'},h('input',{type:'checkbox',checked:d.sel.includes(a.id),onchange:e=>{d.sel=e.target.checked?[...d.sel,a.id]:d.sel.filter(x=>x!==a.id);pr()}}),h('span',{},h('b',{},`${a.n} (${a.c} CP)`),h('br'),h('span',{class:'m'},a.d)))),
h('div',{class:'card'},h('b',{},'Custom decision'),h('input',{type:'text',maxlength:400,value:d.custom,placeholder:'Describe your own decision',oninput:e=>{d.custom=e.target.value;pr()}}),
h('label',{class:'m'},'CP cost (1-5) ',h('input',{type:'number',min:1,max:5,value:d.cost,oninput:e=>{d.cost=Math.max(1,Math.min(5,+e.target.value||2));pr()}}))),
h('div',{class:'card'},h('b',{},'Strategic reasoning (optional)'),h('textarea',{value:d.reason,placeholder:'Objectives, expectations, constraints',oninput:e=>{d.reason=e.target.value;pr()}})),
delegCard(),h('button',{class:'btn big',onclick:prep},'Generate turn packet'));upd();return el};
const prep=()=>{const p=buildPacket(S);if(p.err){MSG=p.err;view='decide';render();flash(p.err);return}
p.prompt=promptFor(S,p);S.pending=p;RESP='';VAL=null;MSG='';save(S);go('exch')};

const exch=()=>{const p=S.pending;
if(!p)return h('div',{},h('h2',{},'AI Exchange'),h('p',{class:'m'},'No turn packet yet. Choose decisions first.'),h('button',{class:'btn',onclick:()=>go('decide')},'Go to Decision Center'));
const ta=h('textarea',{value:RESP,placeholder:'Paste the AI JSON response here',oninput:e=>{RESP=e.target.value}});
const out=[h('h2',{},`Turn ${S.turn} adjudication`),h('p',{class:'m'},`Packet: ${p.decisions.length} decision(s), ${p.cost} CP (deducted only on commit). Hash ${p.hash}.`),
h('button',{class:'btn big',onclick:async()=>{try{await navigator.clipboard.writeText(p.prompt);flash(`Copied ${p.prompt.length} characters to the clipboard.`)}catch(e){flash('Copy failed ('+e.message+'). Select the packet text below and copy it manually.')}}},'COPY TURN TO CHATGPT'),
h('button',{class:'btn s',onclick:()=>window.open('https://chatgpt.com/','_blank','noopener')},'Open ChatGPT'),
h('button',{class:'btn s',onclick:()=>{S.pending=null;VAL=null;save(S);go('decide')}},'Discard packet'),
h('div',{class:'m',id:'msg'},MSG),
h('details',{},h('summary',{},'View packet'),h('textarea',{readonly:true,value:p.prompt})),
h('h3',{},'Paste AI response'),ta,
h('input',{type:'file',accept:'.json,application/json,text/plain',onchange:async e=>{const fl=e.target.files[0];if(fl){RESP=await fl.text();render()}}}),
h('button',{class:'btn',onclick:check},'Validate response')];
if(VAL&&VAL.errs)out.push(h('div',{class:'card'},h('b',{class:'err'},`Rejected: ${VAL.errs.length} problem(s). Nothing was changed.`),h('ul',{},VAL.errs.map(x=>h('li',{class:'err'},x))),
h('button',{class:'btn s',onclick:async()=>{const t=`Your previous JSON response failed validation in the game engine. Fix ONLY these problems and return the complete corrected JSON object (same campaign_id ${S.id}, turn_id ${S.turn}, base_state_hash ${p.hash}), JSON only:\n`+VAL.errs.map((x,i)=>`${i+1}. ${x}`).join('\n');try{await navigator.clipboard.writeText(t);flash('Correction prompt copied.')}catch(e){flash('Copy failed: '+e.message)}}},'Copy correction prompt')));
if(VAL&&VAL.ns)out.push(h('div',{class:'card'},h('b',{class:'ok'},'Valid. Review the changes:'),h('p',{},VAL.r.narrative),h('ul',{},diff(S,VAL.ns).map(x=>h('li',{},x))),h('button',{class:'btn big',onclick:commit},'Commit turn')));
return h('div',{},out)};
const check=async()=>{const dup=await DB.get('adjud',S.id+':'+S.turn);const E=validate(RESP,S,!!dup);
if(E.length)VAL={errs:E};else{const r=JSON.parse(RESP);VAL={r,ns:applyTurn(S,r)}}render()};
const commit=async()=>{const r=VAL.r,old=S;regen(old);if(old.cp.cur<old.pending.cost){flash('Not enough CP.');return}
const ns=applyTurn(old,r),key=old.id+':'+old.turn;
try{await DB.tx(['campaigns','adjud','snaps','log'],(c,a,sn,lg)=>{c.put(ns);a.add({key,cid:old.id,turn:old.turn,hash:old.pending.hash,response:r,engine:ENGINE.version,draws:old.pending.draws,at:Date.now()});sn.put({key,cid:old.id,turn:old.turn,state:old});lg.add({cid:old.id,turn:old.turn,type:'commit',at:Date.now(),summary:r.outcome.summary})})}
catch(e){VAL={errs:['Commit failed, nothing changed: '+(e.name==='ConstraintError'?'this turn was already adjudicated':e.message)]};render();return}
S=ns;VAL=null;RESP='';CAMPS=await DB.all('campaigns');go('dash')};

const timeline=()=>h('div',{},h('h2',{},'Timeline'),
h('div',{class:'card'},h('b',{},'Upcoming'),h('ul',{},S.scheduled.filter(x=>!x.done).sort((a,b)=>a.trigger_turn-b.trigger_turn).map(x=>h('li',{},`Turn ${x.trigger_turn}: ${x.description}`)))),
S.history.length?[...S.history].reverse().map(x=>h('details',{class:'card'},h('summary',{},`Turn ${x.turn} · ${x.status} · quality ${f(x.q)} · utility ${f(x.u)}`),
h('p',{},x.narrative),h('p',{class:'m'},'Decisions: '+x.decisions.map(d=>d.name).join('; ')),h('p',{class:'m'},`Risk ${x.risk}, confidence ${x.conf}, XP ${f(x.gain)}. ${x.assessment.reasoning}`),
h('ul',{},x.events.map(e=>h('li',{},`Event: ${e.title}. ${e.description}`)),x.devs.map(e=>h('li',{},`${e.title}. ${e.description}`)),x.npc.map(a=>h('li',{},`${a.actor_id}: ${a.action}. ${a.description}`)),x.fx.map(i=>h('li',{},'Scheduled effect fired: '+i))))):h('p',{class:'m'},'No turns committed yet.'));

const config=()=>h('div',{},h('h2',{},'World Configuration'),
h('div',{class:'card'},h('b',{},'Immutable engine rules'),h('pre',{class:'m'},JSON.stringify(ENGINE,null,1)),h('p',{class:'m'},'The AI cannot change these, nor CP, XP or utility.')),
h('div',{class:'card'},h('b',{},'Mutable parameters'),h('ul',{},Object.entries(S.params).map(([k,v])=>h('li',{},`${k} = ${v}`)))),
h('div',{class:'card'},h('b',{},'Configuration history'),h('ul',{},S.history.flatMap(x=>x.cfg.map(c=>h('li',{},`T${x.turn} ${c.path} ${c.operation} ${c.value}: ${c.reason}`))))),
h('div',{class:'card'},h('b',{},`Entities (intelligence ${f(S.intel)}/100; undiscovered ones not shown)`),h('ul',{},Object.values(S.entities).filter(e=>e.visible!==false).map(e=>h('li',{},`${e.name} (${e.type}, ${e.status}, trust ≈${e.trust}±${Math.round((100-S.intel)/5)}): ${e.description}`)))),
h('div',{class:'card'},h('b',{},'Variables'),h('ul',{},Object.entries(V).map(([k,d])=>h('li',{},`${d.l} [${d.min}..${d.max}]: ${d.m}`)))));

const dl=(name,obj)=>{const a=h('a',{href:URL.createObjectURL(new Blob([JSON.stringify(obj)],{type:'application/json'})),download:name});document.body.append(a);a.click();a.remove()};
const exportC=async id=>{const c=CAMPS.find(x=>x.id===id),all=async s=>(await DB.all(s)).filter(x=>x.cid===id);
dl(`decision-empire-${c.name.replace(/\W+/g,'_')}.json`,{format:'decision-empire-backup',version:1,campaign:id===S.id?S:c,adjud:await all('adjud'),snaps:await all('snaps'),log:await all('log')})};
const saves=()=>{const nm=h('input',{type:'text',placeholder:'Campaign name',maxlength:60});
return h('div',{},h('h2',{},'Saves'),h('div',{class:'card'},nm,h('button',{class:'btn',onclick:async()=>{S=newState(nm.value.trim()||'Campaign '+(CAMPS.length+1));await save(S);await DB.tx(['settings'],s=>s.put({k:'cur',v:S.id}));CAMPS=await DB.all('campaigns');VAL=null;RESP='';go('dash')}},'New campaign')),
CAMPS.map(c=>h('div',{class:'card'},h('b',{},c.name+(c.id===S.id?' (active)':'')),h('div',{class:'m'},`Turn ${c.turn}, utility ${c.util.last}${c.parent?' · branched from turn '+c.parent.turn:''}`),
c.id!==S.id?h('button',{class:'btn s',onclick:async()=>{S=c;await DB.tx(['settings'],s=>s.put({k:'cur',v:c.id}));VAL=null;RESP='';go('dash')}},'Load'):null,
c.id===S.id?h('button',{class:'btn s',onclick:async()=>{await archive(S,'fork');go('saves')}},'Fork'):null,h('button',{class:'btn s',onclick:()=>exportC(c.id)},'Export'),
h('button',{class:DEL===c.id?'btn d':'btn s',onclick:async()=>{if(DEL!==c.id){DEL=c.id;render();return}DEL=null;await DB.tx(['campaigns'],o=>o.delete(c.id));CAMPS=await DB.all('campaigns');
for(const s of['adjud','snaps']){const ks=(await DB.all(s)).filter(x=>x.cid===c.id).map(x=>x.key);await DB.tx([s],o=>ks.forEach(k=>o.delete(k)))}
if(c.id===S.id){S=CAMPS[0]||newState('First campaign');await save(S);CAMPS=await DB.all('campaigns')}go('saves')}},DEL===c.id?'Confirm delete':'Delete'))),
h('div',{class:'card'},h('b',{},'Import backup'),h('input',{type:'file',accept:'.json',onchange:async e=>{try{const b=JSON.parse(await e.target.files[0].text());if(b.format!=='decision-empire-backup'||!b.campaign||!b.campaign.id||!b.campaign.vars)throw Error('not a Decision Empire backup');
await DB.tx(['campaigns','adjud','snaps','log'],(c,a,sn,lg)=>{c.put(b.campaign);(b.adjud||[]).forEach(x=>a.put(x));(b.snaps||[]).forEach(x=>sn.put(x));(b.log||[]).forEach(x=>lg.add(x))});
S=mig(b.campaign);CAMPS=await DB.all('campaigns');go('saves');flash('Imported '+S.name)}catch(er){flash('Import failed: '+er.message)}}}),h('div',{class:'m',id:'msg'},MSG)),
h('div',{class:'card'},h('b',{},'Snapshots / rollback (state before each committed turn)'),
SNAPS.filter(x=>x.cid===S.id).sort((a,b)=>b.turn-a.turn).map(x=>h('div',{},`Turn ${x.turn} `,h('button',{class:'btn s',onclick:async()=>{await archive(S,'archived future');const ad=(await DB.all('adjud')).filter(a=>a.cid===S.id&&a.turn>=x.turn).map(a=>a.key),sk=SNAPS.filter(a=>a.cid===S.id&&a.turn>x.turn).map(a=>a.key);
S=mig(structuredClone(x.state));S.id=x.cid;regen(S);await DB.tx(['campaigns','adjud','snaps','log'],(c,a,sn,lg)=>{c.put(S);ad.forEach(k=>a.delete(k));sk.forEach(k=>sn.delete(k));lg.add({cid:S.id,turn:S.turn,type:'rollback',at:Date.now()})});VAL=null;RESP='';CAMPS=await DB.all('campaigns');go('saves')}},'Roll back'))),
h('p',{class:'m'},'Rollback discards later adjudications and snapshots so abandoned futures cannot contaminate the timeline.')))};

const worldmap=()=>{const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 400 300');s.style.height='auto';
const add=(t,a,tx)=>{const e=document.createElementNS(ns,t);for(const k in a)e.setAttribute(k,a[k]);if(tx)e.textContent=tx;s.append(e)};
const es=Object.values(S.entities).filter(e=>e.visible!==false);es.forEach((e,i)=>{const a=i/es.length*6.283,x=200+Math.cos(a)*120,y=150+Math.sin(a)*100;add('line',{x1:200,y1:150,x2:x,y2:y,stroke:'#243142'})});
add('circle',{cx:200,cy:150,r:26,fill:'#e0a43a'});add('text',{x:200,y:154,'text-anchor':'middle','font-size':10,fill:'#1a1204'},'Capital');
es.forEach((e,i)=>{const a=i/es.length*6.283,x=200+Math.cos(a)*120,y=150+Math.sin(a)*100;add('circle',{cx:x,cy:y,r:14,fill:e.status==='active'?`hsl(${e.trust*1.2},60%,45%)`:'#555'});add('text',{x,y:y+26,'text-anchor':'middle','font-size':9,fill:'#e8eef5'},e.name.slice(0,18))});
return h('div',{},h('h2',{},'World Overview'),h('div',{class:'card'},s),h('div',{class:'card'},`Infrastructure ${f(S.vars.infrastructure)} · Threats ${f(S.vars.threats)} · Entities ${es.length}`),h('p',{class:'m'},'Node color shows trust (red low, green high); grey means inactive.'))};
const delegCard=()=>{const ok=S.vars.institutions>=25,ag=Object.values(S.entities).filter(e=>e.status==='active'&&['institution','npc'].includes(e.type)),
sa=h('select',{},ACTIONS.filter(a=>a.c<=3&&!S.delegations.some(g=>g.action_id===a.id)).map(a=>h('option',{value:a.id},a.n))),
sg=h('select',{},ag.map(e=>h('option',{value:e.id},`${e.name} (trust ${e.trust})`))),
so=h('select',{},h('option',{value:'low'},'Low oversight: 0 CP, higher agency risk'),h('option',{value:'high'},'High oversight: 1 CP per turn'));
return h('div',{class:'card'},h('b',{},'Delegation'),h('p',{class:'m'},ok?'Delegated actions run every turn without your attention. Oversight costs CP; weak oversight invites misaligned execution.':`Requires Institutions ≥ 25 (now ${f(S.vars.institutions)}).`),
S.delegations.map(g=>h('div',{},`${ACTIONS.find(a=>a.id===g.action_id).n} → ${(S.entities[g.agent_id]||{name:g.agent_id}).name} (${g.oversight} oversight) `,h('button',{class:'btn s',onclick:()=>{S.delegations=S.delegations.filter(x=>x!==g);save(S);render()}},'Revoke'))),
ok&&sa.options.length&&ag.length?h('div',{},sa,sg,so,h('button',{class:'btn s',onclick:()=>{S.delegations.push({action_id:sa.value,agent_id:sg.value,oversight:so.value,since:S.turn});save(S);render()}},'Delegate')):null)};
const stat=(k,v)=>h('div',{class:'card'},h('div',{class:'k'},k),h('div',{class:'v'},v));
const analytics=()=>{const H=S.history,se=S.util.series,cp=H.reduce((a,x)=>a+x.cost,0),avgq=H.length?H.reduce((a,x)=>a+x.q,0)/H.length:0;
let streak=0;for(let i=H.length-1;i>=0&&H[i].u>H[i].u0;i--)streak++;
const rows=H.slice(-10).reverse().map(x=>h('tr',{},[`T${x.turn}`,f(x.eu),f(x.u-x.u0),f(x.u-x.u0-x.eu),f(x.q),x.cost].map(c=>h('td',{},c))));
return h('div',{},h('h2',{},'Analytics'),h('div',{class:'grid'},stat('Avg decision quality (AI est.)',f(avgq)),stat('Proficiency XP',`${f(S.cp.xp)} (max CP ${S.cp.max})`),stat('Utility per CP',cp?f(S.util.cum/cp):'—'),stat('Intelligence',f(S.intel)),stat('Mistakes (q<0.35)',H.filter(x=>x.q<.35).length),stat('Growth streak (turns)',streak),stat('Delegations',S.delegations.length)),
h('div',{class:'card'},h('b',{},'Expected vs realized utility'),h('p',{class:'m'},'Residual = luck plus AI estimation error. It is not decision quality.'),h('table',{},h('tr',{},['Turn','Expected Δu','Realized Δu','Residual','Quality','CP'].map(t=>h('th',{},t))),rows)),
se.length>1?Object.keys(V).map(k=>h('div',{class:'card'},h('div',{class:'k'},V[k].l),spark(se.map(x=>x.v&&x.v[k]).filter(x=>x!=null),'#e0a43a'))):h('p',{class:'m'},'Commit two turns to see variable trends.'))};
const TABS=[['dash','Dashboard',dash],['decide','Decide',decide],['exch','AI Exchange',exch],['map','World',worldmap],['time','Timeline',timeline],['an','Analytics',analytics],['cfg','Config',config],['saves','Saves',saves]];
const render=()=>{$('#main').replaceChildren(TABS.find(t=>t[0]===view)[2]());$('#hd').textContent=S?S.name+' · T'+S.turn:'';
$('#nav').replaceChildren(...TABS.map(t=>h('button',{class:t[0]===view?'on':'',onclick:()=>go(t[0])},t[1])))};
const go=async v=>{view=v;if(v==='saves'){SNAPS=await DB.all('snaps');CAMPS=await DB.all('campaigns')}render();scrollTo(0,0)};

(async()=>{try{await DB.open()}catch(e){$('#main').textContent='IndexedDB unavailable: '+e.message;return}
await loadLib();CAMPS=await DB.all('campaigns');CAMPS.forEach(mig);const cur=await DB.get('settings','cur');S=CAMPS.find(c=>c.id===(cur&&cur.v))||CAMPS[0];
if(!S){S=newState('First campaign');await save(S);CAMPS=[S]}
await DB.tx(['settings'],s=>s.put({k:'cur',v:S.id}));
if(regen(S))save(S);render();
setInterval(()=>{if(regen(S)){save(S);if(view==='dash')render()}const e=$('#cd');if(e)e.textContent=cdText()},1000)})();

if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});

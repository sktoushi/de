export /* ---------- IndexedDB ---------- */
const DB=(()=>{let db;const open=()=>new Promise((ok,no)=>{const r=indexedDB.open('decision-empire',1);
r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('campaigns',{keyPath:'id'});d.createObjectStore('adjud',{keyPath:'key'});d.createObjectStore('snaps',{keyPath:'key'});d.createObjectStore('log',{autoIncrement:true});d.createObjectStore('settings',{keyPath:'k'})};
r.onsuccess=()=>{db=r.result;ok()};r.onerror=()=>no(r.error)});
const tx=(ss,fn)=>new Promise((ok,no)=>{const t=db.transaction(ss,'readwrite');fn(...ss.map(s=>t.objectStore(s)));t.oncomplete=()=>ok();t.onerror=t.onabort=()=>no(t.error)});
const rq=(s,fn)=>new Promise((ok,no)=>{const r=fn(db.transaction(s).objectStore(s));r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
return{open,tx,all:s=>rq(s,o=>o.getAll()),get:(s,k)=>rq(s,o=>o.get(k))}})();

export const PREFIX='izone-substitute-skill:v1:';
export class DurableStore{
 constructor(){this.db=null;this.local=false;this.queue=Promise.resolve();this.seq=0;}
 async open(){
  try{const k=PREFIX+'probe',v=crypto.randomUUID();localStorage.setItem(k,v);if(localStorage.getItem(k)!==v)throw Error();localStorage.removeItem(k);this.local=true;}catch{}
  try{this.db=await new Promise((resolve,reject)=>{const r=indexedDB.open('izone-substitute-skill-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=reject;r.onblocked=reject;});}catch{}
  if(!this.db&&!this.local)throw Object.assign(Error('Không lưu được bài trên trình duyệt này. Hãy liên hệ giảng viên trước khi bắt đầu.'),{code:'LOCAL_PERSIST_FAILED'});
  await this.get('current');await this.put('probe',{ok:true});if(!(await this.get('probe'))?.ok)throw Error('LOCAL_PERSIST_FAILED');return this;
 }
 async get(key){
  let local,db;try{local=JSON.parse(localStorage.getItem(PREFIX+key)||'null');}catch{}
  if(this.db)try{db=await new Promise((resolve,reject)=>{const r=this.db.transaction('records').objectStore('records').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=reject;});}catch{}
  const found=!local?db:!db?local:(local._savedSeq??0)>=(db._savedSeq??0)?local:db;
  this.seq=Math.max(this.seq,found?._savedSeq??0);return found??null;
 }
 put(key,value){
  const copy=structuredClone({...value,_savedSeq:++this.seq});let localOk=false;
  if(this.local)try{const raw=JSON.stringify(copy);localStorage.setItem(PREFIX+key,raw);localOk=localStorage.getItem(PREFIX+key)===raw;}catch{}
  const save=async()=>{let dbOk=false;if(this.db)try{await new Promise((resolve,reject)=>{let tx;try{tx=this.db.transaction('records','readwrite',{durability:'strict'});}catch{tx=this.db.transaction('records','readwrite');}tx.oncomplete=resolve;tx.onabort=reject;tx.onerror=reject;tx.objectStore('records').put(copy,key);});dbOk=true;}catch{}
   if(!localOk&&!dbOk)throw Object.assign(Error('Không lưu được bài trên thiết bị. Hãy giữ nguyên trang và liên hệ giảng viên.'),{code:'LOCAL_PERSIST_FAILED'});return copy;};
  const p=this.queue.catch(()=>{}).then(save);this.queue=p;return p;
 }
}

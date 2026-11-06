const PREFIX='izone-listening-retake:v1:';
export class DurableStore{
 constructor(){this.db=null;this.local=false;this.queue=Promise.resolve();}
 async open(){
  try{const k=PREFIX+'probe',v=crypto.randomUUID();localStorage.setItem(k,v);if(localStorage.getItem(k)!==v)throw Error();localStorage.removeItem(k);this.local=true;}catch{}
  try{this.db=await new Promise((resolve,reject)=>{const r=indexedDB.open('izone-listening-retake-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=reject;r.onblocked=reject;});}catch{}
  if(!this.db&&!this.local)throw Object.assign(Error('Không lưu được bài trên trình duyệt này. Hãy liên hệ giảng viên trước khi bắt đầu.'),{code:'LOCAL_PERSIST_FAILED'});
  await this.put('probe',{ok:true});if(!(await this.get('probe'))?.ok)throw Error('LOCAL_PERSIST_FAILED');return this;
 }
 async get(key){
  let local;try{local=JSON.parse(localStorage.getItem(PREFIX+key)||'null');}catch{}
  let db;if(this.db)try{db=await new Promise((resolve,reject)=>{const r=this.db.transaction('records').objectStore('records').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=reject;});}catch{}
  if(!local)return db??null;if(!db)return local;return (local._savedAt??0)>=(db._savedAt??0)?local:db;
 }
 put(key,value){
  const copy=structuredClone({...value,_savedAt:Date.now()});let localOk=false;
  if(this.local)try{const raw=JSON.stringify(copy);localStorage.setItem(PREFIX+key,raw);localOk=localStorage.getItem(PREFIX+key)===raw;}catch{}
  const save=async()=>{
   let dbOk=false;
   if(this.db)try{await new Promise((resolve,reject)=>{let tx;try{tx=this.db.transaction('records','readwrite',{durability:'strict'});}catch{tx=this.db.transaction('records','readwrite');}tx.oncomplete=resolve;tx.onabort=reject;tx.onerror=reject;tx.objectStore('records').put(copy,key);});dbOk=true;}catch{}
   if(!localOk&&!dbOk)throw Object.assign(Error('Không lưu được bài trên thiết bị. Hãy liên hệ giảng viên.'),{code:'LOCAL_PERSIST_FAILED'});
   return copy;
  };
  const p=this.queue.catch(()=>{}).then(save);this.queue=p;return p;
 }
}

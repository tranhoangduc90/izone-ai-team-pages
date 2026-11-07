const LIMIT=128*1024*1024,TTL=86400000;
const ram=new Map();let ramBytes=0,unavailable=false,opening;
function remember(id,bytes){const old=ram.get(id);if(old)ramBytes-=old.bytes.length;ram.delete(id);ram.set(id,{bytes,expiresAt:Date.now()+TTL});ramBytes+=bytes.length;while(ramBytes>LIMIT){const [key,value]=ram.entries().next().value;ram.delete(key);ramBytes-=value.bytes.length;}}
function open(){
 if(unavailable||typeof indexedDB==='undefined')return Promise.reject(Error('CACHE_UNAVAILABLE'));
 if(opening)return opening;
 opening=new Promise((resolve,reject)=>{const r=indexedDB.open('izone-audio-direct-v1',1);const t=setTimeout(()=>{unavailable=true;reject(Error('CACHE_TIMEOUT'));},1500);
  r.onupgradeneeded=()=>{const db=r.result;db.createObjectStore('assets',{keyPath:'hash'});const p=db.createObjectStore('parts',{keyPath:'id'});p.createIndex('hash','hash');};
  r.onerror=r.onblocked=()=>{clearTimeout(t);unavailable=true;reject(Error('CACHE_UNAVAILABLE'));};
  r.onsuccess=()=>{clearTimeout(t);if(unavailable){r.result.close();return;}r.result.onversionchange=()=>{r.result.close();opening=null;};resolve(r.result);};
 });return opening;
}
async function transaction(mode,fn){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(['assets','parts'],mode);let value;const t=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('CACHE_TIMEOUT'));},1500);tx.oncomplete=()=>{clearTimeout(t);resolve(value);};tx.onerror=tx.onabort=()=>{clearTimeout(t);reject(Error('CACHE_FAILED'));};fn(tx,v=>value=v);});}
export function createDirectCache(){
 const reserved=new Set();
 return {
  async get(asset,index){const id=asset.sha256+':'+index,r=ram.get(id);if(r&&r.expiresAt>Date.now())return r.bytes;
   try{return await transaction('readonly',(tx,out)=>{const q=tx.objectStore('parts').get(id);q.onsuccess=()=>{const v=q.result;if(v?.expiresAt>Date.now())out(new Uint8Array(v.bytes));};});}catch{unavailable=true;return null;}
  },
  async put(asset,index,bytes){const id=asset.sha256+':'+index;remember(id,bytes);
   try{
    if(!reserved.has(asset.sha256)){
     await transaction('readwrite',tx=>{const meta=tx.objectStore('assets'),parts=tx.objectStore('parts'),q=meta.getAll();q.onsuccess=()=>{
      const now=Date.now(),rows=q.result.filter(x=>x.hash!==asset.sha256).sort((a,b)=>a.expiresAt-b.expiresAt);let total=rows.reduce((n,x)=>n+x.byteLength,asset.byteLength);
      for(const row of rows){if(row.expiresAt>now&&total<=LIMIT)continue;total-=row.byteLength;meta.delete(row.hash);const keys=parts.index('hash').openKeyCursor(IDBKeyRange.only(row.hash));keys.onsuccess=()=>{const c=keys.result;if(c){parts.delete(c.primaryKey);c.continue();}};}
      meta.put({hash:asset.sha256,byteLength:asset.byteLength,expiresAt:now+TTL});
     };});reserved.add(asset.sha256);
    }
    await transaction('readwrite',tx=>tx.objectStore('parts').put({id,hash:asset.sha256,expiresAt:Date.now()+TTL,bytes}));return true;
   }catch{unavailable=true;return false;}
  }
 };
}

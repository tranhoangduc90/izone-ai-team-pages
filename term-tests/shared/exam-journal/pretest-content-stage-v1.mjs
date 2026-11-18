// Isolated browser candidate for choosing one durable content destination.
// No network calls occur here. A sender may only see entries after promotion.
import { canonical } from './sealed-batch.mjs';

const encoder = new TextEncoder();
const byteSize = value => encoder.encode(canonical(value)).byteLength;
const contentTypes = new Set(['content_checkpoint','content_changed']);
const scopePattern = /^[a-f0-9]{64}$/;
const maxEventBytes = 94 * 1024;
export const maxContentBatchBytes=44*1024;
const maxContentBatchCount=40;
const maxPinnedBytes=256*1024;
const makeKey = (binding, id) => [binding,id];
const readyRow = (pending, {destination,events,pilotId}, readyAt)=>({binding:pending.binding,id:pending.id,inputHash:pending.inputHash,
  state:'ready',auth:pending.auth,destination,events,offset:0,readyAt,...(pilotId?{pilotId}:{})});
const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(canonical(value)))),
  byte=>byte.toString(16).padStart(2,'0')).join('');
const sameIds=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&canonical([...a].sort())===canonical([...b].sort());

export class PretestContentStage {
  constructor(name,{maxBytes=2*1024*1024,indexedDB=globalThis.indexedDB,now=()=>Date.now()}={}) {
    this.maxBytes=maxBytes;
    this.now=now;
    this.ready=new Promise((resolve,reject)=>{
      const request=indexedDB.open(name,2);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains('content')){
          const rows=db.createObjectStore('content',{keyPath:['binding','id']});
          rows.createIndex('binding','binding');
          db.createObjectStore('usage');
        }
        db.createObjectStore('batches',{keyPath:['binding','destination']});
      };
      request.onsuccess=()=>{
        this.db=request.result;
        this.db.onversionchange=()=>this.db.close();
        resolve();
      };
      request.onerror=()=>reject(Error('CONTENT_STAGE_DB_UNAVAILABLE'));
      request.onblocked=()=>reject(Error('CONTENT_STAGE_DB_BLOCKED'));
    });
  }

  async transact(mode, work) {
    await this.ready;
    return new Promise((resolve,reject)=>{
      const tx=this.db.transaction(['content','usage','batches'],mode,mode==='readwrite'?{durability:'strict'}:{});
      const stores={content:tx.objectStore('content'),usage:tx.objectStore('usage'),batches:tx.objectStore('batches')};
      let result, failure;
      const done=value=>{result=value;};
      const fail=error=>{failure=error;tx.abort();};
      tx.oncomplete=()=>resolve(result);
      tx.onabort=()=>reject(failure||tx.error||Error('CONTENT_STAGE_TRANSACTION_ABORTED'));
      const read=(request,callback)=>{
        request.onsuccess=()=>{try{callback(request.result);}catch(error){fail(error);}};
      };
      try{work({stores,read,done,fail});}catch(error){fail(error);}
    });
  }

  async stage(rows) {
    if(!rows.length||rows.length>32) throw Error('CONTENT_STAGE_INVALID_BATCH');
    // Hash the original before deciding the destination. A reused event ID with
    // other bytes cannot replace either a pending or a promoted record.
    const pending=await Promise.all(rows.map(async ({binding,event,auth})=>{
      if(!scopePattern.test(binding)||!contentTypes.has(event.type)||byteSize(event)>maxEventBytes) throw Error('CONTENT_STAGE_INVALID_EVENT');
      const inputHash=await sha(event);
      const row={binding,id:event.id,inputHash,state:'pending',event,auth};
      const fallback=readyRow(row,{destination:'collector-v1',events:[event]},this.now());
      return {...row,bytes:Math.max(byteSize(row),byteSize(fallback))};
    }));
    return this.transact('readwrite',({stores,read,done,fail})=>{
      read(stores.usage.get('bytes'),previous=>{
        let total=previous||0;
        let cursor=0;
        const next=()=>{
          if(cursor===pending.length){stores.usage.put(total,'bytes');done(true);return;}
          const row=pending[cursor++];
          read(stores.content.get(makeKey(row.binding,row.id)),old=>{
            if(old && old.inputHash!==row.inputHash) return fail(Error('CONTENT_STAGE_ID_CONFLICT'));
            if(!old){
              total+=row.bytes;
              if(total>this.maxBytes) return fail(Error('CONTENT_STAGE_FULL'));
              stores.content.add(row);
            }
            next();
          });
        };
        next();
      });
    });
  }

  get(binding,id) {return this.transact('readonly',({stores,read,done})=>read(stores.content.get(makeKey(binding,id)),done));}

  list(binding) {return this.transact('readonly',({stores,read,done})=>read(stores.content.index('binding').getAll(binding),done));}

  async choose(binding,id,decide) {
    const pending=await this.get(binding,id);
    if(!pending||pending.state!=='pending') return pending;
    const choice=await decide(pending);
    if(!['pubsub-v1','collector-v1'].includes(choice.destination)||!Array.isArray(choice.events)||!choice.events.length) {
      throw Error('CONTENT_STAGE_INVALID_DESTINATION');
    }
    if(choice.pilotId && (choice.destination!=='pubsub-v1'||!/^pretest-content-[a-zA-Z0-9_-]{1,24}$/.test(choice.pilotId))) {
      throw Error('CONTENT_STAGE_INVALID_PILOT');
    }
    if(choice.destination==='collector-v1' && canonical(choice.events)!==canonical([pending.event])) throw Error('CONTENT_STAGE_COLLECTOR_CHANGED');
    if(choice.destination==='pubsub-v1' && choice.events.some(event=>event.type!=='content_sealed_v1' ||
      event.data?.checkpointState?.contentId!==id||event.pageVisitId!==pending.event.pageVisitId)) throw Error('CONTENT_STAGE_WRONG_CONTENT');
    const output=readyRow(pending,choice,this.now());
    const ready={...output,bytes:byteSize(output)};
    // Concurrent readwrite transactions serialize. The winner replaces the raw
    // content with the immutable send record in the same transaction.
    return this.transact('readwrite',({stores,read,done,fail})=>{
      read(stores.content.get(makeKey(binding,id)),latest=>{
        if(!latest||latest.state!=='pending') return done(latest);
        if(latest.inputHash!==pending.inputHash) return fail(Error('CONTENT_STAGE_ID_CONFLICT'));
        read(stores.usage.get('bytes'),total=>{
          const adjusted=total-latest.bytes+ready.bytes;
          if(adjusted>this.maxBytes) return fail(Error('CONTENT_STAGE_FULL'));
          stores.content.put(ready);
          stores.usage.put(adjusted,'bytes');
          done(ready);
        });
      });
    });
  }

  async reserve(binding,destination,{force=false,waitMs=120_000}={}){
    const key=[binding,destination];
    const snapshot=await this.transact('readonly',({stores,read,done})=>{
      read(stores.batches.get(key),batch=>{
        if(batch)return done({batch});
        read(stores.content.index('binding').getAll(binding),rows=>done({rows}));
      });
    });
    if(snapshot.batch)return snapshot.batch;
    const ready=snapshot.rows.filter(row=>row.state==='ready'&&row.destination===destination)
      .sort((a,b)=>a.readyAt-b.readyAt || a.id.localeCompare(b.id));
    const events=[],parts=[];
    const pilotId=ready[0]?.pilotId;
    let bytes=2,full=false;
    for(const row of ready){
      if(row.pilotId!==pilotId){full=true;break;}
      let count=0;
      const from=row.offset??0;
      for(const event of row.events.slice(from)){
        const size=byteSize(event)+1;
        if(bytes+size>maxContentBatchBytes||events.length>=maxContentBatchCount){full=true;break;}
        events.push(event);count++;bytes+=size;
      }
      if(count)parts.push({id:row.id,from,count,inputHash:row.inputHash});
      if(full)break;
    }
    if(!events.length || (!full&&events.length<maxContentBatchCount&&!force&&this.now()-ready[0].readyAt<waitMs)) return null;
    const ids=events.map(event=>event.id).sort();
    if(new Set(ids).size!==ids.length)throw Error('CONTENT_STAGE_BATCH_DUPLICATED');
    const result={binding,destination,events,parts,ids,...(pilotId?{pilotId}:{}),
      batchId:await sha([binding,ids]),eventPayloadSha256:await sha(events)};
    const batch={...result,bytes:byteSize(result)};
    return this.transact('readwrite',({stores,read,done,fail})=>{
      read(stores.batches.get(key),winner=>{
        if(winner)return done(winner);
        let index=0,eventIndex=0;
        const check=()=>{
          if(index===parts.length){
            return read(stores.usage.get('batch-bytes'),previous=>{
              const total=previous||0;
              if(total+batch.bytes>maxPinnedBytes)return fail(Error('CONTENT_STAGE_BATCH_FULL'));
              stores.batches.add(batch);
              stores.usage.put(total+batch.bytes,'batch-bytes');
              done(batch);
            });
          }
          const part=parts[index++];
          read(stores.content.get(makeKey(binding,part.id)),current=>{
            if(!current||current.state!=='ready'||current.destination!==destination||current.pilotId!==pilotId||
              current.inputHash!==part.inputHash||(current.offset??0)!==part.from||
              canonical(current.events.slice(part.from,part.from+part.count))!==canonical(events.slice(eventIndex,eventIndex+part.count)))return done(null);
            eventIndex+=part.count;
            check();
          });
        };
        check();
      });
    });
  }

  async acknowledge(batch,ack){
    const storage=batch.destination==='pubsub-v1'?'pubsub':'collector';
    if(ack?.ok!==true||ack.persisted!==true||ack.scopeId!==batch.binding||ack.storage!==storage||
      ack.batchId!==batch.batchId||ack.eventPayloadSha256!==batch.eventPayloadSha256||!sameIds(ack.acknowledgedIds,batch.ids)||
      (storage==='pubsub'&&(typeof ack.messageId!=='string'||!/^\d+$/.test(ack.messageId))))throw Error('CONTENT_STAGE_ACK_MISMATCH');
    const key=[batch.binding,batch.destination];
    return this.transact('readwrite',({stores,read,done,fail})=>{
      read(stores.batches.get(key),current=>{
        if(!current||current.batchId!==batch.batchId)return done(false);
        if(current.eventPayloadSha256!==batch.eventPayloadSha256)return fail(Error('CONTENT_STAGE_ACK_MISMATCH'));
        let index=0,released=0;
        const next=()=>{
          if(index===current.parts.length){
            return read(stores.usage.get('bytes'),total=>{
              if(total<released)return fail(Error('CONTENT_STAGE_USAGE_MISMATCH'));
              stores.usage.put(total-released,'bytes');
              read(stores.usage.get('batch-bytes'),pinned=>{
                if(pinned<current.bytes)return fail(Error('CONTENT_STAGE_USAGE_MISMATCH'));
                stores.usage.put(pinned-current.bytes,'batch-bytes');
                stores.batches.delete(key);
                done(true);
              });
            });
          }
          const part=current.parts[index++];
          const contentKey=makeKey(batch.binding,part.id);
          read(stores.content.get(contentKey),row=>{
            if(!row||row.inputHash!==part.inputHash||(row.offset??0)!==part.from||row.destination!==batch.destination){
              return fail(Error('CONTENT_STAGE_ACK_SCOPE_MISMATCH'));
            }
            const offset=part.from+part.count;
            if(offset===row.events.length){released+=row.bytes;stores.content.delete(contentKey);}
            else if(offset<row.events.length)stores.content.put({...row,offset});
            else return fail(Error('CONTENT_STAGE_ACK_SCOPE_MISMATCH'));
            next();
          });
        };
        next();
      });
    });
  }

  async close(){await this.ready;this.db.close();}
}

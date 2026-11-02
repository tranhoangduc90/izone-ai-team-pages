import path from 'node:path';
import {pathToFileURL} from 'node:url';
const paragraph=text=>({runs:[{text}]});
/** Synthetic native bundles, registered and validated by each real product engine. */
export async function installPracticeAuthoredContent({fixture:f,product,productRoot,variant}){
 if(!['authored','full'].includes(variant))throw Error('FIXTURE_VARIANT_INVALID');
 const {registerAuthoredLesson}=await import(pathToFileURL(path.join(productRoot,'src/authored-content.js')));
 const {secret,emptyDraft}=await import(pathToFileURL(path.join(productRoot,'src/domain.js')));
 const full=variant==='full',listening=product==='listening',code=`67-practice-${product}_result-observer-${variant}`;
 const ranges=full?(listening?[[1,10],[11,20],[21,30],[31,40]]:[[1,13],[14,26],[27,40]]):[[1,4]];
 const parts=ranges.map(([start,end],index)=>({id:'p'+(index+1),label:'Passage '+(index+1),title:'Synthetic section '+(index+1),start,end,paragraphs:[full?'p'+(index+1)+'_A':'A'],labels:{[full?'p'+(index+1)+'_A':'A']:'A'}}));
 const groups=ranges.map(([start,end],index)=>({id:'group'+index,kind:'completion',label:'Note Completion',start,end,instruction:'ONE WORD ONLY',maxWords:1,questions:Array.from({length:end-start+1},(_,n)=>({n:start+n,text:'The source identifies a ___.',maxWords:1}))}));
 const audioMs=459207,reviewMs=120000,totalMs=listening?audioMs+reviewMs:full?3600000:1200000;
 const lesson=registerAuthoredLesson({code,lesson:full?976:975,title:'Synthetic '+product+' '+variant,totalMs,paragraphs:parts.flatMap(part=>part.paragraphs),groups:groups.map(({questions,...group})=>group),
  ...(listening?{audioMs,reviewMs,...(full?{parts:parts.map((part,index)=>({id:'part'+(index+1),title:'Part '+(index+1),start:part.start,end:part.end,startMs:Math.floor(index*audioMs/4),endMs:Math.floor((index+1)*audioMs/4)}))}:{})}:full?{passages:parts}:{})});
 const passage=Object.fromEntries(parts.map(part=>[part.paragraphs[0],'The river flows here. '+'Synthetic source sentence. '.repeat(40)]));
 const ids=lesson.questionIds,key=Object.fromEntries(ids.map(n=>[n,['river']]));
 const entries=Object.fromEntries(ids.map(n=>{const part=parts.find(part=>+n>=part.start&&+n<=part.end);return[n,{number:+n,kind:'completion',answer:key[n],prompt:paragraph('Synthetic fixture question '+n),reason:[paragraph('Synthetic fixture reasoning. '.repeat(40))],evidenceGroups:[{paragraph:part.paragraphs[0],speaker:'',paragraphs:[paragraph(passage[part.paragraphs[0]])],marks:[{start:4,end:9,background:'#fff2cc'}]}]}];}));
 const content={code,version:'synthetic-'+variant+'-v1',totalMs,key,explanations:{entries,...(listening?{passage}:{})},definition:{authored:true,lesson,groups,mcq:[],...(listening?{audio:{durationMs:audioMs,sha256:'0'.repeat(64)}}:{passage})}};
 await f.service.seedContent(content);const entryToken=secret(),registration={...f.registration,documentId:`fixture_${product}_${variant}_1234567890`,code,contentVersion:content.version,entryToken};
 const registered=await f.service.register(registration);await f.pool.query(`UPDATE ${product}_practice.assignment SET status='open'`);await f.pool.query(`UPDATE ${product}_practice.binding SET cta_verified_at=now()`);
 const logged=await f.service.login({entryToken,studentRef:f.studentRef,classCode:registration.classCode});
 await f.pool.query(`DELETE FROM ${product}_practice.doc_job WHERE binding_id<>$1`,[registered.bindingId]);
 Object.assign(f,{content,registration,registered,entryToken,token:logged.token,draft:()=>emptyDraft(code),contentVariant:variant});
}
export function practiceFixtureReview(content){
 const replay=n=>({id:'clip-'+n,question:+n,startMs:1000,endMs:30000,wordStart:0,wordEnd:1,marks:{},paragraphs:[paragraph('Synthetic fixture transcript.')]});
 return{audioSha256:content.definition.audio.sha256,audioDurationMs:content.definition.audio.durationMs,contentVersion:content.version,questionIds:Object.keys(content.key),
  words:[{word:'Synthetic fixture transcript.',start:1,end:30}],segments:[{id:'synthetic-segment',wordStart:0,wordEnd:1,start:1,end:30}],questions:Object.fromEntries(Object.keys(content.key).map(n=>[n,{replay:[replay(n)],optionReplay:{}}]))};
}

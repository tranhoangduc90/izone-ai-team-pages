import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createSpeakingRequestWindow,startSpeakingHomeworkJournal} from '../shared/speaking-homework-journal.mjs';
const response=(status,id=randomUUID())=>({status,ok:status>=200&&status<300,headers:{get:()=>id}});
function fixture(){let at=0;const rows=[];const window=createSpeakingRequestWindow({emit:(kind,data,traceId,requestId)=>rows.push({kind,data,traceId,requestId}),now:()=>at,makeId:randomUUID});return{window,rows,advance:ms=>{at+=ms;}};}

test('Speaking capture counts 100 reads and emits unchanged state once, with no per-poll request record',()=>{
 const f=fixture(),data={ok:true,status:'draft',links:[],practiceLinks:[],docsProgress:{status:'pending'},private:'PRIVATE_BODY'};
 for(let n=0;n<100;n++){const request=f.window.begin('/open',{});f.advance(1);request.finish({response:response(200),data});}
 f.window.flush(true);assert.equal(f.rows.filter(r=>r.kind==='client.request').length,0);
 assert.equal(f.rows.filter(r=>r.kind==='client.state').length,2);
 assert.deepEqual(f.rows.find(r=>r.kind==='performance.summary').data,{operations:0,requests:100,retries:0,polls:100,streamConnections:0,headerOnlyRequests:0,unclassifiedRequests:0,pendingRequests:0,durationMs:100,coverage:'poster_only'});
 assert.ok(!JSON.stringify(f.rows).includes('PRIVATE_BODY'));
});
test('Speaking capture joins unknown-result retry by RAM-only input key and preserves distinct transmission IDs',()=>{
 const f=fixture(),body={url:'https://chatgpt.com/share/PRIVATE_SHARE',accessToken:'PRIVATE_TOKEN',studentRef:randomUUID(),part:'part_1'};
 const first=f.window.begin('/checks/request',body);first.finish({error:{name:'TimeoutError',message:'PRIVATE_ERROR'}});
 const second=f.window.begin('/checks/request',body),header=randomUUID(),linkId=randomUUID();assert.equal(first.traceId,second.traceId);assert.notEqual(first.requestId,second.requestId);
 f.advance(10);second.finish({response:response(202,header),data:{ok:true,check:{id:linkId,status:'pending'},private:'PRIVATE_AI'}});second.finish();f.window.flush(true);
 const requests=f.rows.filter(row=>row.kind==='client.request');assert.equal(requests.length,2);assert.equal(requests[1].requestId,header);assert.equal(requests[1].data.serverRequestIdObserved,true);
 const summary=f.rows.find(row=>row.kind==='performance.summary').data;assert.equal(summary.operations,1);assert.equal(summary.requests,2);assert.equal(summary.retries,1);
 for(const value of ['PRIVATE_SHARE','PRIVATE_TOKEN','PRIVATE_ERROR','PRIVATE_AI'])assert.ok(!JSON.stringify(f.rows).includes(value));
});
test('Speaking capture keeps late completions in their original window and reports pending separately',()=>{
 const a=fixture(),b=fixture(),first=a.window.begin('/finish',{});a.window.flush(true);
 assert.equal(a.rows.at(-1).data.pendingRequests,1);assert.equal(a.rows.at(-1).data.requests,0);
 const next=b.window.begin('/finish',{});next.finish({response:response(409),data:{ok:false}});b.window.flush(true);
 first.finish({response:response(200),data:{ok:true,receipt:{id:randomUUID()}}});a.window.flush(true);
 assert.equal(a.rows.filter(row=>row.kind==='client.request')[0].data.outcome,'ok');
 assert.equal(b.rows.filter(row=>row.kind==='client.request')[0].data.outcome,'http_error');
 assert.equal(a.rows.at(-1).data.requests,1);assert.equal(a.rows.at(-1).data.pendingRequests,0);
});
test('Speaking observed snapshots and Docs updates emit only useful metadata changes',()=>{
 const f=fixture(),open={status:'draft',links:[],practiceLinks:[],docsProgress:{status:'pending'},documentId:'PRIVATE_DOC',text:'PRIVATE_TEXT'};
 for(let n=0;n<10;n++)f.window.observe({open});f.window.observe({docs:{status:'verified',sequence:'2',applied_sequence:'2'}});
 assert.deepEqual(f.rows.map(row=>[row.data.phase,row.data.state]),[['snapshot','pending'],['docs_observed','pending'],['docs_observed','verified']]);
 assert.ok(!JSON.stringify(f.rows).includes('PRIVATE_'));
});
test('Speaking capture off never touches browser facilities; unavailable browser runtime fails closed for logger only',async()=>{
 const env=new Proxy({},{get(){throw Error('MUST_NOT_TOUCH');}}),off=startSpeakingHomeworkJournal({enabled:false,env});
 off.opened({});assert.equal(off.begin('/finish',{}),null);await off.stop();
 const legacy=startSpeakingHomeworkJournal({enabled:true,env});legacy.opened({independent:false});await legacy.stop();
 const unavailable=startSpeakingHomeworkJournal({enabled:true,env:{}});assert.equal(unavailable.begin('/finish',{}),null);await unavailable.stop();
});

test('Speaking observer HTTP headers count connections without claiming a valid body or exposing parsing errors',()=>{
 const f=fixture();
 for(const path of ['/observation/student/events','/observation/student/view'])f.window.begin(path,{}).finish({response:response(200),data:{ok:true},phase:'headers'});
 f.window.observe({error:{name:'SyntaxError',message:'PRIVATE_RESPONSE'}});f.window.flush(true);
 const summary=f.rows.find(row=>row.kind==='performance.summary').data;assert.equal(summary.requests,2);assert.equal(summary.streamConnections,1);assert.equal(summary.polls,1);assert.equal(summary.headerOnlyRequests,2);
 assert.equal(f.rows.find(row=>row.kind==='client.state').data.errorCode,'BODY_PARSE_FAILED');assert.ok(!JSON.stringify(f.rows).includes('PRIVATE_RESPONSE'));
});

test('Speaking capture does not invent a timeout cause for an unclassified abort',()=>{
 const f=fixture();f.window.begin('/finish',{}).finish({error:{name:'AbortError'}});
 assert.equal(f.rows.find(row=>row.kind==='client.request').data.outcome,'aborted');
});

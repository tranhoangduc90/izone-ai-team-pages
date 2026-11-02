import path from 'node:path';
import {pathToFileURL} from 'node:url';
/** Synthetic Google boundary; production claim/write/readback/commit notification code remains native. */
export async function createPracticeResultDocs({fixture:f,productRoot,hub}){
 const {createDocsWorker,CTA,STATUS_HEADING}=await import(pathToFileURL(path.join(productRoot,'src/docs.js')));
 const {registerWorkPublisher}=await import(pathToFileURL(path.join(productRoot,'src/test-work-runtime.js')));
 let text='',links=[],version=1,reads=0,writes=0;const signals=[];
 const paragraph=(index,value,marks=[])=>{
  const ends=[0,value.length,...marks.flatMap(mark=>[mark.start,mark.end])].sort((a,b)=>a-b),parts=[];
  for(let n=1;n<ends.length;n++){const start=ends[n-1],end=ends[n];if(start===end)continue;const link=marks.find(mark=>mark.start<=start&&mark.end>=end);parts.push({startIndex:index+start,endIndex:index+end,textRun:{content:value.slice(start,end),textStyle:link?{link:{url:link.url}}:{}}});}
  return{startIndex:index,endIndex:index+value.length+1,paragraph:{elements:[...parts,{startIndex:index+value.length,endIndex:index+value.length+1,textRun:{content:'\n',textStyle:{}}}]}};
 };
 const docs={
  async read(id){reads++;if(id!==f.registration.documentId)throw Error('FIXTURE_DOCUMENT_MISMATCH');return{documentId:id,revisionId:'fixture-'+version,tabs:[{tabProperties:{tabId:f.registration.tabId},documentTab:{body:{content:[
   paragraph(1,f.content.code),paragraph(100,CTA,[{start:0,end:CTA.length,url:f.registered.entryUrl}]),
   {table:{tableRows:[{tableCells:[{content:[paragraph(200,STATUS_HEADING)]}]},{tableCells:[{content:[paragraph(300,text,links)]}]}]}}
  ]}}}]};},
  async write(id,plan){if(id!==f.registration.documentId||plan.revisionId!=='fixture-'+version)throw Error('FIXTURE_WRITE_REVISION_MISMATCH');writes++;
   for(const request of plan.requests){
    if(request.deleteContentRange){const range=request.deleteContentRange.range;assertRange(range.startIndex,range.endIndex);text=text.slice(0,range.startIndex-300)+text.slice(range.endIndex-300);links=[];}
    if(request.insertText){const {location,text:insert}=request.insertText;assertRange(location.index,location.index);const offset=location.index-300;text=text.slice(0,offset)+insert+text.slice(offset);}
    if(request.updateTextStyle){const {range,textStyle,fields}=request.updateTextStyle;assertRange(range.startIndex,range.endIndex);if(fields.split(',').includes('link')){links=links.filter(mark=>mark.end<=range.startIndex-300||mark.start>=range.endIndex-300);if(textStyle.link)links.push({start:range.startIndex-300,end:range.endIndex-300,url:textStyle.link.url});}}
   }version++;
  }
 };
 function assertRange(start,end){if(start<300||end<start||end>300+text.length)throw Error('FIXTURE_STATUS_RANGE_INVALID');}
 const detach=registerWorkPublisher(f.pool,lane=>{signals.push(lane);hub.wake();}),worker=createDocsWorker({pool:f.pool,docs});
 return{async drain(){for(let n=0;n<32;n++){const [job]=await worker.claim(1);if(!job)break;await worker.run(job);const row=(await f.pool.query(`SELECT status,error_code FROM ${productRoot.endsWith('reading-practice')?'reading_practice':'listening_practice'}.doc_job WHERE id=$1`,[job.id])).rows[0];if(row.status!=='verified')throw Error('FIXTURE_DOCS_NOT_VERIFIED:'+row.error_code);}return{reads,writes,signals:[...signals],text};},close:detach,snapshot:()=>({reads,writes,signals:[...signals],text})};
}

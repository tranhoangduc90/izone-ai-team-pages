import {createExamAudioMilestones} from '../../shared/audio/exam-audio-milestones-audio-status-v1.mjs?v=20261111-audio-milestones-v2';
import {downloadDirect} from '../../shared/audio/direct-audio-status-v1.mjs?v=20261111-audio-milestones-v2';

// The capability is transient. Only the verified Blob reaches the exam store.
export async function downloadTermAudio(slug,metadata,options={}){
 const journal=createExamAudioMilestones({assetId:slug,sha256:metadata.sha256,byteLength:metadata.bytes},typeof options.onPhase==='function');
 const onMilestone=journal||options.onMilestone?row=>{
  journal?.event(row);
  try{options.onMilestone?.(row);}catch{}
 }:undefined;
 try{
  const blob=await loadTermAudio(slug,metadata,{...options,onMilestone});
  journal?.complete(blob);
  return blob;
 }catch(error){journal?.fail(error);throw error;}
}
async function loadTermAudio(slug,metadata,{audioDownload,signal,onProgress=()=>{},onPhase,onMilestone,fetchImpl=fetch,refresh}){
 const manifest={envelopeVersion:'MP3',url:metadata.pagesUrl,sha256:metadata.sha256,byteLength:metadata.bytes};
 if(audioDownload){
  let pagesAttempted=false;
  try{
   const blob=await downloadDirect(manifest,audioDownload,{termSlug:slug,signal,fetchImpl,refresh,onPhase,onMilestone,
    onProgress:progress=>onProgress({...progress,complete:false}),
    onEvent:event=>{if(event.source==='pages')pagesAttempted=true;}});
   onProgress({loaded:blob.size,total:blob.size,complete:true,verified:true});
   return blob;
  }catch(error){
   if(signal?.aborted||error.accessDenied)throw error;
   if(pagesAttempted)throw Object.assign(Error('Chưa tải được audio đã kiểm từ cả hai nguồn. Hãy thử lại hoặc liên hệ giảng viên.'),{cause:error});
   onMilestone?.({phase:'source_switch_started',source:'pages'});
   onPhase?.('Đang chuyển sang nguồn dự phòng…');
  }
 }
 return downloadWhole({signal,onProgress,onPhase,onMilestone,fetchImpl,url:metadata.pagesUrl,metadata});
}

async function downloadWhole({signal,onProgress,onPhase,onMilestone,fetchImpl,idleMs=10000,totalMs=120000,url,metadata}){
  signal?.throwIfAborted();
  const controller=new AbortController(),abort=()=>controller.abort(signal.reason);signal?.addEventListener('abort',abort,{once:true});
  let idle=setTimeout(()=>controller.abort(),idleMs);const total=setTimeout(()=>controller.abort(),totalMs);
  try{
   onPhase?.('Đang chờ dữ liệu âm thanh…');
   const response=await fetchImpl(url,{credentials:'omit',signal:controller.signal,cache:'no-store',referrerPolicy:'no-referrer'});
   if(!response.ok)throw Object.assign(Error('Nguồn audio trả HTTP '+response.status),{status:response.status});
   const reader=response.body.getReader(),chunks=[];let loaded=0;
   while(true){const {value,done}=await reader.read();if(done)break;clearTimeout(idle);idle=setTimeout(()=>controller.abort(),idleMs);if(loaded===0&&value.byteLength)onMilestone?.({phase:'first_byte',source:'pages',wireBytes:value.byteLength});chunks.push(value);loaded+=value.byteLength;
    if(loaded>metadata.bytes)throw Error('Audio vượt kích thước đã ghim.');onProgress({loaded,total:metadata.bytes,source:'pages',complete:false});}
   if(loaded===metadata.bytes){
    onMilestone?.({phase:'verification_started',source:'verified_file'});
    onPhase?.('Đã tải đủ. Đang kiểm tra tệp âm thanh…');
   }
   const blob=new Blob(chunks,{type:'audio/mpeg'}),sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');
   if(blob.size!==metadata.bytes||sha!==metadata.sha256)throw Error('File audio không khớp byte/hash.');
   controller.signal.throwIfAborted();
   onProgress({loaded,total:metadata.bytes,complete:true,source:'pages'});return blob;
  }catch(error){
   signal?.throwIfAborted();
   throw Object.assign(Error('Chưa tải được audio đã kiểm. Hãy thử lại hoặc liên hệ giảng viên.'),{cause:error});
  }
  finally{clearTimeout(idle);clearTimeout(total);signal?.removeEventListener('abort',abort);controller.abort();}
}

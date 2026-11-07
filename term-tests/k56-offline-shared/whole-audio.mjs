import {downloadDirect} from '../../shared/audio/direct.mjs?v=20261107-mini-v1';

// The capability is transient. Only the verified Blob reaches the exam store.
export async function downloadTermAudio(slug,metadata,{audioDownload,signal,onProgress=()=>{},fetchImpl=fetch,refresh}={}){
 const manifest={envelopeVersion:'MP3',url:metadata.pagesUrl,sha256:metadata.sha256,byteLength:metadata.bytes};
 if(audioDownload){
  let pagesAttempted=false;
  try{
   const blob=await downloadDirect(manifest,audioDownload,{termSlug:slug,signal,fetchImpl,refresh,
    onProgress:progress=>onProgress({...progress,complete:false}),
    onEvent:event=>{if(event.source==='pages')pagesAttempted=true;}});
   onProgress({loaded:blob.size,total:blob.size,complete:true});
   return blob;
  }catch(error){
   if(signal?.aborted||error.accessDenied)throw error;
   if(pagesAttempted)throw Object.assign(Error('Chưa tải được audio đã kiểm từ cả hai nguồn. Hãy thử lại hoặc liên hệ giảng viên.'),{cause:error});
  }
 }
 return downloadWhole({signal,onProgress,fetchImpl,url:metadata.pagesUrl,metadata});
}

async function downloadWhole({signal,onProgress,fetchImpl,idleMs=10000,totalMs=120000,url,metadata}){
  signal?.throwIfAborted();
  const controller=new AbortController(),abort=()=>controller.abort(signal.reason);signal?.addEventListener('abort',abort,{once:true});
  let idle=setTimeout(()=>controller.abort(),idleMs);const total=setTimeout(()=>controller.abort(),totalMs);
  try{
   const response=await fetchImpl(url,{credentials:'omit',signal:controller.signal,cache:'no-store',referrerPolicy:'no-referrer'});
   if(!response.ok)throw Object.assign(Error('Nguồn audio trả HTTP '+response.status),{status:response.status});
   const reader=response.body.getReader(),chunks=[];let loaded=0;
   while(true){const {value,done}=await reader.read();if(done)break;clearTimeout(idle);idle=setTimeout(()=>controller.abort(),idleMs);chunks.push(value);loaded+=value.byteLength;
    if(loaded>metadata.bytes)throw Error('Audio vượt kích thước đã ghim.');onProgress({loaded,total:metadata.bytes,source:'pages',complete:false});}
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

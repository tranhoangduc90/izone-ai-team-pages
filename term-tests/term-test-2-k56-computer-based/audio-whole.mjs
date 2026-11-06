// Tải nguyên file trước thi: Pages trước, Cloudinary dự phòng; không giữ quyền API.
export const AUDIO={bytes:29173785,sha256:'3600563c0af62fd5c9656be0d7b7f52a1bae281d6af1de80ba4fe0de523f92af',
 sources:['https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/k56-audio-assets/term-test-2-k56-3600563c0af62fd5.mp3','https://res.cloudinary.com/dhvgrthes/video/upload/v1793958877/term-test-2-k56_kqfl62.mp3']};
export async function downloadWhole({signal,onProgress=()=>{},fetchImpl=fetch,idleMs=10000,totalMs=120000,sources=AUDIO.sources,metadata=AUDIO}={}){
 let last;
 for(const [index,url] of sources.entries()){
  if(signal?.aborted)throw signal.reason||new DOMException('Đã hủy','AbortError');
  const controller=new AbortController(),abort=()=>controller.abort(signal.reason);signal?.addEventListener('abort',abort,{once:true});
  let idle=setTimeout(()=>controller.abort(),idleMs);const total=setTimeout(()=>controller.abort(),totalMs);
  try{
   const response=await fetchImpl(url,{credentials:'omit',signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw Object.assign(Error('Nguồn audio trả HTTP '+response.status),{status:response.status});
   const reader=response.body.getReader(),chunks=[];let loaded=0;
   while(true){const {value,done}=await reader.read();if(done)break;clearTimeout(idle);idle=setTimeout(()=>controller.abort(),idleMs);chunks.push(value);loaded+=value.byteLength;
    if(loaded>metadata.bytes)throw Error('Audio vượt kích thước đã ghim.');onProgress({loaded,total:metadata.bytes,source:index?'cloudinary':'pages',complete:false});}
   const blob=new Blob(chunks,{type:'audio/mpeg'}),sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');
   if(blob.size!==metadata.bytes||sha!==metadata.sha256)throw Error('File audio không khớp byte/hash.');
   onProgress({loaded,total:metadata.bytes,complete:true,source:index?'cloudinary':'pages'});return blob;
  }catch(e){last=e;if(signal?.aborted)throw signal.reason||e;}
  finally{clearTimeout(idle);clearTimeout(total);signal?.removeEventListener('abort',abort);controller.abort();}
 }
 throw Object.assign(Error('Chưa tải được audio đã kiểm từ cả hai nguồn. Hãy thử lại hoặc liên hệ giảng viên.'),{cause:last});
}

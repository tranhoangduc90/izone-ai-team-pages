// Nhận thao tác UI; gửi đúng API riêng và token trong header, không đặt trong URL.
// Retry một lần cùng requestId khi mất ACK. HTTP lỗi giữ mã để UI bảo toàn nháp.
import {bodyIndexOf} from '../shared/workflow.mjs?v=20261109-l15-discussion1';
export function createClient(base,fetcher=fetch){
 let token='';
 async function call(path,method='GET',body,etag){
  const b=bodyIndexOf(body?.field||body?.section);if(b!==null)body={...body,bodyIndex:b};
  const options={method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error'};
  let response,value;
  for(let attempt=0;attempt<2;attempt++){
   try{
    // Retry a failed conditional request without the header, including after an API rollback.
    const headers=etag&&attempt===0?{...options.headers,'If-None-Match':etag}:options.headers;
    response=await fetcher(base+path,{...options,headers,signal:AbortSignal.timeout(15000)});
    if(response.status===304)return {notModified:true};
    value=await response.json();break;
   }
   catch(error){if(attempt===1)throw error;}
  }
  if(!response.ok||value.ok!==true)throw Object.assign(new Error(value.error||'TECHNICAL_FAILURE'),{status:response.status});
  const responseTag=response.headers?.get('ETag');
  return responseTag?{...value,etag:responseTag}:value;
 }
 return {setToken:value=>{token=value;},lesson:activity=>call('/lessons/'+encodeURIComponent(activity)),roster:(activity='lesson5')=>call('/roster?activity='+encodeURIComponent(activity)),open:body=>call('/sessions','POST',body),read:(ref,etag)=>call('/sessions/'+ref,'GET',undefined,etag),save:(ref,body)=>call('/sessions/'+ref+'/responses','PUT',body),check:(ref,body)=>call('/sessions/'+ref+'/checks','POST',body),attest:(ref,body)=>call('/sessions/'+ref+'/attest','POST',body),edit:(ref,body)=>call('/sessions/'+ref+'/edit','POST',body),thread:(ref,body)=>call('/sessions/'+ref+'/threads','POST',body),idea2:(ref,bodyIndex)=>call('/sessions/'+ref+'/idea2','POST',{bodyIndex}),vocabulary:(ref,n,bodyIndex)=>call('/sessions/'+ref+'/vocabulary/'+n+'/retry','POST',{bodyIndex})};
}

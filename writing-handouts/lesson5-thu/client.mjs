// Nhận thao tác UI; gửi đúng API riêng và token trong header, không đặt trong URL.
// Retry một lần cùng requestId khi mất ACK. HTTP lỗi giữ mã để UI bảo toàn nháp.
export function createClient(base,fetcher=fetch){
 let token='';
 async function call(path,method='GET',body){
  const options={method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error'};
  let response,value;
  for(let attempt=0;attempt<2;attempt++){
   try{response=await fetcher(base+path,{...options,signal:AbortSignal.timeout(15000)});value=await response.json();break;}
   catch(error){if(attempt===1)throw error;}
  }
  if(!response.ok||value.ok!==true)throw Object.assign(new Error(value.error||'TECHNICAL_FAILURE'),{status:response.status});return value;
 }
 return {setToken:value=>{token=value;},roster:()=>call('/roster'),open:body=>call('/sessions','POST',body),read:ref=>call('/sessions/'+ref),save:(ref,body)=>call('/sessions/'+ref+'/responses','PUT',body),check:(ref,body)=>call('/sessions/'+ref+'/checks','POST',body),idea2:ref=>call('/sessions/'+ref+'/idea2','POST',{}),vocabulary:(ref,n)=>call('/sessions/'+ref+'/vocabulary/'+n+'/retry','POST',{})};
}

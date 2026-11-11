// The public demo shares a browser between several trial identities.
// Keep a fresh online visit in the roster and recover only an identified local run.
export function createDemoStore(ExamStore,slug,classCode,query,tabKey=`izone-test:${slug}:${classCode}`) {
 const store=new ExamStore(), get=store.get.bind(store), put=store.put.bind(store);
 const latest='latest:'+classCode;
 const isReload=performance.getEntriesByType('navigation')[0]?.type==='reload';
 const resetSignal=studentRef=>{
  try{return localStorage.getItem(`izone-demo-reset:student:${classCode}:${studentRef}:${slug}`)||'';}
  catch{return '';}
 };
 const current=record=>Boolean(record?.studentRef)&&(record.demoResetSignal||'')===resetSignal(record.studentRef);
 store.get=async key=>{
  const data=await get(key);
  if(key===latest){
   if(!data?.key||query.get('reset')==='1'||(!isReload&&navigator.onLine!==false))return null;
   const record=await get(data.key);
   if(!current(record))return null;
   try{
    const tab=JSON.parse(sessionStorage.getItem(tabKey)||'null');
    if(tab?.studentRef!==record.studentRef||tab?.attemptToken!==record.prepared?.attemptToken)return null;
   }catch{return null;}
  }else if(key.startsWith('run:')&&!key.endsWith(':audio')&&data&&!current(data))return null;
  return data;
 };
 store.put=(key,value)=>{
  if(key.startsWith('run:')&&!key.endsWith(':audio')&&value.studentRef)
   value.demoResetSignal??=resetSignal(value.studentRef);
  return put(key,value);
 };
 return store;
}

// Read the old lesson cache by exact task/class/student/session identity.
// The original IndexedDB record is never changed or removed.
export function eligibleLegacyDraft(local, session, activity) {
 if(!local?.progress||local.sessionRef!==session.sessionRef||session.activitySlug!==activity)return null;
 if(local.identity?.classRef!==session.classRef||local.identity?.studentRef!==session.studentRef)return null;
 if(local.key!==`lesson:${activity}:${session.classRef}:${session.studentRef}`)return null;
 // Opening the old session advances updatedAt even when no text was saved.
 // Offer differing text for explicit comparison; timestamps cannot prove freshness.
 const savedAt=Number(local.savedAt);
 if(!Number.isFinite(savedAt)||savedAt<=0)return null;
 const responses=local.progress.responses;
 if(!responses||typeof responses!=='object'||Array.isArray(responses))return null;
 const fields=[...new Set(session.sectionDefinitions.flatMap(d=>d.inputFields))];
 const selected=Object.fromEntries(fields.filter(key=>typeof responses[key]==='string').map(key=>[key,responses[key]]));
 if(!Object.keys(selected).length||!Object.entries(selected).some(([key,value])=>value!==(session.responses[key]||'')))return null;
 const baseVersion=local.progress.draftVersion??local.progress.version??local.progress.revision;
 if(!Number.isSafeInteger(baseVersion)||baseVersion<0)return null;
 return {responses:selected,baseVersion,savedAt,sessionRef:session.sessionRef};
}
export function eligibleShopsDraft(local,session,activity){
 if(activity!=='writing-task2-public-health-ban'||session.activitySlug!==activity||local?.dirty!==true)return null;
 if(local.studentRef!==session.studentRef||local.classRef!==session.classRef||!Number.isSafeInteger(local.baseVersion)||local.baseVersion<0)return null;
 const fields=[...new Set(session.sectionDefinitions.flatMap(d=>d.inputFields))];
 const responses=Object.fromEntries(fields.filter(key=>typeof local.responses?.[key]==='string').map(key=>[key,local.responses[key]]));
 if(!Object.entries(responses).some(([key,value])=>value!==(session.responses[key]||'')))return null;
 return {responses,baseVersion:local.baseVersion,sessionRef:session.sessionRef,source:'shops-production-cache'};
}
export async function readLegacyDraft(session, activity, database=globalThis.indexedDB, storage=globalThis.localStorage) {
 if(activity==='writing-task2-public-health-ban'&&storage){
  const cached=JSON.parse(storage.getItem('izone:shops-writing:production:'+session.sessionRef)||'null');
  const current=eligibleShopsDraft(cached,session,activity);if(current)return current;
 }
 if(!database)return null;
 const key=`lesson:${activity}:${session.classRef}:${session.studentRef}`;
 if(database.databases&&!(await database.databases()).some(db=>db.name==='izone-task1-practice'))return null;
 const db=await new Promise((resolve,reject)=>{
  const request=database.open('izone-task1-practice',1);
  request.onupgradeneeded=()=>request.transaction.abort();
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
 try {
  if(!db.objectStoreNames.contains('drafts'))return null;
  const local=await new Promise((resolve,reject)=>{const request=db.transaction('drafts','readonly').objectStore('drafts').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  return eligibleLegacyDraft(local,session,activity);
 }finally{db.close();}
}

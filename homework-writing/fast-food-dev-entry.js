const assignmentId='hw-trial-fast-food-intro';
const studentId='hw-trial-student';
const validDocument=value=>typeof value==='string'&&/^[\w-]{20,200}$/u.test(value);
const versionKey=documentId=>'fast-food-dev-writing:'+documentId;

export function isDevWritingEntry(person,assignment,documentId){
  return person?.role==='student'&&person.id===studentId&&assignment===assignmentId&&validDocument(documentId);
}

export function devHandoutUrl(documentId){
  const url=new URL('../writing-handouts/lesson3-dev/',import.meta.url);
  url.search=new URLSearchParams({mode:'student',assignment:assignmentId,documentId}).toString();
  return url;
}

export function rememberApprovedOutline(documentId,version){
  if(!validDocument(documentId)||!Number.isSafeInteger(version)||version<0)throw Error('OUTLINE_VERSION_INVALID');
  sessionStorage.setItem(versionKey(documentId),String(version));
}

export function approvedOutlineVersion(documentId){
  try{
    const version=sessionStorage.getItem(versionKey(documentId));
    return version!==null&&/^\d+$/.test(version)&&Number.isSafeInteger(Number(version))?Number(version):null;
  }catch{return null;}
}

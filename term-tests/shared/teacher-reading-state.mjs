// Gom các lượt đọc cùng phạm vi; dữ liệu đến muộn không được đổi lớp đang xem.
export function createScopedTeacherResults({current,request,apply,start,finish}){
 const pending=new Map();
 const key=scope=>JSON.stringify([scope.generation,scope.classId,scope.testSlug]);
 return async function load({quiet=false}={}){
  const scope=current();if(!scope?.classId||!scope.testSlug)return;
  const id=key(scope);if(pending.has(id))return pending.get(id);
  const isCurrent=()=>{const now=current();return Boolean(now&&key(now)===id);};
  start(scope,quiet);
  const promise=(async()=>{
   try{
    const query=new URLSearchParams({class:scope.className,test:scope.testSlug});
    const payload=await request(`/api/term-tests/teacher/results?${query}`,{isCurrent});
    if(!isCurrent())throw Object.assign(Error('Phạm vi đang xem đã thay đổi.'),{staleSession:true});
    if(payload.class?.id!==scope.classId||(payload.test?.slug&&payload.test.slug!==scope.testSlug)||!Array.isArray(payload.students))
     throw Error('Dữ liệu kết quả chưa khớp lớp và bài đang xem.');
    apply(payload,scope);
   }catch(error){if(!isCurrent())error.staleSession=true;throw error;}
   finally{pending.delete(id);if(isCurrent())finish();}
  })();
  pending.set(id,promise);return promise;
 };
}

export function createTeacherReadingRegions(){
 const revisions=new Map();
 return function render(key,value,draw){
  const revision=JSON.stringify(value);if(revisions.get(key)===revision)return false;
  draw();revisions.set(key,revision);return true;
 };
}

// Giữ nguyên các phần L/R đang đọc khi chỉ phần điểm Writing thay đổi.
// Phần mới giữ handler của lần dựng mới; đổi người/lớp/bài thay toàn bộ chủ dữ liệu.
export function createTeacherResultSections(){
 const roots=new WeakMap();
 return function commit(root,panel,identity,parts){
  const previous=roots.get(root),next=new Map(parts.map(part=>[part.key,{...part,revision:JSON.stringify(part.value)}]));
  const changed=new Set();
  if(!previous||previous.identity!==identity||root.firstElementChild!==previous.panel){
   root.replaceChildren(panel);for(const key of next.keys())changed.add(key);
   roots.set(root,{identity,panel,parts:next});return changed;
  }
  for(const [key,part] of next){
   const old=previous.parts.get(key);
   if(old?.revision===part.revision){next.set(key,old);continue;}
   if(!old?.node?.isConnected)throw Error('Vùng kết quả đang xem không còn khớp.');
   if(key==='questions')for(const details of part.node.querySelectorAll('details[data-skill]')){
    const previousDetails=[...old.node.querySelectorAll('details[data-skill]')].find(node=>node.dataset.skill===details.dataset.skill);
    if(previousDetails)details.open=previousDetails.open;
   }
   old.node.replaceWith(part.node);changed.add(key);
  }
  roots.set(root,{identity,panel:previous.panel,parts:next});return changed;
 };
}

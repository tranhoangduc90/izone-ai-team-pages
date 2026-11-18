const endpoint='https://ducizone.ddns.net/substitute-teacher-api/skill-makeup/v1/class-directory';

export async function loadClassDirectory(testId,select,{fetcher=fetch}={}){
 const response=await fetcher(endpoint+'?testId='+encodeURIComponent(testId),{cache:'no-store',redirect:'error'});
 if(!response.ok)throw Object.assign(Error('Không tải được toàn bộ danh sách lớp.'),{code:'CLASS_DIRECTORY_UNAVAILABLE'});
 const data=await response.json(),rows=data.classes;
 if(data.testId!==testId||data.version!==1||!Array.isArray(rows)||!rows.length||new Set(rows.map(r=>r.key??r.code)).size!==rows.length||rows.some(r=>typeof r.code!=='string'||!r.code.trim()||r.code.length>100||typeof r.eligible!=='boolean'||r.eligible&&!/^IC\d{3,8}$/.test(r.code)))throw Object.assign(Error(),{code:'CLASS_DIRECTORY_UNAVAILABLE'});
 const current=select.value,allowed=new Set(rows.filter(r=>r.eligible).map(r=>r.code));
 select.replaceChildren(new Option('Nhấn để chọn lớp',''),...rows.map(r=>new Option(r.code+(r.eligible?'':r.reason==='CLASS_CODE_AMBIGUOUS'?' · Trùng tên lớp, cần xác minh':' · Chưa có quyền dự thi bài này'),r.eligible?r.code:r.key??r.code)));
 if(data.demo?.available){select.add(new Option('DEMO · Chỉ kiểm tra, không gửi Portal','DEMO'));allowed.add('DEMO');}
 if([...select.options].some(o=>o.value===current))select.value=current;
 return {canEnter:code=>allowed.has(code),requireEligible(code){if(!allowed.has(code))throw Object.assign(Error(),{code:'CLASS_NOT_ELIGIBLE'});}};
}

const profiles={
 'ic2311-listening-retake-substitute1-k56':{testId:'substitute-test-1-k56-listening-makeup',skill:'listening'},
 'ic2311-reading-retake-substitute1-k56':{testId:'substitute-test-1-k56-reading-makeup',skill:'reading'},
 'k67-term1-listening-makeup-substitute1':{testId:'substitute-test-1-k67-listening-makeup',skill:'listening'}
};
export function legacyProfile(){return profiles[location.pathname.split('/').filter(Boolean).filter(x=>x!=='index.html').at(-1)];}
export async function connectLegacyDirectory(){
 const profile=legacyProfile(),select=document.getElementById('class');if(!profile||!select)return;
 const directory=await loadClassDirectory(profile.testId,select);
 select.addEventListener('change',event=>{
  const code=select.value;
  if(code==='DEMO'){event.stopImmediatePropagation();const url=new URL(location.href);url.searchParams.set('class','DEMO');location.assign(url);return;}
  if(profile.testId==='substitute-test-1-k56-listening-makeup'&&new URL(location.href).searchParams.get('course')!=='56'&&code&&code!=='IC2311'&&directory.canEnter(code)){
   // Preserve the original IC2311 storage/permit. Other classes enter the
   // existing cohort controller with its separate namespace.
   event.stopImmediatePropagation();const url=new URL(location.href);url.searchParams.set('course','56');url.searchParams.set('class',code);location.assign(url);return;
  }
  if(code&&!directory.canEnter(code)){
   event.stopImmediatePropagation();const student=document.getElementById('student');student.replaceChildren(new Option('Lớp này chưa có quyền dự thi bài này',''));student.disabled=true;
   for(const id of['prepare','start','preview']){const e=document.getElementById(id);if(e)e.disabled=true;}
   const note=document.getElementById('identity-status');if(note)note.textContent='Lớp được hiển thị trong danh mục, nhưng chưa được cấp quyền dự thi bài này. Hãy liên hệ giảng viên.';
  }
 },true);
 const requested=new URL(location.href).searchParams.get('class');if(!select.value&&requested&&requested!=='DEMO'&&directory.canEnter(requested)){select.value=requested;select.dispatchEvent(new Event('change',{bubbles:true}));}
}

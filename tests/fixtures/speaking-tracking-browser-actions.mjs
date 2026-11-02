// Thao tác trên renderer thật trong trang loopback của speaking-tracking-server.
// Không được gọi từ sản phẩm phát hành. Mọi lỗi điều kiện kiểm đều ném ra rõ ràng.
const assert=(value,message)=>{if(!value)throw Error(message);};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const get=id=>document.getElementById(id);
const first={2:'paraphrase',3:'clarify_1',8:'comparison_direct'},second={2:'speaking',3:'clarify_2',8:'comparison_extended'};
const counts=rows=>({views:rows.filter(row=>row.path==='/observation/student/view').length,opens:rows.filter(row=>row.path==='/open').length,doctors:rows.filter(row=>row.path==='/doctor/list').length});
export async function until(predicate){for(let i=0;i<150;i++){if(predicate())return;await wait(20);}throw Error('Fixture UI deadline exceeded');}
export const stats=()=>fetch('/__fixture/stats').then(response=>response.json());
export const control=body=>fetch('/__fixture/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(response=>response.json());
export async function select(ref){
 await until(()=>get('student-select')&&!get('student-select').disabled||!get('homework-content').hidden);
 if(!get('homework-content').hidden){await until(()=>!get('change-student').disabled);if(get('student-select').value===ref)return;get('change-student').click();await until(()=>get('homework-content').hidden&&!get('student-select').disabled);}
 get('student-select').value=ref;get('student-select').dispatchEvent(new Event('change',{bubbles:true}));
 assert(!get('open-homework').disabled,'Native open button must accept the selected fixture learner');get('open-homework').click();
 await until(()=>!get('homework-content').hidden&&!get(first[Number(document.body.dataset.speakingLesson)]+'-result').hidden);await wait(250);
}
export async function startReading({lesson,ref,store='independent',editDraft=true,streamExpected=true}){
 assert(location.hostname==='127.0.0.1','Fixture actions must stay on loopback');await select(ref);
 if(streamExpected)await until(()=>performance.getEntriesByType('resource').some(entry=>entry.name.includes('/observation/student/view')&&entry.responseEnd>0));
 await wait(100);
 const node=get(first[lesson]+'-result'),input=get(second[lesson]+'-link'),doctor=get('doctor-list');
 if(editDraft){input.value='https://chatgpt.com/share/00000000-0000-4000-8000-999999999997';input.dispatchEvent(new Event('input',{bubbles:true}));}
 input.focus({preventScroll:true});node.scrollIntoView({block:'center',behavior:'instant'});
 const range=document.createRange();range.selectNodeContents(node);getSelection().removeAllRanges();getSelection().addRange(range);
 const data=await stats();window.__speakingQA={lesson,ref,store,at:performance.now(),node,child:node.firstChild,input,inputValue:input.value,
  selection:getSelection().toString(),scrollY,doctor,doctorChild:doctor?.firstChild,ticks:data.records.find(row=>row.number===lesson&&row.ref===ref&&row.store===store)?.ticks||0,
  initialReads:counts(data.requests.filter(row=>row.number===lesson&&row.ref===ref&&row.store===store))};
 assert(!document.hidden,'Test page must be visible');return{started:true,lesson,ref,store,selection:getSelection().toString(),scrollY};
}
export async function readingResult({requireThreeTicks=true}={}){
 const before=window.__speakingQA,data=await stats(),record=data.records.find(row=>row.number===before.lesson&&row.ref===before.ref&&row.store===before.store);
 const requests=data.requests.filter(row=>row.number===before.lesson&&row.ref===before.ref&&row.store===before.store);
 const result={lesson:before.lesson,ref:before.ref,store:before.store,elapsed:performance.now()-before.at,ticks:record.ticks-before.ticks,hidden:document.hidden,
  sameNode:before.node===get(first[before.lesson]+'-result'),sameChild:before.node.firstChild===before.child,
  sameDoctor:!before.doctor||(before.doctor===get('doctor-list')&&before.doctorChild===before.doctor.firstChild),
  focus:document.activeElement===before.input,draft:before.input.value===before.inputValue,selection:getSelection().toString()===before.selection,scrollDelta:scrollY-before.scrollY,
  errors:window.__fixtureErrors,requests:requests.map(row=>row.path),...counts(requests),initialReads:before.initialReads};
 result.newReads=Object.fromEntries(Object.entries(counts(requests)).map(([key,value])=>[key,value-before.initialReads[key]]));
 for(const key of ['sameNode','sameChild','sameDoctor','focus','draft','selection'])assert(result[key],key+' must be retained');
 assert(result.scrollDelta===0,'Reading position must stay fixed');assert(!result.hidden,'Test page became hidden');assert(result.errors.length===0,'Browser had uncaught errors');
 if(requireThreeTicks){assert(result.elapsed>=45000&&result.ticks>=3,'Need three actual native fifteen-second intervals');assert(Object.values(result.newReads).every(value=>value===0),'Unchanged frames must not reload native or combined bodies');}
 return result;
}

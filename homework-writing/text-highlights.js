const esc = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function highlightHtml(text,ranges=[]) {
  let out='',at=0;
  for(const {start,end} of ranges){
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<at||end<=start||end>text.length)continue;
    out+=esc(text.slice(at,start))+'<mark class="teacher-highlight">'+esc(text.slice(start,end))+'</mark>';at=end;
  }
  return out+esc(text.slice(at));
}
export function mergeHighlights(ranges,start,end,remove=false){
  const next=ranges.flatMap(r=>r.end<=start||r.start>=end?[r]:[{start:r.start,end:start},{start:end,end:r.end}].filter(x=>x.end>x.start));
  if(!remove&&end>start)next.push({start,end});
  return next.sort((a,b)=>a.start-b.start).reduce((out,r)=>{
    const last=out.at(-1);if(last&&last.end>=r.start)last.end=Math.max(last.end,r.end);else out.push({...r});return out;
  },[]);
}
export function rebaseHighlights(before,after,ranges){
  let start=0;while(start<before.length&&start<after.length&&before[start]===after[start])start++;
  let oldEnd=before.length,newEnd=after.length;
  while(oldEnd>start&&newEnd>start&&before[oldEnd-1]===after[newEnd-1]){oldEnd--;newEnd--;}
  const delta=newEnd-oldEnd;
  // Không đoán tô sáng cho nội dung mới; giữ hai phần chắc chắn không bị sửa.
  return ranges.flatMap(r=>[
    {start:r.start,end:Math.min(r.end,start)},
    {start:Math.max(r.start,oldEnd)+delta,end:r.end+delta}
  ].filter(x=>x.end>x.start));
}

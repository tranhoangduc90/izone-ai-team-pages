// Keep all 22 server answer strings intact. Structured fields are presentation
// metadata; old free-text answers never need to be guessed or rewritten.
export const UI_KIND='listening-homework-interaction-v1';
const compound=new Set(['S1','S4','S5','S8','S17','S19']);
const choices={S1:['Ý kiến riêng của một người','Lựa chọn cuối cùng được cả James và Beth đồng ý'],S5:['Có','Không'],S8:['Có','Không'],S17:['Có','Không'],S19:['C','A']};
export function encodeAnswer(id,fields){
 if(id==='S4')return ['a','b','c'].some(k=>fields[id+k]?.trim())?['a','b','c'].map(k=>`(${k}) ${fields[id+k]||''}`).join('\n'):'';
 if(['S8','S17','S19'].includes(id))return fields[id+'choice']||fields[id+'quote']?`Lựa chọn: ${fields[id+'choice']||''}\nDẫn chứng: ${fields[id+'quote']||''}`:'';
 return fields[id]||'';
}
export function decodeBody(body,items){
 const fields={},legacy={},annotation=body.annotations?.find(a=>a.kind===UI_KIND);
 for(const {id} of items){
  const raw=body.answers?.[id]||'';
  if(!compound.has(id)){fields[id]=raw;continue;}
  const saved=annotation?.fields;
  if(saved&&encodeAnswer(id,saved)===raw){for(const [k,v]of Object.entries(saved))if((k===id||k.startsWith(id+'choice')||k===id+'quote'||id==='S4'&&/^S4[abc]$/.test(k))&&typeof v==='string')fields[k]=v;continue;}
  if(!raw)continue;
  if(choices[id]?.includes(raw)){fields[id+(id==='S8'||id==='S17'||id==='S19'?'choice':'')]=raw;continue;}
  // Only parse our exact, reversible format. Any historical paraphrase remains raw.
  if(id==='S4'){
   const match=/^\(a\) ([\s\S]*?)\n\(b\) ([\s\S]*?)\n\(c\) ([\s\S]*)$/.exec(raw);
   if(match){['a','b','c'].forEach((k,n)=>fields[id+k]=match[n+1]);continue;}
  }
  if(['S8','S17','S19'].includes(id)){
   const match=/^Lựa chọn: ([^\n]*)\nDẫn chứng: ([\s\S]*)$/.exec(raw);
   if(match&&(!match[1]||choices[id].includes(match[1]))){fields[id+'choice']=match[1];fields[id+'quote']=match[2];continue;}
  }
  legacy[id]=raw;
 }
 if(annotation?.mcq)for(const n of [24,25])if(['A','B','C'].includes(annotation.mcq[n]))fields['mcq'+n]=annotation.mcq[n];
 return {fields,legacy,legacyOriginal:annotation?.legacyOriginal||{}};
}
export function encodeBody(state,items,annotations=[]){
 const answers=Object.fromEntries(items.map(({id})=>[id,Object.hasOwn(state.legacy,id)?state.legacy[id]:encodeAnswer(id,state.fields)]));
 const meta={kind:UI_KIND,fields:{...state.fields},mcq:Object.fromEntries([24,25].map(n=>[n,state.fields['mcq'+n]||''])),legacyOriginal:state.legacyOriginal||{}};
 return {answers,annotations:[...annotations.filter(a=>a.kind!==UI_KIND),meta],notes:state.notes||'',flags:items.flatMap((i,n)=>state.flags.includes(i.id)?[n+1]:[])};
}

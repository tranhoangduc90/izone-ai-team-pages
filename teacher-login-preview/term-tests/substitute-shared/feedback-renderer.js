// Báo cáo AI không đáng tin: chỉ dựng tag cho phép, không mang attribute/script/URL sang DOM.
const blocked=new Set(['SCRIPT','STYLE','HEAD','TITLE','META','LINK','BASE','IMG','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','SVG','MATH','VIDEO','AUDIO','SOURCE','TEMPLATE']);
const allowed=new Set(['P','DIV','SECTION','ARTICLE','H1','H2','H3','H4','H5','H6','STRONG','B','EM','I','UL','OL','LI','TABLE','THEAD','TBODY','TR','TD','TH','BLOCKQUOTE','BR','HR']);
const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
function inline(parent,text){
 const pattern=/(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^\s)]+\)|\*[^*\n]+\*)/gu;let at=0;
 for(const m of text.matchAll(pattern)){
  parent.append(document.createTextNode(text.slice(at,m.index)));const t=m[0];
  if(t.startsWith('**'))parent.append(make('strong',t.slice(2,-2)));
  else if(t.startsWith('`'))parent.append(make('span',t.slice(1,-1)));
  else if(t.startsWith('['))parent.append(document.createTextNode(t.match(/^\[([^\]]+)/)[1])); // Chỉ nhãn, không link phụ trong nhận xét.
  else parent.append(make('em',t.slice(1,-1)));
  at=m.index+t.length;
 }parent.append(document.createTextNode(text.slice(at)));
}
function markdown(parent,value){
 const text=value.replace(/\r\n?/g,'\n').replace(/\s+(#{2,6}\s+)/g,'\n\n$1');let paragraph=[],list=null;
 const flush=()=>{if(paragraph.length){const p=make('p');inline(p,paragraph.join(' '));parent.append(p);paragraph=[];}};
 const lines=text.split('\n');
 for(let n=0;n<lines.length;n++){
  const line=lines[n];
  const s=line.trim();if(!s){flush();list=null;continue;}
  if(s.includes('|')&&/^\s*\|?\s*:?-{3,}:?\s*\|/.test(lines[n+1]||'')){
   flush();list=null;const table=make('table'),head=make('thead'),body=make('tbody');
   const cells=s=>s.trim().replace(/^\||\|$/g,'').split('|').map(s=>s.trim());
   const row=(line,tag,parent)=>{const tr=make('tr');for(const cell of cells(line)){const td=make(tag);inline(td,cell);tr.append(td);}parent.append(tr);};
   row(s,'th',head);n++;while(n+1<lines.length&&lines[n+1].trim().includes('|'))row(lines[++n],'td',body);
   table.append(head,body);parent.append(table);continue;
  }
  const heading=s.match(/^#{1,6}\s+(.+)$/),item=s.match(/^([-*+]\s+|\d+[.)]\s+)(.+)$/);
  if(heading){flush();list=null;const h=make('h3');inline(h,heading[1]);parent.append(h);}
  else if(/^([-*_])(?:\s*\1){2,}$/.test(s)){flush();list=null;parent.append(make('hr'));}
  else if(item){flush();const tag=/^\d/.test(item[1])?'ol':'ul';if(!list||list.tagName.toLowerCase()!==tag){list=make(tag);if(tag==='ol')list.start=parseInt(item[1],10);parent.append(list);}const li=make('li');inline(li,item[2]);list.append(li);}
  else{list=null;paragraph.push(s);}
 }flush();
}
function cleanText(value){return value.replace(/^\s*```(?:html|markdown|md)?\s*\n?/gim,'').replace(/^\s*```\s*$/gm,'').replace(/^\s*html\s*\n/i,'');}
function sanitize(parent,source){
 if(source.nodeType===3){const text=source.textContent;if(text.trim())markdown(parent,cleanText(text));return;}
 if(source.nodeType!==1||blocked.has(source.tagName))return;
 if(source.tagName==='PRE'||source.tagName==='CODE'){markdown(parent,cleanText(source.textContent));return;}
 if(!allowed.has(source.tagName)){for(const child of source.childNodes)sanitize(parent,child);return;}
 const tag=/^H[1-6]$/.test(source.tagName)?'h3':source.tagName.toLowerCase();
 if(['strong','b','em','i'].includes(tag)){parent.append(make(tag,source.textContent));return;}
 // HTML thường chứa Markdown trong p/div; render lại phần text thay vì hiển thị ##/**.
 if(['p','div','section','article'].includes(tag)&&!source.children.length){markdown(parent,cleanText(source.textContent));return;}
 const target=make(tag);
 for(const child of source.childNodes){
  if(child.nodeType===3&&['h3','li','td','th','p'].includes(tag))inline(target,child.textContent);
  else sanitize(target,child);
 }parent.append(target);
}
export function appendWritingFeedback(parent,value){
 if(value==null)return;
 if(typeof value==='object'){
  if(Array.isArray(value)){for(const part of value)appendWritingFeedback(parent,part);}
  else for(const [key,part]of Object.entries(value)){parent.append(make('h4',({summary:'Nhận xét tổng hợp',strengths:'Điểm mạnh',improvements:'Cần cải thiện',annotations:'Ghi chú',text:'Nội dung',reason:'Lý do'}[key]||key)));appendWritingFeedback(parent,part);}
  return;
 }
 const rich=make('div');rich.className='feedback-rich';let text=cleanText(String(value));
 if(/&lt;[a-z][a-z0-9]*\b/i.test(text)){const encoded=document.createElement('template');encoded.innerHTML=text;text=encoded.content.textContent;}
 if(/<[a-z][a-z0-9]*\b[^>]*>/i.test(text)){
  const template=document.createElement('template');template.innerHTML=text;
  for(const child of template.content.childNodes)sanitize(rich,child);
 }else markdown(rich,text);
 parent.append(rich);
}

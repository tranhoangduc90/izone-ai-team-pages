// Chỉ định dạng dữ liệu đã nhận; không tải URL hoặc gọi lại bộ chấm.
export const criterionNames={TA:'Task Achievement',TR:'Task Response',CC:'Coherence & Cohesion',LR:'Lexical Resource',GRA:'Grammatical Range & Accuracy'};
const fieldNames={summary:'Nhận xét',feedback:'Phân tích chi tiết',body:'Nhận xét gốc',conclusion:'Kết luận',strengths:'Điểm tốt',improvements:'Điểm cần cải thiện',examples:'Ví dụ',analysis:'Phân tích',recommendations:'Cách cải thiện',original:'Trong bài viết',suggestion:'Gợi ý chỉnh sửa',revision:'Gợi ý chỉnh sửa',explanation:'Giải thích',score:'Điểm',bandScore:'Điểm'};
const blocked=new Set(['SCRIPT','STYLE','TEMPLATE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','TEXTAREA','SELECT','OPTION','LINK','META','IMG','VIDEO','AUDIO','SOURCE']);
const allowed=new Set(['P','DIV','SPAN','STRONG','B','EM','I','UL','OL','LI','BR','BLOCKQUOTE','TABLE','THEAD','TBODY','TFOOT','TR','TH','TD','PRE','CODE']);
export const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
export function feedbackText(value){
 let text=typeof value==='string'?value:'';
 for(let i=0;i<2;i++){const trimmed=text.trim();if(!trimmed.startsWith('"')||!trimmed.endsWith('"'))break;try{const parsed=JSON.parse(trimmed);if(typeof parsed!=='string')break;text=parsed;}catch{break;}}
 if(!text.includes('\n')&&/\\n/.test(text))text=text.replace(/\\r\\n|\\n/g,'\n');
 return text.replace(/\r/g,'').replace(/[ \t]+(?=#{2,6}\s)/g,'\n');
}
export function semanticText(value){const div=document.createElement('div');appendFeedback(div,value);return div.textContent.replace(/\s+/g,' ').trim();}
export const sameFeedback=(a,b)=>!!a&&!!b&&semanticText(a)===semanticText(b);

function safeHref(value){const href=String(value||'').trim();if(/^#[\w.-]+$/.test(href))return href;try{const url=new URL(href);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
function appendLink(parent,label,href,onLink){const safe=safeHref(href);if(!safe||!onLink){parent.append(document.createTextNode(label));return;}const a=element('a',label,'writing-detail-link');a.href=safe.startsWith('#')?safe:'#writing-detail';a.dataset.feedbackHref=safe;a.setAttribute('aria-haspopup','dialog');const activate=event=>{event.preventDefault();onLink(safe,label,a);};a.addEventListener('click',activate);a.addEventListener('auxclick',event=>{if(event.button===1)activate(event);});parent.append(a);}
function inline(parent,value,onLink){
 const text=String(value||''),pattern=/\[([^\]]+)\]\(([^\s)]+)(?:\s+"[^"]*")?\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|`([^`]+)`/g;let cursor=0;
 for(const match of text.matchAll(pattern)){if(match.index>cursor)parent.append(document.createTextNode(text.slice(cursor,match.index)));if(match[1])appendLink(parent,match[1],match[2],onLink);else parent.append(element(match[3]||match[4]?'strong':match[5]?'em':'code',match[3]||match[4]||match[5]||match[6]));cursor=match.index+match[0].length;}if(cursor<text.length)parent.append(document.createTextNode(text.slice(cursor)));
}
function html(parent,value,onLink){
 const template=document.createElement('template');template.innerHTML=value;
 const clone=node=>{if(node.nodeType===3)return document.createTextNode(node.textContent);if(node.nodeType!==1||blocked.has(node.tagName))return null;let target;
  if(node.tagName==='A'){target=document.createDocumentFragment();appendLink(target,node.textContent,node.getAttribute('href'),onLink);return target;}
  target=/^H[1-6]$/.test(node.tagName)?element('h5'):allowed.has(node.tagName)?element(node.tagName.toLowerCase()):document.createDocumentFragment();for(const child of node.childNodes){const safe=clone(child);if(safe)target.append(safe);}return target;};
 for(const child of template.content.childNodes){const safe=clone(child);if(safe)parent.append(safe);}
}
export function appendFeedback(parent,value,{onLink}={}){
 if(value===null||value===undefined||value==='')return;
 if(Array.isArray(value)){for(const item of value)appendFeedback(parent,item,{onLink});return;}
 if(typeof value==='object'){for(const[key,item]of Object.entries(value)){if(item===null||item===undefined||item==='')continue;const section=element('section',undefined,'writing-feedback-field');section.append(element('h5',Object.hasOwn(fieldNames,key)?fieldNames[key]:key));appendFeedback(section,item,{onLink});parent.append(section);}return;}
 const text=feedbackText(String(value));if(/<\/?[a-z][^>]*>/i.test(text)){html(parent,text,onLink);return;}
 const lines=text.split('\n');let i=0;
 const tableRow=line=>line.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());
 while(i<lines.length){const line=lines[i].trim();if(!line||/^[-*_]{3,}$/.test(line)){i++;continue;}
  const heading=/^#{1,6}\s+(.+?)(?:\s+#+)?$/.exec(line);if(heading){const h=element('h5');inline(h,heading[1],onLink);parent.append(h);i++;continue;}
  if(/^```/.test(line)){const pre=element('pre'),code=element('code');const body=[];i++;while(i<lines.length&&!/^```/.test(lines[i].trim()))body.push(lines[i++]);code.textContent=body.join('\n');pre.append(code);parent.append(pre);if(i<lines.length)i++;continue;}
  if(line.includes('|')&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i+1])){const table=element('table'),head=element('thead'),header=element('tr');for(const value of tableRow(line)){const th=element('th');inline(th,value,onLink);header.append(th);}head.append(header);table.append(head);i+=2;const body=element('tbody');while(i<lines.length&&lines[i].trim().includes('|')){const row=element('tr');for(const value of tableRow(lines[i++])){const td=element('td');inline(td,value,onLink);row.append(td);}body.append(row);}table.append(body);parent.append(table);continue;}
  if(/^>\s?/.test(line)){const quote=element('blockquote'),body=[];while(i<lines.length&&/^>\s?/.test(lines[i].trim()))body.push(lines[i++].trim().replace(/^>\s?/,''));appendFeedback(quote,body.join('\n'),{onLink});parent.append(quote);continue;}
  const item=/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/.exec(line);if(item){const ordered=/^\d/.test(line),list=element(ordered?'ol':'ul');while(i<lines.length){const candidate=/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/.exec(lines[i].trim());if(!candidate||/^\d/.test(lines[i].trim())!==ordered)break;const li=element('li');inline(li,candidate[1],onLink);list.append(li);i++;}parent.append(list);continue;}
  const paragraph=element('p'),body=[line];i++;while(i<lines.length&&lines[i].trim()&&!/^(?:#{1,6}\s|```|>\s?|[-*+]\s|\d+[.)]\s)/.test(lines[i].trim())&&!(lines[i].includes('|')&&/\|?\s*:?-{3,}/.test(lines[i+1]||''))&&!/^[-*_]{3,}$/.test(lines[i].trim()))body.push(lines[i++].trim());inline(paragraph,body.join(' '),onLink);parent.append(paragraph);
 }
}

const cleanTitle=value=>feedbackText(value).replace(/<[^>]*>/g,'').replace(/\*\*|__/g,'').trim();
const normalizedLabel=value=>cleanTitle(value).replace(/^\d+[.)]\s*/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim();
const componentAliases={
 tr_task_coverage:['muc do cover noi dung de bai','dap ung yeu cau de','task coverage'],tr_position:['quan diem cua nguoi viet','quan diem va tinh nhat quan','position'],tr_idea_development:['su phat trien y','phat trien va ho tro y','idea development'],
 cc_organization:['cach sap xep thong tin','organization'],cc_cohesive_devices:['tu noi cohesive devices','tu noi va quan he giua cac y','cohesive devices'],cc_referencing:['tham chieu va thay the referencing and substitution','tham chieu va thay the','referencing'],
 lr_range:['von tu','von tu va do linh hoat','range'],lr_word_choice:['lua chon tu ngu word choice','lua chon va ket hop tu','word choice'],lr_word_formation:['dang tu chinh ta word formation spelling','dang tu va chinh ta','word formation'],gra_sentence_range:['do da dang cua cau truc','sentence range','grammatical range'],gra_accuracy:['do chinh xac','accuracy']};
export function componentKey(criterion,component){
 const code=String(component?.code||component?.id||'').replace(/^#/,'').trim().toLowerCase();if(code)return /^(?:ta|tr|cc|lr|gra)_/.test(code)?code:criterion.toLowerCase()+'_'+code;
 const label=normalizedLabel(component?.label||component?.title||'');for(const[key,values]of Object.entries(componentAliases))if(key.startsWith(criterion.toLowerCase()+'_')&&values.some(v=>normalizedLabel(v)===label))return key;return '';
}
export function splitCriterion(value){
 const text=feedbackText(value);if(typeof value!=='string')return{intro:value,sections:[],conclusion:''};
 const lines=text.split('\n'),sections=[];let current=null,intro=[],conclusion=[],inConclusion=false;
 for(const line of lines){const match=/^#{1,6}\s+(.+?)(?:\s+#+)?$/.exec(line.trim()),title=match?cleanTitle(match[1]):'';
  if(match&&/^(?:KẾT LUẬN|Kết luận)(?:\s|$)/i.test(title)){if(current)sections.push({...current,body:current.body.join('\n').trim()});current=null;inConclusion=true;continue;}
  if(match&&/^\d+[.)]\s+/.test(title)){if(current)sections.push({...current,body:current.body.join('\n').trim()});current={title,body:[]};inConclusion=false;continue;}
  if(inConclusion)conclusion.push(line);else if(current)current.body.push(line);else intro.push(line);
 }if(current)sections.push({...current,body:current.body.join('\n').trim()});return{intro:intro.join('\n').trim(),sections,conclusion:conclusion.join('\n').trim()};
}
export function criterionModel(criterion){
 const code=String(criterion.code??criterion.key??''),parts=splitCriterion(criterion.feedback),components=criterion.components==null?[]:Array.isArray(criterion.components)?criterion.components:[criterion.components],used=new Set(),items=[];
 for(const[valueIndex,value]of components.entries()){
  const component=typeof value==='object'&&value!==null?value:{feedback:value},key=componentKey(code,component),labelKey=componentKey(code,{label:component.label||component.title});let sectionIndex=parts.sections.findIndex((section,index)=>!used.has(index)&&([key,labelKey].filter(Boolean).includes(componentKey(code,{label:section.title}))||normalizedLabel(section.title)===normalizedLabel(component.label||component.title||'')));
  // Chỉ ghép theo số khi cả hai phía đều khai số, không lấy vị trí trong mảng.
  if(sectionIndex<0){const number=/^\s*(\d+)[.)]\s/.exec(component.label||component.title||'')?.[1];if(number)sectionIndex=parts.sections.findIndex((s,i)=>!used.has(i)&&new RegExp('^'+number+'[.)]\\s').test(s.title));}
  const section=sectionIndex>=0?parts.sections[sectionIndex]:null;if(section)used.add(sectionIndex);
  const aliases=[...new Set([key,labelKey,section&&componentKey(code,{label:section.title})].filter(Boolean))],sourceBody=section?.body?.replace(/\[(Xem[^\]]+)\]\((#[\w.-]+)\)/gi,(match,_label,href)=>aliases.includes(href.slice(1))?'':match).trim()||'',summary=component.summary||sourceBody||'',detail=component.feedback||'',extras={};if(sourceBody&&!sameFeedback(summary,sourceBody))extras.body=sourceBody;
  for(const[field,data]of Object.entries(component))if(!['code','id','label','title','summary','feedback','url','href','detailUrl'].includes(field))extras[field]=data;
  items.push({key:key||code.toLowerCase()+'_component_'+valueIndex,aliases,title:section?.title||component.label||component.title||'Phân tích thành phần',summary,detail,extras,urls:[component.url,component.href,component.detailUrl].filter(v=>typeof v==='string'),hasDetail:!!detail&&!sameFeedback(summary,detail)||Object.values(extras).some(v=>v!==null&&v!==undefined&&v!=='')});
 }
 for(const[sectionIndex,section]of parts.sections.entries())if(!used.has(sectionIndex))items.push({key:componentKey(code,{label:section.title})||code.toLowerCase()+'_section_'+sectionIndex,title:section.title,summary:section.body,detail:'',extras:{},urls:[],hasDetail:false});
 return{code,name:criterion.name||criterionNames[code]||'Tiêu chí',band:criterion.bandScore??criterion.score,intro:parts.intro,conclusion:parts.conclusion||criterion.conclusion||'',items,extra:Object.fromEntries(Object.entries(criterion).filter(([key])=>!['code','key','name','bandScore','score','feedback','components','conclusion'].includes(key)))};
}

// Build public question-only demos from an explicit, private, read-only source capture.
// No database, credentials, answer keys, grading rules or learner records are consumed.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const source=process.argv[2];if(!source)throw Error('Pass the private capture directory.');
const read=async f=>JSON.parse(await fs.readFile(path.join(source,f),'utf8'));
const inventory=(await read('original-inventory.json')).rows;
if(inventory.length!==31||new Set(inventory.map(x=>x.code)).size!==31)throw Error('Expected the 31 distinct CTA codes.');
const out=path.join(root,'homework-demo');await fs.mkdir(path.join(out,'data'),{recursive:true});
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=v=>JSON.stringify(v,null,2)+'\n';
const sha=v=>createHash('sha256').update(v).digest('hex');
const strip=v=>Array.isArray(v)?v.map(strip):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['source','sourceUrl','sourceDocumentId','sourceTabId','sourceRevisionId','documentId','revisionId'].includes(k)).map(([k,x])=>[k,strip(x)])):v;
const opts=rows=>rows.map(([value,text])=>({value,text}));
const letters=rows=>rows.map((text,i)=>({value:'ABCD'[i],text}));
const group=(id,kind,label,questions,instruction,options)=>({id,kind,label,questions,start:questions[0].n,end:questions.at(-1).n,instruction,...(options?{options}:{} )});
function legacyDefinition(d,code){
 if(code==='67-practice-reading_matching_heading_mcq'){
  return {...d,groups:[
   group('headings','matching','Matching headings',Object.keys(d.passage).map((letter,i)=>({n:14+i,text:'Paragraph '+letter})),'Choose the correct heading for each paragraph from the list below. Write the correct number, i–viii, in boxes 14–20.',opts(d.headings)),
   group('mcq','mcq','Multiple choice',d.mcq.map(q=>({...q,options:letters(q.options)})),'Choose the correct letter, A, B, C or D.'),
   {...group('summary','completion','Summary completion',[24,25,26].map(n=>({n,text:'The Model E',maxWords:1})),'Choose ONE WORD AND/OR A NUMBER from the passage for each answer.'),summaryTitle:'The Model E',summaryParagraphs:[d.summary.map(s=>s.question?'{{'+s.question+'}}':s.text).join('')]}
  ],lesson:{code,lesson:7,title:d.title,book:18,test:3,passage:2,totalMs:1200000}};
 }
 if(code==='67-practice-reading_matching_names_sentence_endings_mcq')return {...d,groups:[
  group('names','matching','Matching names',d.names,'Match each statement with the correct expert, A, B or C. You may use any letter more than once.',opts(d.experts)),
  group('endings','matching','Sentence endings',d.endings,'Complete each sentence with the correct ending, A–D, below.',opts(d.endingOptions)),
  group('mcq','mcq','Multiple choice',d.mcq.map(q=>({...q,options:letters(q.options)})),'Choose the correct letter, A, B, C or D.')
 ],lesson:{code,lesson:9,title:'Robots and us',book:20,test:3,passage:3,totalMs:1200000}};
 if(code==='67-practice-listening_mcq_flowchart')return {...d,groups:[
  group('mcq','mcq','Multiple choice',d.mcq.map(q=>({...q,options:letters(q.options)})),'Choose the correct letter, A, B or C.'),
  group('flow','matching','Flowchart completion',d.flow.map(([n,before,after])=>({n,text:before+' ______ '+after})),'Complete the flowchart. Choose FIVE answers from the box and write the correct letter, A–H, next to Questions 26–30.',opts(d.bank))
 ],lesson:{code,lesson:8,title:'Science experiment',book:19,test:3,part:3}};
 throw Error('No native renderer mapping for '+code);
}
const readingRows=await read('reading_practice-definitions.private.json'),listeningRows=await read('listening_practice-definitions.private.json');
const byPractice=new Map();for(const row of [...readingRows,...listeningRows])if(!byPractice.has(row.code))byPractice.set(row.code,row);
const byHomework=new Map((await read('reading-homework-content.private.json')).map(x=>[x.data.code,x.data]));
const partsByLesson=new Map();
for(let n=2;n<=15;n++){
 let parts;
 if(n>=5)parts=(await import(pathToFileURL(path.join(root,`speaking-homework/lesson-${n}-parts.js`)).href))[`lesson${n}Parts`];
 else{const s=await fs.readFile(path.join(root,`speaking-homework/lesson-${n}-live.js`),'utf8');const a=s.indexOf('[',s.indexOf('const parts = ')),b=s.indexOf('\n];',a);if(a<0||b<0)throw Error('Speaking literal missing '+n);parts=vm.runInNewContext('('+s.slice(a,b+2)+')',Object.create(null),{timeout:1000});}
 if(!parts?.length)throw Error('Speaking parts missing '+n);
 partsByLesson.set(n,JSON.parse(JSON.stringify(parts)));
}
const exercises=[...new Map([...partsByLesson.values()].flat().map(p=>[p.url,{title:p.title,url:p.url}])).values()];
const css=files=>files.map(f=>`<link rel="stylesheet" href="../${f}">`).join('\n');
const readingStyles=['reading-practice/term-style/shared.css','reading-practice/term-style/computer-based.css','reading-practice/explanation-dialog.css','reading-skills67/prototype.css','reading-skills67/headings.css','reading-skills67/green-roofs.css','reading-skills67/sentence.css','reading-skills67/people.css','reading-skills67/tfng.css','shared/master170/theme.css','shared/master170/materials.css','shared/master170/assessment-v1.1.css'];
const practiceStyles=kind=>[`${kind}-practice/styles.css`,`${kind}-practice/term-style/shared.css`,`${kind}-practice/term-style/computer-based.css`,`${kind}-practice/term-style/skin.css`,`${kind}-practice/term-style/header.css`,`${kind}-practice/term-style/color-lab.css`,`${kind}-practice/term-style/real-exam.css`,`${kind}-practice/reading-theme.css`,`${kind}-practice/explanation-dialog.css`,...(kind==='reading'?['reading-practice/authored.css','reading-practice/term67-alignment.css']:['listening-practice/listening.css','listening-practice/flow-options.css','listening-practice/full-test.css']), 'shared/master170/theme.css','shared/master170/practice.css','shared/master170/assessment-v1.1.css'];
const head=(title,styles)=>`<!doctype html><html lang="vi" data-izone-theme="master170"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://izone-audio-delivery.tranhoangduc90.workers.dev https://tranhoangduc90.github.io; media-src 'self' blob: https://tranhoangduc90.github.io; base-uri 'none'; form-action 'none'"><title>Demo · ${e(title)}</title><link rel="icon" href="data:,">${css(styles)}<link rel="stylesheet" href="./demo.css?v=20261030-1"><script type="module" src="../shared/master170/assessment-v1.1.mjs?v=20261029-approved-r3"></script></head>`;
const readingBody=`<div class="prototype-strip" hidden><select id="scenario"><option value="current">Bài demo</option></select></div><header class="app-header"><span class="wordmark"><img class="m170-logo" src="../shared/master170/assets/izone-logo-color.png" alt="IZONE — IELTS chiến lược" width="145" height="48"></span><span class="product-name">READING HOMEWORK <i>/</i> DEMO</span><button class="quiet header-notes" data-action="notes">Ghi chú</button><button id="teacher" hidden>Giảng viên</button></header><main id="app" aria-busy="true"><p class="loading">Đang mở bài Reading…</p></main><dialog id="modal" aria-labelledby="modal-title"></dialog><dialog id="explanation-dialog" aria-labelledby="explanation-dialog-title"></dialog><div id="toast" role="status" hidden></div>`;
const catalog=[];let speakingIndex=2;
for(const item of inventory){
 let data,html,classes,attributes;
 if(item.group==='Speaking'){
  const lesson=speakingIndex++;data={kind:'speaking',code:item.code,title:item.title,lesson,parts:partsByLesson.get(lesson),supplementary:lesson>=4,exercises};
  classes='speaking-design is-learning demo-speaking homework-demo';attributes='data-m170-product="speaking"';
  html=head(item.title,['speaking-homework/styles.css','speaking-homework/guide.css','speaking-homework/lesson-3.css','speaking-homework/lesson-4.css','speaking-homework/identity-login.css','speaking-homework/composition.css','shared/master170/theme.css','shared/master170/speaking.css'])+`<body class="${classes}" ${attributes} data-demo-code="${item.code}"><main></main>`;
 }else if(item.group==='Reading homework'){
  const content=byHomework.get(item.code);if(!content)throw Error('Homework missing '+item.code);
  data={kind:'reading-homework',code:item.code,title:content.title,content:strip(content)};
  html=head(data.title,readingStyles)+`<body class="reading-skills homework-demo" data-izone-design="master170@1.1" data-izone-ui-profile="skill-homework" data-izone-consumer="reading-homework" data-m170-product="materials" data-demo-code="${item.code}">${readingBody}`;
 }else if(item.group==='Listening Homework'){
  const content=JSON.parse(await fs.readFile(path.join(root,'listening-homework/interactive-content.json'),'utf8'));
  data={kind:'listening-homework',code:item.code,title:'Scandinavian Studies',content};
  html=await fs.readFile(path.join(root,'listening-homework/preview.html'),'utf8');
  html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/(href|src)="(?!https?:|data:|#)([^"?]+)([^"\n]*)"/g,(_,attr,p,q)=>`${attr}="${path.posix.normalize('../listening-homework/'+p)}${q}"`);
  html=html.replace('<body ',`<body data-demo-code="${item.code}" `).replace(/(<body[^>]*class=")([^"]*)"/,(_,prefix,value)=>prefix+value+' homework-demo"').replace('</head>','<link rel="stylesheet" href="./demo.css?v=20261030-1"></head>').replace('</body></html>','');
 }else{
  const row=byPractice.get(item.code);if(!row)throw Error('Practice missing '+item.code);
  const kind=item.group.startsWith('Reading')?'reading':'listening';
  const definition=row.definition.authored?row.definition:legacyDefinition(row.definition,item.code);
  const lesson=definition.lesson;lesson.totalMs=row.total_ms;
  data={kind:'practice',subject:kind,code:item.code,title:lesson.title,version:row.version,totalMs:row.total_ms,definition:strip(definition)};
  html=head(data.title,practiceStyles(kind))+`<body class="design67 reading cbt-mode homework-demo demo-practice" data-izone-design="master170@1.1" data-izone-ui-profile="exam-compact" data-izone-consumer="${kind}-practice" data-teacher-product="${kind}" data-m170-product="practice" data-demo-code="${item.code}"><main id="app" class="demo-shell"></main>`;
 }
 html+='<script type="module" src="./app.mjs?v=20261030-1"></script><noscript>Bật JavaScript để mở nội dung và thao tác thử.</noscript></body></html>\n';
 html=html.replace(/[\t ]+$/gm,'');
 const dataText=json(data);await fs.writeFile(path.join(out,'data',item.code+'.json'),dataText,'utf8');await fs.writeFile(path.join(out,item.code+'.html'),html,'utf8');
 const qids=data.kind==='practice'?data.definition.groups.flatMap(g=>g.questions.map(q=>q.n)):null;
 if(qids&&new Set(qids).size!==qids.length)throw Error('Duplicate questions '+item.code);
 catalog.push({...item,title:data.title,kind:data.kind,...(data.subject?{subject:data.subject}:{}),href:item.code+'.html',parts:data.parts?.length??null,questions:qids?.length??data.content?.questions?.length??null,fields:data.content?.targets?.length??data.content?.items?.length??null,version:data.version??data.content?.version??null,contentSha256:sha(dataText)});
}
await fs.writeFile(path.join(out,'catalog.json'),json(catalog),'utf8');
const groups=[...new Set(catalog.map(x=>x.group))];
await fs.writeFile(path.join(out,'index.html'),head('Thư viện bài demo',['shared/master170/theme.css'])+`<body data-m170-product="practice"><main class="demo-catalog"><img src="../shared/master170/assets/izone-logo-color.png" alt="IZONE" width="145"><h1>Thư viện bài demo cho giảng viên</h1><p>Chọn bài để mở ngay nội dung và thao tác thử. Không cần đăng nhập. Khi giao bài thật, <a href="https://docs.google.com/document/d/17d2BlBjwvXwTwytiZnIeiMUkO59eBd7-6FVAdwJKoxg/edit" target="_blank" rel="noopener">lấy CTA từ tài liệu gốc</a>.</p>${groups.map(g=>`<section><h2>${e(g)}</h2><ul>${catalog.filter(x=>x.group===g).map(x=>`<li><a href="./${x.href}">${e(x.title)}<small>${e(x.code)}</small></a></li>`).join('')}</ul></section>`).join('')}</main></body></html>\n`,'utf8');
console.log(JSON.stringify({count:catalog.length,groups:Object.fromEntries(groups.map(g=>[g,catalog.filter(x=>x.group===g).length])),out}));

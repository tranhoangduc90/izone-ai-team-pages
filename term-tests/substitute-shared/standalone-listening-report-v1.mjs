import {bindListeningReport} from './listening-report-v1.mjs';
import {substituteListeningReportMap} from './listening-report-maps-v1.mjs';
import {captureListeningEvidence,renderListeningEvidence} from '../term-test-2-computer-based/listening-report-evidence-v1.mjs';

const day=24*60*60*1000;
const reportsUnavailable=new Set([400,401,403,404,410]);

export async function verifyStandaloneListeningPackage(content,sourceSlug){
  const profile=substituteListeningReportMap(sourceSlug);
  const sections=content?.listening?.sections;
  const expected=new Set(content?.controls?.map(row=>String(row.number))||[]);
  if(!profile||content?.sourceSlug!==sourceSlug||sections?.length!==4||expected.size!==40)
    throw Error('Gói đề Listening chưa đúng bài được cấp.');
  const found=new Set(),images=new Set();
  for(const section of sections){
    const template=document.createElement('template');
    if(typeof section.html!=='string')throw Error('Đề Listening thiếu một Part.');
    template.innerHTML=section.html;
    if(!template.content.textContent.trim())throw Error('Đề Listening thiếu nội dung.');
    for(const slot of template.content.querySelectorAll('[data-answer-slot]')){
      const key=slot.dataset.answerSlot;
      if(!expected.has(key)||found.has(key))throw Error('Đề Listening có vị trí câu trả lời không hợp lệ.');
      found.add(key);
    }
    for(const image of template.content.querySelectorAll('img')){
      const source=image.getAttribute('src');
      const embedded=source?.length<=2*1024*1024&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(source);
      if(!source||!image.alt.trim()||(!embedded&&new URL(source,location.href).origin!==location.origin))
        throw Error('Ảnh đề Listening chưa đúng nguồn.');
      images.add(source);
    }
  }
  if(found.size!==expected.size)throw Error('Đề Listening thiếu ô trả lời.');
  await Promise.all([...images].map(async source=>{
    const image=new Image();image.src=source;
    try{await image.decode();}catch{throw Error('Chưa đọc được ảnh bắt buộc của Listening.');}
  }));
  return profile;
}

export function requireStandaloneListeningVisible(form){
  const sections=[...form.querySelectorAll('.cbt-listening-section')];
  const active=sections.find(section=>!section.hidden);
  const inputKeys=new Set(sections.flatMap(part=>[...part.querySelectorAll('[data-answer-slot] [data-question], [data-answer-slot] [data-number]')]
    .map(field=>field.dataset.question||field.dataset.number)));
  const box=active?.getBoundingClientRect();
  if(sections.length!==4||inputKeys.size!==40||!box?.width||!box.height||!active.textContent.trim()
    ||getComputedStyle(active).visibility!=='visible')throw Error('Vùng đề Listening chưa hiển thị. Audio chưa phát.');
}

export function bindStandaloneListeningReport({profile,audio,form,host,button,active,assetHash,observe}){
  let captured;
  bindListeningReport({audio,button,host,profile,assetHash,active,
    observe(result,positionSeconds){
      if(result.decision!=='expected_audible')captured=undefined;
      observe('manual_report_classified',{reportVersion:1,classification:result.decision,positionAfter:positionSeconds,
        ...(result.gap?{gapId:result.gap.id,remainingSeconds:result.remainingSeconds}:{}),
        ...(result.reason?{classificationReason:result.reason}:{})});
    },
    capture(positionSeconds){
      const reportedAt=new Date().toISOString();
      let view;
      try{view=captureListeningEvidence({player:audio,form,reportedAt,positionSeconds});}catch{}
      captured={reportedAt,positionSeconds,assetHash,operationId:crypto.randomUUID(),view};
    },
  });
  return ()=>{const value=captured;captured=undefined;return value;};
}

export async function sendStandaloneListeningReport({endpoint,proof,report,authorization}){
  if(Date.now()-Date.parse(report.reportedAt)>day)return 'expired';
  let pngBase64;
  try{if(report.view)pngBase64=renderListeningEvidence(report.view);}catch{}
  const reply=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',
    ...(authorization?{Authorization:'Bearer '+authorization}:{})},signal:AbortSignal.timeout(8000),
    body:JSON.stringify({...proof,operationId:report.operationId,reportedAt:report.reportedAt,
      assetHash:report.assetHash,positionSeconds:report.positionSeconds,...(pngBase64?{pngBase64}:{})})});
  if(reportsUnavailable.has(reply.status))return 'rejected';
  const result=await reply.json();
  if(!reply.ok||!result.incidentId)throw Error('LISTENING_REPORT_ACK_MISSING');
  return result.status;
}

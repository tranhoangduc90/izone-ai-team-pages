import {listeningProfiles} from './listening-profiles-v1.mjs';

export async function verifyListeningPreparation(content, config, signal){
  const parts=content?.listening?.sections;
  const controls=config?.listening?.controls;
  const profile=listeningProfiles[config?.slug];
  if(!profile||content?.baseTestSlug!==profile.slug||parts?.length!==profile.parts.length||
      controls?.length!==profile.last-profile.first+1)
    throw Error('Chưa nhận đúng gói đề Listening.');
  const expected=new Set(controls.flatMap(control=>control.kind==='pair'?control.keys:[String(control.number)]));
  const seen=new Set();
  const imageUrls=new Set();
  for(const [index, part] of parts.entries()){
    if(part.label!=='Part '+profile.parts[index]||!part.range||typeof part.html!=='string')throw Error('Gói đề Listening thiếu một Part.');
    const fragment=document.createElement('template');
    fragment.innerHTML=part.html;
    if(!fragment.content.textContent.trim())throw Error('Gói đề Listening thiếu chữ đề.');
    for(const slot of fragment.content.querySelectorAll('[data-answer-slot]')){
      const key=slot.dataset.answerSlot;
      if(!expected.has(key)||seen.has(key))throw Error('Vị trí ô trả lời Listening không khớp gói đề.');
      seen.add(key);
    }
    for(const image of fragment.content.querySelectorAll('img')){
      const source=image.getAttribute('src');
      const url=new URL(source||'',location.href);
      const embeddedPng = source?.length <= 2*1024*1024 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(source);
      if(!source||!image.alt?.trim()||(!embeddedPng&&url.origin!==location.origin))
        throw Error('Ảnh đề Listening chưa đúng phiên bản.');
      imageUrls.add(url.href);
    }
  }
  if(expected.size!==seen.size)throw Error('Gói đề Listening thiếu ô trả lời.');
  await Promise.all([...imageUrls].map(async source=>{
    const image=new Image();
    image.src=source;
    try{await image.decode();}catch{throw Error('Chưa đọc được ảnh bắt buộc của đề Listening.');}
    signal.throwIfAborted();
  }));
  signal.throwIfAborted();
  return {parts:parts.length,questions:controls.length,fields:seen.size,images:imageUrls.size};
}

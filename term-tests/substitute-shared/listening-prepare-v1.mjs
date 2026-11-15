export async function verifyListeningPackage(content, config, signal){
  const sections=content?.listening?.sections;
  const controls=config?.listening?.controls;
  if(content?.baseTestSlug!==config?.slug||sections?.length!==4||!Array.isArray(controls))
    throw Error('Chưa tải đúng gói đề Listening.');
  const expected=new Set(controls.flatMap(control=>control.kind==='pair'?control.keys:[String(control.number)]).map(String));
  const seen=new Set();
  const images=new Set();
  for(const section of sections){
    if(typeof section.html!=='string'||!section.label||!section.range)
      throw Error('Gói đề Listening thiếu nội dung một Part.');
    const fragment=document.createElement('template');
    fragment.innerHTML=section.html;
    if(!fragment.content.textContent.trim())throw Error('Gói đề Listening thiếu chữ đề.');
    for(const slot of fragment.content.querySelectorAll('[data-answer-slot]')){
      const key=slot.dataset.answerSlot;
      if(!expected.has(key)||seen.has(key))throw Error('Vị trí ô trả lời Listening không khớp với đề.');
      seen.add(key);
    }
    for(const image of fragment.content.querySelectorAll('img')){
      const src=image.getAttribute('src');
      const url=new URL(src||'',location.href);
      if(!src||url.origin!==location.origin||!image.alt.trim())
        throw Error('Gói đề Listening có ảnh chưa đúng cấu hình.');
      images.add(url.href);
    }
  }
  if(seen.size!==expected.size||expected.size!==config.listening.totalQuestions)
    throw Error('Chưa đủ vị trí ô trả lời Listening.');
  await Promise.all([...images].map(async src=>{
    const image=new Image();
    image.src=src;
    try{await image.decode();}catch{throw Error('Chưa tải được ảnh của đề Listening.');}
    signal.throwIfAborted();
    if(!image.naturalWidth||!image.naturalHeight)throw Error('Chưa đọc được ảnh của đề Listening.');
  }));
  signal.throwIfAborted();
  return {parts:sections.length,questions:seen.size,images:images.size};
}

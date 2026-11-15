const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function captureListeningEvidence({player, form, reportedAt, positionSeconds}) {
  const viewportWidth=window.innerWidth,viewportHeight=window.innerHeight;
  const region=form.querySelector('#listeningQuestions');
  const section=region?.querySelector('.cbt-listening-section:not([hidden])');
  const title=section?.querySelector('.cbt-section-intro h3');
  const promptNodes=[...section?.querySelectorAll('.cbt-section-intro, .cbt-data-table tr, .cbt-question-heading')||[]];
  const audio=form.querySelector('.cbt-audio-card');
  function block(node) {
    if(!node || node.closest('[hidden]')) return null;
    const rect=node.getBoundingClientRect();
    let left=clamp(rect.left,0,viewportWidth),right=clamp(rect.right,0,viewportWidth);
    let top=clamp(rect.top,0,viewportHeight),bottom=clamp(rect.bottom,0,viewportHeight);
    for(let parent=node;parent&&parent!==document.body;parent=parent.parentElement){
      const style=getComputedStyle(parent);
      if(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')return null;
      if(parent!==node){
        const clip=parent.getBoundingClientRect();
        if(/hidden|clip|scroll|auto/.test(style.overflowX)){left=Math.max(left,clip.left);right=Math.min(right,clip.right);}
        if(/hidden|clip|scroll|auto/.test(style.overflowY)){top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom);}
      }
      if(right<=left||bottom<=top)return null;
    }
    if(right<=left || bottom<=top) return null;
    return {x:left,y:top,width:right-left,height:bottom-top};
  }
  const part=Number(section?.dataset.sectionIndex);
  return {
    reportedAt,positionSeconds,viewportWidth,viewportHeight,
    duration:Number.isFinite(player.duration)?player.duration:null,
    state:player.error?'lỗi tải':player.paused?'đang dừng':'đang phát',
    title:block(title),region:block(region),audio:block(audio),
    part:Number.isInteger(part)?part+1:null,promptCount:promptNodes.length,
    prompts:promptNodes.slice(0,40).map(block).filter(Boolean),
    answers:[...(section||region)?.querySelectorAll('[data-number]')||[]].slice(0,40).map(block).filter(Boolean),
  };
}

export function renderListeningEvidence(view) {
  // Rebuilt from bounded geometry, without student text, typed values, or page content.
  const canvas=document.createElement('canvas');
  const width=canvas.width=900;
  const height=canvas.height=520;
  const ctx=canvas.getContext('2d');
  if(!ctx) throw Error('LISTENING_REPORT_IMAGE_UNAVAILABLE');
  function box(col,x,y,w,h) {
    ctx.fillStyle=col;
    ctx.fillRect(x,y,w,h);
  }
  function label(text,x,y,size=17,col='#16304c') {
    ctx.fillStyle=col;
    ctx.font=size+'px sans-serif';
    ctx.fillText(text,x,y);
  }
  box('#edf2f8',0,0,width,height);
  label('Term Test 2 K67 · Listening',20,31,23);
  label('Audio '+view.state+' · '+view.positionSeconds.toFixed(1)+' giây · '
    +view.viewportWidth+' × '+view.viewportHeight,20,59);
  const offsetX=20,offsetY=78;
  const scale=Math.min((width-2*offsetX)/Math.max(view.viewportWidth,1),
    (height-offsetY-55)/Math.max(view.viewportHeight,1));
  const draw=(r,col)=>{
    if(r)box(col,offsetX+r.x*scale,offsetY+r.y*scale,Math.max(2,r.width*scale),Math.max(2,r.height*scale));
  };
  box('#fff',offsetX,offsetY,view.viewportWidth*scale,view.viewportHeight*scale);
  draw(view.region,'#dbe7f4');
  draw(view.audio,'#829ebc');
  for(const prompt of view.prompts)draw(prompt,'#9cb5d3');
  draw(view.title,'#1d4a77');
  for(const field of view.answers)draw(field,'#b6cbe0');
  label((view.part?'Part '+view.part:'Chưa thấy Part')
    +' · '+view.prompts.length+'/'+view.promptCount+' khối đề trong vùng nhìn'
    +' · '+view.answers.length+' ô thấy được',20,482);
  label('Ảnh dựng từ bố cục lúc báo · Đáp án đã che',20,507,15);
  const uri=canvas.toDataURL('image/png');
  const prefix='data:image/png;base64,';
  if(!uri.startsWith(prefix)) throw Error('LISTENING_REPORT_IMAGE_UNAVAILABLE');
  return uri.slice(prefix.length);
}

// Chỉ dựng các thẻ cố định từ văn bản nhận xét. HTML, ảnh và URL đầu vào không được thực thi.
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Chỉ bỏ nguyên đoạn hệ thống cũ; không sửa văn bản riêng do giảng viên biên tập.
export function overallFeedback(value){
  const text=String(value??'');
  return /^AI đã đối chiếu \d+ câu: \d+ câu cần sửa và \d+ câu có gợi ý nâng cấp\. Em đọc góp ý từng câu và phần ý, mạch bài bên dưới\. AI chưa đối chiếu handout\/outline đã làm trên lớp; nhận xét chỉ dựa trên đề và bài viết được nộp\. Giảng viên cần kiểm tra trước khi trả bài\.$/.test(text.trim().replace(/\s+/g,' '))?'':text;
}
function inline(text,depth=0,offset=0,ranges=[]){
  if(depth>8)return escape(text);
  let out='',i=0;
  while(i<text.length){
    if(text[i]==='\\'&&/[\\`*_#]/.test(text[i+1]||'')){out+=escape(text[i+1]);i+=2;continue;}
    const token=text[i]==='`'?text.slice(i).match(/^`+/)[0]:text.startsWith('**',i)?'**':text.startsWith('__',i)?'__':['*','_'].includes(text[i])?text[i]:null;
    if(token){
      const end=text.indexOf(token,i+token.length),body=end<0?'':text.slice(i+token.length,end);
      if(body.trim()&&(!/^\s|\s$/.test(body)||token[0]==='`')){
        const tag=token[0]==='`'?'code':token.length===2?'strong':'em';
        out+='<'+tag+'>'+inline(body,depth+1,offset+i+token.length,ranges)+'</'+tag+'>';i=end+token.length;continue;
      }
    }
    const char=escape(text[i]);out+=ranges.some(r=>r.start<=offset+i&&r.end>offset+i)?'<mark class="teacher-highlight">'+char+'</mark>':char;i++;
  }
  return out;
}
export function feedbackInlineHtml(value){return inline(String(value??''));}
export function feedbackTextHtml(value,ranges=[]){
  const raw=String(value??''),lines=raw.split(/\r\n?|\n/);
  const offsets=[0];for(const match of raw.matchAll(/\r\n?|\n/g))offsets.push(match.index+match[0].length);
  const formatted=(text,line=i)=>inline(text,0,offsets[line]+lines[line].indexOf(text),ranges);
  const bullet=line=>{const m=line.match(/^(\s*)([-+*]|\d+[.)])\s+(.+)$/);return m?{indent:m[1].replace(/\t/g,'    ').length,ordered:/^\d/.test(m[2]),number:parseInt(m[2],10),text:m[3]}:null;};
  let i=0,out='',paragraph=[];
  const flush=()=>{if(paragraph.length){out+='<p>'+paragraph.join('<br>')+'</p>';paragraph=[];}};
  function list(indent,ordered,depth=0){
    const first=bullet(lines[i]),tag=ordered?'ol':'ul';let html='<'+tag+(ordered&&first.number!==1?' start="'+Math.min(first.number,999999)+'"':'')+'>';
    while(i<lines.length){
      const item=bullet(lines[i]);if(!item||item.indent!==indent||item.ordered!==ordered)break;
      html+='<li>'+formatted(item.text);i++;
      while(i<lines.length){
        const nested=bullet(lines[i]);
        if(nested&&nested.indent>indent){if(depth<12)html+=list(nested.indent,nested.ordered,depth+1);else{html+='<br>'+formatted(nested.text);i++;}continue;}
        if(!nested&&lines[i].trim()&&/^\s+/.test(lines[i])&&lines[i].match(/^\s*/)[0].length>indent){html+='<br>'+formatted(lines[i].trim());i++;continue;}
        break;
      }
      html+='</li>';
    }
    return html+'</'+tag+'>';
  }
  while(i<lines.length){
    const line=lines[i],heading=line.match(/^\s{0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/),item=bullet(line);
    if(!line.trim()){flush();i++;continue;}
    if(/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)){flush();out+='<hr>';i++;continue;}
    if(heading){flush();const tag=heading[1].length>3?'h5':'h4';out+='<'+tag+'>'+formatted(heading[2])+'</'+tag+'>';i++;continue;}
    if(item){flush();out+=list(item.indent,item.ordered);continue;}
    paragraph.push(formatted(line));i++;
  }
  flush();return out.replaceAll('</mark><mark class="teacher-highlight">','');
}
export function feedbackBlockHtml(value,ranges=[]){return '<div class="feedback-text feedback-rich">'+feedbackTextHtml(value,ranges)+'</div>';}

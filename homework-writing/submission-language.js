// Luật nhận bài riêng của Homework, mở rộng theo yêu cầu ngày 29/10/2026.
// Chạy đồng bộ tại máy chủ, không gọi AI/API và không đọc outline/nhận xét GV.
const vietnameseMark=/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/iu;
// Các từ mượn thông dụng vẫn dùng trong bài tiếng Anh.
const englishLoans=new Set('café cafés résumé résumés cliché clichés exposé exposés fiancé fiancée fiancés fiancées décor entrée entrées touché soufflé passé blasé déjà açaí sauté sautéed naïveté'.split(' '));
// Không chặn riêng các từ trùng tiếng Anh như an, ban, can, do, in, on, me, to.
const distinctiveWords=new Set('khong duoc nhieu nguoi nhung toi chao'.split(' '));
const phrases=[
 'xin chao','tieng viet','toi la','toi yeu','toi nghi','toi muon','toi thay','toi di','toi hoc','toi thich','toi co','toi se','toi khong',
 'minh la','minh nghi','minh muon','em la','em nghi','em chua','em thay','em muon','em co','em khong','em da sua',
 'hom nay','ngay nay','bai viet','bai lam','di hoc','di lam','hoc sinh','giao vien','dong phuc','thoi trang','van de','vi vay','boi vi','theo toi',
 'phat trien','kinh te','cai thien','doi song','xa hoi','con nguoi','moi truong','bao ve','giai phap','tac dong','giao duc','cong nghe','thanh pho','du lich',
 'hanh vi','mua sam','ngan sach','tai chinh','tat ca','ket qua','ket luan','nuoc ngoai','tac hai','loi ich','tich cuc','tieu cuc','hoat dong','anh huong',
 'can phai','nen lam','can thiet','rat tot','rat dep','cam on ban','cam on thay','cam on co','cam on em'
].map(s=>s.split(' '));
// Các cụm này mơ hồ trong bài Anh (ví dụ "turn the cam on", "the ban than").
// Chỉ dùng chúng khi chính cụm là toàn bộ một câu/đoạn ngắn.
const standalonePhrases=new Set(['cam on','an com','o nha','di cho','co the','day la','do la','ban be','ban than','rat hay']);
const fold=s=>s.normalize('NFKD').replace(/[\p{M}\p{Cf}]/gu,'').replace(/đ/gi,'d').toLowerCase();

export function vietnameseWritingError(text){
 const words=[...text.matchAll(/[\p{L}\p{M}\p{Cf}]+/gu)].map(m=>({start:m.index,end:m.index+m[0].length,value:m[0],folded:fold(m[0])}));
 const hits=[];
 for(const word of words){
  const normalized=word.value.normalize('NFC').replace(/\p{Cf}/gu,'').toLowerCase();
  if((vietnameseMark.test(normalized)&&!englishLoans.has(normalized))||distinctiveWords.has(word.folded))hits.push([word.start,word.end]);
 }
 for(let i=0;i<words.length;i++){
  for(const phrase of phrases){
   if(words[i].folded!==phrase[0]||i+phrase.length>words.length)continue;
   if(phrase.every((part,n)=>words[i+n].folded===part&&(n===0||/^[\s\p{Cf}]+$/u.test(text.slice(words[i+n-1].end,words[i+n].start)))))hits.push([words[i].start,words[i+phrase.length-1].end]);
  }
 }
 for(let i=0;i+1<words.length;i++){
  const first=words[i],last=words[i+1];
  if(standalonePhrases.has(first.folded+' '+last.folded)&&/^[\s\p{Cf}]+$/u.test(text.slice(first.end,last.start))&&
    (i===0||/[\n.!?;]/u.test(text.slice(words[i-1].end,first.start)))&&
    (i+2===words.length||/[\n.!?;]/u.test(text.slice(last.end,words[i+2].start))))hits.push([first.start,last.end]);
 }
 if(!hits.length)return null;
 const ranges=[];
 for(const range of hits.sort((a,b)=>a[0]-b[0]||a[1]-b[1])){
  const last=ranges.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else ranges.push([...range]);
 }
 return {code:'VIETNAMESE_WRITING',message:'Bài đang có tiếng Việt (có dấu hoặc không dấu). Em chuyển phần này sang tiếng Anh rồi nộp lại nhé. Bản nháp của em vẫn được giữ.',ranges};
}

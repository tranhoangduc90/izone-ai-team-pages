export function submissionLength(text){return Array.from(String(text).normalize('NFC').trim().replace(/\s+/gu,' ')).length;}
export function basicSubmissionError(text){
 if(!String(text).trim())return {code:'EMPTY_ESSAY',message:'Em hãy nhập bài trước khi nộp.'};
 if(submissionLength(text)<50)return {code:'ESSAY_TOO_SHORT',message:'Bài của em chưa đủ 50 ký tự. Em viết tiếp rồi nộp lại nhé.'};
 return null;
}

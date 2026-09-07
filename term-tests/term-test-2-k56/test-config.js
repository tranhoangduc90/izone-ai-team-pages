(function () {
  const range = (start, end, kind = 'text', options) => Array.from({length:end-start+1}, (_,i) => ({number:start+i,kind,...(options?{options}:{})}));
  const letters = end => Array.from({length:end.charCodeAt(0)-64}, (_,i)=>String.fromCharCode(65+i));
  const roman = ['i','ii','iii','iv','v','vi','vii','viii','ix'];
  window.TERM_TEST_CONFIG = Object.freeze({
    slug:'term-test-2-k56', title:'Term Test 2 · Khóa 56', intro:'Làm bài trực tiếp trên nội dung đề. Mỗi kỹ năng được lưu và nộp độc lập.',
    listening:{title:'Listening · 40 câu',durationSeconds:1824,totalQuestions:40,
      description:['Bài nghe gồm 4 phần và 40 câu.','Audio chỉ phát sau khi tải đủ và hoàn thành bước nghe thử.'],
      controls:[...range(1,10),...range(11,15,'select',letters('H')),...range(16,20),...range(21,27,'select',letters('I')),...range(28,40)]},
    reading:{title:'Reading · 3 passages · 40 câu',durationMinutes:60,totalQuestions:40,
      description:['Bạn có 60 phút để hoàn thành 3 passages và 40 câu.','Câu 24–26: chọn ba đáp án khác nhau, không phụ thuộc thứ tự.'],
      controls:[...range(1,6,'select',roman),...range(7,10),...range(11,13,'select',letters('C')),...range(14,17),...range(18,23,'select',['TRUE','FALSE','NOT GIVEN']),...range(24,26,'select',letters('G')),...range(27,32,'select',roman.slice(0,8)),...range(33,36,'select',letters('D')),...range(37,40)]},
    writing:{durationMinutes:30,planningMinutes:10,totalQuestions:1}
  });
}());

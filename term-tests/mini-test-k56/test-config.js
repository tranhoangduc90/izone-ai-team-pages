(function () {
  const range = (start,end,kind='text',options) => Array.from({length:end-start+1},(_,i)=>({number:start+i,kind,...(options?{options}:{})}));
  window.TERM_TEST_CONFIG = Object.freeze({
    slug:'mini-test-k56', title:'Mini Test · Khóa 56', intro:'Làm bài trực tiếp trên đề; bài làm của Mini Test được lưu riêng.',
    listening:{title:'Listening · 10 câu',durationSeconds:446,totalQuestions:10,
      description:['Preston Park Run · 10 câu.','Audio Section 1 từ nguồn Notion do người dùng cung cấp.'],controls:range(1,10)},
    reading:{title:'Reading · 1 passage · 13 câu',durationMinutes:20,totalQuestions:13,
      description:['Bạn có 20 phút để hoàn thành 13 câu.'],controls:[...range(1,5),...range(6,9,'select',['TRUE','FALSE','NOT GIVEN']),...range(10,13)]},
    writing:{durationMinutes:15,planningMinutes:3,totalQuestions:1}
  });
}());

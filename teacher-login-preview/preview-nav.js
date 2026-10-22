// Bản thử riêng chỉ chứa dữ liệu mẫu. Điều hướng giữ nguyên cùng origin Google.
(()=>{const base='/izone-ai-team-pages/teacher-login-preview/';const insert=()=>{
 if(document.getElementById('sso-preview-nav'))return;
 const box=document.createElement('aside');box.id='sso-preview-nav';box.setAttribute('aria-label','Bản thử đăng nhập');
 const title=document.createElement('strong');title.textContent='BẢN THỬ RIÊNG · Dữ liệu mẫu · Chưa chuyển sản phẩm thật';box.append(title);
 for(const [label,path]of [['Trang đầu',''],['Handout','writing-handouts/lesson5/teacher.html?class=IC2304'],['K56','term-tests/teacher-k56/?class=IC2264'],['K56 demo','term-tests/teacher-k56/?class=CODEXDEMO56'],['Substitute','term-tests/substitute-test-1-k67-results/?class=DEMO']]){const a=document.createElement('a');a.textContent=label;a.href=base+path;box.append(a);}document.body.prepend(box);
};insert();new MutationObserver(insert).observe(document.body,{childList:true});})();

import { assignmentClient } from './assignment-browser.mjs?v=sitting-release-20261122';

const notice=document.querySelector('[data-substitute-sitting]');
const api=assignmentClient('https://ducizone.ddns.net/substitute-teacher-api/assignments/v1/');
const testId=notice?.dataset.substituteSitting;
let timer,failures=0;

async function check() {
  clearTimeout(timer);
  if(!notice?.isConnected)return;
  if(document.hidden){timer=setTimeout(check,10000);return;}
  try{
    const state=await api('student/sitting',{query:{testId}});
    failures=0;
    if(!state.enabled){notice.hidden=true;return;}
    notice.hidden=state.state==='open';
    notice.textContent='Ngoài giờ thi · Ca đang dừng nhận lượt mới.';
  }catch(error){
    if(error.message==='NOT_FOUND')return;
    failures++;
    notice.hidden=false;
    notice.textContent='Chưa kiểm tra được giờ mở ca. Trang sẽ thử lại.';
  }
  timer=setTimeout(check,Math.min(30000,7000 * 2 ** failures)+Math.floor(Math.random()*1500));
}

void check();

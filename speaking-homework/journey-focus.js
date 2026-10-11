// Mở mới đến đầu bài; bài đã nộp đến biên nhận. Không kéo focus khi đang gõ.
export function focusSpeakingStart(submitted) {
  const target=document.querySelector(submitted?'#completion-card h2':'#lesson-hero h1');
  if(!target)return;
  target.tabIndex=-1;
  target.focus({preventScroll:true});
  target.scrollIntoView({block:'start',behavior:'instant'});
}

export function lesson6CompletionConfirmed(state, hasUnsavedChanges) {
  return !hasUnsavedChanges && state.completed === true && state.practice?.status === 'accepted' &&
    ['body1_topic', 'body2_topic'].every(key => state.steps?.[key]?.status === 'passed');
}

export function lesson7TransferEligible(offer, completed, version) {
  return completed && offer?.eligible === true && !offer.suspended && offer.version === version;
}

export function mountLesson6Completion(container) {
  const notice = document.createElement('section');
  notice.className = 'answer-card homework-completion';
  const title = document.createElement('h2');
  title.textContent = 'Bạn đã hoàn thành Homework Writing Lesson 6';
  const detail = document.createElement('p');
  detail.textContent = 'Bài của bạn đã được lưu. Bạn có thể đóng trang này.';
  notice.append(title, detail);
  container.replaceChildren(notice);
}

// Keep the only Lesson 7 action immediately below the question, including on mobile.
export function mountLesson7Transfer(prompt, transfer) {
  const region = document.createElement('div');
  region.className = 'lesson5-bridge';
  region.id = 'lesson7-transfer';
  region.hidden = true;
  const description = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = 'Tiếp tục với Handout Lesson 7';
  const help = document.createElement('p');
  help.textContent = 'Dùng các ý của Thân bài 2 để xây dàn ý A–X–B.';
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  description.append(title, help, status);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary';
  button.textContent = 'Luyện tập Handout Writing Lesson 7 →';
  region.append(description, button);
  prompt.after(region);

  button.addEventListener('click', async () => {
    if (region.hidden || button.disabled) return;
    button.disabled = true;
    status.textContent = 'Đang chuyển ý sang Lesson 7…';
    try { await transfer(); }
    catch (error) {
      status.textContent = error.message === 'LESSON7_SOURCE_CHANGED'
        ? 'Dàn ý Homework vừa thay đổi. Hãy xem lại rồi bấm chuyển lần nữa.'
        : error.message === 'LESSON7_SOURCE_INCOMPLETE'
          ? 'Dàn ý cần đạt lại phần đối chiếu trước khi chuyển.'
          : 'Chưa chuyển được ý. Bài Lesson 6 đã lưu vẫn được giữ.';
    } finally { button.disabled = false; }
  });

  return (offer, completed, version) => {
    const hidden = !lesson7TransferEligible(offer, completed, version);
    if (region.hidden === hidden) return;
    region.hidden = hidden;
    if (hidden) status.textContent = '';
  };
}

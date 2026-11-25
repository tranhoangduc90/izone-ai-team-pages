// Dùng cùng vị trí và lớp CSS của nút chuyển từ Homework Lesson 4.
export function mountLesson7Transfer(prompt, transfer, openLesson7) {
  const region = document.createElement('div');
  region.className = 'lesson5-bridge';
  region.id = 'lesson7-transfer';
  const description = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = 'Tiếp tục với Handout Lesson 7';
  const help = document.createElement('p');
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'text-button';
  open.textContent = 'Mở dàn ý Lesson 7';
  description.append(title, help, open, status);
  const button = document.createElement('button');
  const dockButton = document.createElement('button');
  for (const item of [button, dockButton]) {
    item.type = 'button';
    item.className = 'primary';
    item.textContent = 'Đưa kết quả sang Lesson 7 →';
  }
  region.append(description, button);
  prompt.after(region);
  const dock = document.createElement('div');
  dock.className = 'lesson5-bridge-dock';
  dock.hidden = true;
  const dockStatus = document.createElement('p');
  dockStatus.className = 'lesson7-dock-status';
  dockStatus.setAttribute('role', 'status');
  dockStatus.hidden = true;
  dock.append(dockStatus, dockButton);
  document.body.append(dock);
  const mobile = matchMedia('(max-width: 700px)');
  let visible = true, eligible = false, busy = false;
  function update() {
    const editing = document.activeElement?.matches('input,textarea,select,[contenteditable=true]');
    const keyboard = window.visualViewport && innerHeight - window.visualViewport.height > 130;
    dock.hidden = !mobile.matches || visible || region.hidden || !eligible || Boolean(editing || keyboard || document.querySelector('dialog[open]'));
    document.body.classList.toggle('lesson5-bridge-dock-open', !dock.hidden);
    button.disabled = dockButton.disabled = !eligible || busy;
    open.disabled = busy;
  }
  function message(text) {
    status.textContent = dockStatus.textContent = text;
    dockStatus.hidden = !text;
  }
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
  observer.observe(region);
  mobile.addEventListener('change', update);
  window.visualViewport?.addEventListener('resize', update);
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', () => queueMicrotask(update));
  const click = async () => {
    if (!eligible || busy) return;
    busy = true;
    update();
    message('Đang chuyển ý sang Lesson 7…');
    try { await transfer(); }
    catch (error) {
      message(error.message === 'LESSON7_SOURCE_CHANGED'
        ? 'Dàn ý Homework vừa thay đổi. Hãy xem lại rồi bấm chuyển lần nữa.'
        : error.message === 'LESSON7_SOURCE_INCOMPLETE'
          ? 'Dàn ý cần đạt lại phần đối chiếu trước khi chuyển.'
          : 'Chưa chuyển được ý. Bài Lesson 6 đã lưu vẫn được giữ.');
    } finally { busy = false; update(); }
  };
  open.addEventListener('click', async () => {
    if(busy)return;
    busy=true;
    update();
    message('Đang mở dàn ý Lesson 7…');
    try { await openLesson7(); }
    catch { message('Chưa mở được Lesson 7. Hãy lưu bài Homework rồi thử lại.'); }
    finally { busy=false; update(); }
  });
  button.addEventListener('click', click);
  dockButton.addEventListener('click', click);
  return (offer, completedSteps) => {
    region.hidden = !offer;
    eligible = offer?.eligible === true;
    button.hidden = offer?.suspended === true;
    open.hidden = eligible;
    help.textContent = offer?.suspended ? 'Có thể mở dàn ý đã lưu hoặc tự nhập ý.' : eligible ? 'Dùng các ý của Thân bài 2 để xây dàn ý A–X–B.' : completedSteps === 2
      ? 'Hãy bổ sung phần đối chiếu chung trước khi chuyển ý.' : 'Hoàn thành Check hai thân và phần đối chiếu chung để chuyển ý.';
    update();
  };
}

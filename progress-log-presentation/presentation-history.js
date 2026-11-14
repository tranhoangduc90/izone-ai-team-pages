/* Lưu bản hiển thị của mỗi nhịp. Xem lại dùng DOM tĩnh, không chạy script hay yêu cầu API. */
export function createPresentationHistory(onKey) {
  const panel = document.createElement('div');
  panel.className = 'presenter-history';
  panel.popover = 'manual';
  const snapshots = [];
  let frames = [];
  let revision = 0;
  document.body.append(panel);

  const path = element => {
    const indexes = [];
    for (let node = element; node?.parentElement; node = node.parentElement) {
      indexes.unshift([...node.parentElement.children].indexOf(node));
    }
    return indexes;
  };
  const follow = (doc, indexes) => indexes.reduce((node, index) => node?.children[index], doc.documentElement);
  const shell = doc => [...doc.head.querySelectorAll('link[rel=stylesheet],style')].map(node => node.outerHTML).join('');

  function remember(index, doc, overlay, target, pointerVisible) {
    const body = doc.body.cloneNode(true);
    const original = [...doc.body.querySelectorAll('input,textarea,select')];
    [...body.querySelectorAll('input,textarea,select')].forEach((node, i) => {
      const live = original[i];
      if (node.tagName === 'TEXTAREA') node.textContent = live.value;
      else if (node.tagName === 'SELECT') {
        [...node.options].forEach((option, j) => option.toggleAttribute('selected', live.options[j].selected));
      } else {
        node.setAttribute('value', live.value);
        node.toggleAttribute('checked', live.checked);
      }
    });
    const scroll = [...doc.body.querySelectorAll('*')].filter(node => node.scrollTop || node.scrollLeft)
      .map(node => [path(node), node.scrollLeft, node.scrollTop]);
    const modal = doc.querySelector('dialog:modal');
    const current = doc.activeElement;
    const copy = overlay.cloneNode(true);
    copy.removeAttribute('popover');
    copy.classList.add('presenter-history-layer');
    const aux = doc === document ? '' : '<link rel="stylesheet" href="' + new URL('presentation.css', import.meta.url).href + '">';
    const banner = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
    // Ghi đường dẫn phần tử trước khi bỏ script và khung điều khiển ra khỏi bản xem lại.
    const copiedNode = indexes => follow({ documentElement: { children: [null, body] } }, indexes);
    const mark = (node, attribute) => node && copiedNode(path(node))?.setAttribute(attribute, '');
    if (current && current !== doc.body) mark(current, 'data-history-focus');
    if (modal) mark(modal, 'data-history-modal');
    if (target?.ownerDocument === doc) mark(target, 'data-history-target');
    scroll.forEach(([indexes], i) => copiedNode(indexes)?.setAttribute('data-history-scroll', String(i)));
    body.querySelectorAll('script,iframe,object,embed,.presenter-layer,.presenter-history').forEach(node => node.remove());
    for (const node of body.querySelectorAll('dialog[open]')) {
      if (node.hasAttribute('data-history-modal')) node.removeAttribute('open');
    }
    const page = doc.documentElement.cloneNode(false);
    page.removeAttribute('class');
    for (const name of page.getAttributeNames()) if (name.startsWith('data-presentation-')) page.removeAttribute(name);
    const head = doc.createElement('head');
    head.innerHTML = banner + shell(doc) + aux;
    page.append(head, body);
    snapshots[index] = {
      html: '<!doctype html>' + page.outerHTML,
      overlay: copy,
      pointerVisible,
      scroll, x: doc.defaultView.scrollX, y: doc.defaultView.scrollY,
    };
  }

  function raise() {
    if (!frames.length || !panel.matches(':popover-open')) return;
    // Giữ bản đang đọc ở trên cả hộp thoại thật khi chuẩn bị nhịp chưa xem.
    if (document.querySelector('dialog:modal')) {
      panel.hidePopover();
      panel.showPopover();
    }
  }

  async function show(index, { focus = true } = {}) {
    const snapshot = snapshots[index];
    if (!snapshot) throw Error('Nhịp này chưa có bản lưu.');
    const generation = ++revision;
    const frame = document.createElement('iframe');
    frame.title = 'Progress Log';
    frame.className = 'presenter-history-frame';
    frame.setAttribute('sandbox', 'allow-same-origin');
    frames.push(frame);
    const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
    frame.srcdoc = snapshot.html;
    panel.append(frame);
    if (!panel.matches(':popover-open')) panel.showPopover();
    await loaded;
    if (generation !== revision) return;
    const doc = frame.contentDocument;
    const overlay = doc.adoptNode(snapshot.overlay.cloneNode(true));
    doc.body.append(overlay);
    const modal = doc.querySelector('[data-history-modal]');
    if (modal) {
      modal.showModal();
      overlay.setAttribute('popover', 'manual');
      overlay.showPopover();
    }
    await doc.fonts.ready;
    if (generation !== revision) return;
    frame.contentWindow.scrollTo(snapshot.x, snapshot.y);
    for (const element of doc.querySelectorAll('[data-history-scroll]')) {
      const [, x, y] = snapshot.scroll[Number(element.dataset.historyScroll)];
      element.scrollTo(x, y);
    }
    const target = doc.querySelector('[data-history-target]');
    function positionOverlay() {
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const { innerWidth, innerHeight } = frame.contentWindow;
      const left = Math.max(4, rect.left - 5);
      const top = Math.max(4, rect.top - 5);
      const width = Math.min(innerWidth - 4, rect.right + 5) - left;
      const height = Math.min(innerHeight - 4, rect.bottom + 5) - top;
      const visible = width > 0 && height > 0 && target.getClientRects().length > 0;
      const spotlight = overlay.querySelector('.presenter-focus');
      spotlight.classList.toggle('visible', visible);
      Object.assign(spotlight.style, {
        left: left + 'px', top: top + 'px',
        width: Math.max(0, width) + 'px', height: Math.max(0, height) + 'px',
      });
      const pointer = overlay.querySelector('.presenter-pointer');
      pointer.classList.toggle('visible', visible && snapshot.pointerVisible);
      if (visible && snapshot.pointerVisible) {
        const x = rect.left + Math.min(rect.width * .52, 170);
        const y = rect.top + rect.height * .55;
        pointer.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
      }
    }
    positionOverlay();
    frame.contentWindow.addEventListener('resize', positionOverlay);
    doc.addEventListener('scroll', positionOverlay, { capture: true, passive: true });
    doc.addEventListener('click', event => event.preventDefault(), true);
    frame.style.visibility = 'visible';
    frames.filter(other => other !== frame).forEach(other => other.remove());
    frames = [frame];
    frame.contentWindow.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        overlay.querySelector('.presenter-focus').classList.remove('visible');
        overlay.querySelector('.presenter-pointer').classList.remove('visible');
        event.preventDefault();
      } else onKey(event);
    }, true);
    if (focus) {
      frame.contentWindow.focus();
      doc.querySelector('[data-history-focus]')?.focus({ preventScroll: true });
    }
  }

  function hide() {
    revision++;
    if (panel.matches(':popover-open')) panel.hidePopover();
    frames.forEach(frame => frame.remove());
    frames = [];
  }

  return { remember, show, hide, raise, has: index => Boolean(snapshots[index]) };
}

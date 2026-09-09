(function () {
  'use strict';
  // Dàn ý lưu riêng theo lượt thi/Task. Máy chủ giữ mốc đầu tiên; chuyển tab không khởi động lại giờ.
  // Lỗi mạng giữ chữ trên thiết bị và hiện trạng thái chờ lưu, không sửa bài luận hoặc điểm.
  window.TermTestWritingPlanning = {
    create({ state, tasks, saveSession, request, demoMode }) {
      const cards = new Map();
      const operations = new Map();
      const saveTimers = new Map();
      const owner = state.attemptToken || (demoMode ? 'demo' : '');
      if (state.writingPlanning?.attemptToken !== owner) state.writingPlanning = { attemptToken: owner, tasks: {} };
      const plans = state.writingPlanning.tasks;
      const now = () => Date.now() + (Number(state.serverTimeOffsetMs) || 0);
      const duration = id => id === 'task1' ? 5 : 10;
      const node = (tag, className, text) => {
        const result = document.createElement(tag);
        result.className = className;
        if (text) result.textContent = text;
        return result;
      };
      function planFor(id) {
        return plans[id] ||= { outline: '', revision: 0, dirty: false, startedAt: '', deadlineAt: '' };
      }
      function render(id) {
        const card = cards.get(id);
        if (!card) return;
        const plan = planFor(id);
        const globalDeadline = Date.parse(state.writingDeadlineAt || '');
        const ended = state.writingSubmitted || (Number.isFinite(globalDeadline) && now() >= globalDeadline);
        card.editor.disabled = !plan.startedAt || ended || Boolean(plan.conflict);
        const deadline = Math.min(Date.parse(plan.deadlineAt || ''), globalDeadline);
        const seconds = Math.max(0, Math.ceil((deadline - now()) / 1000));
        const label = !plan.startedAt ? `${duration(id)} phút đầu khi bắt đầu Task này`
          : ended ? 'Writing đã kết thúc'
            : seconds > 0 ? `Lập dàn ý · còn ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
              : 'Đã hết giờ dàn ý · chuyển sang viết bài';
        card.clock.textContent = label;
        card.clock.classList.toggle('is-essay', Boolean(plan.startedAt) && seconds === 0);
        card.retry.hidden = !plan.error || ended || Boolean(plan.conflict);
        card.status.textContent = plan.conflict ? 'Có bản mới trên thiết bị khác. Dàn ý trên máy này được giữ lại; hãy tiếp tục trên thiết bị đã lưu bản mới.'
          : plan.error || (plan.dirty ? 'Dàn ý đang chờ lưu trên hệ thống…' : plan.startedAt ? 'Dàn ý đã lưu riêng · không tính vào số từ bài viết' : 'Dàn ý không tính vào số từ bài viết');
      }
      async function send(id, action) {
        const plan = planFor(id);
        if (plan.conflict) throw new Error('Dàn ý có xung đột giữa các thiết bị.');
        const captured = { outline: plan.outline, revision: plan.revision };
        const response = demoMode ? {
          ok: true, accepted: true, planning: {
            taskNumber: Number(id.slice(-1)), outline: plan.outline, revision: plan.revision,
            startedAt: plan.startedAt || new Date(now()).toISOString(),
            deadlineAt: plan.deadlineAt || new Date(Math.min(now() + duration(id) * 60000, Date.parse(state.writingDeadlineAt))).toISOString()
          }
        } : await request('/api/term-tests/writing/planning', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attemptToken: state.attemptToken, taskNumber: Number(id.slice(-1)), action,
            ...(action === 'save' ? captured : {}) })
        });
        const incoming = response.planning;
        if (!incoming || incoming.taskNumber !== Number(id.slice(-1))) throw new Error('Chưa xác nhận được dàn ý của Task này.');
        if (response.serverNow) state.serverTimeOffsetMs = Date.parse(response.serverNow) - Date.now();
        if (response.accepted === false) {
          plan.conflict = true;
          throw new Error('Dàn ý có bản mới trên thiết bị khác.');
        }
        plan.startedAt = incoming.startedAt;
        plan.deadlineAt = incoming.deadlineAt;
        if (!plan.dirty) {
          plan.outline = incoming.outline;
          plan.revision = incoming.revision;
          cards.get(id).editor.value = plan.outline;
        } else if (action === 'save' && plan.revision === captured.revision) {
          plan.dirty = false;
        } else if (action === 'start' && incoming.revision > plan.revision) {
          plan.conflict = true;
        }
        plan.error = '';
        saveSession();
        render(id);
        return response;
      }
      function enqueue(id, action) {
        const operation = (operations.get(id) || Promise.resolve()).catch(() => undefined).then(() => send(id, action));
        operations.set(id, operation);
        return operation.catch(error => {
          planFor(id).error = 'Chưa lưu được dàn ý · chữ vẫn được giữ trên thiết bị này';
          saveSession();
          render(id);
          throw error;
        });
      }
      function scheduleSave(id) {
        clearTimeout(saveTimers.get(id));
        saveTimers.set(id, setTimeout(() => enqueue(id, 'save').catch(() => {
          if (!state.writingSubmitted && !planFor(id).conflict) saveTimers.set(id, setTimeout(() => scheduleSave(id), 5000));
        }), 900));
      }
      async function activate(id) {
        if (state.stage !== 'writing' || !state.writingStarted || state.writingSubmitted || !cards.has(id)) return;
        const currentOwner = state.attemptToken || (demoMode ? 'demo' : '');
        if (state.writingPlanning.attemptToken !== currentOwner) {
          if (state.writingPlanning.attemptToken) throw new Error('Lượt thi đã thay đổi; hãy mở lại trang để tránh lẫn dàn ý.');
          state.writingPlanning.attemptToken = currentOwner;
        }
        // API start lặp lại chỉ đọc mốc cũ; không có thời gian mới khi refresh hoặc mở tab khác.
        await enqueue(id, 'start');
        if (planFor(id).dirty) scheduleSave(id);
      }
      function attach(task, parent) {
        const plan = planFor(task.id);
        const section = node('section', 'writing-outline-card');
        const header = node('header', '');
        const clock = node('span', 'cbt-writing-phase');
        clock.setAttribute('role', 'timer');
        header.append(node('strong', '', `Dàn ý ${task.label}`), clock);
        const editor = node('textarea', 'writing-outline-editor');
        editor.dataset.writingOutline = task.id;
        editor.setAttribute('aria-label', `Dàn ý Writing ${task.label}`);
        editor.spellcheck = false;
        editor.maxLength = 12000;
        editor.value = plan.outline;
        const status = node('p', 'writing-outline-status');
        status.setAttribute('role', 'status');
        const retry = node('button', 'button', 'Thử lưu dàn ý lại');
        retry.type = 'button';
        retry.addEventListener('click', () => activate(task.id).catch(() => undefined));
        editor.addEventListener('input', () => {
          plan.outline = editor.value;
          plan.revision += 1;
          plan.dirty = true;
          saveSession();
          render(task.id);
          scheduleSave(task.id);
        });
        cards.set(task.id, { editor, clock, status, retry });
        section.append(header, editor, status, retry);
        parent.append(section);
        render(task.id);
      }
      const onStage = () => activate(state.writingLayout.activeTask).catch(() => undefined);
      window.addEventListener('term-test:writing-stage', onStage);
      const tick = () => { for (const id of cards.keys()) render(id); };
      let timer = setInterval(tick, 1000);
      window.addEventListener('pagehide', () => { clearInterval(timer); saveSession(); });
      window.addEventListener('pageshow', event => {
        if (!event.persisted) return;
        clearInterval(timer);
        timer = setInterval(tick, 1000);
        tick();
        onStage();
      });
      return {
        attach,
        activate: id => activate(id).catch(() => undefined),
        async flush() {
          for (const id of cards.keys()) {
            clearTimeout(saveTimers.get(id));
            await (operations.get(id) || Promise.resolve()).catch(() => undefined);
            if (planFor(id).dirty) await enqueue(id, 'save');
          }
        }
      };
    }
  };
})();

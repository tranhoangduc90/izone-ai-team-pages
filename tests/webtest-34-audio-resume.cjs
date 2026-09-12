// Kiểm tra resume audio Learning bằng browser, không gọi API/audio bên ngoài.
async page => {
  const site = page.url().split('/term-tests/')[0];
  const url = site + '/term-tests/webtest-34-demo/index.html#test=11111111-1111-4111-8111-111111111111';
  const storageKey = 'izone_course34_phase1_test1_prototype_v1';
  const attemptToken = '11111111-1111-4111-8111-111111111111';
  const expiresAt = '2099-01-01T00:00:00.000Z';
  const calls = [];
  const beacons = [];
  const external = [];
  const pageErrors = [];
  const ensure = (value, message) => { if(!value) throw Error(message); };
  const checkpoint = (body, completed = false) => ({
    audioKey: body.audioKey,
    lastHeardSeconds: body.lastHeardSeconds,
    checkpointedAt: '2098-12-31T23:59:00.000Z',
    completedAt: completed ? '2098-12-31T23:59:01.000Z' : null
  });
  const resume = {
    attemptToken,
    status: 'active',
    resumable: true,
    reason: 'active',
    expiresAt,
    serverNow: '2098-12-31T23:58:00.000Z',
    checkpoints: [{
      audioKey: 'vocabulary',
      lastHeardSeconds: 42.5,
      checkpointedAt: '2098-12-31T23:50:00.000Z',
      completedAt: null
    }]
  };

  await page.addInitScript(({storageKey, attemptToken}) => {
    localStorage.setItem(storageKey, JSON.stringify({
      startedAt: Date.parse('2098-12-31T23:00:00.000Z'),
      studentRef: '22222222-2222-4222-8222-222222222222',
      studentName: 'Học viên audio',
      classCode: 'IC2293',
      answers: {},
      audioFlags: { vocabulary: { started: true, finished: true } },
      learning: {
        attemptToken,
        definitionHash: 'a'.repeat(64),
        status: 'active',
        expiresAt: Date.parse('2099-01-01T00:00:00.000Z')
      }
    }));
    const times = new WeakMap();
    const playing = new WeakSet();
    Object.defineProperties(HTMLMediaElement.prototype, {
      readyState: { configurable: true, get: () => 4 },
      duration: { configurable: true, get: () => 120 },
      currentTime: {
        configurable: true,
        get(){ return times.get(this) || 0; },
        set(value){ times.set(this, Number(value) || 0); }
      },
      ended: { configurable: true, get: () => false }
    });
    HTMLMediaElement.prototype.load = function(){
      queueMicrotask(() => this.dispatchEvent(new Event('canplaythrough')));
    };
    HTMLMediaElement.prototype.play = function(){
      playing.add(this);
      window.__audioPlayCount = (window.__audioPlayCount || 0) + 1;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function(){ playing.delete(this); };
    window.__beacons = [];
    navigator.sendBeacon = (url, body) => {
      const record = {url, type: body?.type || '', size: body?.size || 0};
      window.__beacons.push(record);
      if(body?.text) body.text().then(text => { record.body = JSON.parse(text); });
      return true;
    };
  }, {storageKey, attemptToken});

  page.on('pageerror', error => pageErrors.push(error.message));
  await page.context().route('**/*', async route => {
    const request = route.request();
    const requestUrl = request.url();
    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: {'access-control-allow-origin': '*'},
      body: JSON.stringify(body)
    });
    if(requestUrl.includes('/term-tests/webtest-34-demo/config.js')) {
      return route.fulfill({
        contentType: 'application/javascript',
        body: `window.WEBTEST_34_PREVIEW_CONFIG=Object.freeze({LEARNING_API_BASE_URL:'https://learning.test',AUDIO:{soundcheck:{remote:'https://assets.test/soundcheck.mp3'},vocabulary:{remote:'https://assets.test/vocabulary.mp3'},listening:{remote:'https://assets.test/listening.mp3'}}});`
      });
    }
    if(requestUrl.startsWith('https://learning.test/') && request.method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'Content-Type'
        }
      });
    }
    if(requestUrl === 'https://learning.test/api/learning/attempts/audio/resume') {
      return json({ok: true, resume});
    }
    if(requestUrl === 'https://learning.test/api/learning/attempts/audio/checkpoint') {
      const body = request.postDataJSON();
      calls.push(body);
      return json({ok: true, checkpoint: checkpoint(body, body.completed)});
    }
    if(requestUrl.startsWith(site + '/')) return route.continue();
    if(requestUrl.startsWith('https://assets.test/') || requestUrl.startsWith('https://fonts.googleapis.com/')) {
      return route.abort();
    }
    external.push(requestUrl);
    return route.abort();
  });

  await page.goto(url);
  await page.locator('#examApp').waitFor({state: 'visible'});
  const resumeButton = page.locator('[data-audio-resume="vocabulary"]');
  await resumeButton.waitFor({state: 'visible'});
  ensure((await resumeButton.innerText()).includes('Tiếp tục từ 00:42'), 'Không hiện mốc resume từ server.');
  ensure(await page.evaluate(() => window.__audioPlayCount || 0) === 0, 'Refresh tự động phát audio.');
  ensure(await page.locator('[data-audio-content="vocabulary"]').isVisible(), 'Resume không mở nội dung Vocabulary.');

  const beforeUnloadWhileActive = await page.evaluate(() => {
    const event = new Event('beforeunload', {cancelable: true});
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  ensure(beforeUnloadWhileActive, 'beforeunload không chặn khi track đang dở.');

  await resumeButton.click();
  await page.waitForFunction(() => window.__audioPlayCount === 1);
  const restoredTime = await page.evaluate(() => {
    const audio = [...document.querySelectorAll('audio')].find(el => el.src.includes('vocabulary.mp3'));
    return audio?.currentTime;
  });
  ensure(restoredTime === 42.5, `Không seek đúng vị trí server: ${restoredTime}`);

  await page.evaluate(() => {
    const audio = [...document.querySelectorAll('audio')].find(el => el.src.includes('vocabulary.mp3'));
    audio.currentTime = 55.25;
    Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'hidden'});
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
  });
  await page.waitForFunction(() => window.__beacons?.some(item => item.body?.audioKey === 'vocabulary'));
  const lifecycleBeacon = await page.evaluate(() => window.__beacons.find(item => item.body?.audioKey === 'vocabulary'));
  ensure(lifecycleBeacon.type === 'application/json', 'Lifecycle checkpoint không dùng application/json Blob.');
  ensure(lifecycleBeacon.body.attemptToken === attemptToken, 'Lifecycle checkpoint sai attempt token.');
  ensure(lifecycleBeacon.body.audioKey === 'vocabulary', 'Lifecycle checkpoint sai audio key.');
  ensure(lifecycleBeacon.body.lastHeardSeconds === 55.25, 'Lifecycle checkpoint không lấy currentTime mới nhất.');

  await resumeButton.click();
  await page.waitForFunction(() => window.__audioPlayCount === 2);
  await page.evaluate(() => {
    const audio = [...document.querySelectorAll('audio')].find(el => el.src.includes('vocabulary.mp3'));
    audio.currentTime = 70;
    audio.dispatchEvent(new Event('ended'));
  });
  await new Promise(resolve => setTimeout(resolve, 50));
  ensure(calls.some(body => body.completed === true), 'ended không gửi checkpoint completed.');
  ensure(calls.find(body => body.completed === true).attemptToken === attemptToken, 'Completion sai attempt token.');
  ensure(calls.find(body => body.completed === true).audioKey === 'vocabulary', 'Completion sai audio key.');
  await page.locator('[data-audio-controls="vocabulary"]').filter({hasText: 'Đã phát xong'}).waitFor();
  const beforeUnloadAfterCompletion = await page.evaluate(() => {
    const event = new Event('beforeunload', {cancelable: true});
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  ensure(!beforeUnloadAfterCompletion, 'beforeunload vẫn chặn sau completedAt từ server.');

  await page.reload();
  await page.locator('#examApp').waitFor({state: 'visible'});
  await page.locator('[data-audio-resume="vocabulary"]').waitFor({state: 'visible'}).catch(() => {});
  ensure(await page.evaluate(() => window.__audioPlayCount || 0) === 0, 'Reload tự động phát audio.');
  ensure((await page.locator('[data-audio-controls="vocabulary"]').innerText()).includes('Tiếp tục từ 00:42'), 'Reload không dùng server resume position.');
  ensure(external.length === 0, 'Fixture gọi mạng ngoài: ' + external.join(', '));
  ensure(pageErrors.length === 0, 'Trang phát sinh lỗi: ' + pageErrors.join(', '));
  return {outcome: 'success', checks: ['server resume 42.5s', 'lifecycle Blob checkpoint', 'ended completion', 'beforeunload', 'conflicting local flags']};
}

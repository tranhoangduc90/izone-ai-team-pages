import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';

process.env.K56_FIXTURE_IMPORT_ONLY = '1';
const {fixture, wait} = await import('./term2-offline-browser.mjs');
const term1 = process.env.TERM1_HARDWARE_TEST === '1';
const mini = process.env.MINI_HARDWARE_TEST === '1';
assert.ok(!(term1 && mini), 'Select a single audio fixture');
const demo = (mini ? process.env.MINI_FIXTURE_DEMO : term1 ? process.env.TERM1_FIXTURE_DEMO : process.env.TERM2_TEST_DEMO) === '1';
const evidenceDir = mini ? process.env.MINI_EVIDENCE : term1 ? process.env.TERM1_EVIDENCE : process.env.TERM2_EVIDENCE;

async function installDeviceSimulation(page) {
  await page.addInitScript(() => {
    const actions = new Map();
    const devices = new EventTarget();
    const lab = window.listeningDeviceLab = {
      actions, devices, rows: [], selected: '', outputs: ['default', 'stereo', 'speakers'],
      behavior: 'resolve', switches: [], permissionCalls: [],
    };
    devices.enumerateDevices = async () => lab.outputs.map(deviceId => ({kind:'audiooutput', deviceId}));
    for (const method of ['selectAudioOutput', 'getUserMedia']) devices[method] = () => {
      lab.permissionCalls.push(method);
      return Promise.reject(new DOMException('Unexpected permission request', 'NotAllowedError'));
    };
    Object.defineProperty(navigator, 'mediaDevices', {value: devices});
    Object.defineProperty(navigator, 'mediaSession', {value: {
      setActionHandler(action, handler) { if (handler) actions.set(action, handler); else actions.delete(action); },
      setPositionState() {},
    }});
    Object.defineProperty(HTMLMediaElement.prototype, 'sinkId', {get: () => lab.selected, configurable: true});
    Object.defineProperty(HTMLMediaElement.prototype, 'setSinkId', {
      configurable: true,
      get() {
        if (lab.behavior === 'unsupported') return undefined;
        return async (sink) => {
          lab.switches.push({samePlayer:this === lab.player, sink, at:Math.round(this.currentTime * 1000)});
          if (lab.behavior === 'reject') throw new DOMException('Simulated unavailable device', 'NotAllowedError');
          if (lab.behavior === 'wait') await new Promise(done => { lab.finishSwitch = done; });
          lab.selected = sink;
        };
      },
    });
  });
}

async function start(exam, mode) {
  const {page} = exam;
  exam.controls.r2Audio = true;
  exam.controls.listeningReportsEnabled = true;
  exam.controls.listeningRecoveryEnabled = true;
  exam.controls.preparedOverride = {[mini ? 'miniCbtParallelEntry' : term1 ? 'term1ParallelEntry' : 'term2ParallelEntry']:true};
  await installDeviceSimulation(page);
  await page.goto(exam.url);
  await page.locator(`#bootstrapStudent option[value="${exam.student}"]`).waitFor({state:'attached'});
  await page.selectOption('#bootstrapStudent', exam.student);
  await page.click('#confirmIdentity');
  await wait(page, () => (window.K56_MINI_OFFLINE || window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE)?.active, 'Prepared Listening attempt');
  if (mode === 'read_first') {
    await page.getByRole('button', {name:'Bắt đầu Reading', exact:true}).click();
    await page.locator('#readingQuestions input[data-number]').first().fill('Reading before device simulation');
    await page.click('#submitReading');
  }
  await page.click('#bootstrapPreview');
  await page.click('#bootstrapStart', {timeout:45000});
  await wait(page, () => (window.K56_MINI_OFFLINE || window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE)?.player?.currentTime > 0.5, 'Main MP3 advances');
  await page.evaluate(() => {
    const lab = window.listeningDeviceLab, runtime = (window.K56_MINI_OFFLINE || window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE);
    const original = runtime.observe.bind(runtime);
    runtime.observe = (action, row) => {
      if (action.startsWith('audio_') || action.startsWith('listening_')) lab.rows.push({action, ...structuredClone(row)});
      return original(action, row);
    };
    lab.player = runtime.player;
    lab.source = lab.player.getAttribute('src');
    lab.latePlay = lab.actions.get('play');
    lab.lateAppPlay = runtime.listeningController.play;
  });
}

for (const mode of ['read_first','lis_first']) {
  test(`${mini?'Mini':term1?'Term 1':'Term 2'} K56 simulates output changes and headset commands (${mode})`, {timeout:120000}, async () => {
    const exam = await fixture(mode, {demo,product:mini?"mini":term1?1:2});
    const {page} = exam;
    const collector = evidenceDir && resolve(evidenceDir, `${mode}-hardware-collector.jsonl`);
    if (collector) exam.controls.journalBatchFile = collector;
    const cases = [];
    const answer = 'Nháp giữ qua các tín hiệu tai nghe giả lập';
    const input = page.locator('#listeningQuestions input[data-number]').first();
    const snapshot = () => page.evaluate(() => {
      const lab = window.listeningDeviceLab, audio = lab.player;
      return {position:Math.round(audio.currentTime * 1000), rate:audio.playbackRate, paused:audio.paused,
        samePlayer:audio === (window.K56_MINI_OFFLINE || window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).player, sameSource:audio.getAttribute('src') === lab.source};
    });
    async function outputChange(label, {outputs, selected, behavior, commands = [], outcome, switches = 0}) {
      const before = await snapshot();
      const startIndex = await page.evaluate(({outputs, selected, behavior, commands}) => {
        const lab = window.listeningDeviceLab;
        const start = lab.rows.length;
        lab.outputs = outputs;
        if (selected !== undefined) lab.selected = selected;
        if (behavior) lab.behavior = behavior;
        lab.devices.dispatchEvent(new Event('devicechange'));
        for (const action of commands) lab.actions.get(action)({action});
        return start;
      }, {outputs,selected,behavior,commands});
      await page.waitForFunction(({startIndex,outcome}) => window.listeningDeviceLab.rows.slice(startIndex)
        .some(row=>row.action === 'audio_output_result' && row.outcome === outcome), {startIndex,outcome});
      await page.waitForFunction(position => Math.round(window.listeningDeviceLab.player.currentTime * 1000) >= position + 180, before.position);
      const after = await snapshot();
      const details = await page.evaluate(start => ({rows:window.listeningDeviceLab.rows.slice(start),
        switches:window.listeningDeviceLab.switches.length}), startIndex);
      const change = details.rows.find(row => row.action === 'audio_device_change');
      const result = details.rows.find(row => row.action === 'audio_output_result' && row.outcome === outcome);
      assert.equal(result.outputChangeId, change.outputChangeId);
      assert.equal(result.playerId, change.playerId);
      assert.equal(details.switches, switches);
      assert.equal(after.samePlayer && after.sameSource && !after.paused && after.rate === 1, true);
      assert.ok(after.position - before.position < 2500);
      assert.equal(details.rows.some(row => row.action === 'audio_command'), false);
      assert.equal(details.rows.filter(row => row.action === 'audio_media_action' && row.disposition === 'ignored').length, commands.length);
      cases.push({label, before, after, outcome, changes:details.rows.filter(row => ['audio_device_change','audio_output_result','audio_media_action'].includes(row.action))});
    }
    try {
      await start(exam, mode);
      await input.fill(answer);
      await outputChange('Bluetooth power off, default route', {outputs:['default','speakers'],
        commands:['pause','stop','seekbackward','seekforward','seekto','play'], outcome:'default_route_unobserved'});
      await outputChange('Simulated Zoom opens mic and switches to Hands-Free', {outputs:['default','handsfree','speakers'],
        commands:['pause'], outcome:'default_route_unobserved'});
      await outputChange('Simulated Zoom closes mic and restores Stereo', {outputs:['default','stereo','speakers'],
        outcome:'default_route_unobserved'});
      await outputChange('Virtual endpoint is visible and selected', {outputs:['default','virtual-cable','speakers'],
        selected:'virtual-cable', outcome:'selected_sink_still_listed'});
      await outputChange('Browser hides device identifiers', {outputs:['default'], outcome:'unobserved'});
      await outputChange('Virtual endpoint is disabled, default fallback succeeds', {outputs:['default','speakers'],
        outcome:'resolved', switches:1, commands:['pause']});
      await outputChange('Bluetooth selected during simulated Zoom call', {outputs:['default','handsfree','speakers'],
        selected:'handsfree', outcome:'selected_sink_still_listed', switches:1});
      await outputChange('Pinned Hands-Free device drops, default fallback is rejected', {outputs:['default','speakers'],
        behavior:'reject', outcome:'rejected', switches:2, commands:['pause']});
      await outputChange('Stereo selected on engine without setSinkId', {outputs:['default','stereo','speakers'],
        selected:'stereo', behavior:'unsupported', outcome:'selected_sink_still_listed', switches:2});
      await outputChange('Stereo disappears on engine without setSinkId', {outputs:['default','speakers'],
        outcome:'unsupported', switches:2});
      await outputChange('Visible Stereo pin before burst of device signals', {outputs:['default','stereo','speakers'],
        selected:'stereo', behavior:'wait', outcome:'selected_sink_still_listed', switches:2});
      const burst = await page.evaluate(async () => {
        const lab = window.listeningDeviceLab;
        const start = lab.rows.length;
        lab.outputs = ['default','speakers'];
        const notify = () => lab.devices.dispatchEvent(new Event('devicechange'));
        notify();
        await Promise.resolve();
        notify();
        notify();
        lab.actions.get('pause')({action:'pause'});
        lab.finishSwitch();
        return start;
      });
      await page.waitForFunction(start => window.listeningDeviceLab.rows.slice(start)
        .filter(row=>row.action === 'audio_output_result').length === 3, burst);
      const burstProof = await page.evaluate(start => window.listeningDeviceLab.rows.slice(start), burst);
      const burstChanges = burstProof.filter(row=>row.action === 'audio_device_change');
      assert.deepEqual(burstChanges.map(change=>burstProof.find(row=>row.action === 'audio_output_result' &&
        row.outputChangeId === change.outputChangeId)?.outcome), ['resolved','superseded','unobserved']);
      assert.equal(burstProof.filter(row=>row.action === 'audio_media_action' && row.disposition === 'ignored').length,1);
      assert.equal(burstProof.some(row=>row.action === 'audio_command'),false);
      cases.push({label:'Burst of three output changes while fallback is pending', changes:burstProof});

      const beforeStop = await snapshot();
      await page.evaluate(() => {
        const lab = window.listeningDeviceLab;
        lab.actions.get('stop')({action:'stop'});
        lab.player.pause();
      });
      const resume = page.getByRole('button', {name:'Nghe tiếp', exact:true});
      await resume.waitFor();
      const pause = await page.evaluate(() => (window.K56_MINI_OFFLINE || window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).record.listeningCheckpoint);
      assert.ok(pause.positionMs >= beforeStop.position && pause.positionMs - beforeStop.position < 400);
      assert.equal(pause.resumeCount,0);
      await resume.click();
      await wait(page, () => (window.K56_MINI_OFFLINE || window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).record.listeningCheckpoint?.resumeCount === 1,
        'User resume after simulated Windows Stop');
      const first = await snapshot();
      assert.equal(first.samePlayer && first.sameSource && !first.paused && first.rate === 1, true);
      assert.ok(first.position > pause.positionMs && first.position - pause.positionMs < 1500);
      assert.equal(await input.inputValue(), answer);
      await outputChange('Visible Stereo pin before the learner leaves Listening', {outputs:['default','stereo','speakers'],
        selected:'stereo', behavior:'wait', outcome:'selected_sink_still_listed', switches:3});
      const beforeLeaving = await page.evaluate(() => {
        const lab = window.listeningDeviceLab;
        const start = lab.rows.length;
        lab.finishSwitch = undefined;
        lab.outputs = ['default','speakers'];
        lab.devices.dispatchEvent(new Event('devicechange'));
        lab.devices.dispatchEvent(new Event('devicechange'));
        return start;
      });
      await page.waitForFunction(() => Boolean(window.listeningDeviceLab.finishSwitch));
      await page.getByRole('button',{name:'Báo lỗi âm thanh', exact:true}).click();
      await page.getByRole('button',{name:'Tôi không nghe thấy âm thanh', exact:true}).click();
      await page.getByRole('button',{name:/Tôi đã hiểu\. Đến phần thi tiếp theo/}).click();
      await (mode === 'read_first' ? page.locator('#startWriting') : page.locator('#k56SectionReady button')).waitFor();
      await wait(page, () => (window.K56_MINI_OFFLINE || window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).pending === 0, 'Interruption receipt recorded');
      await page.evaluate(() => window.listeningDeviceLab.finishSwitch());
      await page.waitForFunction(start => window.listeningDeviceLab.rows.slice(start).some(row=>
        row.action === 'audio_output_result' && row.outcome === 'resolved' && row.active === false), beforeLeaving);
      const proof = await page.evaluate(async () => {
        const lab = window.listeningDeviceLab, audio = lab.player;
        lab.latePlay({action:'play'});
        const lateCallback = await lab.lateAppPlay('fixture_late_start').then(()=>'played', error=>error.name);
        return {next:(window.K56_MINI_OFFLINE || window.K56_TERM1_OFFLINE || window.K56_TERM2_OFFLINE).sectionResponse().nextSection, attached:audio.isConnected,
          source:audio.hasAttribute('src'), paused:audio.paused, active:lab.actions.size, switches:lab.switches,
          lateCallback, rows:lab.rows, permissions:lab.permissionCalls};
      });
      assert.deepEqual({next:proof.next,attached:proof.attached,source:proof.source,paused:proof.paused,active:proof.active},
        {next:mode === 'read_first' ? 'writing' : 'reading',attached:false,source:false,paused:true,active:0});
      assert.ok(proof.switches.every(row=>row.samePlayer && row.sink === ''));
      assert.equal(proof.switches.length,4);
      const lateChanges = proof.rows.slice(beforeLeaving).filter(row=>row.action === 'audio_device_change');
      assert.deepEqual(lateChanges.map(change=>proof.rows.find(row=>row.action === 'audio_output_result' &&
        row.outputChangeId === change.outputChangeId)?.outcome), ['resolved','cancelled']);
      assert.deepEqual(proof.permissions,[]);
      assert.ok(proof.rows.some(row=>row.action === 'audio_anomaly' && row.event === 'pause' && row.source === 'unknown'));
      assert.ok(proof.rows.some(row=>row.action === 'audio_media_action' && row.mediaAction === 'play' && row.disposition === 'inactive'));
      assert.equal(proof.lateCallback,'AbortError');
      assert.equal([...exam.receipts.values()].filter(row=>row.section === 'listening' && row.kind === 'interrupt').length,1);
      assert.deepEqual(exam.errors,[]);
      if (collector) {
        const changes = proof.rows.filter(row=>row.action === 'audio_device_change').map(row=>row.outputChangeId);
        const expected = proof.rows.filter(row=>changes.includes(row.outputChangeId));
        const deadline = Date.now() + 12000;
        let written = [];
        let checkpoints = [];
        const has = (action, matcher = () => true) => checkpoints.some(row=>row.action === action && matcher(row));
        const completeJournal = () => has('audio_command', row=>row.command === 'play' && Boolean(row.commandId))
          && has('audio_anomaly', row=>row.event === 'pause' && row.source === 'unknown')
          && has('audio_media_action', row=>row.mediaAction === 'play' && row.disposition === 'inactive')
          && has('audio_player_retired', row=>row.sourceCleared && row.callbacksAborted)
          && has('audio_late_play_blocked', row=>row.reason === 'fixture_late_start' && Boolean(row.disposalId));
        do {
          const contents = await readFile(collector, 'utf8').catch(error => {
            if (error.code !== 'ENOENT') throw error;
            return '';
          });
          checkpoints = contents.trim().split('\n').filter(Boolean).flatMap(line=>JSON.parse(line).rows)
            .map(row=>row.data.checkpointState);
          written = checkpoints.filter(row=>changes.includes(row.outputChangeId));
          if (written.length === expected.length && completeJournal()) break;
          await new Promise(done => setTimeout(done,200));
        } while (Date.now() < deadline);
        const ordered = rows => rows.sort((a,b)=>a.sequence-b.sequence).map(({action,outputChangeId,sequence,outcome,playerId})=>
          ({action,outputChangeId,sequence,outcome,playerId}));
        assert.deepEqual(ordered(written),ordered(expected));
        assert.ok(completeJournal(),'Collector lacked a command, anomaly, media action or cleanup record');
        proof.collectorDeviceSignals = changes.length;
        proof.collectorDeviceRows = written.length;
      }
      if (evidenceDir) await writeFile(resolve(evidenceDir,`${mode}-hardware-simulation.json`),
        JSON.stringify({mode,demo,simulation:true,physicalSignalMeasured:false,cases,pause,first,proof},null,2));
    } finally { await exam.close(); }
  });
}

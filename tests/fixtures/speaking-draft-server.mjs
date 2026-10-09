import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// Nhận source thật và dữ liệu giả; chỉ đổi địa chỉ API trong bản phục vụ cục bộ.
// Không gọi API, database, Classroom hoặc AI thật. Lỗi tuyến lạ trả HTTP 400.
export const learners = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
export const lessons = [
  { number: 2, file: 'index.html', code: '67-speaking-paraphrase', parts: ['paraphrase', 'speaking'] },
  { number: 3, file: 'lesson-3.html', code: '67-speaking-lam_ro', parts: ['clarify_1', 'clarify_2', 'clarify_3', 'freestyle'] },
  { number: 4, file: 'lesson-4.html', code: '67-speaking-diem_giua', parts: ['insert_middle', 'freestyle'] },
  { number: 5, file: 'lesson-5.html', code: '67-speaking-on_tap_lam_ro_diem_giua', parts: ['review_clarify_middle', 'freestyle'] },
  { number: 6, file: 'lesson-6.html', code: '67-speaking-ly_do_hanh_vi', parts: ['benefit_harm', 'reason_action', 'freestyle'] },
];
export const share = index => `https://chatgpt.com/share/00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

export async function startFixture(root, options = {}) {
  root = resolve(root);
  const records = new Map();
  const requests = [];
  let failOpen = false;
  let openCount = 0;
  function record(lesson, ref) {
    const key = `${lesson.code}:${ref}`;
    if (!records.has(key)) {
      const seeded = ref === learners[0];
      const links = new Map();
      const practice = new Map();
      if (seeded) {
        for (const [index, part] of lesson.parts.entries()) {
          if (index === 0 || options.seedAll || options.submitted) links.set(part, {
            part, share_url: share(index + 1), check_status: options.status || 'rejected',
            question_count: 3, analysis_status: 'done',
          });
        }
        if (lesson.number >= 4) for (const slot of [1, 2]) {
          if ((slot === 1 || options.seedAll || options.submitted) && !(options.missingLast && slot === 2)) practice.set(slot, {
            slot, exercise_id: `exercise-${slot}`, share_url: share(10 + slot),
            status: options.status || 'rejected', analysis_status: 'done',
          });
        }
      }
      records.set(key, { links, practice, submitted: Boolean(options.submitted && seeded) });
    }
    return records.get(key);
  }
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/__api/')) {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const body = raw ? JSON.parse(raw) : {};
        const path = url.pathname.slice('/__api'.length);
        requests.push({ path, body });
        const lesson = lessons.find(item => item.code === body.assignmentCode)
          || lessons.find(item => body.accessToken?.startsWith(item.code + ':')) || lessons[4];
        const ref = body.studentRef || learners[0];
        const current = record(lesson, ref);
        let data;
        if (path === '/classes') data = { classes: [{ classCode: 'IC2304', ready: true, assignmentStatus: 'open' }] };
        else if (path === '/identity/resolve') data = { status: 'unique', classCode: 'IC2304', studentRef: ref };
        else if (path === '/assignment/open') data = { assignment: { classCode: 'IC2304' } };
        else if (path === '/assignment/roster') data = { assignment: {
          title: 'Bài kiểm thử · dữ liệu giả', assignmentCode: lesson.code, classCode: 'IC2304', assignmentStatus: 'open',
          students: learners.map((student_ref, index) => ({ student_ref, name: `Hồ sơ thử ${index + 1}` })),
          parts: lesson.parts.map((part_key, index) => ({ part_key, min_questions: lesson.number === 6 ? [0, 2, 1][index] : lesson.number >= 4 && part_key === 'freestyle' ? 1 : 3 })),
          requiredPracticeCount: lesson.number >= 4 ? 2 : 0, doctorEnabled: lesson.number !== 3,
        } };
        else if (path === '/session/start-selected') data = { session: {
          accessToken: `${lesson.code}:${ref}`, classCode: 'IC2304', studentRef: ref,
          documentId: `fixture-${lesson.number}-${ref}`, workUnitId: `fixture-${lesson.number}-${ref}`,
        } };
        else if (path === '/open') {
          openCount += 1;
          if (failOpen) { res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, message: 'Mất kết nối thử nghiệm' })); return; }
          data = { status: current.submitted ? 'submitted' : 'draft', receipt: current.submitted ? { id: 'fixture-receipt' } : null,
            links: [...current.links.values()], practiceLinks: [...current.practice.values()] };
        } else if (path === '/doctor/list') data = { needed: [], allNeeded: [], practiced: [], neededCount: 0, personalCount: 0,
          sharedCatalog: [1, 2].map(index => ({ exercise_id: `exercise-${index}`, title: `Bài giả ${index}`, exercise_url: `https://example.com/exercise-${index}` })) };
        else if (path === '/checks/request') {
          current.links.set(body.part, { part: body.part, share_url: body.url, check_status: 'accepted', question_count: 3, analysis_status: 'done' });
          data = {};
        } else if (path === '/doctor/practice/request' || path === '/doctor/practice/extra/request') {
          const slot = body.slot || 3;
          current.practice.set(slot, { slot, exercise_id: body.exerciseId, share_url: body.url, status: 'accepted', analysis_status: 'done' });
          data = {};
        } else if (path === '/finish') { current.submitted = true; data = { receipt: { id: 'fixture-receipt' } }; }
        else throw Error(`Unexpected fixture API ${path}`);
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ ok: true, ...data }));
        return;
      }
      const file = resolve(root, '.' + url.pathname);
      if (!file.startsWith(root + sep)) throw Error('Outside fixture root');
      let content = await readFile(file);
      if (extname(file) === '.js') content = content.toString('utf8').replaceAll(
        /https:\/\/ducizone\.ddns\.net\/mapping-api\/api\/speaking-homework(?:-independent)?/g, '/__api');
      if (extname(file) === '.html') content = content.toString('utf8').replace('<div class="page-shell">',
        '<div class="page-shell"><p role="note" style="background:#fff2d1;padding:12px">KIỂM THỬ CỤC BỘ · DỮ LIỆU GIẢ · Không ghi bài học viên thật</p>');
      res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' })[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(content);
    } catch (error) { res.writeHead(400); res.end(error.message); }
  });
  await new Promise(resolve => server.listen(options.port || 0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, requests, record, get openCount() { return openCount; },
    setFailOpen(value) { failOpen = value; }, close: () => new Promise(resolve => server.close(resolve)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const fixture = await startFixture(process.argv[2], { port: Number(process.argv[3]) || 8879, status: 'pending' });
  console.log(`Chrome fixture: ${fixture.origin}/speaking-homework/lesson-6.html`);
}

import assert from 'node:assert/strict';
import { demoCheck, needsTeacherEmail, parseShareUrl, safeHomeworkUrl } from '../speaking-homework/logic.mjs';

// Dữ liệu giả kiểm đúng ranh giới giữa link hợp lệ, cảnh báo mềm và chặn nộp.
const a = parseShareUrl(' https://www.chatgpt.com/share/example-id?x=1#part ');
assert.deepEqual(a, { ok: true, url: 'https://chatgpt.com/share/example-id' });
assert.equal(parseShareUrl('https://chatgpt.com/c/private-id').ok, false);
assert.equal(parseShareUrl('https://evil.example/share/example-id').ok, false);
assert.equal(parseShareUrl('http://chatgpt.com/share/example-id').ok, false);
assert.equal(parseShareUrl('https://chatgpt.com/share/').ok, false);
assert.equal(parseShareUrl('https://chatgpt.com/share/example-id/extra').ok, false);

assert.equal(demoCheck('paraphrase', 'pass').kind, 'pass');
assert.equal(demoCheck('paraphrase', 'incomplete').kind, 'blocked');
assert.match(demoCheck('paraphrase', 'incomplete').message, /4\/5/);
assert.equal(demoCheck('speaking', 'incomplete').kind, 'blocked');
assert.match(demoCheck('speaking', 'incomplete').message, /nói lại/);
assert.equal(demoCheck('speaking', 'typing').kind, 'warning');
assert.equal(demoCheck('speaking', 'used').kind, 'blocked');
assert.match(demoCheck('speaking', 'reshare').message, /Homework Lesson 1/);
assert.equal(demoCheck('speaking', 'private').kind, 'blocked');
assert.equal(demoCheck('speaking', 'error').kind, 'blocked');

assert.equal(needsTeacherEmail('TURNED_IN', false, false), true);
assert.equal(needsTeacherEmail('RETURNED', false, false), false);
assert.equal(needsTeacherEmail('TURNED_IN', true, false), false);
assert.equal(needsTeacherEmail('TURNED_IN', false, true), false);
assert.equal(safeHomeworkUrl('https://docs.google.com/document/d/example_id/edit'), 'https://docs.google.com/document/d/example_id/edit');
assert.equal(safeHomeworkUrl('https://classroom.google.com/c/example/a/example'), 'https://classroom.google.com/c/example/a/example');
assert.equal(safeHomeworkUrl('https://evil.example/redirect'), '');
assert.equal(safeHomeworkUrl('javascript:alert(1)'), '');

console.log('Speaking Homework demo: 24 kiểm tra đạt.');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseShareUrl } from '../speaking-homework/logic.mjs';

const wholeChat = 'https://chatgpt.com/share/6a4b8dc6-aa30-83ec-82cb-b235ee51d460';
assert.deepEqual(parseShareUrl(`${wholeChat}?utm=1#part`), { ok: true, url: wholeChat });
for (const input of [
  'https://chatgpt.com/s/t_6ab7c876892881919d9c9cfff0af4c32',
  'https://chatgpt.com/c/6a4b8dc6-aa30-83ec-82cb-b235ee51d460',
  'http://chatgpt.com/share/6a4b8dc6-aa30-83ec-82cb-b235ee51d460',
  'https://chatgpt.com/share/short'
]) assert.equal(parseShareUrl(input).ok, false, input);
assert.match(parseShareUrl('https://chatgpt.com/s/t_6ab7c876892881919d9c9cfff0af4c32').reason,
  /một phản hồi/);

const html = await readFile(new URL('../speaking-homework/lesson-4.html', import.meta.url), 'utf8');
assert.match(html, /id="doctor-list"/);
assert.match(html, /id="doctor-expand"/);
assert.match(html, /id="practice-slots"/);
assert.match(html, /id="extra-practice"/);
assert.match(html, /type="module" src=/);
for (const image of ['voice-input.png', 'iphone-menu.png', 'iphone-select-chat.png',
  'iphone-share-chat.png', 'iphone-share-link.png', 'android-menu.png',
  'android-share.png', 'android-share-link.png', 'link-format.png']) {
  assert.match(html, new RegExp(image.replace('.', '\.')));
}
console.log('Lesson 4: link toàn hội thoại, Bác sĩ AI và hướng dẫn đủ hình đạt.');

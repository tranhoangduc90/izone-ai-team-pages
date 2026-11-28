import assert from 'node:assert/strict';
import test from 'node:test';
import * as ui from '../shared/lesson7-transfer-ui.mjs';

function element(tagName) {
  return {
    tagName, children: [], events: {},
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    setAttribute() {},
    addEventListener(type, fn) { this.events[type] = fn; },
  };
}

globalThis.document = {
  createElement: element, body: element('body'),
  addEventListener() {}, querySelector() { return null; },
};
document.body.classList = { toggle() {} };
globalThis.window = { visualViewport: null };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.IntersectionObserver = class { observe() {} };

test('Lesson 7 has no early link, then offers one button under the prompt', async () => {
  const prompt = { after(node) { this.sibling = node; } };
  let transfers = 0;
  const update = ui.mountLesson7Transfer(prompt, async () => { transfers++; }, async () => {});
  update({ eligible: false, version: 7 }, false, 7);
  assert.equal(prompt.sibling.hidden, true, 'even an ineligible server offer must hide the whole region');
  const offer = { eligible: true, version: 7 };
  update(offer, false, 7);
  assert.equal(prompt.sibling.hidden, true, 'an offer cannot replace confirmation');
  update(offer, true, 6);
  assert.equal(prompt.sibling.hidden, true, 'offer must match the current version');
  update({ ...offer, suspended: true }, true, 7);
  assert.equal(prompt.sibling.hidden, true);
  update(offer, true, 7);
  assert.equal(prompt.sibling.hidden, false);
  const button = prompt.sibling.children.find(node => node.tagName === 'button');
  assert.equal(button.textContent, 'Luyện tập Handout Writing Lesson 7 →');
  assert.equal(document.body.children.length, 0, 'no extra mobile shortcut');
  const first = button.events.click();
  await button.events.click();
  await first;
  assert.equal(transfers, 1);
  update(offer, false, 7);
  await button.events.click();
  assert.equal(prompt.sibling.hidden, true);
  assert.equal(transfers, 1);
});

test('confirmed, current server state shows a text-only completion notice', () => {
  const accepted = {
    completed: true, practice: { status: 'accepted' },
    steps: { body1_topic: { status: 'passed' }, body2_topic: { status: 'passed' } },
  };
  assert.equal(ui.lesson6CompletionConfirmed(accepted, false), true);
  assert.equal(ui.lesson6CompletionConfirmed(accepted, true), false);
  assert.equal(ui.lesson6CompletionConfirmed({ ...accepted, completed: false }, false), false);
  assert.equal(ui.lesson6CompletionConfirmed({ ...accepted, practice: { status: 'pending' } }, false), false);
  const container = element('div');
  ui.mountLesson6Completion(container);
  assert.deepEqual(container.children[0].children.map(child => child.tagName), ['h2', 'p']);
  assert.match(container.children[0].children[1].textContent, /Bạn có thể đóng trang này/);
});

import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const source = process.env.SPEAKING_LOGIC_BASE_PATH
  ? pathToFileURL(process.env.SPEAKING_LOGIC_BASE_PATH).href
  : new URL('../speaking-homework/logic.mjs', import.meta.url).href;
const { parseShareUrl } = await import(source);

const responseOnly = 'https://chatgpt.com/s/t_6ab7c876892881919d9c9cfff0af4c32';
const result = parseShareUrl(responseOnly);
assert.equal(result.ok, false);
assert.match(result.reason, /một phản hồi/);
console.log('Link chia sẻ một phản hồi bị chặn với lời hướng dẫn đúng.');

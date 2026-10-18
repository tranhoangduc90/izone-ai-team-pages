// Link Test thiếu lớp: chỉ tìm lớp từ người đã nhớ và nguồn được phép của bài.
// Một lớp thì chuyển đúng link; nhiều lớp chỉ hỏi lớp, không hỏi lại tên hoặc chọn đại.
import { createStudentIdentityClient } from './student-identity-client.js?v=20261018-identity-v1';
import { createStudentIdentityMemory } from './student-identity.js?v=20261018-identity-v1';

export async function redirectRememberedTestClass({ root, apiBase, testSlug, location = globalThis.location } = {}) {
  const client = createStudentIdentityClient({ memory: createStudentIdentityMemory(), requestIdentity: async input => {
    const response = await fetch(`${apiBase}/api/term-tests/${testSlug}/student-identity`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      cache: 'no-store', signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error('Chưa kiểm được lớp của người học.');
    return response.json();
  } });
  let result;
  try { result = await client.resolveRemembered(); } catch { return false; }
  if (result.status !== 'unique' || !client.isCurrent(result)) return false;
  const codes = [...new Set(result.aliases.map(alias => alias.classCode))];
  if (!codes.length) return false;
  const navigate = code => {
    if (!client.isCurrent(result) || !codes.includes(code)) {
      root.textContent = 'Lựa chọn người học đã đổi ở tab khác. Hãy tải lại để kiểm đúng lớp.';
      return;
    }
    const target = new URL(location.href);
    target.searchParams.set('class', code);
    location.replace(target.href);
  };
  if (codes.length === 1) { navigate(codes[0]); return true; }
  const panel = document.createElement('main');
  panel.className = 'page-shell';
  const heading = document.createElement('h1');
  heading.textContent = 'Chọn lớp cho bài test';
  const text = document.createElement('p');
  text.textContent = 'Đã nhớ người học. Bạn có nhiều lớp phù hợp; hãy chọn lớp của bài này.';
  const label = document.createElement('label');
  label.textContent = 'Lớp ';
  const select = document.createElement('select');
  select.id = 'studentIdentityClassChoice';
  select.add(new Option('Chọn lớp', ''));
  for (const code of codes) select.add(new Option(code, code));
  select.addEventListener('change', () => navigate(select.value));
  label.append(select); panel.append(heading, text, label); root.replaceChildren(panel);
  return true;
}

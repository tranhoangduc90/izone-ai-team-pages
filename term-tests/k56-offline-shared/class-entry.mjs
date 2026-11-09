export const isK56ClassCode = code => /^[A-Z0-9_-]{2,32}$/.test(code);

export function renderK56ClassEntry(host, onChoose) {
  const existing = document.getElementById('k56ClassEntry');
  if (existing) return existing;
  const form = document.createElement('form');
  form.id = 'k56ClassEntry';
  form.className = 'cbt-bootstrap-identity';
  const label = document.createElement('label');
  label.textContent = 'Mã lớp';
  const input = document.createElement('input');
  input.required = true;
  input.maxLength = 32;
  input.placeholder = 'Ví dụ IC2264';
  input.autocomplete = 'off';
  input.spellcheck = false;
  label.append(input);
  const button = document.createElement('button');
  button.className = 'button button-primary';
  button.textContent = 'Chọn lớp';
  form.append(label, button);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const code = input.value.trim().toUpperCase();
    if (!isK56ClassCode(code)) {
      input.setCustomValidity('Nhập mã lớp được giảng viên cung cấp.');
      input.reportValidity();
      return;
    }
    onChoose(code);
  });
  input.addEventListener('input', () => input.setCustomValidity(''));
  host.after(form);
  return form;
}

export const COPY_STUDENT_LINK_LABEL = 'Sao chép link cho học viên';

export function decorateCopyStudentLinkButton(button) {
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(svgNamespace, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(svgNamespace, 'path');
  path.setAttribute('d', 'M10 13a4 4 0 0 0 6 .4l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7m2.4 4.6a4 4 0 0 0-6-.4l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7');
  icon.append(path);
  const label = document.createElement('span');
  label.textContent = COPY_STUDENT_LINK_LABEL;
  button.classList.add('student-assignment-copy');
  button.replaceChildren(icon, label);
  return label;
}

export function studentAssignmentLink(publicToken, {thuy = true} = {}) {
  if (typeof publicToken !== 'string' || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/iu.test(publicToken)) return '';
  const root = new URL(window.PROGRESS_LOG_RELEASE?.root || './', window.location.href);
  const url = new URL(thuy ? 'thuy.html' : './', root);
  url.hash = new URLSearchParams({assignment: publicToken}).toString();
  return url.href;
}

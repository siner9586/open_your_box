const isPersonalRoute = () => window.location.pathname.replace(/\/+/g, '/').endsWith('/personal/');

function injectOptionalPhoneInput() {
  if (!isPersonalRoute()) return;
  const form = document.querySelector('#scan-form');
  const formRow = form?.querySelector('.form-row');
  if (!formRow || formRow.querySelector('#phone')) return;
  const username = formRow.querySelector('#username')?.closest('label');
  const label = document.createElement('label');
  label.textContent = '手机号（可选）';
  const input = document.createElement('input');
  input.id = 'phone';
  input.type = 'tel';
  input.inputMode = 'tel';
  input.placeholder = '138****8888';
  input.autocomplete = 'off';
  label.appendChild(input);
  formRow.insertBefore(label, username || formRow.firstChild);
}

const observer = new MutationObserver(injectOptionalPhoneInput);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', injectOptionalPhoneInput);
window.addEventListener('popstate', injectOptionalPhoneInput);
injectOptionalPhoneInput();

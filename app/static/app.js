// Tiện ích chung cho các trang quản lý.
async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data || {}),
    credentials: 'same-origin',
  });
  let body = {};
  try { body = await res.json(); } catch (e) { /* không phải JSON */ }
  if (!res.ok || body.ok === false) {
    throw new Error(body.message || ('Lỗi ' + res.status + '. Hãy tải lại trang.'));
  }
  return body;
}

function showSaved(text, isError) {
  const el = document.getElementById('saved-indicator');
  if (!el) { if (isError) alert(text); return; }
  el.textContent = text;
  el.classList.toggle('err', !!isError);
  el.hidden = false;
}

// Ô tìm kiếm lọc các dòng có data-search
function bindSearch(inputId, rowSelector) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  input.addEventListener('input', () => {
    const q = norm(input.value.trim());
    document.querySelectorAll(rowSelector).forEach((row) => {
      row.hidden = q && !norm(row.dataset.search || '').includes(q);
    });
  });
}

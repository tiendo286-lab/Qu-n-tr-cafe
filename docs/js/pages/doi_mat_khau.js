import { isManager, loadMe, state } from '../app.js';
import { rpc, sb, viError } from '../sb.js';
import { $, flash, go, html } from '../ui.js';

export async function render({ me }) {
  const form = html`
    ${me.must_change ? html`<div class="alert warn">Bạn đang dùng mật khẩu tạm do quản lý cấp. Hãy đặt mật khẩu riêng trước khi tiếp tục.</div>` : ''}
    <div class="alert error" role="alert" id="pw-err" hidden></div>
    <form class="stack" id="pw-form">
      ${me.must_change ? '' : html`<div class="field"><label for="cu">Mật khẩu hiện tại</label>
        <input class="input" id="cu" type="password" autocomplete="current-password" required></div>`}
      <div class="field"><label for="moi">Mật khẩu mới</label>
        <input class="input" id="moi" type="password" autocomplete="new-password" minlength="6" required>
        <div class="hint">Tối thiểu 6 ký tự.</div></div>
      <div class="field"><label for="lai">Nhập lại mật khẩu mới</label>
        <input class="input" id="lai" type="password" autocomplete="new-password" minlength="6" required></div>
      <button class="btn" type="submit" id="pw-btn">Lưu mật khẩu</button>
    </form>`;
  return {
    title: 'Đổi mật khẩu',
    html: isManager()
      ? html`<div class="page-head"><h1>Đổi mật khẩu</h1></div><div class="card stack" style="max-width:460px">${form}</div>`
      : html`<div class="card stack">${form}</div>`,
    mount() {
      const err = $('#pw-err');
      const btn = $('#pw-btn');
      $('#pw-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        err.hidden = true;
        const moi = $('#moi').value;
        try {
          if (moi.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
          if (moi !== $('#lai').value) throw new Error('Hai lần nhập mật khẩu không khớp.');
          btn.disabled = true;
          const { data } = await sb.auth.getUser();
          if (!state.me.must_change) {
            const { error } = await sb.auth.signInWithPassword({ email: data.user.email, password: $('#cu').value });
            if (error) throw new Error('Mật khẩu hiện tại không đúng.');
          }
          const { error } = await sb.auth.updateUser({ password: moi });
          if (error) throw new Error(viError(error));
          await rpc('app_password_changed');
          await loadMe();
          flash('Đã đổi mật khẩu.');
          go('/');
        } catch (e) {
          err.textContent = viError(e);
          err.hidden = false;
          btn.disabled = false;
        }
      });
    },
  };
}

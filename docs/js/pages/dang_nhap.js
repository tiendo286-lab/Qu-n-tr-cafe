import { loadMe } from '../app.js';
import { rpc, sb, viError } from '../sb.js';
import { $, go, html } from '../ui.js';

const LOGIN_ERROR = 'Mã nhân viên hoặc mật khẩu không đúng. Nếu chưa có mật khẩu, hãy liên hệ quản lý.';

export async function render() {
  return {
    title: 'Đăng nhập',
    html: html`
      <form class="card stack" id="login-form">
        <div class="alert error" role="alert" id="login-err" hidden></div>
        <div class="field">
          <label for="ma">Mã nhân viên</label>
          <input class="input" id="ma" name="ma" placeholder="Ví dụ: 88" autocomplete="username" autocapitalize="off" required autofocus>
        </div>
        <div class="field">
          <label for="mat_khau">Mật khẩu</label>
          <input class="input" id="mat_khau" name="mat_khau" type="password" autocomplete="current-password" required>
        </div>
        <button class="btn" type="submit" id="login-btn">Đăng nhập</button>
      </form>
      <div class="foot">Thiết bị này sẽ giữ đăng nhập cho tới khi bạn bấm Đăng xuất.<br>Chưa có mật khẩu hoặc quên mật khẩu? Liên hệ quản lý để được cấp mật khẩu tạm.</div>`,
    mount() {
      const form = $('#login-form');
      const err = $('#login-err');
      const btn = $('#login-btn');
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        err.hidden = true;
        btn.disabled = true;
        btn.textContent = 'Đang đăng nhập…';
        try {
          const r = await rpc('app_login_email', { p_login: $('#ma').value.trim() });
          if (r.error) throw new Error(LOGIN_ERROR);
          const { error } = await sb.auth.signInWithPassword({ email: r.email, password: $('#mat_khau').value });
          if (error) throw new Error(viError(error));
          await rpc('app_touch_login');
          const me = await loadMe();
          if (!me) throw new Error('Tài khoản không còn hoạt động.');
          go(me.must_change ? '/doi-mat-khau' : '/');
        } catch (e) {
          err.textContent = viError(e);
          err.hidden = false;
          btn.disabled = false;
          btn.textContent = 'Đăng nhập';
        }
      });
    },
  };
}

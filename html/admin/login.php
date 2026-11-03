<?php
require_once __DIR__ . '/../inc/Database.php';
require_once __DIR__ . '/../inc/helpers.php';
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
if (in_array(current_admin()['role'] ?? '', ['admin', 'editor'], true)) { header('Location: /admin/'); exit; }
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content">
<meta name="csrf-token" content="<?= esc(csrf_token()) ?>">
<title>登录 · 后台管理</title>
<link rel="stylesheet" href="/static/css/fa.min.css">
<link rel="stylesheet" href="/static/css/toastr.css">
<link rel="stylesheet" href="/admin/assets/admin.css?v=20261030-5">
<link rel="stylesheet" href="/admin/assets/mobile.css?v=20261030-3">
</head>
<body>
<div class="login-wrap">
  <form class="login-card" id="loginForm">
    <div class="logo">♥</div>
    <h2>后台登录</h2>
    <p>恋爱小窝 · 管理员入口</p>
    <div class="field"><input type="text" name="username" placeholder="账号" required autocomplete="username"></div>
    <div class="field"><input type="password" name="password" placeholder="密码" required autocomplete="current-password"></div>
    <div class="field captcha-row">
      <input type="text" name="captcha" placeholder="验证码" maxlength="4" required>
      <img src="/api/captcha.php" onclick="this.src='/api/captcha.php?'+Date.now()" title="点击刷新" alt="验证码">
    </div>
    <button class="btn primary" type="submit" style="width:100%;justify-content:center;padding:13px">登 录</button>
  </form>
</div>
<script src="/static/js/jquery.min.js"></script>
<script src="/static/js/toastr.js"></script>
<script>
$('#loginForm').on('submit', function (e) {
  e.preventDefault();
  var fd = new FormData(this);
  fd.append('csrf_token', document.querySelector('meta[name=csrf-token]').content);
  fd.append('action', 'login');
  var btn = this.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = '登录中…';
  fetch('/api/user_api.php', { method: 'POST', body: fd, credentials: 'same-origin' })
    .then(r => r.json()).then(res => {
      btn.disabled = false; btn.textContent = '登 录';
      if (res.code === 0) { toastr.success(res.msg); setTimeout(() => location.href = '/admin/', 600); }
      else { toastr.error(res.msg || '登录失败'); document.querySelector('.captcha-row img').click(); }
    }).catch(err => {
      btn.disabled = false; btn.textContent = '登 录';
      toastr.error('网络或服务器异常，请检查 Docker 容器是否正常运行');
      console.error(err);
    });
});
</script>
</body>
</html>

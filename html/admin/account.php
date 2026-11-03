<?php
require_once __DIR__ . '/inc/layout.php';
$user = require_user();
admin_head('账号设置', true);
?>
<div class="card">
  <div class="card-title"><i class="fa-solid fa-user"></i>个人资料</div>
  <form id="profileForm">
    <div class="field"><label for="profileAvatar">头像</label><div class="profile-avatar-row">
      <img id="avatarPreview" src="<?= esc($user['avatar'] ?: '/uploads/demo/avatar_boy.jpg') ?>" alt="头像" style="width:72px;height:72px;border-radius:50%;object-fit:cover">
      <input id="profileAvatar" name="avatar" type="hidden" value="<?= esc($user['avatar']) ?>">
      <label class="btn" for="avatarUpload"><i class="fa-solid fa-camera"></i>更换头像</label>
      <input id="avatarUpload" type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden>
    </div></div>
    <div class="field"><label>用户名</label><input type="text" value="<?= esc($user['username']) ?>" disabled></div>
    <div class="field"><label for="profileNickname">显示昵称</label><input type="text" id="profileNickname" name="nickname" maxlength="32" value="<?= esc($user['nickname']) ?>"></div>
    <div class="field"><label for="profileBirthday">生日</label><input id="profileBirthday" name="birthday" type="date" max="<?= date('Y-m-d') ?>" value="<?= esc($user['birthday'] ?? '') ?>"></div>
    <div class="field"><label for="profileBio">座右铭</label><textarea id="profileBio" name="bio" maxlength="200" rows="3"><?= esc($user['bio']) ?></textarea></div>
    <button class="btn primary" type="submit"><i class="fa-solid fa-floppy-disk"></i>保存资料</button>
  </form>
</div>
<div class="card"><div class="card-title"><i class="fa-solid fa-lock"></i>修改密码</div>
  <form id="passwordForm">
    <div class="field"><label for="oldPassword">当前密码</label><input id="oldPassword" name="old" type="password" required autocomplete="current-password"></div>
    <div class="field"><label for="newPassword">新密码</label><input id="newPassword" name="new" type="password" minlength="6" maxlength="128" required autocomplete="new-password"></div>
    <div class="field"><label for="confirmPassword">确认新密码</label><input id="confirmPassword" name="confirm" type="password" minlength="6" maxlength="128" required autocomplete="new-password"></div>
    <button class="btn primary" type="submit"><i class="fa-solid fa-key"></i>修改密码</button>
  </form>
</div>
<script src="/admin/assets/personal.js?v=20261030"></script>
<script>
document.getElementById('profileForm').addEventListener('submit', async function (event) {
  event.preventDefault();
  const button = this.querySelector('button[type=submit]'); button.disabled = true;
  try {
    await Personal.api('account', 'save', Object.fromEntries(new FormData(this)));
    toastr.success('资料已保存');
    document.querySelector('.topbar-user').textContent = document.getElementById('profileNickname').value || <?= site_json($user['username']) ?>;
  } catch (error) { Personal.error(error); } finally { button.disabled = false; }
});
document.getElementById('avatarUpload').addEventListener('change', async function () {
  const file = this.files[0]; if (!file) return;
  if (file.size > 5 * 1024 * 1024) return toastr.warning('图片不能超过 5MB');
  const body = new FormData(); body.append('file', file); body.append('csrf_token', Admin.csrf());
  const submit = document.querySelector('#profileForm button[type=submit]'); submit.disabled = true;
  try {
    const response = await fetch('/api/upload_image.php', { method:'POST', body, credentials:'same-origin' });
    const result = await response.json(); if (result.code !== 0) throw new Error(result.msg);
    document.getElementById('profileAvatar').value = result.data.url;
    document.getElementById('avatarPreview').src = result.data.url;
  } catch (error) { Personal.error(error); } finally { submit.disabled = false; this.value = ''; }
});
document.getElementById('passwordForm').addEventListener('submit', async function (event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(this));
  if (values.new !== values.confirm) return toastr.warning('两次密码不一致');
  const button = this.querySelector('button'); button.disabled = true;
  try { await Personal.api('account', 'password', values); location.href = '/admin/login.php'; }
  catch (error) { Personal.error(error); button.disabled = false; }
});
</script>
<?php admin_foot(); ?>

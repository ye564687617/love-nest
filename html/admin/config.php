<?php
require_once __DIR__ . '/inc/layout.php';
admin_head('站点设置');
?>
<div class="card">
  <div class="card-title"><i class="fa-solid fa-gear"></i>站点设置</div>
  <div class="field"><label>站点标题 *</label><input type="text" id="c_title" placeholder="恋爱小窝"></div>
  <div class="field"><label>副标题 / 情话</label><input type="text" id="c_subtitle" placeholder="陪伴是最长情的告白~"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="field"><label>男生姓名 *</label><input type="text" id="c_boy_name"></div>
    <div class="field"><label>男生生日</label><input type="date" id="c_boy_birth"></div>
    <div class="field"><label>男生头像</label>
      <div style="display:flex;gap:10px;align-items:center">
        <img id="c_boy_avatar_prev" src="/uploads/demo/avatar_boy.jpg" style="width:52px;height:52px;border-radius:50%;object-fit:cover">
        <input type="hidden" id="c_boy_avatar">
        <button class="btn small" onclick="Config.pickAvatar('boy')"><i class="fa-solid fa-image"></i>选择头像</button>
      </div></div>
    <div class="field"><label>女生姓名 *</label><input type="text" id="c_girl_name"></div>
    <div class="field"><label>女生生日</label><input type="date" id="c_girl_birth"></div>
    <div class="field"><label>女生头像</label>
      <div style="display:flex;gap:10px;align-items:center">
        <img id="c_girl_avatar_prev" src="/uploads/demo/avatar_girl.jpg" style="width:52px;height:52px;border-radius:50%;object-fit:cover">
        <input type="hidden" id="c_girl_avatar">
        <button class="btn small" onclick="Config.pickAvatar('girl')"><i class="fa-solid fa-image"></i>选择头像</button>
      </div></div>
  </div>
  <div class="field"><label>在一起的时间</label><input type="datetime-local" id="c_love_start"></div>
  <div class="field"><label>站点公告</label><textarea id="c_notice" rows="3" placeholder="留空则不显示公告弹窗"></textarea></div>
  <div class="field"><label>ICP 备案号</label><input type="text" id="c_icp" placeholder="留空则不显示"></div>
  <div class="actions" style="justify-content:flex-start"><button class="btn primary" onclick="Config.save()"><i class="fa-solid fa-floppy-disk"></i>保存设置</button></div>
</div>

<div class="card">
  <div class="card-title"><i class="fa-solid fa-heart"></i>小程序权限</div>
  <p class="muted">最多指定两位主人，其他访客只能浏览。未选择的纪念日不会通过小程序公开，原网站展示不变。</p>
  <div class="field"><label>小窝主人</label><div id="miniOwners"></div></div>
  <div class="field"><label>向小程序访客公开的纪念日</label><div id="miniDates"></div></div>
  <div class="actions" style="justify-content:flex-start"><button class="btn primary" id="miniSave">保存小程序权限</button></div>
</div>

<div class="card">
  <div class="card-title"><i class="fa-solid fa-key"></i>修改密码</div>
  <div class="field"><label>原密码</label><input type="password" id="p_old" autocomplete="current-password"></div>
  <div class="field"><label>新密码（至少 6 位）</label><input type="password" id="p_new" autocomplete="new-password"></div>
  <div class="field"><label>确认新密码</label><input type="password" id="p_new2" autocomplete="new-password"></div>
  <div class="actions" style="justify-content:flex-start"><button class="btn primary" onclick="Config.changePwd()">修改密码</button></div>
</div>

<script>
const Config = {
  keys: ['title', 'subtitle', 'boy_name', 'boy_birth', 'boy_avatar', 'girl_name', 'girl_birth', 'girl_avatar', 'love_start', 'notice', 'icp'],

  init() {
    Admin.get('config', 'get').then(cfg => {
      this.keys.forEach(k => {
        const el = document.getElementById('c_' + k);
        if (!el) return;
        let v = cfg[k] || '';
        if (k === 'love_start' && v) v = v.slice(0, 16).replace(' ', 'T');
        if ((k === 'boy_avatar' || k === 'girl_avatar') && v) {
          document.getElementById('c_' + k + '_prev').src = v;
        }
        el.value = v;
      });
    });
  },

  pickAvatar(who) {
    Admin.pickImage(url => {
      document.getElementById('c_' + who + '_avatar').value = url;
      document.getElementById('c_' + who + '_avatar_prev').src = url;
    });
  },

  save() {
    const title = Admin.el('c_title').value.trim();
    const boy = Admin.el('c_boy_name').value.trim();
    const girl = Admin.el('c_girl_name').value.trim();
    if (!title) return toastr.warning('站点标题不能为空');
    if (!boy || !girl) return toastr.warning('男生 / 女生姓名不能为空');
    let love = Admin.el('c_love_start').value;
    if (love && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(love)) return toastr.warning('在一起的时间格式不正确');
    if (love) love = love.replace('T', ' ') + ':00';
    // 用 cfg[key] 形式提交，后端可解析为数组
    const data = {};
    this.keys.forEach(k => {
      let v = document.getElementById('c_' + k).value.trim();
      if (k === 'love_start') v = love;
      data['cfg[' + k + ']'] = v;
    });
    Admin.api('config', 'set', data).then(() => this.init());
  },

  changePwd() {
    const oldP = Admin.el('p_old').value, nw = Admin.el('p_new').value, nw2 = Admin.el('p_new2').value;
    if (!oldP) return toastr.warning('请输入原密码');
    if (nw.length < 6) return toastr.warning('新密码至少 6 位');
    if (nw !== nw2) return toastr.warning('两次输入的新密码不一致');
    Admin.confirm('确定修改密码吗？修改后需要重新登录。').then(ok => {
      if (!ok) return;
      Admin.api('config', 'password', { old: oldP, new: nw }).then(() => {
        Admin.el('p_old').value = Admin.el('p_new').value = Admin.el('p_new2').value = '';
        setTimeout(() => location.href = '/admin/login.php', 1200);
      });
    });
  },
};
Config.init();
</script>
<script src="/admin/assets/miniprogram.js"></script>
<?php admin_foot(); ?>

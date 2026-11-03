<?php require_once __DIR__.'/inc/layout.php';admin_head('用户与权限');$me=(int)current_admin()['id']; ?>
<div class="workspace-heading"><div><h2>用户与权限</h2></div></div>
<div class="permission-legend"><span><strong>管理员</strong>全部管理与权限设置</span><span><strong>内容编辑</strong>相册、瞬间、文章及内容维护</span><span><strong>普通用户</strong>个人资料、自己的留言与私信</span></div>
<div class="card"><div class="table-scroll"><table class="tbl permission-table"><thead><tr><th>用户</th><th>账号</th><th>角色</th><th>注册时间</th><th>操作</th></tr></thead><tbody id="usersBody"></tbody></table></div></div>
<script>
const Users = {
  rows: [], modules: {},
  async load() {
    try {
      const data = await Admin.get('users', 'list');
      this.rows = data.list; this.modules = data.modules;
      const names = {admin:'管理员', editor:'内容编辑', user:'普通用户'};
      Admin.el('usersBody').innerHTML = this.rows.map(user => `<tr><td>${Admin.esc(user.nickname || user.username)} ${user.id === <?= $me ?> ? '<span class="badge">当前账号</span>' : ''}</td><td>${Admin.esc(user.username)}</td><td><span class="badge">${names[user.role] || '普通用户'}</span>${user.role === 'editor' ? `<p class="muted">${user.permissions.length} / ${Object.keys(this.modules).length} 个内容模块</p>` : ''}</td><td class="muted">${Admin.time(user.created_at)}</td><td><button class="btn small ghost" data-user="${user.id}" ${user.id === <?= $me ?> ? 'disabled' : ''}>设置权限</button></td></tr>`).join('');
    } catch (error) { toastr.error(error.message); }
  },
  open(id) {
    const user = this.rows.find(row => row.id === id); if (!user) return;
    Admin.modal('设置权限 · ' + user.username, `<div class="field"><label for="permissionRole">账号角色</label><select id="permissionRole">${[['admin','管理员'],['editor','内容编辑'],['user','普通用户']].map(([value,label]) => `<option value="${value}" ${user.role === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><fieldset id="modulePermissions" style="border:1px solid var(--line);padding:16px;border-radius:6px"><legend>内容模块</legend><div class="workspace-actions"><button type="button" class="btn small ghost" id="permissionsAll">全选</button><button type="button" class="btn small ghost" id="permissionsNone">全不选</button></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:16px">${Object.entries(this.modules).map(([key,label]) => `<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" value="${key}" ${user.permissions.includes(key) || user.role !== 'editor' ? 'checked' : ''}>${label}</label>`).join('')}</div></fieldset><div class="actions"><button class="btn ghost" onclick="Admin.closeModal()">取消</button><button class="btn primary" id="permissionSave">保存权限</button></div>`);
    const fieldset = Admin.el('modulePermissions');
    const update = () => { fieldset.hidden = Admin.el('permissionRole').value !== 'editor'; };
    Admin.el('permissionRole').onchange = update; update();
    Admin.el('permissionsAll').onclick = () => fieldset.querySelectorAll('input').forEach(input => input.checked = true);
    Admin.el('permissionsNone').onclick = () => fieldset.querySelectorAll('input').forEach(input => input.checked = false);
    Admin.el('permissionSave').onclick = async () => {
      const role = Admin.el('permissionRole').value;
      const data = {id, role};
      if (role === 'editor') data.permissions = JSON.stringify(Array.from(fieldset.querySelectorAll('input:checked'), input => input.value));
      if (!await Admin.confirm('确认修改此账号权限？修改会立即生效。')) return;
      return Admin.submit(Admin.el('permissionSave'), async () => {
        await Admin.api('users', 'role', data); Admin.closeModal(); await this.load();
      });
    };
  }
};
Admin.el('usersBody').onclick = event => { const button = event.target.closest('[data-user]'); if (button) Users.open(Number(button.dataset.user)); };
Users.load();
</script>
<?php admin_foot(); ?>

const MiniPolicy = {
  async load() {
    try {
      const data = await Admin.get('miniprogram', 'get');
      const selected = (key, id) => data.policy[key].map(Number).includes(Number(id)) ? 'checked' : '';
      Admin.el('miniOwners').innerHTML = data.users.map(user => `<label style="display:flex;align-items:center;gap:10px;padding:8px 0"><input type="checkbox" value="${Number(user.id)}" ${selected('owner_ids', user.id)}> ${Admin.esc(user.nickname || user.username)} (${Admin.esc(user.username)})</label>`).join('') || '<p class="muted">没有可选账号，请先在用户与权限中设置内容编辑。</p>';
      Admin.el('miniDates').innerHTML = data.countdowns.map(row => `<label style="display:flex;align-items:center;gap:10px;padding:8px 0"><input type="checkbox" value="${Number(row.id)}" ${selected('public_countdown_ids', row.id)}> ${Admin.esc(row.title)} (${Admin.esc(row.target_date)})</label>`).join('') || '<p class="muted">还没有纪念日。</p>';
    } catch (error) { toastr.error(error.message); }
  },
  async save() {
    const ids = id => Array.from(Admin.el(id).querySelectorAll('input:checked'), input => Number(input.value));
    const owners = ids('miniOwners');
    if (owners.length > 2) return toastr.warning('最多指定两位主人');
    if (!await Admin.confirm('确认更新小程序权限？主人权限立即生效，勾选的纪念日将对所有小程序访客公开。')) return;
    return Admin.submit(Admin.el('miniSave'), async () => {
      await Admin.api('miniprogram', 'set', { owner_ids:JSON.stringify(owners), public_countdown_ids:JSON.stringify(ids('miniDates')) });
      await this.load();
    });
  }
};
Admin.el('miniSave').onclick = () => MiniPolicy.save();
MiniPolicy.load();

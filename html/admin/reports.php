<?php
require_once __DIR__ . '/inc/layout.php';
admin_head('举报处理');
?>
<div class="card">
  <div class="card-title"><i class="fa-solid fa-flag"></i>举报列表
    <span style="flex:1"></span><span class="muted" id="repPending"></span>
  </div>
  <table class="tbl">
    <thead><tr><th>类型</th><th>目标ID</th><th style="width:32%">原因</th><th>IP</th><th>状态</th><th>时间</th><th style="width:170px">操作</th></tr></thead>
    <tbody id="repBody"></tbody>
  </table>
  <div class="empty-tip" id="repEmpty" style="display:none">暂无举报，社区很和谐~</div>
</div>

<div class="card">
  <div class="card-title"><i class="fa-solid fa-ban"></i>IP 黑名单
    <span style="flex:1"></span>
    <button class="btn small danger" onclick="Reports.addBlack()"><i class="fa-solid fa-plus"></i>拉黑 IP</button>
  </div>
  <div class="muted" style="margin-bottom:12px">被拉黑的 IP 将无法访问前台所有页面和接口。</div>
  <table class="tbl">
    <thead><tr><th>IP</th><th>原因</th><th>拉黑时间</th><th style="width:100px">操作</th></tr></thead>
    <tbody id="blBody"></tbody>
  </table>
  <div class="empty-tip" id="blEmpty" style="display:none">黑名单是空的</div>
</div>

<script>
const Reports = {
  typeName: { moment: '瞬间', message: '留言', photo: '照片', comment: '评论' },

  init() { this.loadReports(); this.loadBlacklist(); },

  loadReports() {
    Admin.get('reports', 'list').then(d => {
      const pending = d.list.filter(x => x.status == 0).length;
      Admin.el('repPending').textContent = pending ? `待处理 ${pending} 条` : '';
      Admin.el('repEmpty').style.display = d.list.length ? 'none' : 'block';
      Admin.el('repBody').innerHTML = d.list.map(r => `
        <tr>
          <td><span class="badge">${Admin.esc(this.typeName[r.type] || r.type)}</span></td>
          <td class="muted">#${r.target_id}</td>
          <td><span class="ellipsis" style="max-width:300px" title="${Admin.esc(r.reason)}">${Admin.esc(r.reason)}</span></td>
          <td class="muted">${Admin.esc(r.ip || '')}</td>
          <td>${r.status == 1 ? '<span class="badge green">已处理</span>' : '<span class="badge gray">待处理</span>'}</td>
          <td class="muted">${Admin.time(r.created_at)}</td>
          <td>
            ${r.status == 0 ? `<button class="btn small ghost" onclick="Reports.resolve(${r.id})">标记已处理</button>` : ''}
            <button class="btn small danger" onclick="Reports.del(${r.id})">删除</button>
          </td>
        </tr>`).join('');
    });
  },

  resolve(id) {
    Admin.api('reports', 'resolve', { id }).then(() => this.loadReports());
  },

  del(id) {
    Admin.confirm('确定删除这条举报记录吗？').then(ok => {
      if (ok) Admin.api('reports', 'delete', { id }).then(() => this.loadReports());
    });
  },

  loadBlacklist() {
    Admin.get('blacklist', 'list').then(d => {
      Admin.el('blEmpty').style.display = d.list.length ? 'none' : 'block';
      Admin.el('blBody').innerHTML = d.list.map(b => `
        <tr>
          <td><b>${Admin.esc(b.ip)}</b></td>
          <td>${Admin.esc(b.reason || '—')}</td>
          <td class="muted">${Admin.time(b.created_at)}</td>
          <td><button class="btn small ghost" onclick="Reports.unBlack(${b.id}, '${Admin.esc(b.ip)}')">移除</button></td>
        </tr>`).join('');
    });
  },

  addBlack() {
    Admin.modal('拉黑 IP', `
      <div class="field"><label>IP 地址</label><input type="text" id="blIp" placeholder="例如：1.2.3.4"></div>
      <div class="field"><label>原因</label><input type="text" id="blReason" placeholder="例如：恶意刷留言"></div>
      <div class="actions"><button class="btn ghost" onclick="Admin.closeModal()">取消</button>
      <button class="btn danger" id="blOk">确认拉黑</button></div>`);
    Admin.el('blOk').onclick = () => {
      const ip = Admin.el('blIp').value.trim();
      const reason = Admin.el('blReason').value.trim();
      if (!ip) return toastr.warning('请输入 IP 地址');
      Admin.confirm(`确定拉黑 ${ip} 吗？该 IP 将无法访问本站。`).then(ok => {
        if (!ok) return;
        Admin.submit(Admin.el('blOk'), async () => {
          await Admin.api('blacklist', 'add', { ip, reason });
          Admin.closeModal(); this.loadBlacklist();
        });
      });
    };
  },

  unBlack(id, ip) {
    Admin.confirm(`确定将 ${ip} 移出黑名单吗？`).then(ok => {
      if (ok) Admin.api('blacklist', 'delete', { id }).then(() => this.loadBlacklist());
    });
  },
};
Reports.init();
</script>
<?php admin_foot(); ?>

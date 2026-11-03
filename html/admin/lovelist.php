<?php
require_once __DIR__ . '/inc/layout.php';
admin_head('恋爱清单');
?>
<div class="card">
  <div class="card-title"><i class="fa-solid fa-list-check"></i>恋爱清单
    <span style="flex:1"></span>
    <button class="btn small primary" onclick="LoveList.openModal()"><i class="fa-solid fa-plus"></i>新增事项</button>
  </div>
  <div class="field" style="margin-bottom:16px">
    <div class="muted" style="margin-bottom:6px">完成率：<b id="doneRate">0%</b>（<span id="doneStat"></span>）</div>
    <div style="height:10px;border-radius:6px;background:#f3e8ee;overflow:hidden">
      <div id="doneBar" style="height:100%;width:0;border-radius:6px;background:linear-gradient(90deg,#ff9eb5,#ff6b8b);transition:width .5s"></div>
    </div>
  </div>
  <table class="tbl">
    <thead><tr><th style="width:55%">事项</th><th>状态</th><th style="width:200px">操作</th></tr></thead>
    <tbody id="llBody"></tbody>
  </table>
  <div class="empty-tip" id="llEmpty" style="display:none">还没有清单事项，添加第一件想和 TA 一起做的事吧~</div>
</div>

<script>
const LoveList = {
  rows: [], moments: [],

  init() { this.load(); this.momentsReady = window.ADMIN_MODULES.includes('moments') ? this.loadMoments(1) : Promise.resolve(); this.momentsReady.catch(() => {}); },

  loadMoments(page) {
    return Admin.get('moments', 'list', {page}).then(d => {
      this.moments.push(...d.list);
      if (page * 15 < d.total) return this.loadMoments(page + 1);
    });
  },

  load() {
    Admin.get('lovelist', 'list').then(d => {
      this.rows = d.list;
      Admin.el('llEmpty').style.display = d.list.length ? 'none' : 'block';
      const done = d.list.filter(x => x.done == 1).length;
      const rate = d.list.length ? Math.round(done / d.list.length * 100) : 0;
      Admin.el('doneRate').textContent = rate + '%';
      Admin.el('doneStat').textContent = `已完成 ${done} / 共 ${d.list.length} 项`;
      Admin.el('doneBar').style.width = rate + '%';
      Admin.el('llBody').innerHTML = d.list.map(x => `
        <tr>
          <td style="${x.done == 1 ? 'text-decoration:line-through;color:#999' : ''}">${Admin.esc(x.title)}</td>
          <td>${x.done == 1 ? '<span class="badge green">已完成</span>' : '<span class="badge gray">待完成</span>'}</td>
          <td>
            <button class="btn small ghost" onclick="LoveList.toggle(${x.id}, ${x.done})">${x.done == 1 ? '标为未完成' : '标为已完成'}</button>
            <button class="btn small" onclick="LoveList.openModal(${x.id})">编辑</button>
            <button class="btn small danger" onclick="LoveList.del(${x.id})">删除</button>
          </td>
        </tr>`).join('');
    });
  },

  async openModal(id) {
    try { await this.momentsReady; } catch (error) {
      this.moments = []; this.momentsReady = this.loadMoments(1); this.momentsReady.catch(() => {});
      return toastr.error('关联瞬间加载失败，请重试');
    }
    const x = id ? (this.rows.find(r => r.id == id) || {}) : {};
    const canLink = window.ADMIN_MODULES.includes('moments');
    Admin.modal(id ? '编辑事项' : '新增事项', `
      <div class="field"><label>事项内容</label>
        <input type="text" id="llTitle" value="${Admin.esc(x.title || '')}" placeholder="例如：一起去看海"></div>
      <div class="field"><label>状态</label>
        <select id="llDone">
          <option value="0" ${x.done != 1 ? 'selected' : ''}>待完成</option>
          <option value="1" ${x.done == 1 ? 'selected' : ''}>已完成</option>
        </select></div>
      <div class="field"><label>关联瞬间</label><select id="llMoment" ${canLink ? '' : 'disabled'}><option value="0">不关联</option>${!canLink && x.moment_id ? `<option value="${x.moment_id}" selected>保留现有关联 #${x.moment_id}</option>` : ''}${this.moments.map(m => `<option value="${m.id}" ${m.id == x.moment_id ? 'selected' : ''}>${Admin.esc((m.content || '图片动态').slice(0, 40))}</option>`).join('')}</select></div>
      <div class="actions"><button class="btn ghost" onclick="Admin.closeModal()">取消</button>
      <button class="btn primary" id="llOk">${id ? '保存' : '添加'}</button></div>`);
    Admin.el('llOk').onclick = () => {
      const title = Admin.el('llTitle').value.trim();
      if (!title) return toastr.warning('请输入事项内容');
      const data = { title, done: Admin.el('llDone').value };
      if (canLink) data.moment_id = Admin.el('llMoment').value;
      if (id) data.id = id;
      Admin.submit(Admin.el('llOk'), async () => {
        await Admin.api('lovelist', id ? 'update' : 'create', data);
        Admin.closeModal(); this.load();
      });
    };
  },

  toggle(id, cur) {
    const x = this.rows.find(r => r.id == id) || {};
    Admin.api('lovelist', 'update', { id, title: x.title, done: cur == 1 ? 0 : 1 })
      .then(() => this.load());
  },

  del(id) {
    Admin.confirm('确定删除这个事项吗？').then(ok => {
      if (ok) Admin.api('lovelist', 'delete', { id }).then(() => this.load());
    });
  },
};
LoveList.init();
</script>
<?php admin_foot(); ?>

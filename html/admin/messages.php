<?php
require_once __DIR__ . '/inc/layout.php';
admin_head('留言祝福');
?>
<div class="card">
  <div class="card-title"><i class="fa-solid fa-envelope-open-text"></i>留言祝福
    <span style="flex:1"></span><span class="muted" id="msgCount"></span>
  </div>
  <div class="toolbar"><input id="messageQuery" class="search-input" type="search" placeholder="搜索全部留言的昵称或内容" aria-label="搜索全部留言"><select id="messageStatus" class="btn ghost" aria-label="留言状态"><option value="all">全部状态</option><option value="1">显示中</option><option value="0">已隐藏</option></select></div>
  <table class="tbl">
    <thead><tr><th>昵称</th><th style="width:36%">内容</th><th>IP / 归属地</th><th>状态</th><th>时间</th><th style="width:150px">操作</th></tr></thead>
    <tbody id="msgBody"></tbody>
  </table>
  <div class="empty-tip" id="msgEmpty" style="display:none">还没有收到留言~</div>
  <div id="msgPager"></div>
</div>

<script>
const Messages = {
  page: 1, per: 15, revision: 0, rows: [],

  init() { this.load(); let timer; Admin.el('messageQuery').oninput = () => { clearTimeout(timer); timer = setTimeout(() => this.load(1), 250); }; Admin.el('messageStatus').onchange = () => this.load(1); },

  load(page) {
    this.page = page || 1;
    const revision = ++this.revision;
    Admin.get('messages', 'list', { page: this.page, q: Admin.el('messageQuery').value.trim(), status: Admin.el('messageStatus').value }).then(d => {
      if (revision !== this.revision) return;
      this.page = d.page; this.rows = d.list;
      Admin.el('msgEmpty').style.display = d.list.length ? 'none' : 'block';
      Admin.el('msgCount').textContent = d.total ? `共 ${d.total} 条` : '';
      Admin.el('msgBody').innerHTML = d.list.map(m => `
        <tr>
          <td><img src="${Admin.esc(m.avatar || '/uploads/demo/avatar_boy.jpg')}" style="width:28px;height:28px;border-radius:50%;vertical-align:middle;margin-right:6px">${Admin.esc(m.nickname)}</td>
          <td><span class="ellipsis" style="max-width:340px" title="${Admin.esc(m.content)}">${Admin.esc(m.content || (m.img ? '图片留言' : '礼物留言'))}</span>${m.img ? '<span class="badge">图片</span>' : ''}</td>
          <td class="muted">${Admin.esc(m.ip || '')}${m.location ? ' · ' + Admin.esc(m.location) : ''}</td>
          <td>${m.status == 1 ? '<span class="badge green">显示</span>' : '<span class="badge gray">隐藏</span>'}</td>
          <td class="muted">${Admin.time(m.created_at)}</td>
          <td>
            <button class="btn small ghost" onclick="Messages.view(${m.id})">详情</button>
            <button class="btn small ghost" onclick="Messages.toggle(${m.id}, this)">${m.status == 1 ? '隐藏' : '显示'}</button>
            <button class="btn small danger" onclick="Messages.del(${m.id}, this)">删除</button>
          </td>
        </tr>`).join('');
      Admin.pager(document.getElementById('msgPager'), d.page, d.total, this.per, p => this.load(p));
    }).catch(error => { if (revision === this.revision) toastr.error(error.message); });
  },

  view(id) {
    const row = this.rows.find(item => item.id === id); if (!row) return;
    Admin.modal('留言详情', `<div class="tile-meta"><strong>${Admin.esc(row.nickname)}</strong><span>${Admin.time(row.created_at)}</span></div><p style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9;margin:20px 0">${Admin.esc(row.content)}</p>${row.img ? `<img class="media-preview" src="${Admin.esc(row.img)}" alt="留言配图">` : ''}${row.gift_name ? `<p>礼物：${Admin.esc(row.gift_name)}</p>` : ''}<div class="actions"><button class="btn ghost" onclick="Admin.closeModal()">关闭</button></div>`);
  },

  toggle(id, button) {
    return Admin.submit(button, async () => { await Admin.api('messages', 'toggle', { id }); this.load(this.page); });
  },

  del(id, button) {
    Admin.confirm('确定删除这条留言吗？').then(ok => {
      if (ok) Admin.submit(button, async () => { await Admin.api('messages', 'delete', { id }); this.load(this.page); });
    });
  },
};
Messages.init();
</script>
<?php admin_foot(); ?>

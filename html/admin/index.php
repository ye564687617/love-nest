<?php
require_once __DIR__ . '/inc/layout.php';
if (content_permissions(require_user()) === []) {
    require __DIR__ . '/inc/personal-dashboard.php';
    exit;
}
admin_head('仪表盘');
?>
<div class="grid4" id="statRow"></div>
<div class="grid2" style="margin-top:20px">
  <div class="card">
    <div class="card-title"><i class="fa-solid fa-bolt"></i>快捷操作</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <?php if (can_manage_module('albums')): ?><a class="btn primary" href="/admin/album.php"><i class="fa-solid fa-cloud-arrow-up"></i>上传照片</a><?php endif; ?>
      <?php if (can_manage_module('moments')): ?><a class="btn" href="/admin/moments.php"><i class="fa-solid fa-heart"></i>发布瞬间</a><?php endif; ?>
      <?php if (can_manage_module('articles')): ?><a class="btn" href="/admin/articles.php"><i class="fa-solid fa-pen"></i>写文章</a><?php endif; ?>
      <?php if (current_admin()['role'] === 'admin'): ?><a class="btn" href="/admin/config.php"><i class="fa-solid fa-gear"></i>站点设置</a><?php endif; ?>
    </div>
  </div>
  <?php if (current_admin()['role'] === 'admin'): ?><div class="card">
    <div class="card-title"><i class="fa-solid fa-flag"></i>待处理举报 <span class="badge" id="reportBadge">0</span></div>
    <div id="reportList"><div class="empty-tip">暂无待处理举报</div></div>
    <a class="btn small ghost" href="/admin/reports.php" style="margin-top:10px">查看全部</a>
  </div><?php endif; ?>
</div>
<?php if (can_manage_module('messages')): ?><div class="card">
  <div class="card-title"><i class="fa-solid fa-envelope-open-text"></i>最新留言</div>
  <div id="msgList"><div class="empty-tip">暂无留言</div></div>
  <a class="btn small ghost" href="/admin/messages.php" style="margin-top:10px">管理留言</a>
</div><?php endif; ?>
<script>
const PALETTE = [
  ['fa-images', 'linear-gradient(135deg,#ff6b8b,#ffa8a8)'],
  ['fa-heart', 'linear-gradient(135deg,#fbc2eb,#a6c1ee)'],
  ['fa-envelope-open-text', 'linear-gradient(135deg,#a18cd1,#fbc2eb)'],
  ['fa-newspaper', 'linear-gradient(135deg,#84fab0,#8fd3f4)'],
];
Admin.get('dashboard', 'stats').then(d => {
  const items = [
    [d.photos, '照片'], [d.moments, '甜蜜瞬间'], [d.messages, '留言祝福'], [d.articles, '文章'],
  ];
  Admin.el('statRow').innerHTML = items.map((it, i) => it[0] === null ? '' :
    `<div class="stat"><div class="ic" style="background:${PALETTE[i][1]}"><i class="fa-solid ${PALETTE[i][0]}"></i></div>
     <div><div class="num">${it[0]}</div><div class="lbl">${it[1]}</div></div></div>`).join('');
  if (Admin.el('reportBadge')) Admin.el('reportBadge').textContent = d.reports_pending;
  if (Admin.el('reportList') && d.recent_reports.length) {
    Admin.el('reportList').innerHTML = d.recent_reports.map(r =>
      `<div style="padding:8px 0;border-bottom:1px solid #f6eef1;font-size:13px">
        <span class="badge">${Admin.esc(r.type)}</span> ${Admin.esc(r.reason)} <span class="muted">${Admin.time(r.created_at)}</span></div>`).join('');
  }
  if (Admin.el('msgList') && d.recent_messages.length) {
    Admin.el('msgList').innerHTML = '<table class="tbl"><tr><th>昵称</th><th>内容</th><th>时间</th></tr>' +
      d.recent_messages.map(m => `<tr><td>${Admin.esc(m.nickname)}</td><td class="ellipsis">${Admin.esc(m.content)}</td><td class="muted">${Admin.time(m.created_at)}</td></tr>`).join('') + '</table>';
  }
});
</script>
<?php admin_foot(); ?>

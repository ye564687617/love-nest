<?php
$user = require_user();
$uid = (int)$user['id'];
$messages = db()->fetchAll('SELECT content,created_at FROM messages WHERE user_id=? ORDER BY id DESC LIMIT 5', [$uid]);
$total = (int)db()->fetchColumn('SELECT COUNT(*) FROM messages WHERE user_id=?', [$uid]);
$unread = (int)db()->fetchColumn('SELECT COUNT(*) FROM private_msgs WHERE to_id=? AND is_read=0', [$uid]);
admin_head('个人中心', true);
?>
<h2>欢迎，<?= esc($user['nickname'] ?: $user['username']) ?></h2>
<p class="muted"><?= ($user['role'] ?? '') === 'editor' ? '内容编辑 · 暂无已授权内容模块' : '普通用户' ?></p>
<div class="grid2" style="margin:20px 0">
  <div class="stat"><div><div class="num"><?= $total ?></div><div class="lbl">我的留言</div></div></div>
  <div class="stat"><div><div class="num"><?= $unread ?></div><div class="lbl">未读私信</div></div></div>
</div>
<div class="card"><div class="card-title">我的留言 <a href="/admin/my_messages.php" style="margin-left:auto">查看全部</a></div>
<?php if (!$messages): ?><div class="empty-tip">暂无留言</div><?php endif; ?>
<?php foreach ($messages as $message): ?>
<div style="padding:12px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere"><?= esc($message['content']) ?><p class="muted"><?= esc($message['created_at']) ?></p></div>
<?php endforeach; ?></div>
<div class="card"><div class="card-title">快捷入口</div><div class="actions">
<a class="btn" href="/admin/private_messages.php"><i class="fa-solid fa-envelope"></i>私信</a>
<a class="btn" href="/admin/my_messages.php"><i class="fa-solid fa-comments"></i>留言</a>
<a class="btn" href="/admin/account.php"><i class="fa-solid fa-user-gear"></i>账号</a>
<a class="btn" href="/"><i class="fa-solid fa-globe"></i>前台</a>
</div></div>
<?php admin_foot(); ?>

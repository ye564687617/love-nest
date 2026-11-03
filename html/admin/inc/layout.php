<?php
// 后台公共布局
require_once __DIR__ . '/../../inc/Database.php';
require_once __DIR__ . '/../../inc/helpers.php';
require_once __DIR__ . '/../../inc/site.php';

function admin_menu(): array
{
    $personal = [
        ['private_messages.php', '私信管理', 'fa-envelope'],
        ['my_messages.php', '我的留言', 'fa-comments'],
        ['account.php', '账号设置', 'fa-user-gear'],
    ];
    $role = current_admin()['role'] ?? '';
    if (!in_array($role, ['admin', 'editor'], true)) {
        return array_merge([['index.php', '仪表盘', 'fa-gauge-high']], $personal);
    }
    $menu = [
        ['index.php', '仪表盘', 'fa-gauge-high'],
        ['album.php', '相册管理', 'fa-images'],
        ['moments.php', '甜蜜瞬间', 'fa-heart'],
        ['messages.php', '留言祝福', 'fa-envelope-open-text'],
        ['articles.php', '文章管理', 'fa-newspaper'],
        ['lovelist.php', '恋爱清单', 'fa-list-check'],
        ['countdowns.php', '纪念日', 'fa-calendar-heart'],
        ['playlist.php', '音乐歌单', 'fa-music'],
    ];
    if ($role === 'admin') $menu = array_merge($menu, [
        ['users.php', '用户与权限', 'fa-user-shield'],
        ['config.php', '站点设置', 'fa-gear'],
        ['reports.php', '举报处理', 'fa-flag'],
    ]);
    $modules = ['album.php'=>'albums','moments.php'=>'moments','articles.php'=>'articles','messages.php'=>'messages','lovelist.php'=>'lovelist','countdowns.php'=>'countdowns','playlist.php'=>'playlist'];
    $menu = array_values(array_filter($menu, fn($item) => !isset($modules[$item[0]]) || can_manage_module($modules[$item[0]])));
    return array_merge($menu, $personal);
}

function admin_head(string $title, bool $personal = false): void
{
    $restricted = in_array(basename($_SERVER['SCRIPT_NAME']), ['config.php', 'reports.php', 'users.php'], true);
    $modules = ['album.php'=>'albums','moments.php'=>'moments','articles.php'=>'articles','messages.php'=>'messages','lovelist.php'=>'lovelist','countdowns.php'=>'countdowns','playlist.php'=>'playlist'];
    $admin = $personal ? require_user() : ($restricted ? require_admin() : require_content_manager($modules[basename($_SERVER['SCRIPT_NAME'])] ?? null));
    $csrf = csrf_token();
    ?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content">
<meta name="csrf-token" content="<?= esc($csrf) ?>">
<title><?= esc($title) ?> · <?= in_array($admin['role'], ['admin', 'editor'], true) ? '后台管理' : '个人中心' ?></title>
<link rel="stylesheet" href="/static/css/fa.min.css">
<link rel="stylesheet" href="/static/css/toastr.css">
<link rel="stylesheet" href="/admin/assets/admin.css?v=20261030-5">
<link rel="stylesheet" href="/admin/assets/workspace.css?v=20261030-4">
<link rel="stylesheet" href="/admin/assets/mobile.css?v=20261030-3">
<script src="/static/js/jquery.min.js"></script>
<script src="/static/js/toastr.js"></script>
<script>window.ADMIN_MODULES = <?= json_encode(content_permissions($admin)) ?>;</script>
<script src="/admin/assets/admin.js?v=20261030-5"></script>
<script src="/admin/assets/media.js?v=20261030-3"></script>
<script src="/admin/assets/workbench.js?v=20261030-2" defer></script>
<script src="/static/js/location.js?v=20261030-2"></script>
<script src="/admin/assets/mobile.js?v=20261030-3" defer></script>
</head>
<body>
<input type="hidden" name="csrf_token" value="<?= esc($csrf) ?>">
<div class="admin-shell">
  <button class="nav-backdrop" id="navBackdrop" aria-label="关闭导航" hidden></button>
  <aside class="sidebar" id="adminSidebar" aria-label="后台导航">
    <button type="button" class="icon-btn nav-close" id="navClose" aria-label="关闭导航"><i class="fa-solid fa-xmark"></i></button>
    <a class="brand" href="/admin/">♥ <?= esc(cfg('title')) ?> <span><?= in_array($admin['role'], ['admin', 'editor'], true) ? '后台' : '个人中心' ?></span></a>
    <nav class="side-nav">
      <?php foreach (admin_menu() as [$href, $label, $icon]):
        $active = basename($_SERVER['SCRIPT_NAME']) === $href ? ' active' : ''; ?>
      <a class="side-link<?= $active ?>" href="/admin/<?= $href ?>"><i class="fa-solid <?= $icon ?>"></i><?= $label ?></a>
      <?php endforeach; ?>
    </nav>
    <div class="side-foot">
      <a href="/" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i>查看前台</a>
      <button onclick="Admin.logout()"><i class="fa-solid fa-right-from-bracket"></i>退出</button>
    </div>
  </aside>
  <div class="main">
    <header class="topbar">
      <div class="topbar-heading"><button type="button" class="icon-btn nav-toggle" id="navToggle" aria-label="打开导航" aria-controls="adminSidebar" aria-expanded="false"><i class="fa-solid fa-bars"></i></button><h1><?= esc($title) ?></h1></div>
      <div class="topbar-user"><span class="badge"><?= ['admin'=>'管理员','editor'=>'内容编辑','user'=>'普通用户'][$admin['role']] ?? '普通用户' ?></span><?= esc($admin['nickname']) ?></div>
    </header>
    <main class="content">
    <?php
}

function admin_foot(array $js = []): void
{
    ?>
    </main>
  </div>
</div>
<div class="modal-mask" id="modalMask" style="display:none"><div class="modal" id="modalBox"></div></div>
<?php foreach ($js as $j): ?><script src="<?= esc($j) ?>"></script><?php endforeach; ?>
</body>
</html>
    <?php
}

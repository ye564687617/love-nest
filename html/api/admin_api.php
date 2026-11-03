<?php
// 后台统一管理接口：api/admin_api.php?module=xxx&action=yyy（全部需要登录）
require_once __DIR__ . '/bootstrap.php';
require_content_manager();
require_once __DIR__ . '/../inc/article-content.php';

$module = req('module', '');
$action = req('action', '');
if (!in_array($module, ['dashboard', 'albums', 'photos', 'moments', 'messages', 'articles', 'lovelist', 'countdowns', 'playlist'], true)) require_admin();
elseif ($module !== 'dashboard') require_content_manager($module);
if (!in_array($action, ['list', 'stats', 'get'], true)) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('请使用 POST 修改数据', 405);
    csrf_check();
}
$d = db();

switch ($module) {
    // ---------- 仪表盘 ----------
    case 'dashboard':
        if ($action === 'stats') {
            json_ok([
                'photos' => can_manage_module('albums') ? (int)$d->fetchColumn('SELECT COUNT(*) FROM photos') : null,
                'moments' => can_manage_module('moments') ? (int)$d->fetchColumn('SELECT COUNT(*) FROM moments') : null,
                'messages' => can_manage_module('messages') ? (int)$d->fetchColumn('SELECT COUNT(*) FROM messages') : null,
                'articles' => can_manage_module('articles') ? (int)$d->fetchColumn('SELECT COUNT(*) FROM articles') : null,
                'reports_pending' => current_admin()['role'] === 'admin' ? (int)$d->fetchColumn('SELECT COUNT(*) FROM reports WHERE status=0') : 0,
                'recent_messages' => can_manage_module('messages') ? $d->fetchAll('SELECT id, nickname, content, created_at FROM messages ORDER BY id DESC LIMIT 5') : [],
                'recent_reports' => current_admin()['role'] === 'admin' ? $d->fetchAll('SELECT id, type, reason, created_at FROM reports WHERE status=0 ORDER BY id DESC LIMIT 5') : [],
            ]);
        }
        break;

    // ---------- 相册 ----------
    case 'albums':
        if ($action === 'list') {
            $rows = $d->fetchAll("SELECT a.*, COALESCE(NULLIF(a.cover,''),(SELECT p.src FROM photos p WHERE p.album_id=a.id ORDER BY p.sort DESC,p.id DESC LIMIT 1),'') AS preview, (SELECT COUNT(*) FROM photos p WHERE p.album_id=a.id) AS photo_count FROM albums a ORDER BY a.id DESC");
            json_ok(['list' => $rows]);
        }
        if ($action === 'create') {
            $title = req('title', '', 64);
            if ($title === '') json_err('相册名不能为空');
            json_ok(['id' => $d->insert('albums', ['title' => $title])], '创建成功');
        }
        if ($action === 'rename') {
            if (req('title') === '') json_err('相册名不能为空');
            $d->update('albums', ['title' => req('title', '', 64)], 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已重命名');
        }
        if ($action === 'delete') {
            $id = (int)req('id');
            $d->delete('photos', 'album_id=:id', ['id' => $id]);
            $d->delete('albums', 'id=:id', ['id' => $id]);
            json_ok(null, '相册及照片已删除');
        }
        break;

    case 'photos':
        if ($action === 'move') {
            $albumId = req_int('album_id');
            if (!$d->fetch('SELECT id FROM albums WHERE id=?', [$albumId])) json_err('目标相册不存在', 404);
            $ids = array_values(array_unique(array_filter(array_map('intval', (array)req('ids', [])), fn($id) => $id > 0)));
            if (!$ids || count($ids) > 500) json_err('请选择 1 至 500 张照片');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $d->query("UPDATE photos SET album_id=? WHERE id IN ($placeholders)", array_merge([$albumId], $ids));
            json_ok(null, '照片已移动');
        }
        if ($action === 'list') {
            $albumId = (int)req('album_id', 0);
            $where = $albumId > 0 ? 'WHERE album_id=:aid' : '';
            $params = $albumId > 0 ? ['aid' => $albumId] : [];
            json_ok(['list' => $d->fetchAll("SELECT * FROM photos $where ORDER BY sort DESC, id DESC", $params)]);
        }
        if ($action === 'add') {
            // 配合 upload_image.php：前端先上传拿 url，再调此接口入库
            $src = req('src', '', 255);
            if ($src === '' || !site_valid_media_url($src)) json_err('图片地址无效');
            if (!$d->fetch('SELECT id FROM albums WHERE id=?', [req_int('album_id')])) json_err('相册不存在', 404);
            $id = $d->insert('photos', [
                'album_id' => (int)req('album_id', 0),
                'src' => $src,
                'desc' => req('desc', '', 255),
                'is_video' => (int)req('is_video', 0),
                'sort' => time(),
            ]);
            json_ok(['id' => $id], '已添加');
        }
        if ($action === 'update') {
            $d->update('photos', ['desc' => req('desc', '', 255)], 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已保存');
        }
        if ($action === 'delete') {
            $d->delete('photos', 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已删除');
        }
        if ($action === 'batch_delete') {
            $ids = array_filter(array_map('intval', (array)req('ids', [])));
            if ($ids) {
                $ph = implode(',', array_fill(0, count($ids), '?'));
                $d->query("DELETE FROM photos WHERE id IN ($ph)", $ids);
            }
            json_ok(null, '批量删除完成');
        }
        if ($action === 'reorder') {
            // ids 为有序数组，依次赋予 sort 权重
            $ids = array_map('intval', (array)req('ids', []));
            $weight = count($ids) * 10;
            foreach ($ids as $pid) {
                $d->update('photos', ['sort' => $weight], 'id=:id', ['id' => $pid]);
                $weight -= 10;
            }
            json_ok(null, '排序已保存');
        }
        if ($action === 'set_cover') {
            $photo = $d->fetch('SELECT src, album_id FROM photos WHERE id=:id', ['id' => (int)req('id')]);
            if (!$photo) json_err('照片不存在');
            $d->update('albums', ['cover' => $photo['src']], 'id=:id', ['id' => $photo['album_id']]);
            json_ok(null, '已设为相册封面');
        }
        break;

    // ---------- 瞬间 ----------
    case 'moments':
        if ($action === 'list') {
            $page = max(1, (int)req('page', 1));
            $per = 15; $off = ($page - 1) * $per;
            $total = (int)$d->fetchColumn('SELECT COUNT(*) FROM moments');
            $rows = $d->fetchAll("SELECT * FROM moments ORDER BY id DESC LIMIT {$per} OFFSET {$off}");
            foreach ($rows as &$r) { $r['images'] = json_decode($r['images'] ?: '[]', true); }
            json_ok(['list' => $rows, 'total' => $total, 'page' => $page]);
        }
        if (in_array($action, ['create', 'update'], true)) {
            $images = json_decode(req('images', '[]'), true);
            if (!is_array($images) || !array_is_list($images) || count($images) > 30) json_err('图片列表格式错误，最多 30 张');
            foreach ($images as $image) {
                if (!is_string($image) || !preg_match('~^(https?://|/(?!/)|uploads/)~i', $image) || strlen($image) > 2048) json_err('图片地址无效');
            }
            if (req('content') === '' && !$images) json_err('内容和图片至少填一项');
            if ($action === 'update' && !$d->fetch('SELECT id FROM moments WHERE id=?', [req_int('id')])) json_err('动态不存在', 404);
            $data = [
                'content' => req('content', '', 2000),
                'images' => json_encode($images, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'location' => req('location', '', 64),
            ];
            foreach (['status', 'is_top'] as $field) if (isset($_POST[$field])) $data[$field] = req_int($field) ? 1 : 0;
            if (isset($_POST['created_at'])) {
                $date = str_replace('T', ' ', req('created_at'));
                $parsed = DateTime::createFromFormat('!Y-m-d H:i', substr($date, 0, 16));
                if (!$parsed || $parsed->format('Y-m-d H:i') !== substr($date, 0, 16)) json_err('时间格式无效');
                $data['created_at'] = $parsed->format('Y-m-d H:i:s');
            }
            if ($action === 'create') {
                $admin = current_admin();
                $data += ['user_id' => $admin['id'], 'nickname' => $admin['nickname'], 'avatar' => $admin['avatar'] ?? ''];
                json_ok(['id' => $d->insert('moments', $data)], '发布成功');
            }
            $d->update('moments', $data, 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已保存');
        }
        if ($action === 'delete') {
            $id = (int)req('id');
            $d->delete('moment_comments', 'moment_id=:id', ['id' => $id]);
            $d->delete('moment_likes', 'moment_id=:id', ['id' => $id]);
            $d->update('lovelist', ['moment_id' => 0], 'moment_id=:id', ['id' => $id]);
            $d->delete('moments', 'id=:id', ['id' => $id]);
            json_ok(null, '已删除');
        }
        if ($action === 'toggle') {
            $id = (int)req('id'); $field = req('field', '');
            if (!in_array($field, ['is_top', 'status'], true)) json_err('参数错误');
            $row = $d->fetch("SELECT `$field` FROM moments WHERE id=:id", ['id' => $id]);
            if (!$row) json_err('动态不存在', 404);
            $d->update('moments', [$field => $row[$field] ? 0 : 1], 'id=:id', ['id' => $id]);
            json_ok(null, '已切换');
        }
        break;

    // ---------- 留言 ----------
    case 'messages':
        if ($action === 'list') {
            $page = max(1, (int)req('page', 1));
            $query = req('q', '', 100);
            $status = req('status', 'all');
            if (!in_array($status, ['all', '0', '1'], true)) json_err('状态参数无效');
            $clauses = []; $params = [];
            if ($query !== '') { $clauses[] = '(nickname LIKE ? OR content LIKE ?)'; $params = ['%' . $query . '%', '%' . $query . '%']; }
            if ($status !== 'all') { $clauses[] = 'status=?'; $params[] = (int)$status; }
            $where = $clauses ? ' WHERE ' . implode(' AND ', $clauses) : '';
            $total = (int)$d->fetchColumn('SELECT COUNT(*) FROM messages' . $where, $params);
            $per = 15;
            $page = min($page, max(1, (int)ceil($total / $per)));
            $off = ($page - 1) * $per;
            $rows = $d->fetchAll("SELECT * FROM messages $where ORDER BY id DESC LIMIT {$per} OFFSET {$off}", $params);
            json_ok(['list' => $rows, 'total' => $total, 'page' => $page]);
        }
        if ($action === 'delete') {
            $d->delete('messages', 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已删除');
        }
        if ($action === 'toggle') {
            $id = (int)req('id');
            $row = $d->fetch('SELECT status FROM messages WHERE id=:id', ['id' => $id]);
            if (!$row) json_err('留言不存在', 404);
            $d->update('messages', ['status' => $row['status'] ? 0 : 1], 'id=:id', ['id' => $id]);
            json_ok(null, '已切换显示状态');
        }
        break;

    // ---------- 文章 ----------
    case 'articles':
        if ($action === 'list') {
            json_ok(['list' => $d->fetchAll('SELECT id, title, cover, excerpt, views, status, created_at FROM articles ORDER BY id DESC')]);
        }
        if ($action === 'get') {
            $article = $d->fetch('SELECT * FROM articles WHERE id=:id', ['id' => (int)req('id')]);
            if (!$article) json_err('文章不存在', 404);
            $article['content'] = article_safe_html($article['content']);
            json_ok($article);
        }
        if (in_array($action, ['create', 'update'], true)) {
            $data = ['title' => req('title', '', 128), 'content' => article_safe_html(req('content', '', 200000))];
            if ($data['title'] === '') json_err('标题不能为空');
            if (trim(strip_tags($data['content'])) === '' && !str_contains($data['content'], '<img')) json_err('正文不能为空');
            if ($action === 'update' && !$d->fetch('SELECT id FROM articles WHERE id=?', [req_int('id')])) json_err('文章不存在', 404);
            if (isset($_POST['cover'])) { $data['cover'] = req('cover', '', 255); if ($data['cover'] !== '' && !site_valid_media_url($data['cover'])) json_err('封面地址无效'); }
            if (isset($_POST['excerpt'])) $data['excerpt'] = req('excerpt', '', 300);
            if (isset($_POST['status'])) $data['status'] = req_int('status') ? 1 : 0;
            if ($action === 'create') json_ok(['id' => $d->insert('articles', $data)], '已发布');
            $d->update('articles', $data, 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已保存');
        }
        if ($action === 'delete') {
            $d->delete('articles', 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已删除');
        }
        if ($action === 'toggle') {
            $row = $d->fetch('SELECT status FROM articles WHERE id=?', [req_int('id')]);
            if (!$row) json_err('文章不存在', 404);
            $d->update('articles', ['status' => $row['status'] ? 0 : 1], 'id=:id', ['id' => req_int('id')]);
            json_ok(null, '状态已更新');
        }
        break;

    case 'users':
        if ($action === 'list') {
            $users = $d->fetchAll('SELECT id,username,nickname,avatar,role,content_permissions,created_at FROM users ORDER BY id');
            foreach ($users as &$user) {
                $user['permissions_default'] = $user['content_permissions'] === null;
                $user['permissions'] = content_permissions($user);
                unset($user['content_permissions']);
            }
            unset($user);
            json_ok(['list' => $users, 'modules' => content_modules()]);
        }
        if ($action === 'role') {
            $id = req_int('id'); $role = req('role');
            if (!in_array($role, ['admin', 'editor', 'user'], true)) json_err('角色无效');
            if ($id === (int)current_admin()['id']) json_err('不能修改自己的管理权限');
            $permissions = null;
            $hasPermissions = isset($_POST['permissions']);
            if ($hasPermissions) {
                $raw = $_POST['permissions'];
                if (!is_string($raw)) json_err('模块权限格式无效');
                $decoded = json_decode($raw, true);
                if (!is_array($decoded) || !array_is_list($decoded)) json_err('模块权限格式无效');
                foreach ($decoded as $permission) {
                    if (!is_string($permission) || !array_key_exists($permission, content_modules())) json_err('模块权限无效');
                }
                if ($role !== 'editor') json_err('仅内容编辑可以设置模块权限');
                $permissions = json_encode(array_values(array_unique($decoded)));
            }
            $d->transaction(function () use ($d, $id, $role, $permissions, $hasPermissions) {
                $rows = $d->fetchAll('SELECT id,role FROM users ORDER BY id FOR UPDATE');
                $target = array_values(array_filter($rows, fn($row) => (int)$row['id'] === $id))[0] ?? null;
                if (!$target) json_err('用户不存在', 404);
                if ($target['role'] === 'admin' && $role !== 'admin' && count(array_filter($rows, fn($row) => $row['role'] === 'admin')) <= 1) json_err('必须保留一位管理员');
                $data = ['role' => $role];
                if ($hasPermissions || $role !== $target['role']) $data['content_permissions'] = $permissions;
                $d->update('users', $data, 'id=:id', ['id' => $id]);
            });
            json_ok(null, '权限已更新');
        }
        break;

    // ---------- 恋爱清单 ----------
    case 'lovelist':
        if ($action === 'list') {
            json_ok(['list' => $d->fetchAll('SELECT * FROM lovelist ORDER BY sort ASC, id ASC')]);
        }
        if (in_array($action, ['create', 'update'], true)) {
            $data = ['title' => req('title', '', 128), 'done' => (int)req('done', 0)];
            if (isset($_REQUEST['moment_id'])) {
                if (!can_manage_module('moments')) json_err('没有关联瞬间的管理权限', 403);
                $data['moment_id'] = max(0, req_int('moment_id'));
                if ($data['moment_id'] && !$d->fetch('SELECT id FROM moments WHERE id=?', [$data['moment_id']])) json_err('关联动态不存在');
            }
            if ($data['title'] === '') json_err('内容不能为空');
            if ($action === 'create') { $data['sort'] = time(); json_ok(['id' => $d->insert('lovelist', $data)], '已添加'); }
            $d->update('lovelist', $data, 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已保存');
        }
        if ($action === 'delete') {
            $d->delete('lovelist', 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已删除');
        }
        break;

    // ---------- 倒计时 ----------
    case 'countdowns':
        if ($action === 'list') {
            json_ok(['list' => $d->fetchAll('SELECT * FROM countdowns ORDER BY sort ASC, id ASC')]);
        }
        if (in_array($action, ['create', 'update'], true)) {
            $data = ['title' => req_string('title', 64), 'target_date' => req_string('target_date', 10), 'kind' => req_string('kind', 16, 'countdown')];
            $festivalKey = req_string('festival_key', 32);
            $festivals = ['valentine'=>'情人节', 'qixi'=>'七夕', 'new_year'=>'元旦', 'spring'=>'春节', 'lantern'=>'元宵节', 'dragon_boat'=>'端午节', 'mid_autumn'=>'中秋节', 'national'=>'国庆节', 'christmas'=>'圣诞节', 'love520'=>'520'];
            if ($festivalKey !== '') {
                if ($data['kind'] !== 'festival' || !isset($festivals[$festivalKey])) json_err('节日选项无效');
                $data['title'] = $festivals[$festivalKey];
            }
            if ($data['title'] === '' || !site_valid_date($data['target_date'])) json_err('请填写标题和正确日期');
            if (!in_array($data['kind'], ['countdown', 'anniversary', 'birthday', 'festival'], true)) json_err('日子类型无效');
            if ($data['kind'] === 'birthday' && $data['target_date'] > date('Y-m-d')) json_err('出生日期不能晚于今天');
            if (array_key_exists('birthday_calendar', $_POST) || $action === 'create' || $data['kind'] !== 'birthday') {
                $birthdayCalendar = req_string('birthday_calendar', 8, 'solar');
                if (!in_array($birthdayCalendar, ['solar', 'lunar'], true)) json_err('生日历法无效');
                $data['birthday_calendar'] = $data['kind'] === 'birthday' ? $birthdayCalendar : 'solar';
            }
            if (array_key_exists('festival_key', $_POST) || $action === 'create' || $data['kind'] !== 'festival') $data['festival_key'] = $festivalKey;
            if ($action === 'update' && !$d->fetch('SELECT id FROM countdowns WHERE id=?', [req_int('id')])) json_err('日子不存在', 404);
            if ($action === 'create') { $data['sort'] = time(); json_ok(['id' => $d->insert('countdowns', $data)], '已添加'); }
            $d->update('countdowns', $data, 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已保存');
        }
        if ($action === 'delete') {
            $d->delete('countdowns', 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已删除');
        }
        break;

    // ---------- 歌单 ----------
    case 'playlist':
        if ($action === 'list') {
            json_ok(['list' => $d->fetchAll('SELECT * FROM playlist ORDER BY sort ASC, id ASC')]);
        }
        if (in_array($action, ['create', 'update'], true)) {
            $data = ['title' => req('title', '', 64), 'artist' => req('artist', '', 64), 'cover' => req('cover', '', 255), 'url' => req('url', '', 512)];
            if ($data['title'] === '') json_err('歌名不能为空');
            if (!site_valid_media_url($data['url']) || !site_valid_media_url($data['cover'])) json_err('请填写有效的 HTTP(S) 或站内地址');
            if (isset($_POST['lyrics'])) $data['lyrics'] = req('lyrics', '', 200000);
            if ($action === 'update' && !$d->fetch('SELECT id FROM playlist WHERE id=?', [req_int('id')])) json_err('歌曲不存在', 404);
            if ($action === 'create') { $data['sort'] = time(); json_ok(['id' => $d->insert('playlist', $data)], '已添加'); }
            $d->update('playlist', $data, 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已保存');
        }
        if ($action === 'delete') {
            $d->delete('playlist', 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已删除');
        }
        break;

    case 'miniprogram':
        require_once __DIR__ . '/../inc/miniprogram.php';
        if ($action === 'get') {
            json_ok([
                'policy' => mini_config(),
                'users' => $d->fetchAll("SELECT id,username,nickname,role FROM users WHERE role IN ('admin','editor') ORDER BY id"),
                'countdowns' => $d->fetchAll('SELECT id,title,target_date FROM countdowns ORDER BY sort,id'),
            ]);
        }
        if ($action === 'set') {
            $ownerIds = mini_policy_ids($_POST['owner_ids'] ?? '', 2);
            $publicIds = mini_policy_ids($_POST['public_countdown_ids'] ?? '', 1000);
            $d->transaction(function () use ($d, $ownerIds, $publicIds) {
                // Lock account roles as well as validating them before granting access.
                $eligible = array_map('intval', array_column($d->fetchAll("SELECT id FROM users WHERE role IN ('admin','editor') ORDER BY id FOR UPDATE"), 'id'));
                if (array_diff($ownerIds, $eligible)) json_err('主人必须是现有管理员或内容编辑');
                $dates = array_map('intval', array_column($d->fetchAll('SELECT id FROM countdowns'), 'id'));
                if (array_diff($publicIds, $dates)) json_err('公开列表包含不存在的纪念日，请刷新重试');
                site_config_set('mini_policy', json_encode(['owner_ids' => $ownerIds, 'public_countdown_ids' => $publicIds], JSON_THROW_ON_ERROR));
            });
            json_ok(null, '小程序权限已保存，立即生效');
        }
        break;

    // ---------- 站点配置 ----------
    case 'config':
        if ($action === 'get') {
            $rows = $d->fetchAll('SELECT `k`, `v` FROM site_config');
            $out = [];
            foreach ($rows as $r) $out[$r['k']] = $r['v'];
            json_ok($out);
        }
        if ($action === 'set') {
            $allow = ['title', 'subtitle', 'boy_name', 'boy_birth', 'boy_avatar', 'girl_name', 'girl_birth', 'girl_avatar', 'love_start', 'notice', 'icp'];
            $values = req('cfg', []);
            if (!is_array($values)) json_err('配置格式错误');
            $data = [];
            foreach ($values as $k => $v) {
                if (!in_array($k, $allow, true)) continue;
                if (!is_string($v)) json_err('配置值必须是文本');
                $v = trim(mb_cut($v, 2000));
                if (in_array($k, ['boy_birth', 'girl_birth'], true) && !site_valid_date($v)) json_err('生日格式错误');
                if ($k === 'love_start' && !site_valid_date($v, true)) json_err('恋爱时间格式错误');
                if (in_array($k, ['boy_avatar', 'girl_avatar'], true) && !site_valid_media_url($v)) json_err('头像地址无效');
                if (in_array($k, ['title', 'boy_name', 'girl_name'], true) && $v === '') json_err('标题和昵称不能为空');
                $data[$k] = $v;
            }
            $d->transaction(function () use ($data) {
                foreach ($data as $k => $v) site_config_set($k, $v);
            });
            json_ok(null, '配置已保存');
        }
        if ($action === 'password') {
            $old = $_POST['old'] ?? ''; $new = $_POST['new'] ?? '';
            if (!is_string($old) || !is_string($new) || strlen($new) > 128) json_err('密码格式错误');
            $admin = current_admin();
            $u = $d->fetch('SELECT password_hash FROM users WHERE id=:id', ['id' => $admin['id']]);
            if (!password_verify($old, $u['password_hash'])) json_err('原密码错误');
            if (mb_strlen($new, 'UTF-8') < 6) json_err('新密码至少 6 位');
            $d->update('users', ['password_hash' => password_hash($new, PASSWORD_DEFAULT)], 'id=:id', ['id' => $admin['id']]);
            unset($_SESSION['admin'], $_SESSION['auth_hash']);
            session_regenerate_id(true);
            json_ok(null, '密码已修改，请重新登录');
        }
        break;

    // ---------- 举报 ----------
    case 'reports':
        if ($action === 'list') {
            json_ok(['list' => $d->fetchAll('SELECT * FROM reports ORDER BY id DESC LIMIT 100')]);
        }
        if ($action === 'resolve') {
            $d->update('reports', ['status' => 1], 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已标记为已处理');
        }
        if ($action === 'delete') {
            $d->delete('reports', 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已删除');
        }
        break;

    // ---------- 黑名单 ----------
    case 'blacklist':
        if ($action === 'list') {
            json_ok(['list' => $d->fetchAll('SELECT * FROM ip_blacklist ORDER BY id DESC')]);
        }
        if ($action === 'add') {
            $ip = req('ip', '', 45);
            if (!filter_var($ip, FILTER_VALIDATE_IP)) json_err('IP 格式不正确');
            $d->query('INSERT IGNORE INTO ip_blacklist (ip, reason) VALUES (:ip, :r)', ['ip' => $ip, 'r' => req('reason', '', 255)]);
            json_ok(null, '已拉黑');
        }
        if ($action === 'delete') {
            $d->delete('ip_blacklist', 'id=:id', ['id' => (int)req('id')]);
            json_ok(null, '已移除');
        }
        break;
}

json_err('未知 module/action', 404);

<?php
// 用户卡片接口
require_once __DIR__ . '/bootstrap.php';

$action = req('action', 'card');

if ($action === 'card' || $action === 'get_card') {
    $uid = (int)req('user_id', 0);
    if ($uid > 0) {
        $u = db()->fetch(
            'SELECT id, nickname, avatar, role, created_at, birthday, bio FROM users WHERE id = :id',
            ['id' => $uid]
        );
    } else {
        // 默认博主卡片：取第一个管理员
        $u = db()->fetch(
            "SELECT id, nickname, avatar, role, created_at, birthday, bio FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
        );
    }
    if (!$u) {
        json_out(1, '用户不存在', 404);
    }
    $d = db();
    $current = current_admin();
    $moments = (int)$d->fetchColumn('SELECT COUNT(*) FROM moments WHERE user_id=? AND status=1', [$u['id']]);
    json_ok([
        'id' => (int)$u['id'],
        'nickname' => $u['nickname'],
        'display_name' => $u['nickname'],
        'avatar' => $u['avatar'] ?: '/uploads/demo/avatar_boy.jpg',
        'role' => $u['role'] === 'admin' ? 1 : 4,
        'role_label' => $u['role'] === 'admin' ? '博主' : '用户',
        'created_at' => $u['created_at'],
        '_current' => ['id' => (int)($current['id'] ?? 0), 'logged_in' => $current !== null, 'role' => ($current['role'] ?? '') === 'admin' ? 1 : 4, 'csrf_token' => csrf_token()],
        'stats' => [
            'moments' => $moments,
            'messages' => (int)$d->fetchColumn('SELECT COUNT(*) FROM messages WHERE user_id=? AND status=1', [$u['id']]),
            'comments' => (int)$d->fetchColumn('SELECT COUNT(*) FROM moment_comments WHERE user_id=? AND status=1', [$u['id']]),
            'chats' => (int)$d->fetchColumn('SELECT COUNT(*) FROM chat_messages WHERE user_id=?', [$u['id']]),
        ],
        'bio' => $u['bio'] ?: site_config('subtitle', '陪伴是最长情的告白~'),
        'birthday' => $u['birthday'] ?? '',
        'moments' => $moments,
    ]);
}

json_out(1, '未知 action', 404);

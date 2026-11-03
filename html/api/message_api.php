<?php
// 留言 API：列表 / 发表
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $limit = req_int('limit', 20);
    $limit = max(1, min(100, $limit));
    $page = max(1, req_int('page', 1));
    $offset = (min($page, 1000000) - 1) * $limit;
    $before = max(0, req_int('before'));
    $where = $before ? ' AND id < ?' : '';
    if ($before) $offset = 0;

    $rows = db()->fetchAll(
        "SELECT id, user_id, nickname, nickname AS display_name, avatar, location, location AS ip_location,
                content, img, gift_icon, gift_name, created_at
         FROM messages WHERE status = 1{$where} ORDER BY id DESC LIMIT {$limit} OFFSET {$offset}",
        $before ? [$before] : []
    );
    $total = (int)db()->fetchColumn("SELECT COUNT(*) FROM messages WHERE status = 1");
    $giftTotal = (int)db()->fetchColumn("SELECT COUNT(*) FROM messages WHERE status=1 AND gift_icon<>''");
    $last = $rows ? (int)$rows[count($rows) - 1]['id'] : 0;
    $hasMore = $last > 0 && (bool)db()->fetchColumn('SELECT id FROM messages WHERE status=1 AND id < ? LIMIT 1', [$last]);
    json_out(0, 'ok', ['list' => $rows, 'total' => $total, 'gift_total' => $giftTotal, 'has_more' => $hasMore]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $user = current_admin();
    if (!$user) json_err('请登录后留言', 401);
    if (ip_blocked(client_ip())) json_out(403, '访问受限');
    $nickname = $user['nickname'] ?: $user['username'];
    $content = req_string('content', 200);
    $img = req_string('img', 255);
    $location = req_string('location', 64);
    $giftIcon = req_string('gift_icon', 32);
    $giftName = req_string('gift_name', 64);
    if ($img !== '' && !preg_match('~^/uploads/user/\d{8}/[a-zA-Z0-9_.-]+\.(?:jpg|png|gif|webp)$~D', $img)) json_err('图片地址无效');
    if ($content === '' && $img === '') json_out(1, '留言内容不能为空');

    $id = db()->insert('messages', [
        'user_id' => (int)$user['id'], 'nickname' => $nickname, 'avatar' => $user['avatar'] ?? '',
        'content' => $content, 'img' => $img, 'gift_icon' => $giftIcon,
        'gift_name' => $giftName, 'ip' => client_ip(), 'location' => $location, 'status' => 1,
    ]);
    $total = (int)db()->fetchColumn('SELECT COUNT(*) FROM messages WHERE status=1');
    $giftTotal = (int)db()->fetchColumn("SELECT COUNT(*) FROM messages WHERE status=1 AND gift_icon<>''");
    json_out(0, '发表成功', ['id' => $id, 'name' => $nickname, 'avatar' => $user['avatar'] ?? '', 'img' => $img, 'ip_location' => $location, 'total' => $total, 'gift_total' => $giftTotal]);
}

json_out(1, '未知操作');

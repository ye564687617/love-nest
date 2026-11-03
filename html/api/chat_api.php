<?php
// 聊天室 API：心跳（在线数）/ 发送 / 历史
require_once __DIR__ . '/bootstrap.php';

$action = req('action');
$online_file = sys_get_temp_dir() . '/lianai_chat_online.json';

// 心跳：更新在线数
if ($action === 'heartbeat') {
    $now = time();
    $vid = visitor_id();
    $user = current_admin();
    $file = fopen($online_file, 'c+');
    if (!$file || !flock($file, LOCK_EX)) throw new RuntimeException('无法更新在线状态');
    try {
        $data = json_decode(stream_get_contents($file), true);
        if (!is_array($data)) $data = [];
        $data = array_filter($data, static fn($entry) => is_array($entry) && $now - (int)($entry['time'] ?? 0) < 60);
        $data[$vid] = ['time' => $now, 'user_id' => (int)($user['id'] ?? 0)];
        $users = []; $guests = 0;
        foreach ($data as $entry) {
            if ($entry['user_id'] > 0) $users[$entry['user_id']] = true;
            else $guests++;
        }
        rewind($file);
        ftruncate($file, 0);
        fwrite($file, json_encode($data, JSON_THROW_ON_ERROR));
        fflush($file);
    } finally {
        flock($file, LOCK_UN);
        fclose($file);
    }
    json_out(0, 'ok', ['online' => count($users) + $guests, 'onlineUsers' => count($users), 'onlineGuests' => $guests]);
}

// 首页旧版前端使用 ?limit=5，未传 action；兼容该调用并统一返回首页所需字段。
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($action === 'history' || $action === '')) {
    $limit = max(1, min(100, req_int('limit', 20)));
    $rows = db()->fetchAll(
        "SELECT id, user_id, nickname, nickname AS display_name, content, is_bot,
                is_admin, avatar, image, reply_id, created_at
         FROM chat_messages ORDER BY id DESC LIMIT {$limit}"
    );
    json_out(0, 'ok', [
        'list' => array_reverse($rows),
        'total' => (int)db()->fetchColumn('SELECT COUNT(*) FROM chat_messages'),
        'today' => (int)db()->fetchColumn('SELECT COUNT(*) FROM chat_messages WHERE created_at >= CURDATE()'),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'send') {
    csrf_check();
    $user = current_admin();
    if (!$user) json_err('请登录后发言', 401);
    if (ip_blocked(client_ip())) json_out(403, '访问受限');
    $nickname = $user['nickname'] ?: $user['username'];
    $content = mb_substr(req('content'), 0, 500);
    $image = req('image', '', 255);
    if ($image !== '' && !preg_match('~^/uploads/user/\d{8}/[a-zA-Z0-9_.-]+\.(?:jpg|png|gif|webp)$~D', $image)) json_err('图片地址无效');
    if ($content === '' && $image === '') json_out(1, '消息不能为空');
    $replyId = max(0, req_int('reply_id'));
    if ($replyId && !db()->fetch('SELECT id FROM chat_messages WHERE id=?', [$replyId])) json_err('回复的消息不存在');

    $id = db()->insert('chat_messages', [
        'user_id' => (int)$user['id'], 'nickname' => $nickname, 'avatar' => $user['avatar'] ?? '',
        'content' => $content, 'image' => $image, 'reply_id' => $replyId, 'is_bot' => 0,
        'is_admin' => ($user['role'] ?? '') === 'admin' ? 1 : 0,
    ]);
    $resp = ['id' => $id];

    // 简单机器人回复
    $reply = bot_reply($content);
    if ($reply) {
        db()->query(
            "INSERT INTO chat_messages (nickname, content, is_bot, created_at) VALUES ('小爱', ?, 1, NOW())",
            [$reply]
        );
        $resp['bot_reply'] = $reply;
    }
    json_out(0, 'ok', $resp);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'retract') {
    csrf_check();
    $user = current_admin();
    if (!$user) json_err('请登录后操作', 401);
    $row = db()->fetch('SELECT user_id FROM chat_messages WHERE id=?', [req_int('msg_id')]);
    if (!$row) json_err('消息不存在', 404);
    if ((int)$row['user_id'] !== (int)$user['id'] && ($user['role'] ?? '') !== 'admin') json_err('无权撤回此消息', 403);
    db()->delete('chat_messages', 'id=:id', ['id' => req_int('msg_id')]);
    json_ok(null, '已撤回');
}

json_out(1, '未知操作');

function bot_reply(string $content): ?string
{
    $keywords = [
        '你好|嗨|hello|hi' => '你好呀～我是小爱，有什么可以帮你的吗？',
        '爱你|喜欢你' => '我也爱你呀～❤️',
        '几点|时间' => '现在是 ' . date('H:i') . '，要记得按时吃饭哦～',
        '天气' => '记得看窗外哦，冷了就加衣服～',
    ];
    foreach ($keywords as $pattern => $reply) {
        if (preg_match('/' . $pattern . '/iu', $content)) {
            return $reply;
        }
    }
    // 10% 概率随机回复
    if (rand(1, 10) === 1) {
        $pool = ['嗯嗯～', '哈哈', '是这样呀', '❤️', '抱抱你'];
        return $pool[array_rand($pool)];
    }
    return null;
}

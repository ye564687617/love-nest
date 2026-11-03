<?php
// 私聊消息接口（访客 ↔ 博主）
require_once __DIR__ . '/bootstrap.php';

$action = req('action', '');
if ($action === 'messages') $action = 'history';
if (isset($_REQUEST['partner_id']) && !isset($_REQUEST['peer_id'])) $_REQUEST['peer_id'] = $_REQUEST['partner_id'];
if (isset($_REQUEST['to_uid']) && !isset($_REQUEST['to_id'])) $_REQUEST['to_id'] = $_REQUEST['to_uid'];
$d = db();
$user = current_admin();
if (!$user) json_err('请登录后使用私信', 401);
if ($action === 'send') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('请使用 POST 发送', 405);
    csrf_check();
    if (ip_blocked(client_ip())) json_err('访问受限', 403);
    if (!db()->fetch('SELECT id FROM users WHERE id=?', [req_int('to_id')])) json_err('收件人不存在');
}

switch ($action) {
    case 'conversations':
        $me = (int)$user['id'];
        $rows = $d->fetchAll(
            'SELECT p.id,p.from_id,p.to_id,p.content,p.is_read,p.created_at,
                    u.id AS peer_id,u.nickname,u.username,u.avatar
             FROM private_msgs p JOIN users u ON u.id=IF(p.from_id=:me,p.to_id,p.from_id)
             WHERE p.from_id=:me OR p.to_id=:me ORDER BY p.id DESC', ['me' => $me]
        );
        $conversations = [];
        foreach ($rows as $row) {
            $peer = (int)$row['peer_id'];
            if (!isset($conversations[$peer])) {
                $conversations[$peer] = [
                    'peer_id' => $peer, 'nickname' => $row['nickname'] ?: $row['username'],
                    'avatar' => $row['avatar'], 'content' => $row['content'],
                    'created_at' => $row['created_at'], 'unread' => 0, 'total' => 0,
                ];
            }
            $conversations[$peer]['total']++;
            if ((int)$row['to_id'] === $me && !$row['is_read']) $conversations[$peer]['unread']++;
        }
        json_ok(['list' => array_values($conversations)]);

    case 'contacts':
        $me = (int)$user['id'];
        json_ok(['list' => $d->fetchAll(
            'SELECT id,nickname,username,avatar FROM users WHERE id<>? ORDER BY nickname,id LIMIT 100', [$me]
        )]);

    case 'read':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('请使用 POST 修改数据', 405);
        csrf_check();
        $d->update('private_msgs', ['is_read' => 1], 'to_id=:me AND from_id=:peer',
            ['me' => (int)$user['id'], 'peer' => req_int('peer_id')]);
        json_ok(null);
    // 拉取与某人的聊天记录（访客用固定 guest 标识）
    case 'history':
        $peer = (int)req('peer_id', 0);
        if ($peer < 1) json_err('请选择有效的聊天对象');
        $me = current_admin()['id'] ?? 0; // 访客为 0
        $rows = $d->fetchAll(
            'SELECT id, from_id, from_name, content, created_at
             FROM private_msgs
             WHERE (from_id = :me AND to_id = :peer) OR (from_id = :peer AND to_id = :me)
             ORDER BY id DESC LIMIT 50',
            ['me' => $me, 'peer' => $peer]
        );
        $rows = array_reverse($rows);
        foreach ($rows as &$row) $row['is_me'] = (int)$row['from_id'] === (int)$me;
        unset($row);
        json_out(0, "ok", ['list' => $rows, 'messages' => $rows]);
        break;

    case 'send':
        $to = (int)req('to_id', 0);
        $content = req('content', '', 1000);
        if ($content === '') {
            json_out(1, '消息不能为空');
        }
        $admin = current_admin();
        $fromId = $admin['id'] ?? 0;
        $fromName = $admin['nickname'] ?? req('nickname', '访客', 16);
        $id = $d->insert('private_msgs', [
            'from_id' => $fromId,
            'from_name' => $fromName === '' ? '访客' : $fromName,
            'to_id' => $to,
            'content' => $content,
        ]);
        json_out(0, "ok", ['id' => $id], '发送成功');
        break;

    // 未读数（管理员用）
    case 'unread':
        $admin = current_admin();
        $count = (int)$d->fetchColumn(
            'SELECT COUNT(*) FROM private_msgs WHERE to_id = :me AND is_read = 0',
            ['me' => $admin['id']]
        );
        json_out(0, "ok", ['unread' => $count]);
        break;

    default:
        json_out(1, '未知 action', 404);
}

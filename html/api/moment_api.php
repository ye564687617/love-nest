<?php
// 瞬间 API：点赞 / 评论列表 / 发表评论
require_once __DIR__ . '/bootstrap.php';

$action = req('action');

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'comments') {
    $mid_raw = req('moment_id');
    if (is_string($mid_raw) && strpos($mid_raw, 'photo_') === 0) {
        $mid = 1000000 + (int)substr($mid_raw, 6); // 照片评论用大数偏移
    } else {
        $mid = (int)$mid_raw;
    }
    if (!$mid) json_out(1, '参数错误');
    $comments = db()->fetchAll(
        "SELECT c.id, c.user_id, c.reply_id, c.nickname, c.avatar, c.content, c.img, c.created_at,
                r.nickname AS reply_nickname
         FROM moment_comments c
         LEFT JOIN moment_comments r ON r.id=c.reply_id AND r.moment_id=c.moment_id AND r.status=1
         WHERE c.moment_id = ? AND c.status = 1
         ORDER BY c.id ASC LIMIT 100",
        [$mid]
    );
    foreach ($comments as &$comment) {
        $comment['avatar'] = $comment['avatar'] ?: '/uploads/demo/avatar_boy.jpg';
        foreach (['id', 'user_id', 'reply_id'] as $key) $comment[$key] = (int)$comment[$key];
    }
    unset($comment);
    $total = (int)db()->fetchColumn('SELECT COUNT(*) FROM moment_comments WHERE moment_id=? AND status=1', [$mid]);
    json_out(0, 'ok', ['comments' => $comments, 'total' => $total]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (ip_blocked(client_ip())) json_out(403, '访问受限');

    if ($action === 'like') {
        $raw = req('moment_id');
        if (!preg_match('/^(photo_)?([1-9][0-9]*)$/D', (string)$raw, $match)) json_err('参数错误');
        $isPhoto = ($match[1] ?? '') === 'photo_';
        $id = (int)$match[2];
        $targetId = $isPhoto ? 1000000 + $id : $id;
        $table = $isPhoto ? 'photos' : 'moments';
        $visible = $isPhoto ? '' : ' AND status=1';
        // Serialize retries on the target row; likes cannot be cancelled.
        $likes = db()->transaction(function ($d) use ($table, $visible, $id, $targetId) {
            $target = $d->fetch("SELECT likes_count FROM `$table` WHERE id=?$visible FOR UPDATE", [$id]);
            if (!$target) return null;
            $exists = $d->fetch('SELECT id FROM moment_likes WHERE moment_id=? AND ip=? LIMIT 1', [$targetId, client_ip()]);
            $count = (int)$target['likes_count'];
            if (!$exists) {
                $d->query('INSERT INTO moment_likes (moment_id,ip,created_at) VALUES (?,?,NOW())', [$targetId, client_ip()]);
                $d->query("UPDATE `$table` SET likes_count=likes_count+1 WHERE id=?", [$id]);
                $count++;
            }
            return $count;
        });
        if ($likes === null) json_err('动态不存在或已隐藏', 404);
        json_ok(['likes' => $likes, 'liked' => true]);
    }

    if ($action === 'comment') {
        csrf_check();
        $admin = current_admin();
        if (!$admin) json_err('请登录后评论', 401);
        $mid_raw = req('moment_id');
        if (is_string($mid_raw) && strpos($mid_raw, 'photo_') === 0) {
            $mid = 1000000 + (int)substr($mid_raw, 6); // 照片评论用大数偏移
        } else {
            $mid = (int)$mid_raw;
        }
        $nickname = $admin['nickname'] ?: $admin['username'];
        $content = mb_substr(req('content'), 0, 500);
        $img = req('img', '', 255);
        if ($img !== '' && !preg_match('~^/uploads/user/\d{8}/[a-zA-Z0-9_.-]+\.(?:jpg|png|gif|webp)$~D', $img)) json_err('图片地址无效');
        if (!$mid || ($content === '' && $img === '')) json_out(1, '评论内容不能为空');
        $table = $mid >= 1000000 ? 'photos' : 'moments';
        $targetId = $mid >= 1000000 ? $mid - 1000000 : $mid;
        $visible = $table === 'moments' ? ' AND status=1' : '';
        if (!db()->fetch("SELECT id FROM `$table` WHERE id=?$visible", [$targetId])) json_err('动态不存在或已隐藏', 404);
        $replyId = max(0, req_int('reply_id'));
        if ($replyId && !db()->fetch('SELECT id FROM moment_comments WHERE id=? AND moment_id=? AND status=1', [$replyId, $mid])) json_err('回复的评论不存在');
        $id = db()->insert('moment_comments', [
            'moment_id' => $mid, 'user_id' => (int)$admin['id'], 'reply_id' => $replyId,
            'nickname' => $nickname, 'avatar' => $admin['avatar'] ?? '',
            'content' => $content, 'img' => $img, 'ip' => client_ip(), 'status' => 1,
        ]);
        json_out(0, 'ok', ['id' => $id]);
    }
}

json_out(1, '未知操作');

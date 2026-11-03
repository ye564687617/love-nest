<?php
// 举报接口
require_once __DIR__ . '/bootstrap.php';

$action = req('action', '');
if ($action === 'submit') {
    $_REQUEST['type'] = 'user';
    $_REQUEST['target_id'] = req_int('reported_id');
    $action = 'add';
}

if ($action === 'add') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('请使用 POST 提交', 405);
    csrf_check();
    if (!current_admin()) json_err('请登录后举报', 401);
    $type = req('type', '', 16);
    $targetId = (int)req('target_id', 0);
    $reason = req('reason', '', 255);
    if (!in_array($type, ['moment', 'message', 'photo', 'comment', 'user'], true) || $targetId <= 0) {
        json_out(1, '参数错误');
    }
    db()->insert('reports', [
        'type' => $type,
        'target_id' => $targetId,
        'reason' => $reason === '' ? '违规内容' : $reason,
        'ip' => client_ip(),
    ]);
    json_ok(null, '举报已提交，感谢监督~');
}

if ($action === 'list') {
    // 管理员查看
    require_admin();
    $rows = db()->fetchAll('SELECT * FROM reports ORDER BY id DESC LIMIT 100');
    json_out(0, "ok", ['list' => $rows]);
}

json_out(1, '未知 action', 404);

<?php
require_once __DIR__ . '/bootstrap.php';
$user = require_user();
$action = req('action', 'profile');
$uid = (int)$user['id'];
$d = db();
if (in_array($action, ['save', 'password', 'delete_message'], true)) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('请使用 POST 修改数据', 405);
    csrf_check();
}
if ($action === 'profile') {
    json_ok([
        'id' => $uid, 'username' => $user['username'], 'nickname' => $user['nickname'],
        'avatar' => $user['avatar'], 'birthday' => $user['birthday'], 'bio' => $user['bio'],
        'role' => $user['role'], 'created_at' => $user['created_at'],
    ]);
}
if ($action === 'save') {
    $birthday = req('birthday');
    $avatar = req('avatar', '', 255);
    if ($birthday !== '' && (!site_valid_date($birthday) || $birthday > date('Y-m-d'))) json_err('请输入正确的生日');
    if (!site_valid_media_url($avatar)) json_err('头像地址无效');
    $data = [
        'nickname' => req('nickname', '', 32) ?: $user['username'],
        'birthday' => $birthday === '' ? null : $birthday,
        'bio' => req('bio', '', 200), 'avatar' => $avatar,
    ];
    $d->update('users', $data, 'id=:id', ['id' => $uid]);
    $_SESSION['admin'] = array_merge($user, $data);
    json_ok(null, '资料已保存');
}
if ($action === 'password') {
    $old = $_POST['old'] ?? '';
    $new = $_POST['new'] ?? '';
    $confirm = $_POST['confirm'] ?? '';
    if (!is_string($old) || !is_string($new) || !is_string($confirm)) json_err('密码格式错误');
    if (strlen($new) < 6 || strlen($new) > 128) json_err('新密码需为 6-128 字节');
    if ($new !== $confirm) json_err('两次密码不一致');
    $hash = $d->fetchColumn('SELECT password_hash FROM users WHERE id=?', [$uid]);
    if (!password_verify($old, $hash)) json_err('原密码错误');
    $d->update('users', ['password_hash' => password_hash($new, PASSWORD_DEFAULT)], 'id=:id', ['id' => $uid]);
    unset($_SESSION['admin'], $_SESSION['auth_hash']);
    session_regenerate_id(true);
    json_ok(null, '密码已修改，请重新登录');
}
if ($action === 'messages') {
    $page = max(1, req_int('page', 1));
    $offset = ($page - 1) * 15;
    json_ok([
        'list' => $d->fetchAll("SELECT id,content,img,status,created_at FROM messages WHERE user_id=? ORDER BY id DESC LIMIT 15 OFFSET $offset", [$uid]),
        'total' => (int)$d->fetchColumn('SELECT COUNT(*) FROM messages WHERE user_id=?', [$uid]),
        'page' => $page,
    ]);
}
if ($action === 'delete_message') {
    $id = req_int('id');
    if (!$d->fetch('SELECT id FROM messages WHERE id=? AND user_id=?', [$id, $uid])) json_err('留言不存在或无权删除', 404);
    $d->delete('messages', 'id=:id AND user_id=:uid', ['id' => $id, 'uid' => $uid]);
    json_ok(null, '留言已删除');
}
json_err('未知操作', 404);

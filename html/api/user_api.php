<?php
// 用户 API：访客信息（用于点赞/评论身份）
require_once __DIR__ . '/bootstrap.php';

$action = req('action');

if ($action === 'info') {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    $vid = client_ip();
    // 查该访客点赞过的瞬间
    $liked = db()->fetchAll(
        "SELECT moment_id FROM moment_likes WHERE ip = ?",
        [$vid]
    );
    $liked_ids = array_column($liked, 'moment_id');
    $admin = current_admin();
    json_out(0, 'ok', [
        'visitor_id' => $vid,
        'liked_moments' => $liked_ids,
        'is_admin' => ($admin['role'] ?? '') === 'admin',
        'can_manage_content' => content_permissions($admin) !== [],
        'logged_in' => $admin !== null,
        'nickname' => $admin['nickname'] ?? $admin['username'] ?? '',
        'user_id' => (int)($admin['id'] ?? 0),
        'avatar' => $admin['avatar'] ?? '',
        'csrf_token' => csrf_token(),
    ]);
}

if ($action === 'logout') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('请使用 POST 退出', 405);
    csrf_check();
    unset($_SESSION['admin'], $_SESSION['auth_hash']);
    session_regenerate_id(true);
    json_ok(null, '已退出登录');
}

if ($action === 'login') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('请使用 POST 登录', 405);
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    $username = req_string('username', 30);
    // 登录表单字段名是 account/password
    if ($username === '') $username = req_string('account', 30);
    $password = $_POST['password'] ?? '';
    if (!is_string($password) || strlen($password) > 128) json_err('密码格式错误');
    $captcha = req_string('captcha', 8);
    require_once __DIR__ . '/../inc/login-throttle.php';
    $attempt = login_attempt($username, client_ip());
    if (!$attempt['allowed']) {
        http_response_code(429);
        header('Retry-After: ' . $attempt['retry_after']);
        json_err('登录尝试过多，请稍后再试', 429, ['retry_after' => $attempt['retry_after'], 'require_captcha' => true]);
    }

    $sess_captcha = $_SESSION['captcha_login'] ?? '';
    $captchaRequired = $sess_captcha !== '' || $attempt['require_captcha'] || (int)($_SESSION['login_failures'] ?? 0) >= 3;
    unset($_SESSION['captcha_login']);
    if ($captchaRequired && ($sess_captcha === '' || strcasecmp($captcha, $sess_captcha) !== 0)) {
        json_out(1, '验证码错误', ['require_captcha' => true]);
    }

    $u = db()->fetch('SELECT * FROM users WHERE username = ?', [$username]);
    if (!$u || !password_verify($password, $u['password_hash'])) {
        $_SESSION['login_failures'] = (int)($_SESSION['login_failures'] ?? 0) + 1;
        json_out(1, '账号或密码错误', ['require_captcha' => $_SESSION['login_failures'] >= 3]);
    }
    unset($_SESSION['login_failures']);
    login_attempt_succeeded($username, client_ip());
    $_SESSION['auth_hash'] = $u['password_hash'];
    unset($u['password_hash']);
    session_regenerate_id(true);
    $_SESSION['admin'] = $u;
    json_out(0, '登录成功，欢迎回来~', ['nickname' => $u['nickname'] ?? $u['username']]);
}

if ($action === 'register') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('请使用 POST 注册', 405);
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    $captcha = $_SESSION['captcha_register'] ?? '';
    unset($_SESSION['captcha_register']);
    if ($captcha === '' || strcasecmp($captcha, req_string('captcha', 8)) !== 0) json_err('验证码错误');
    $username = req_string('username', 30);
    $password = $_POST['password'] ?? '';
    if (!is_string($password) || strlen($password) > 128) json_err('密码格式错误');
    if (!preg_match('/^[a-zA-Z0-9_]{3,30}$/D', $username)) json_err('账号需为 3-30 位字母、数字或下划线');
    if (strlen($password) < 6) json_err('密码至少 6 位');
    if ($password !== ($_POST['confirm_password'] ?? '')) json_err('两次密码不一致');
    if (db()->fetch('SELECT id FROM users WHERE username=?', [$username])) json_err('账号已存在');
    try {
        $id = db()->insert('users', [
            'username' => $username, 'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'nickname' => req_string('display_name', 32, $username) ?: $username,
            'avatar' => '/uploads/demo/avatar_boy.jpg', 'role' => 'user',
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') json_err('账号已存在');
        throw $e;
    }
    $user = db()->fetch('SELECT * FROM users WHERE id=?', [$id]);
    $_SESSION['auth_hash'] = $user['password_hash'];
    unset($user['password_hash']);
    session_regenerate_id(true);
    $_SESSION['admin'] = $user;
    json_ok(['id' => $id], '注册成功');
}

if ($action === 'login_status') {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    $admin = current_admin();
    json_out(0, 'ok', $admin ? ['logged' => true] : ['logged' => false]);
}

json_out(1, '未知操作');

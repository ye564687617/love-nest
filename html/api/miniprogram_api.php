<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../inc/miniprogram.php';
header('Cache-Control: no-store');
$action = req_string('action', 32, 'home');
$method = $_SERVER['REQUEST_METHOD'];

if (in_array($action, ['chat', 'chat_send', 'chat_read'], true)) {
    $user = mini_require_owner();
    $peer = mini_partner($user);
    if (!$peer) json_err('请先在站点设置中配置两位主人', 409);
    $me = (int)$user['id'];
    $partner = (int)$peer['id'];
    // The recipient is resolved from policy, never from client-supplied IDs.
    $pair = '((from_id=:me AND to_id=:peer) OR (from_id=:peer AND to_id=:me))';
    $params = ['me' => $me, 'peer' => $partner];
    if ($action === 'chat') {
        if ($method !== 'GET') json_err('请使用 GET 读取', 405);
        $after = max(0, req_int('after'));
        $before = max(0, req_int('before'));
        if ($after && $before) json_err('不能同时向前和向后翻页');
        $filter = $after ? ' AND id>:cursor' : ($before ? ' AND id<:cursor' : '');
        if ($after || $before) $params['cursor'] = $after ?: $before;
        $order = $after ? 'ASC' : 'DESC';
        $rows = db()->fetchAll("SELECT id,from_id,from_name,content,created_at,is_read FROM private_msgs WHERE $pair$filter ORDER BY id $order LIMIT 31", $params);
        $more = count($rows) > 30;
        $rows = array_slice($rows, 0, 30);
        if (!$after) $rows = array_reverse($rows);
        foreach ($rows as &$row) {
            $row['id'] = (int)$row['id'];
            $row['is_me'] = (int)$row['from_id'] === $me;
            unset($row['from_id']);
        }
        unset($row);
        json_ok(['list' => $rows, 'has_more' => $more, 'partner_id' => $partner,
            'partner' => $peer['nickname'] ?: $peer['username']]);
    }
    if ($method !== 'POST') json_err('请使用 POST 操作', 405);
    csrf_check();
    // A policy change must not silently redirect an in-flight send to a new owner.
    if (isset($_REQUEST['partner_id']) && req_int('partner_id') !== $partner) {
        json_err('聊天对象已变更，请刷新对话后再发送', 409);
    }
    if ($action === 'chat_read') {
        $through = max(0, req_int('through'));
        db()->update('private_msgs', ['is_read' => 1], 'to_id=:me AND from_id=:peer AND id<=:through',
            ['me' => $me, 'peer' => $partner, 'through' => $through]);
        json_ok(null);
    }
    if (ip_blocked(client_ip())) json_err('访问受限', 403);
    $content = req_string('content', 1000);
    if ($content === '') json_err('消息不能为空');
    $id = db()->insert('private_msgs', ['from_id' => $me, 'to_id' => $partner,
        'from_name' => $user['nickname'] ?: $user['username'], 'content' => $content]);
    json_ok(['id' => (int)$id]);
}

if ($action === 'login') {
    if ($method !== 'POST') json_err('请使用 POST 登录', 405);
    csrf_check();
    $username = req_string('username', 30);
    $password = $_POST['password'] ?? '';
    if (!is_string($password) || strlen($password) > 128) json_err('密码格式错误');
    require_once __DIR__ . '/../inc/login-throttle.php';
    $attempt = login_attempt($username, client_ip());
    if (!$attempt['allowed']) json_err('登录尝试过多，请稍后再试', 429);
    $captcha = req_string('captcha', 8);
    if (!check_captcha($captcha)) json_err('验证码错误，请点击图片刷新', 1);
    $user = db()->fetch('SELECT * FROM users WHERE username=?', [$username]);
    if (!$user || !password_verify($password, $user['password_hash']) || !mini_owner($user)) {
        json_err('账号、密码错误或不属于小窝主人', 403);
    }
    login_attempt_succeeded($username, client_ip());
    session_regenerate_id(true);
    $_SESSION['auth_hash'] = $user['password_hash'];
    unset($user['password_hash']);
    $_SESSION['admin'] = $user;
    json_ok(['nickname' => $user['nickname'], 'csrf_token' => csrf_token()]);
}

if ($action === 'manage' || $action === 'upload') {
    if ($method !== 'POST') json_err('请使用 POST 操作', 405);
    mini_require_owner();
    csrf_check();
    if ($action === 'upload') {
        require_content_manager('moments');
        require __DIR__ . '/upload_image.php';
        exit;
    }
    $module = req_string('module', 16);
    $operation = req_string('operation', 16);
    if (!in_array($module, ['moments', 'lovelist', 'countdowns'], true)
        || !in_array($operation, ['create', 'update', 'delete'], true)) json_err('不支持的操作', 400);
    // Validate mini-program inputs before forwarding to the established handlers.
    if ($operation !== 'create') {
        $id = req_string('id', 20);
        if (!ctype_digit($id) || (int)$id <= 0) json_err('记录 ID 无效');
    }
    if (in_array($operation, ['create', 'update'], true)) {
        if ($module === 'moments') {
            req_string('content', 2000);
            req_string('location', 64);
            if (!isset($_POST['status'])) $_POST['status'] = $_REQUEST['status'] = '0';
        } else {
            req_string('title', $module === 'lovelist' ? 128 : 64);
        }
    }
    $_POST['action'] = $_GET['action'] = $_REQUEST['action'] = $operation;
    require __DIR__ . '/admin_api.php';
    exit;
}

if ($method !== 'GET') json_err('请使用 GET 读取', 405);
$user = current_admin();
$owner = mini_owner($user);

if ($action === 'session') {
    json_ok(['owner' => $owner, 'nickname' => $owner ? ($user['nickname'] ?: $user['username']) : '',
        'permissions' => $owner ? content_permissions($user) : [], 'csrf_token' => csrf_token()]);
}
if ($action === 'playlist') {
    json_ok(['list' => array_values(array_filter(site_playlist(),
        fn($song) => $song['src'] !== '' && site_valid_media_url($song['src'])))]);
}
if ($action === 'home') {
    $keys = ['title', 'subtitle', 'boy_name', 'girl_name', 'boy_avatar', 'girl_avatar', 'love_start'];
    $config = [];
    foreach ($keys as $key) $config[$key] = cfg($key);
    $stats = db()->fetch('SELECT COUNT(*) AS total, COALESCE(SUM(done=1),0) AS done FROM lovelist');
    $latest = db()->fetchAll('SELECT * FROM moments WHERE status=1 ORDER BY is_top DESC, created_at DESC, id DESC LIMIT 3');
    json_ok(['site' => $config, 'checklist' => $stats, 'moments' => array_map('mini_moment', $latest),
        'moment_count' => (int)db()->fetchColumn('SELECT COUNT(*) FROM moments WHERE status=1')]);
}
if ($action === 'moments') {
    $page = max(1, min(10000, req_int('page', 1)));
    $offset = ($page - 1) * 15;
    $where = $owner && can_manage_module('moments') && req('scope') === 'manage' ? '' : ' WHERE status=1';
    $summary = db()->fetch("SELECT COUNT(*) AS total, COUNT(DISTINCT NULLIF(TRIM(location),'')) AS cities, COALESCE(DATEDIFF(MAX(created_at),MIN(created_at)),0) AS record_days FROM moments$where");
    $years = array_map('intval', array_column(db()->fetchAll("SELECT DISTINCT YEAR(created_at) AS year FROM moments$where ORDER BY year DESC"), 'year'));
    $year = req_int('year');
    $month = req_int('month');
    if (($year && ($year < 1900 || $year > 9999)) || $month < 0 || $month > 12 || ($month && !$year)) json_err('日期筛选无效');
    $params = [];
    if ($year) {
        $from = sprintf('%04d-%02d-01 00:00:00', $year, $month ?: 1);
        $until = $month ? date('Y-m-d H:i:s', strtotime($from . ' +1 month')) : ($year + 1) . '-01-01 00:00:00';
        $where .= ($where ? ' AND ' : ' WHERE ') . 'created_at>=:from_date AND created_at<:until_date';
        $params = ['from_date' => $from, 'until_date' => $until];
    }
    $rows = db()->fetchAll("SELECT * FROM moments$where ORDER BY is_top DESC, created_at DESC, id DESC LIMIT 15 OFFSET $offset", $params);
    $filteredTotal = (int)db()->fetchColumn("SELECT COUNT(*) FROM moments$where", $params);
    json_ok(['list' => array_map('mini_moment', $rows), 'page' => $page,
        'summary' => array_map('intval', $summary), 'years' => $years,
        'has_more' => $offset + count($rows) < $filteredTotal]);
}
if ($action === 'lovelist') {
    json_ok(['list' => db()->fetchAll('SELECT id,title,done FROM lovelist ORDER BY sort,id')]);
}
if ($action === 'countdowns') {
    $rows = db()->fetchAll('SELECT id,title,target_date,kind,festival_key,birthday_calendar FROM countdowns ORDER BY sort,id');
    $public = array_map('intval', (array)mini_config()['public_countdown_ids']);
    if (!$owner) $rows = array_values(array_filter($rows, fn($row) => in_array((int)$row['id'], $public, true)));
    json_ok(['list' => $rows]);
}
json_err('未知操作', 400);

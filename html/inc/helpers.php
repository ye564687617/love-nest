<?php
require_once __DIR__ . '/security.php';
// 通用助手函数：配置 / JSON 输出 / CSRF / 鉴权 / 工具

function app_config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $file = __DIR__ . '/config.php';
        if (!is_file($file)) {
            http_response_code(500);
            exit('缺少 inc/config.php，请复制 inc/config.example.php 并填写');
        }
        $cfg = require $file;
    }
    return $cfg;
}

function db(): Database
{
    return Database::get(app_config()['db']);
}

/** 统一 JSON 输出：{code, msg, data}，code=0 成功 */
function json_out(int $code, string $msg = '', mixed $data = null): never
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['code' => $code, 'msg' => $msg, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function json_ok(mixed $data = null, string $msg = 'ok'): never
{
    json_out(0, $msg, $data);
}

function json_err(string $msg = 'error', int $code = 1, mixed $data = null): never
{
    json_out($code, $msg, $data);
}

/** CSRF token 生成 / 校验 */
function csrf_token(): string
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_check(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    $sent = $_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $real = $_SESSION['csrf_token'] ?? '';
    if (!is_string($sent) || $sent === '' || $real === '' || !hash_equals($real, $sent)) {
        json_err('CSRF 校验失败，请刷新页面重试', 403);
    }
}

/** 校验图形验证码（一次性） */
function check_captcha(string $input): bool
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    $real = $_SESSION['captcha_login'] ?? '';
    unset($_SESSION['captcha_login']);
    return $real !== '' && strcasecmp($real, trim($input)) === 0;
}

/** 当前登录管理员，无则 null */
function current_admin(): ?array
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    $sessionUser = $_SESSION['admin'] ?? null;
    if (!$sessionUser) return null;
    static $resolved = [];
    $id = (int)$sessionUser['id'];
    if (!array_key_exists($id, $resolved)) {
        $resolved[$id] = db()->fetch('SELECT * FROM users WHERE id=?', [$id]);
    }
    $user = $resolved[$id];
    if (!$user || (isset($_SESSION['auth_hash']) && !hash_equals($_SESSION['auth_hash'], $user['password_hash']))) {
        unset($_SESSION['admin'], $_SESSION['auth_hash']);
        return null;
    }
    $_SESSION['auth_hash'] = $user['password_hash'];
    unset($user['password_hash']);
    return $_SESSION['admin'] = $user;
}

function require_user(): array
{
    $user = current_admin();
    if ($user) return $user;
    if (str_starts_with($_SERVER['SCRIPT_NAME'] ?? '', '/api/')) json_err('请先登录', 401);
    header('Location: /admin/login.php');
    exit;
}

function require_admin(): array
{
    $admin = current_admin();
    if ($admin === null || ($admin['role'] ?? '') !== 'admin') {
        $isApi = str_starts_with($_SERVER['SCRIPT_NAME'] ?? '', '/api/');
        if ($isApi) {
            json_err($admin === null ? '未登录' : '没有管理员权限', $admin === null ? 401 : 403);
        }
        if (($admin['role'] ?? '') === 'editor') {
            http_response_code(403);
            exit('没有管理员权限');
        }
        header('Location: /admin/login.php');
        exit;
    }
    return $admin;
}

function content_modules(): array
{
    return ['albums' => '相册管理', 'moments' => '甜蜜瞬间', 'articles' => '文章管理', 'messages' => '留言祝福', 'lovelist' => '恋爱清单', 'countdowns' => '纪念日', 'playlist' => '音乐歌单'];
}

function content_permissions(?array $user = null): array
{
    $user = $user ?? current_admin();
    $modules = array_keys(content_modules());
    if (($user['role'] ?? '') === 'admin') return $modules;
    if (($user['role'] ?? '') !== 'editor') return [];
    if (($user['content_permissions'] ?? null) === null) return $modules;
    $permissions = json_decode($user['content_permissions'], true);
    if (!is_array($permissions) || !array_is_list($permissions)) return [];
    return array_values(array_intersect($modules, $permissions));
}

function can_manage_module(string $module): bool
{
    return in_array($module === 'photos' ? 'albums' : $module, content_permissions(), true);
}

function require_content_manager(?string $module = null): array
{
    $user = require_user();
    if ($module === null ? content_permissions($user) !== [] : can_manage_module($module)) return $user;
    if (str_starts_with($_SERVER['SCRIPT_NAME'] ?? '', '/api/')) json_err('没有内容管理权限', 403);
    http_response_code(403);
    exit('没有此模块的管理权限');
}

/** 站点配置读写 */
function site_config(string $key, string $default = ''): string
{
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        foreach (db()->fetchAll('SELECT `k`, `v` FROM site_config') as $row) {
            $cache[$row['k']] = $row['v'];
        }
    }
    return $cache[$key] ?? $default;
}

function site_config_set(string $key, string $value): void
{
    db()->query(
        'INSERT INTO site_config (`k`, `v`) VALUES (:k, :v) ON DUPLICATE KEY UPDATE `v` = VALUES(`v`)',
        ['k' => $key, 'v' => $value]
    );
}

/** HTML 转义 */
function esc(mixed $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Walk the proxy chain from the trusted peer, stopping at the first untrusted hop. */
function client_ip(): string
{
    $peer = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!filter_var($peer, FILTER_VALIDATE_IP)) return '0.0.0.0';
    if (!trusted_proxy($peer)) return $peer;
    $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? '';
    $chain = array_map('trim', explode(',', $forwarded));
    foreach (array_reverse($chain) as $hop) {
        if (!trusted_proxy($peer)) break;
        if (!filter_var($hop, FILTER_VALIDATE_IP)) return $_SERVER['REMOTE_ADDR'];
        $peer = $hop;
    }
    return $peer;
}

/** 是否被拉黑 */
function ip_blocked(string $ip): bool
{
    return (bool)db()->fetch('SELECT id FROM ip_blacklist WHERE ip = :ip', ['ip' => $ip]);
}

/** 输入长度截断（多字节安全） */
function mb_cut(string $s, int $len): string
{
    return mb_substr($s, 0, $len, 'UTF-8');
}

/** 相对时间：x分钟前 / x小时前 / Y-m-d */
function time_ago(string $datetime): string
{
    $ts = strtotime($datetime);
    $diff = time() - $ts;
    if ($diff < 60) return '刚刚';
    if ($diff < 3600) return floor($diff / 60) . '分钟前';
    if ($diff < 86400) return floor($diff / 3600) . '小时前';
    if ($diff < 86400 * 30) return floor($diff / 86400) . '天前';
    return date('Y-m-d', $ts);
}

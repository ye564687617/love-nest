<?php
// API 统一引导：异常转 JSON
set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['code' => 500, 'msg' => '服务器错误', 'data' => null], JSON_UNESCAPED_UNICODE);
    error_log('[lianai-v2] ' . $e->getMessage());
    exit;
});

require_once __DIR__ . '/../inc/site.php';

header('Content-Type: application/json; charset=utf-8');

function req(string $key, mixed $default = '', int $maxlen = 0): mixed
{
    $v = $_REQUEST[$key] ?? $default;
    if (is_array($v)) {
        return $v;
    }
    $v = trim((string)$v);
    if ($maxlen > 0) {
        $v = mb_substr($v, 0, $maxlen);
    }
    return $v;
}

function req_int(string $key, int $default = 0): int
{
    return (int)($_REQUEST[$key] ?? $default);
}

function req_string(string $key, int $maxlen, string $default = ''): string
{
    $value = $_POST[$key] ?? $_GET[$key] ?? $default;
    if (!is_string($value)) json_err('字段格式无效：' . $key);
    $value = trim($value);
    if (mb_strlen($value, 'UTF-8') > $maxlen) json_err('字段过长：' . $key);
    return $value;
}

function visitor_id(): string
{
    if (empty($_COOKIE['visitor_id'])) {
        $vid = bin2hex(random_bytes(8));
        setcookie('visitor_id', $vid, time() + 365 * 86400, '/');
        return $vid;
    }
    return $_COOKIE['visitor_id'];
}

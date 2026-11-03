<?php
require_once __DIR__ . '/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_err('请求方式不支持', 405);
$ip = client_ip();
if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
    json_out(0, '本地网络无法识别城市，可手动填写', ['location' => '', 'source' => 'local']);
}
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
$key = hash('sha256', $ip);
$cached = $_SESSION['city_lookup'] ?? null;
if ($cached && $cached['key'] === $key && $cached['expires'] > time()) {
    session_write_close();
    json_out(0, 'ok', $cached['data']);
}
session_write_close();
$context = stream_context_create(['http' => ['timeout' => 2, 'ignore_errors' => true, 'follow_location' => 0]]);
$raw = @file_get_contents('https://ipwho.is/' . rawurlencode($ip) . '?lang=zh-CN&fields=success,region,city', false, $context, 0, 16384);
$result = $raw ? json_decode($raw, true) : null;
$city = '';
if (is_array($result) && ($result['success'] ?? false)) {
    $parts = array_unique(array_filter([$result['region'] ?? '', $result['city'] ?? '']));
    $city = mb_substr(implode(' ', $parts), 0, 64);
}
$data = ['location' => $city, 'source' => 'ip'];
session_start();
$_SESSION['city_lookup'] = ['key' => $key, 'expires' => time() + ($city !== '' ? 3600 : 120), 'data' => $data];
session_write_close();
json_out(0, $city !== '' ? 'ok' : '暂时无法识别城市，可手动填写', $data);

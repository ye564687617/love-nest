<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('请使用 POST 上传', 405);
require_content_manager('playlist');
csrf_check();
if (ip_blocked(client_ip())) json_err('访问受限', 403);

$file = $_FILES['file'] ?? null;
if (!is_array($file) || !isset($file['error']) || is_array($file['error'])) {
    json_err('请选择 MP3 文件，单首最大 15MB');
}
if (in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
    json_err('文件太大，单首最大 15MB');
}
if ($file['error'] !== UPLOAD_ERR_OK) json_err('音乐上传失败，请重新选择文件');
if (!is_string($file['tmp_name'] ?? null) || !is_uploaded_file($file['tmp_name'])) {
    json_err('不是有效的上传文件');
}
$size = filesize($file['tmp_name']);
if ($size === false || $size === 0 || $size > 15 * 1024 * 1024) {
    json_err('文件为空或超过 15MB');
}
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
if (!in_array($mime, ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg'], true)) {
    json_err('请选择有效的 MP3 音频文件');
}

$path = '/uploads/music/' . date('Ymd');
$dir = dirname(__DIR__) . $path;
if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
    json_err('音乐目录创建失败，请检查上传目录权限');
}
$url = $path . '/' . bin2hex(random_bytes(16)) . '.mp3';
if (!move_uploaded_file($file['tmp_name'], dirname(__DIR__) . $url)) {
    json_err('音乐保存失败，请检查上传目录权限');
}
json_ok(['url' => $url]);

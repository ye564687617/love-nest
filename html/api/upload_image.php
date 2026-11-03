<?php
// 图片上传（访客留言/聊天配图）
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('请使用 POST 上传', 405);
csrf_check();
if (!current_admin()) json_err('请登录后上传图片', 401);
if (ip_blocked(client_ip())) json_err('访问受限', 403);

if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    json_out(1, '文件上传失败');
}

$file = $_FILES['file'];
$max_size = 5 * 1024 * 1024;
if ($file['size'] > $max_size) {
    json_out(1, '文件太大，最大 5MB');
}

// MIME 校验
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);
$mimeExtensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'];
if (!isset($mimeExtensions[$mime]) || @getimagesize($file['tmp_name']) === false) {
    json_out(1, '不是有效的图片文件');
}
$ext = $mimeExtensions[$mime];

$dir = __DIR__ . '/../uploads/user/' . date('Ymd');
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

$name = date('His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$dest = $dir . '/' . $name;
if (!move_uploaded_file($file['tmp_name'], $dest)) {
    json_out(1, '保存失败');
}

$url = '/uploads/user/' . date('Ymd') . '/' . $name;
json_out(0, 'ok', ['url' => $url]);

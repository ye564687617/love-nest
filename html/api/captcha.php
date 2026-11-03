<?php
require_once __DIR__ . '/../inc/security.php';
// 图形验证码（4 位字母数字，session 存储）
if (session_status() !== PHP_SESSION_ACTIVE) session_start();

$chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
$code = '';
for ($i = 0; $i < 4; $i++) {
    $code .= $chars[random_int(0, strlen($chars) - 1)];
}
$type = ($_GET['type'] ?? 'login') === 'register' ? 'register' : 'login';
$_SESSION['captcha_' . $type] = $code;
header('Cache-Control: no-store, no-cache, must-revalidate');

$w = 110; $h = 40;
$img = imagecreatetruecolor($w, $h);
$bg = imagecolorallocate($img, 255, 245, 248);
imagefilledrectangle($img, 0, 0, $w, $h, $bg);

for ($i = 0; $i < 4; $i++) {
    $c = imagecolorallocate($img, random_int(180, 230), random_int(150, 200), random_int(180, 220));
    imageline($img, random_int(0, $w), random_int(0, $h), random_int(0, $w), random_int(0, $h), $c);
}
for ($i = 0; $i < 80; $i++) {
    $c = imagecolorallocate($img, random_int(200, 240), random_int(200, 240), random_int(200, 240));
    imagesetpixel($img, random_int(0, $w), random_int(0, $h), $c);
}
for ($i = 0; $i < 4; $i++) {
    $c = imagecolorallocate($img, random_int(120, 200), random_int(80, 140), random_int(140, 190));
    imagestring($img, 5, 12 + $i * 24, random_int(8, 14), $code[$i], $c);
}

header('Content-Type: image/png');
imagepng($img);
imagedestroy($img);

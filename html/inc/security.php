<?php
// Forwarding headers are accepted only from explicitly configured proxy peers.
function trusted_proxy(string $ip): bool
{
    $packed = @inet_pton($ip);
    if ($packed === false) return false;
    foreach (explode(',', getenv('TRUSTED_PROXIES') ?: '') as $network) {
        $parts = explode('/', trim($network), 2);
        $base = @inet_pton($parts[0]);
        if ($base === false || strlen($base) !== strlen($packed)) continue;
        $bits = isset($parts[1]) && ctype_digit($parts[1]) ? (int)$parts[1] : strlen($base) * 8;
        if (isset($parts[1]) && !ctype_digit($parts[1])) continue;
        if ($bits < 0 || $bits > strlen($base) * 8) continue;
        $bytes = intdiv($bits, 8);
        $rest = $bits % 8;
        if (substr($base, 0, $bytes) === substr($packed, 0, $bytes)
            && (!$rest || ((ord($base[$bytes]) ^ ord($packed[$bytes])) & (255 << (8 - $rest))) === 0)) return true;
    }
    return false;
}

function request_is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') return true;
    return trusted_proxy($_SERVER['REMOTE_ADDR'] ?? '')
        && strtolower(trim($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'secure' => request_is_https(),
        'httponly' => true, 'samesite' => 'Lax',
    ]);
}

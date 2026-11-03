<?php
// 站点配置：从 site_config 表加载，带缓存
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/helpers.php';

function site_cfg(): array
{
    static $cfg = null;
    if ($cfg === null) {
        try {
            $rows = db()->fetchAll("SELECT `k`, `v` FROM site_config");
            $cfg = [];
            foreach ($rows as $r) {
                $cfg[$r['k']] = $r['v'];
            }
        } catch (Exception $e) {
            $cfg = [];
        }
        $defaults = [
            'title' => '恋爱小窝',
            'subtitle' => '陪伴是最长情的告白~',
            'boy_name' => '彬彬',
            'girl_name' => '小萍子',
            'boy_birth' => '2000-05-13',
            'girl_birth' => '2002-03-16',
            'love_start' => '2025-02-14 06:35:00',
            'boy_avatar' => 'uploads/demo/avatar_boy.jpg',
            'girl_avatar' => 'uploads/demo/avatar_girl.jpg',
        ];
        $cfg = array_merge($defaults, $cfg);
    }
    return $cfg;
}

function cfg(string $key, string $default = ''): string
{
    $c = site_cfg();
    return $c[$key] ?? $default;
}

function e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function site_json(mixed $value): string
{
    return json_encode($value, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}

function site_playlist(): array
{
    static $songs = null;
    if ($songs === null) {
        $songs = array_map(static fn(array $row): array => [
            'id' => (int)$row['id'],
            'name' => $row['title'],
            'artist' => $row['artist'],
            'src' => $row['url'],
            'cover' => $row['cover'],
            'lyrics' => $row['lyrics'],
        ], db()->fetchAll('SELECT * FROM playlist ORDER BY sort ASC, id ASC'));
    }
    return $songs;
}

function site_valid_date(string $date, bool $withTime = false): bool
{
    $format = $withTime ? 'Y-m-d H:i:s' : 'Y-m-d';
    $parsed = DateTimeImmutable::createFromFormat('!' . $format, $date);
    return $parsed !== false && $parsed->format($format) === $date;
}

function site_valid_media_url(string $url): bool
{
    if ($url === '') return true;
    if (preg_match('~[\x00-\x20\x7f\\\\]~', $url)) return false;
    if (preg_match('~^(?:/(?!/)|uploads/|static/)~', $url)) return true;
    return filter_var($url, FILTER_VALIDATE_URL) !== false
        && in_array(strtolower(parse_url($url, PHP_URL_SCHEME) ?? ''), ['http', 'https'], true);
}

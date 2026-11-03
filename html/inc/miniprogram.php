<?php
// Independent mini-program policy; no changes to the website's authentication.
function mini_config(): array
{
    static $config;
    if ($config === null) {
        $file = __DIR__ . '/miniprogram.local.php';
        $local = is_file($file) ? require $file : [];
        $saved = json_decode(site_config('mini_policy', ''), true);
        $config = array_merge(['owner_ids' => [], 'public_countdown_ids' => []],
            is_array($saved) ? $saved : (is_array($local) ? $local : []));
    }
    return $config;
}

function mini_policy_ids(mixed $raw, int $limit): array
{
    if (!is_string($raw)) json_err('权限列表格式错误');
    $ids = json_decode($raw, true);
    if (!is_array($ids) || !array_is_list($ids) || count($ids) > $limit) json_err('权限列表数量或格式错误');
    foreach ($ids as $id) {
        if (!is_int($id) || $id <= 0) json_err('权限列表必须为正整数 ID');
    }
    return array_values(array_unique($ids));
}

function mini_owner(?array $user): bool
{
    $ids = mini_config()['owner_ids'];
    return is_array($ids) && count($ids) <= 2 && $user !== null
        && in_array((int)$user['id'], array_map('intval', $ids), true)
        && in_array($user['role'] ?? '', ['admin', 'editor'], true);
}

function mini_require_owner(): array
{
    $user = current_admin();
    if (!mini_owner($user)) json_err('仅限小窝的两位主人操作', 403);
    return $user;
}

function mini_partner(array $user): ?array
{
    foreach ((array)mini_config()['owner_ids'] as $id) {
        if ((int)$id === (int)$user['id']) continue;
        $peer = db()->fetch('SELECT id,nickname,username,role FROM users WHERE id=?', [(int)$id]);
        if (mini_owner($peer)) return $peer;
    }
    return null;
}

function mini_moment(array $row): array
{
    $images = json_decode((string)($row['images'] ?? '[]'), true);
    return [
        'id' => (int)$row['id'], 'content' => (string)$row['content'],
        'images' => is_array($images) ? array_values(array_filter($images, 'is_string')) : [],
        'nickname' => (string)$row['nickname'], 'avatar' => (string)($row['avatar'] ?? ''),
        'location' => (string)($row['location'] ?? ''), 'created_at' => (string)$row['created_at'],
        'status' => (int)$row['status'],
    ];
}

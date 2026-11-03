<?php
// Reserve attempts under row locks so parallel requests cannot bypass the limits.
function login_attempt(string $username, string $ip): array
{
    $account = mb_strtolower($username, 'UTF-8');
    $buckets = [
        hash('sha256', 'pair:' . $account . ':' . $ip) => 8,
        hash('sha256', 'account:' . $account) => 60,
        hash('sha256', 'ip:' . $ip) => 150,
    ];
    ksort($buckets);
    $now = time();
    $pair = hash('sha256', 'pair:' . $account . ':' . $ip);
    for ($try = 0; $try < 4; $try++) {
        try {
            return db()->transaction(function ($db) use ($buckets, $now, $pair) {
                $rows = [];
                foreach ($buckets as $key => $limit) {
                    $db->query('INSERT IGNORE INTO auth_rate_limits (bucket, attempts, expires_at) VALUES (?, 0, ?)', [$key, $now + 900]);
                    $row = $db->fetch('SELECT attempts, expires_at FROM auth_rate_limits WHERE bucket=? FOR UPDATE', [$key]);
                    if ((int)$row['expires_at'] <= $now) $row = ['attempts' => 0, 'expires_at' => $now + 900];
                    $rows[$key] = $row;
                }
                $retry = 0;
                foreach ($buckets as $key => $limit) {
                    if ((int)$rows[$key]['attempts'] >= $limit) $retry = max($retry, (int)$rows[$key]['expires_at'] - $now);
                }
                if ($retry) return ['allowed' => false, 'retry_after' => $retry];
                foreach ($rows as $key => $row) {
                    $db->query('UPDATE auth_rate_limits SET attempts=?, expires_at=? WHERE bucket=?', [(int)$row['attempts'] + 1, (int)$row['expires_at'], $key]);
                }
                return ['allowed' => true, 'require_captcha' => (int)$rows[$pair]['attempts'] >= 3];
            });
        } catch (PDOException $error) {
            if (!in_array((int)($error->errorInfo[1] ?? 0), [1205, 1213], true)) throw $error;
            if ($try === 3) return ['allowed' => false, 'retry_after' => 2];
            usleep(random_int(10000, 40000));
        }
    }
}

function login_attempt_succeeded(string $username, string $ip): void
{
    db()->query('DELETE FROM auth_rate_limits WHERE bucket=?', [hash('sha256', 'pair:' . mb_strtolower($username, 'UTF-8') . ':' . $ip)]);
    if (random_int(1, 100) === 1) db()->query('DELETE FROM auth_rate_limits WHERE expires_at < ? LIMIT 1000', [time()]);
}

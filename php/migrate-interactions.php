<?php
// Pipe this script into: docker compose exec -T php php
if (PHP_SAPI !== 'cli') exit(1);
require_once '/var/www/html/inc/site.php';
$columns = [
    'articles' => [
        'cover' => "VARCHAR(255) NOT NULL DEFAULT ''",
        'excerpt' => "VARCHAR(300) NOT NULL DEFAULT ''",
    ],
    'users' => [
        'content_permissions' => 'TEXT NULL DEFAULT NULL',
        'birthday' => 'DATE NULL DEFAULT NULL',
        'bio' => "VARCHAR(200) NOT NULL DEFAULT ''",
    ],
    'lovelist' => ['moment_id' => 'INT UNSIGNED NOT NULL DEFAULT 0'],
    'moments' => ['location' => "VARCHAR(64) NOT NULL DEFAULT '' AFTER avatar"],
    'moment_comments' => [
        'user_id' => 'INT UNSIGNED NOT NULL DEFAULT 0',
        'reply_id' => 'INT UNSIGNED NOT NULL DEFAULT 0',
        'img' => "VARCHAR(255) NOT NULL DEFAULT ''",
    ],
    'messages' => [
        'user_id' => 'INT UNSIGNED NOT NULL DEFAULT 0',
        'img' => "VARCHAR(255) NOT NULL DEFAULT ''",
        'gift_icon' => "VARCHAR(32) NOT NULL DEFAULT ''",
        'gift_name' => "VARCHAR(64) NOT NULL DEFAULT ''",
    ],
    'chat_messages' => [
        'user_id' => 'INT UNSIGNED NOT NULL DEFAULT 0',
        'avatar' => "VARCHAR(255) NOT NULL DEFAULT ''",
        'image' => "VARCHAR(255) NOT NULL DEFAULT ''",
        'reply_id' => 'INT UNSIGNED NOT NULL DEFAULT 0',
        'is_admin' => 'TINYINT NOT NULL DEFAULT 0',
    ],
];
foreach ($columns as $table => $fields) {
    $existing = array_column(db()->fetchAll("SHOW COLUMNS FROM `$table`"), 'Field');
    foreach ($fields as $name => $definition) {
        if (!in_array($name, $existing, true)) db()->query("ALTER TABLE `$table` ADD COLUMN `$name` $definition");
    }
}
db()->query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'");
echo "Interaction schema ready.\n";

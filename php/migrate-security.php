<?php
if (PHP_SAPI !== 'cli') exit(1);
require_once '/var/www/html/inc/site.php';
db()->query('CREATE TABLE IF NOT EXISTS auth_rate_limits (
    bucket CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    expires_at BIGINT UNSIGNED NOT NULL,
    INDEX expires_at (expires_at)
) ENGINE=InnoDB');
echo "Security schema ready.\n";

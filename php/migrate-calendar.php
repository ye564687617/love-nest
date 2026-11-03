<?php
if (PHP_SAPI !== 'cli') exit(1);
require_once '/var/www/html/inc/site.php';
$fields = array_column(db()->fetchAll('SHOW COLUMNS FROM countdowns'), 'Field');
if (!in_array('festival_key', $fields, true)) {
    db()->query("ALTER TABLE countdowns ADD COLUMN festival_key VARCHAR(32) NOT NULL DEFAULT ''");
}
if (!in_array('birthday_calendar', $fields, true)) {
    db()->query("ALTER TABLE countdowns ADD COLUMN birthday_calendar VARCHAR(8) NOT NULL DEFAULT 'solar'");
}
echo "Calendar schema ready.\n";

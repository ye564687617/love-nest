<?php
return ['db' => [
    'host' => 'mysql', 'port' => 3306, 'name' => 'lianai',
    'user' => getenv('MYSQL_USER'), 'pass' => getenv('MYSQL_PASSWORD'),
    'charset' => 'utf8mb4',
]];

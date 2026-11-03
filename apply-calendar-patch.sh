#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
umask 077
dc() { docker compose --project-name lianai-production --env-file .deploy.env -f compose.production.yml "$@"; }
[[ -f .deploy.env ]] || { echo '请在生产项目目录 /opt/lianai 执行'; exit 1; }
backup="backups/calendar-$(date +%Y%m%d-%H%M%S).sql"
mkdir -p backups
dc exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump --protocol=TCP -h127.0.0.1 -uroot --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF lianai' > "$backup"
test -s "$backup"
dc exec -T php php < php/migrate-calendar.php
find html -type d -exec chmod 755 {} +
chmod 644 html/index.php html/loveImg.php html/list.php html/message.php html/chat.php html/articles.php html/games.php html/admin/countdowns.php html/api/admin_api.php html/static/js/important-days.js html/static/js/index.js html/static/js/album-timeline.js html/static/css/moment-card.css html/static/css/album-timeline.css
echo "补丁迁移完成，数据库备份：$backup。请用无痕窗口检查相册和纪念日。"

#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
umask 077

fail() { printf '\n部署停止：%s\n' "$*" >&2; exit 1; }
command -v docker >/dev/null || fail '请先在宝塔 Docker 管理中安装 Docker，再重新执行。'
docker compose version >/dev/null || fail '需要 Docker Compose v2 插件。'
docker info >/dev/null 2>&1 || fail 'Docker 未启动，或当前账号没有 Docker 权限。'
command -v flock >/dev/null || fail '需要 Linux flock 命令（util-linux）。'
exec 9>.deploy.lock
flock -n 9 || fail '另一个部署正在运行，请勿重复点击。'
sql="${1:-database.sql}"
[[ $# -le 1 ]] || fail '用法：bash deploy.sh [数据库SQL路径]'
[[ -f .deploy.env || ! -f .deploy.complete ]] || fail '已有部署标记但凭据丢失，请恢复 .deploy.env，不能生成新密码。'
if [[ ! -f .deploy.env ]]; then
    [[ -s "$sql" ]] || fail '首次部署缺少 database.sql，请上传完整部署包。'
    command -v openssl >/dev/null || fail '需要 openssl 生成数据库随机密码。'
    root_secret=$(openssl rand -hex 32)
    app_secret=$(openssl rand -hex 32)
    printf 'MYSQL_ROOT_PASSWORD=%s\nMYSQL_USER=lianai\nMYSQL_PASSWORD=%s\nTRUSTED_PROXIES=\n' "$root_secret" "$app_secret" > .deploy.env
    unset root_secret app_secret
fi
chmod 600 .deploy.env
dc() { docker compose --project-name lianai-production --env-file .deploy.env -f compose.production.yml "$@"; }
dc config --quiet
trap 'printf "\n部署中断。数据库卷没有删除。请检查上述错误；已有站点若已停止，不要删卷重装。\n" >&2' ERR

echo '[1/6] 构建 PHP，启动数据库（首次需要下载镜像）'
dc build php
dc up -d mysql
wait_for_mysql() {
    # The image starts a temporary socket-only server during first initialization.
    # Only the final server accepts TCP; socket readiness can race its shutdown.
    local i
    for ((i=0; i<90; i++)); do
        if dc exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h127.0.0.1 -uroot -Nse "SELECT 1"' >/dev/null 2>&1; then return 0; fi
        sleep 2
    done
    return 1
}
wait_for_mysql || fail '数据库未就绪。运行 docker compose --project-name lianai-production --env-file .deploy.env -f compose.production.yml logs --tail=80 mysql 排查。'

table_count=$(dc exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h127.0.0.1 -uroot -Nse "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\"lianai\""')
table_count=$(printf '%s' "$table_count" | tr -d '[:space:]')
[[ "$table_count" =~ ^[0-9]+$ ]] || fail '无法读取数据库状态。'
if [[ -f .deploy.complete && "$table_count" == 0 ]]; then
    fail '已有部署的数据库突然为空，请检查卷/项目路径，不会自动覆盖恢复。'
fi
if [[ ! -f .deploy.complete && "$table_count" != 0 ]]; then
    fail '检测到未确认的已有数据库：为防覆盖已停止。若上次首次安装中断，请保留数据并排查，不要删卷。'
fi

echo '[2/6] 首次导入，或备份已有数据'
if [[ -f .deploy.complete ]]; then
    backup="backups/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup"
    dc stop nginx php
    dc exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump --protocol=TCP -h127.0.0.1 -uroot --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF lianai' > "$backup/database.sql"
    tar -czf "$backup/uploads.tar.gz" html/uploads
    cp .deploy.env "$backup/deploy.env"
    echo "更新前数据备份：$backup（旧版代码需在上传更新文件前另行备份）"
else
    [[ -s "$sql" ]] || fail '缺少 SQL 文件。'
    dc exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=TCP -h127.0.0.1 -uroot --default-character-set=utf8mb4 lianai' < "$sql"
    # An imported database is never imported again, even if a later migration fails.
    printf 'imported=%s\n' "$(date -u +%FT%TZ)" > .deploy.complete
fi

echo '[3/6] 配置宿主机可信代理'
gateway=$(docker inspect "$(dc ps -q mysql)" --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}')
[[ "$gateway" =~ ^[0-9a-fA-F:.]+$ ]] || fail '无法识别 Docker 网络网关。'
if ! grep -q '^TRUSTED_PROXIES=.' .deploy.env; then
    sed "s/^TRUSTED_PROXIES=$/TRUSTED_PROXIES=$gateway/" .deploy.env > .deploy.env.tmp
    mv .deploy.env.tmp .deploy.env
fi

echo '[4/6] 配置权限并启动 PHP'
dc run --rm --no-deps --user root php sh -c 'find /var/www/html -type d -exec chmod 755 {} + && find /var/www/html -type f -name "*.php" ! -path "/var/www/html/inc/config*" -exec chmod 644 {} + && chown -R www-data:www-data /var/www/html/uploads && find /var/www/html/uploads -type f -exec chmod 644 {} +'
# nginx must be able to read static files copied from a restrictive Mac archive.
dc run --rm --no-deps --user root php sh -c 'find /var/www/html/static -type f -exec chmod 644 {} +'
dc up -d php

echo '[5/6] 自动执行数据库迁移'
dc exec -T php php < php/migrate-interactions.php
dc exec -T php php < php/migrate-security.php
dc exec -T php php < php/migrate-calendar.php

echo '[6/6] 启动网页并检查 HTTP'
dc up -d nginx
dc exec -T nginx nginx -t
dc exec -T nginx wget -q -O /dev/null http://127.0.0.1/
dc ps
printf '\n部署完成。宝塔反代目标：http://127.0.0.1:8090\n'
printf '公网需另配域名/HTTPS和反代头，详见 ONE-CLICK.md。8090 默认不向公网开放。\n'
printf '请立即在后台修改开发管理员密码。已有文章、图片和账号来自导入的数据库。\n'

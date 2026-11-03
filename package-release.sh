#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
umask 077
out="${HOME}/lianai-oneclick-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$out"
stopped=0
resume() { if [[ $stopped == 1 ]]; then docker compose up -d php nginx; fi; }
trap resume EXIT
echo '短暂停止本地网站，导出数据库和图片的一致快照。'
stopped=1
docker compose stop nginx php
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 lianai' > "$out/database.sql"
test -s "$out/database.sql"
COPYFILE_DISABLE=1 tar --exclude='html/inc/config.php' --exclude='html/inc/config.local.php' --exclude='html/inc/config.docker.php' -czf "$out/app.tar.gz" \
  compose.production.yml deploy.sh php html nginx ONE-CLICK.md DEPLOYMENT.md README.md
mkdir "$out/stage"
tar -xzf "$out/app.tar.gz" -C "$out/stage"
cp "$out/database.sql" "$out/stage/database.sql"
COPYFILE_DISABLE=1 tar -czf "$out/lianai-oneclick.tar.gz" -C "$out/stage" .
docker compose up -d php nginx
stopped=0
printf '\n一键部署包已生成：%s/lianai-oneclick.tar.gz\n' "$out"
printf '只需上传这个文件，解压后运行 bash deploy.sh。包内含用户数据，请勿公开分享。\n'

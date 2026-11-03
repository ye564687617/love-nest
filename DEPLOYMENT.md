# 恋爱小窝上线部署教程

更新日期：2026-10-31。适用于当前项目，而不是原站 PHP 源码的通用安装方式。

推荐方案：**Linux 服务器 + Docker Compose + 宿主机 Nginx/宝塔反向代理 + HTTPS**。
本教程不会自动上传、修改服务器或开放公网；实际执行前请替换示例域名、IP、路径和密码。

## 1. 先看这几个关键点

- 当前网站由 `nginx`、`php`、`mysql` 三个容器组成，默认访问端口为 8090。
- **当前 `initdb/` 是空目录。两份 migration 只补字段/安全表，不会创建完整网站。新服务器必须导入当前数据库。**
- 网站内容包括数据库和 `html/uploads/`，两者缺一不可。只传代码会丢相册、文章或图片。
- 根目录旧的 `bundle.tar.gz` 不代表本轮修改后的版本，不要拿它直接上线。
- `.db.env` 和 `html/inc/config.php` 是两个独立的数据库配置，必须对应；PHP 实际读取后者，不会自动读取 `.db.env`。
- 不要执行 `docker compose down -v`，也不要删除 `mysql_data` 卷。普通重启/更新不需要删除数据库。
- 本文按单机直连反代编写。第一次上线先不要加 CDN、第二层反代或多副本 PHP。

部署链路：

```text
浏览器 -- HTTPS:443 --> 服务器 Nginx/宝塔
                       -- HTTP:127.0.0.1:8090 --> Docker nginx --> PHP --> MySQL
```

## 2. 服务器准备

准备域名、服务器 SSH 权限以及可用 HTTPS 证书。资源可先按 2 核 2GB 起步，这是小站起步建议，不是容量保证。
示例系统为 Ubuntu 24.04 LTS；其他发行版请使用对应的 Docker 安装方式。

已安装 Docker 的服务器先检查，不要重复安装或卸载现有环境：

```sh
docker version
docker compose version
```

未安装时，按 Docker 官方安装教程安装 Engine 和 Compose 插件：
https://docs.docker.com/engine/install/ubuntu/

后续服务器命令在具备 Docker 权限的 SSH 终端执行。不要为了省事给整个项目 `chmod -R 777`。

安全组放行网站 80/443；SSH 和宝塔面板端口限制到管理员来源 IP。**不开放 3306、9000、8090 给公网。**
域名 A 记录指向服务器；没有配置 IPv6 时，不要留下指向其他地址的 AAAA 记录。
如果服务器所在地区要求备案，先按主机商要求完成。证书申请和续签也要配置好。

## 3. 从本地导出完整版本

以下在你的 Mac 终端执行。导出会短暂停止本地网页和 PHP，使数据库与上传目录保持同一备份窗口；MySQL 保持启动。
这不是服务器操作，也不会删除本地数据。

```sh
cd /Users/shurong/lianai-deploy-v2
umask 077
EXPORT="$HOME/lianai-release-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EXPORT"
docker compose stop nginx php
```

导出数据库；**必须看到命令成功退出后再继续**：

```sh
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 lianai' > "$EXPORT/database.sql"
```

打包当前实际代码、配置和全部上传文件：

```sh
COPYFILE_DISABLE=1 tar -czf "$EXPORT/project.tar.gz" \
  docker-compose.yml .db.env html php nginx initdb DEPLOYMENT.md
docker compose up -d php nginx
ls -lh "$EXPORT"
test -s "$EXPORT/database.sql"
tar -tzf "$EXPORT/project.tar.gz" | head -n 15
```

若导出失败，先用 `docker compose up -d php nginx` 恢复本地，再排错；不要上传空 SQL。
打包文件包含数据库凭据和用户内容，按敏感备份保管，不能放到网站根目录、公开网盘或公开仓库。
测试脚本不是运行必需文件，因此此包没有包含 `tests/`。

## 4. 上传到服务器

先在服务器创建**非网站公开目录**，这里使用 `/opt/lianai` 和 `/opt/lianai-import`：

```sh
sudo mkdir -p /opt/lianai /opt/lianai-import
sudo chmod 700 /opt/lianai-import
```

在 Mac 上传两个文件。把示例账号和 IP 换成真实 SSH 账号/IP；该账号需要目标目录写权限：

```sh
scp "$EXPORT/project.tar.gz" "$EXPORT/database.sql" root@YOUR_SERVER_IP:/opt/lianai-import/
```

以下步骤都在服务器执行：

```sh
cd /opt/lianai
tar -xzf /opt/lianai-import/project.tar.gz
chmod 600 .db.env
```

**首次部署才解压这份包含配置/上传的完整包。已有线上内容时，不要照此覆盖，转到第 11 节。**

## 5. 首次部署：设置数据库密码和端口

### 数据库配置

编辑 `/opt/lianai/.db.env`，设置新生产密码，不沿用开发密码。建议使用随机字母数字，方便安全填写配置：

```dotenv
MYSQL_ROOT_PASSWORD=替换为新的数据库root强密码
MYSQL_USER=lianai
MYSQL_PASSWORD=替换为新的网站数据库强密码
```

编辑 `/opt/lianai/html/inc/config.php`，结构如下。`pass` 必须等于上面的 `MYSQL_PASSWORD`：

```php
<?php
return [
    'db' => [
        'host' => 'mysql',
        'port' => 3306,
        'name' => 'lianai',
        'user' => 'lianai',
        'pass' => '替换为新的站点数据库强密码',
        'charset' => 'utf8mb4',
    ],
];
```

这里的 `mysql` 是容器服务名，**不要改成 localhost**。
其他 `config.local.php`、`config.docker.php` 文件不是当前入口，改它们不能代替修改 `config.php`。
MySQL 的初始化环境变量只在空数据卷首次初始化时生效。已有数据卷改 `.db.env` 不会自动改数据库账号密码；已有部署应沿用原配置，密码轮换需另行同步执行。

### 限制 8090 只供本机反代

编辑服务器上的 `/opt/lianai/docker-compose.yml`，将 nginx 的端口：

```yaml
    ports:
      - "8090:80"
```

替换为：

```yaml
    ports:
      - "127.0.0.1:8090:80"
```

是**替换原行**，不是再加一行。宿主机反代使用这个端口；外部用户使用域名 443。
不要仅依赖 UFW 阻止 Docker 已发布端口；Docker 的端口发布有独立的网络规则。
官方说明：https://docs.docker.com/engine/network/port-publishing/

## 6. 启动数据库、导入内容、执行迁移

保持域名反代尚未开放，先只启动 MySQL：

```sh
cd /opt/lianai
docker compose up -d mysql
docker compose ps
docker compose logs --tail=60 mysql
```

等 MySQL 显示 `healthy` 再继续。首次初始化可能需要一些时间，不要在初始化途中反复删卷重装。

**以下导入只用于首次部署到空站点数据库**。它不是合并工具，不要对已有线上内容的库重复执行：

```sh
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --default-character-set=utf8mb4 lianai' < /opt/lianai-import/database.sql
docker compose up -d --build php
docker compose exec -T php php < php/migrate-interactions.php
docker compose exec -T php php < php/migrate-security.php
```

两份迁移应分别输出 `Interaction schema ready.` 和 `Security schema ready.`。
任意一步失败都先停下来修复，**不要在缺表状态直接开放网站**。

修复 Linux 网站读取/上传权限，并限制数据库配置访问。Mac 打包后可能保留 `750` 目录权限，导致服务器 nginx/PHP 无法遍历，不能只修 uploads：

```sh
docker compose exec -T --user root php sh -c 'find /var/www/html -type d -exec chmod 755 {} + && find /var/www/html -type f -exec chmod 644 {} +'
docker compose exec -T --user root php sh -c 'chown -R www-data:www-data /var/www/html/uploads && find /var/www/html/uploads -type d -exec chmod 755 {} + && find /var/www/html/uploads -type f -exec chmod 644 {} +'
docker compose exec -T --user root php sh -c 'chown root:www-data /var/www/html/inc/config*.php && chmod 640 /var/www/html/inc/config*.php'
docker compose up -d nginx
curl -I http://127.0.0.1:8090/
```

MySQL 只在 Docker 内网可用，无需在宝塔另外创建一个同名 MySQL 数据库。
宝塔 PHP 版本也不参与运行本项目，PHP 已经在容器里。

## 7. 配置 HTTPS 反向代理

### 宝塔用户

创建绑定自己域名的 Nginx 站点，PHP 选纯静态/不启用宿主机 PHP；申请证书并开启 HTTPS。
为站点配置反代，目标为 `http://127.0.0.1:8090`。
保留宝塔的证书续签验证路径；不要把验证路径误改成网站业务接口。

修改站点实际生效的反代 `location /`，核心内容如下。若宝塔已生成该块，编辑原块，不能重复添加：

```nginx
location / {
    proxy_pass http://127.0.0.1:8090;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 10s;
    proxy_read_timeout 60s;
}
```

在该 HTTPS 站点的 `server` 内配置：

```nginx
client_max_body_size 20m;
location ^~ /inc/ { return 404; }
location ~ /\. { return 404; }
```

隐藏路径规则如与已有 ACME 规则冲突，以保留 `/.well-known/acme-challenge/` 证书验证为准。
对外只允许预期域名；其他默认站点不要反代到本项目。
登录、后台、接口和带用户身份的 HTML 不启用整页缓存；不要配置全站强制缓存或缓存验证码。
静态资源可以缓存，图片/js/css 更新使用现有版本号刷新。

### 不使用宝塔

在宿主机 Nginx 配置相同 HTTPS 站点、证书路径和上面的反代规则。
80 端口保留证书验证路径，其余跳转 HTTPS。验证后再 reload：

```sh
sudo nginx -t
sudo systemctl reload nginx
```

宝塔使用其自带 Nginx 的配置检测/重载功能，不要启动第二个 Nginx 抢占 80/443。
证书申请方式随 DNS/面板而异，本教程不预设不存在的证书文件路径。
Nginx 官方反代说明：https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header

## 8. 配置可信代理：影响真实 IP、定位和登录

本项目默认忽略客户端随意发送的 `X-Forwarded-For`，这是安全措施。
必须只信任真正向 Docker nginx 转发请求的宿主机代理地址，否则所有访客可能共用一个 IP，城市为空，登录限流也会互相影响。

先查看 nginx 所在 Docker 网络的网关；普通 Linux bridge + 宿主机回环反代下，它通常就是 Docker 看到的代理来源：

```sh
cd /opt/lianai
docker inspect "$(docker compose ps -q nginx)" --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}'
```

例如输出 `172.20.0.1`，编辑项目根目录 `.env`，写入：

```dotenv
TRUSTED_PROXIES=172.20.0.1
```

**地址只是示例，以服务器实际值和后面的验证为准。不要信任整个公网，不要填写 `0.0.0.0/0`。**
如果原来就有 `.env`，只修改对应变量，保留其他配置。Docker 网络重建后网关可能变化，需要重新核对。
应用变量要重建 PHP 容器，不只是 restart：

```sh
chmod 600 .env
docker compose up -d php
```

从你自己的电脑通过 HTTPS 域名打开：

```text
https://你的域名/api/user_api.php?action=info
```

其中 `visitor_id` 应当是你当前访问网络的公网 IP，而不是 Docker 的 `172.x` 或 `127.0.0.1`。
再用手机蜂窝网络访问同一路径，两者应按实际出口显示不同 IP。不要把这个响应原样发到公开群里。
用浏览器开发者工具检查新的 `PHPSESSID`：应带 `Secure`、`HttpOnly`、`SameSite=Lax`。
检查前先清除该域名旧 Cookie 或使用无痕窗口，避免旧 Cookie 影响判断。

若 IP 仍不对或缺少 Secure，暂不开放，先核对代理来源与转发头。不要通过“信任所有 IP”解决。
如果使用 CDN/多层代理，需额外配置 CDN 可信地址和源站访问限制；不要直接套用本节的单层链路。

## 9. 开放前验收清单

- [ ] 首页、相册、文章、留言、聊天均能打开，没有数据库报错或图片 404。
- [ ] 后台 `/admin/` 可登录；**立刻将导入数据库中的管理员密码改为自己的强密码**。
- [ ] 普通用户不能直接打开相册/文章管理页；编辑者只能管理管理员分配的模块。
- [ ] 相册上传、主图切换、文章本地插图、瞬间发布正常；刷新页面后仍存在。
- [ ] 留言登录提示正确，城市可手动改；留言超过 20 条时能加载更多。
- [ ] 手机 Wi-Fi 和蜂窝网都能访问；后台表单、图片选择和输入法弹起后能操作。
- [ ] HTTPS 有效，HTTP 跳转 HTTPS；新会话 Cookie 三个安全属性齐全。
- [ ] 访客 IP 正确；城市识别失败时不会卡住整个页面，可手动填写。
- [ ] 公网不能直接访问服务器的 8090、3306、9000；后台/API 不被 CDN 缓存。
- [ ] 音乐不开播不会阻塞页面，播放地址可由生产服务器/访客网络正常访问。
- [ ] 已有可恢复的数据库和上传目录备份，证书自动续期正常。

城市识别使用第三方 IP 查询服务，存在超时、误差或网络不可达的可能，不等于手机 GPS 定位；IP 查询涉及向服务商发送访问 IP，应在站点隐私说明中披露。
本地通过的回归不能代替线上真实手机、Safari、HTTPS 和服务器网络验证。

## 10. 上线后的备份

备份至少包括：数据库、`html/uploads/`、当前代码和生产配置。目录放在网站根目录之外，并定期复制到另一台机器。
下面是短维护窗口下的一致性备份示例；执行前确认可接受暂停访问：

```sh
cd /opt/lianai
umask 077
BACKUP="/opt/lianai-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
docker compose stop nginx php
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 lianai' > "$BACKUP/database.sql"
```

确认导出成功，再打包；任一步失败都先恢复 `docker compose up -d php nginx`，排错后重新备份：

```sh
tar -czf "$BACKUP/project.tar.gz" docker-compose.yml .db.env .env html php nginx initdb DEPLOYMENT.md
docker compose up -d php nginx
test -s "$BACKUP/database.sql"
ls -lh "$BACKUP"
```

该命令假设已按第 8 节创建 `.env`。备份任务必须监控失败，不能把生成一个文件当成备份成功。
至少做一次在隔离环境恢复数据库和图片的演练。不要在生产上为了测试恢复覆盖当前库。

## 11. 以后更新已有线上站点

1. 按第 10 节备份；检查备份成功后进入维护窗口，停止 nginx/PHP，保留 MySQL。
2. 上传本次代码到单独暂存目录。**不导入本地 database.sql，不覆盖线上 `.db.env`、`.env`、`html/inc/config.php`、`html/uploads/`，也不重置 mysql_data。**
3. 对照版本变更更新代码；保留服务器 `127.0.0.1:8090` 绑定和站点反代配置。不要用完整本地包直接覆盖整个线上目录。
   更新后的代码文件同样需要 PHP/nginx 可读，目录可遍历；数据库配置仍保持受限权限，上传目录仍由 www-data 可写。
4. 若 PHP Dockerfile/扩展变化，执行 build；随后启动 PHP、执行两份幂等迁移，再启动 nginx：

```sh
cd /opt/lianai
docker compose up -d --build php
docker compose exec -T php php < php/migrate-interactions.php
docker compose exec -T php php < php/migrate-security.php
docker compose up -d nginx
docker compose ps
```

5. 检查登录、权限、上传、前端页面和服务器日志后再结束维护。

“代码打包时间较新”不等于数据库可以覆盖线上。线上新增的文章、留言、照片都以线上数据库/上传文件为准。

## 12. 出问题如何回滚

先停止入口，保留错误日志，不删卷、不反复初始化数据库。

- **仅代码有问题**：恢复更新前代码，保留当前线上配置和上传目录。确认代码兼容当前数据库；本轮 migration 是加字段/加表，不必仅为了回滚代码就删除新字段。
- **数据被误改**：先为当前故障状态另做备份，再决定恢复哪个时间点。恢复数据库会丢失该备份之后的新留言/文章/用户，必须确认可接受。
- **需要整站恢复**：在新的隔离目录/数据卷中按第 4～8 节恢复代码、数据库、图片，验收后再切换反代；优先避免在原数据卷上盲目覆盖。

不要执行 `down -v`、`docker volume prune` 或 `docker system prune --volumes` 作为常规排错。
恢复期间不要同时开放新旧两个可写站点，避免数据分叉。

## 13. 常见故障排查

在 `/opt/lianai` 下执行：

```sh
docker compose ps
docker compose logs --tail=100 php nginx mysql
docker compose exec -T nginx nginx -t
curl -I http://127.0.0.1:8090/
```

| 现象 | 优先检查 |
| --- | --- |
| 502 | PHP 容器是否运行、镜像是否构建成功；宿主机反代目标是否为 127.0.0.1:8090 |
| 数据库连接失败 | config.php 与 .db.env 是否对应；host 是否 mysql；MySQL 是否 healthy；已有卷的密码是否被误改 |
| 缺表/登录 500 | 是否导入完整 SQL；是否执行两份迁移；看 PHP 日志，不要删库重装 |
| 图片打不开/上传保存失败 | 是否上传 html/uploads；Linux 权限是否允许容器 www-data 写入；浏览器具体图片请求是否 404 |
| 上传 413 | 宿主机和容器 nginx 请求上限；PHP 当前单文件 5MB、请求 8MB，改 nginx 不会自动改 PHP |
| 所有人 IP 相同/城市空 | 可信代理是否为实际直接来源；边缘代理是否覆盖转发头；是否误套多层代理配置 |
| HTTPS 登录循环/CSRF 失败 | 是否缓存后台/API；Cookie 是否残留；Secure/协议头与域名是否正确 |
| 登录 429 | 15 分钟窗口内重试过多，停止重复提交；多人共用 IP 时先修代理配置，不要删除全站限流数据 |
| 修改后仍是旧页面 | 静态资源版本、浏览器/CDN 缓存；确认上传的是本次版本，不是旧 bundle.tar.gz |
| 偶发慢 | 分别看 HTML/API、图片、音乐/封面和外部服务请求耗时；城市/音乐外网不可达不应被当成数据库问题 |

日志可能包含用户数据和 IP，排错分享前先脱敏。不要公开 `.db.env`、config.php、SQL 备份或 Cookie。

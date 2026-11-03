# Docker 一键部署

## 第一次上线：只传一个包

本地生成包含数据库、图片、代码和部署脚本的完整包：

```sh
cd /Users/shurong/lianai-deploy-v2
bash package-release.sh
```

终端会显示 `lianai-oneclick.tar.gz` 的完整路径。本地网站会短暂停止，完成后自动恢复。
不要再使用旧的 project.tar.gz；新包不用另传 SQL，也不包含本地数据库配置密码，但 SQL 本身含用户数据，仍然需要保密。

用宝塔「文件」上传到 `/opt/lianai`，在该目录解压。无需使用 scp，也无需解决 SSH 私钥问题。
在宝塔终端执行：

```sh
cd /opt/lianai
bash deploy.sh
```

需要 Linux、Docker Engine、Compose v2、openssl 和 flock。宝塔 Docker 未安装时先通过面板安装。
脚本自动生成生产数据库随机密码、创建独立数据卷、等待 MySQL、导入 SQL、修复图片权限、执行两份迁移并启动网站。
第一次下载镜像/安装 PHP 扩展需要联网，服务器网络慢时构建也会慢。

2026-10-31 启动修复：等待 MySQL 使用 TCP 和实际 SQL 查询，避免首次初始化的临时 socket 服务误判为就绪。
若旧版停在 ERROR 2002 且尚未导入 SQL，只更新 deploy.sh 和 compose.production.yml 后重跑即可；保留 .deploy.env 和数据卷。

## 最后一步：宝塔绑定域名

创建域名站点、申请 SSL，设置反向代理目标 `http://127.0.0.1:8090`。
反代 location 中必须有以下请求头（编辑已有 location，不重复添加）：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
```

站点请求大小设置 `client_max_body_size 20m;`，禁止缓存后台/API/验证码。
只开放公网 80/443，8090 默认绑定回环，不公开暴露。SSL 和 DNS 需要你的域名控制权，脚本不能凭空替你完成。
本脚本只面向单机、宿主机 Nginx/宝塔直接反代；CDN、多层反代需按 DEPLOYMENT.md 单独配置。
上线后验证访客 IP、HTTPS Cookie，并立刻修改已公开的开发管理员密码。

## 数据保护与重复执行

- 使用独立 Compose 项目 `lianai-production`，不修改本地 docker-compose.yml，也不复用开发数据库卷。
- 重复执行不会再次导入 SQL。已有库但缺少导入完成标记时会拒绝操作，防止误覆盖。
- 已安装时，脚本会先停止入口并备份数据库、图片和凭据到 `backups/`，再迁移启动；已有文章/照片不会被清空。
- **此脚本不是代码上传器。更新代码前仍需保留上一版代码；不要重新解压完整首次包覆盖线上 uploads 或 database.sql。**
- 保留 `.deploy.env`、`.deploy.complete`、上传目录及 Docker 数据卷；不能删除 `.deploy.env` 后当成新安装。
- 首次 SQL 导入中途失败会保留现场并在下次拒绝重复导入，需要排查，绝不自动删库重装。
- 后续步骤失败后修好原因可重跑；错误退出期间入口可能仍停止，需要检查。
- 备份和 SQL 不能放到 html 内。不要执行 down -v 或清理生产卷。

管理命令与原开发环境不同，需要带生产 Compose 文件：

```sh
docker compose --project-name lianai-production --env-file .deploy.env -f compose.production.yml ps
docker compose --project-name lianai-production --env-file .deploy.env -f compose.production.yml logs --tail=100 php nginx mysql
```

域名、HTTPS、验收及故障排查的详细版见 DEPLOYMENT.md。详细版默认使用开发 Compose 部署；选择本一键方案后，请使用本节生产管理命令，不要混用两套命令。

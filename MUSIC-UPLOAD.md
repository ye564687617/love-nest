# 音乐上传更新（2026-11-03）

网站后台「音乐歌单 → 添加歌曲 / 编辑」现在支持上传 MP3，单首最大 15MB。
上传完成可试听，确认后点击「添加 / 保存」加入歌单。网站和小程序读取同一首歌，无需另填小程序地址。
上传后保存的是 `/uploads/music/日期/随机名.mp3`，线上通过当前 HTTPS 域名播放。
文件需要由你准备并具有相应使用权限，本功能不抓取第三方平台歌曲。

## 宝塔 Docker 更新

本次更新包：`output/release/lianai-music-upload-update-20261103.tar.gz`。
包内只有以下三个运行文件及本文，不含数据库、数据库配置、已有图片和音频：

```text
html/admin/playlist.php
html/api/upload_audio.php
php/uploads.ini
MUSIC-UPLOAD.md
```

1. 先备份服务器这三个文件，备份放在网站公开目录以外。
2. 将更新包上传到 Docker 项目目录（之前使用 `/opt/lianai`），在这里解压并覆盖同名文件。不要解压到 `html` 内。
3. 宝塔域名站点的 Nginx 设置应允许至少 20MB 请求，即已有 `server` 中的 `client_max_body_size 20m;`。原项目容器内 Nginx 已设置 20m，不需要重复修改。
4. 在宝塔终端执行：

```sh
cd /opt/lianai
sudo docker compose --project-name lianai-production --env-file .deploy.env -f compose.production.yml restart php
```

此命令适用于之前的一键生产部署。若改用宝塔 Docker 容器列表，则重启对应 PHP 容器。
`php/uploads.ini` 必须仍挂载到容器的 `/usr/local/etc/php/conf.d/uploads.ini`（原生产 Compose 已配置）。
本次将 PHP 的单文件限制提高到 15M、请求总量提高到 20M；原图片接口仍限制单张 5MB。
无需重建镜像、导入数据库或删除 Docker 数据卷。

## 使用与验收

1. 登录网站后台「音乐歌单」，编辑现有 HTTP 歌曲，或点击「添加歌曲」。
2. 选择 MP3，等待显示「上传完成」，填写歌名、歌手和封面，试听后保存。
3. 访问网站前台和小程序歌单，检查播放与拖动进度。
4. 如上传提示 HTTP 413，检查宝塔外层反代的上传大小限制并重载该站点配置；如提示 PHP 文件过大，确认配置挂载和 PHP 重启。
5. 正式小程序仍需要微信平台允许音频域名及真机验证。本功能不会自动改写现有 HTTP 外链，旧歌曲需逐首上传替换或从歌单删除。

有歌单模块管理权限的账号才能上传，接口检查 CSRF、实际文件类型和体积。
服务端生成随机 `.mp3` 文件名，不使用用户提供的文件名作为路径。
删除歌单记录、取消表单或替换音频不会自动删除原文件，避免影响引用同一音频的歌曲；定期备份整个 `html/uploads`。

## 本地验证

```sh
node tests/audio_upload.cjs
python3 tests/smoke_audio.py
```

Python 集成测试仅用于本地 Docker，并依赖本机 ffmpeg 生成测试音频。临时账号、歌单和文件会在结束后清理。
已验证权限、CSRF、伪造类型、体积限制、超过旧 5MB 上限的上传、音频 MIME、HTTP Range 206、
网站与小程序歌单读取、上传进度与失败恢复、关闭弹窗后的迟到响应。
浏览器已验证上传和试听，并检查桌面及手机宽度布局；尚未部署或验证 VPS/微信真机。

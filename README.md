# 恋爱小窝 · Love Nest

一个可以自己部署的情侣记录空间，包含网页版、管理后台和原生微信小程序。记录相伴的时间、照片、生日、心愿和日常，让两个人的回忆有一个共同的家。

网站和小程序共用 PHP 接口与 MySQL 数据库，内容一次维护，两端同步。

## 功能

| 模块 | 内容 |
| --- | --- |
| 恋爱首页 | 双人头像、恋爱计时、照片与重要日子 |
| 甜蜜瞬间 | 文字、照片、地点、时间线和公开状态管理 |
| 纪念日 | 生日、周年纪念、节日和固定日期倒计时 |
| 农历生日 | 公历 / 农历选择，每年自动换算公历日期与周岁 |
| 恋爱清单 | 记录想一起完成的事情，支持完成与撤销 |
| 音乐歌单 | 歌曲管理、站内 MP3 上传与播放 |
| 两人私信 | 小程序两位主人之间的私信，与网站同账号会话互通 |
| 情侣小游戏 | 双人骰子、约会转盘、默契问答 |
| 网站内容 | 文章、留言及对应的后台管理 |
| 管理后台 | 内容维护、账号角色、模块权限和小程序公开范围配置 |

### 农历生日

生日可以按公历或农历记录，不需要每年手动修改日期。

例如，生日选择农历 `九月十四`，2026 年对应公历 `10 月 23 日`，2027 年对应 `10 月 13 日`。填写出生年份后，系统自动显示下一次生日和年龄。

- 闰月生日：当年有同名闰月时按闰月，没有时按普通月。
- 农历三十：当年对应月份只有廿九时，按廿九计算。
- 原有生日默认保留公历模式，需自行确认后切换。

### 两位主人与访客

小程序最多配置两位主人，访客可浏览公开内容，主人登录后管理内容。

- 主人须在网站后台明确选择，同时具备相应模块权限。
- 小程序纪念日默认不公开，管理员可逐条选择公开。
- 照片瞬间可设为未公开，清单目前为公开内容。
- 网站和小程序的纪念日展示规则各自生效，小程序白名单不会改变网站原有展示。
- 小程序使用网站账号、密码和图形验证码登录，尚未实现微信身份绑定。

## 技术栈

- 网页端：PHP、HTML、CSS、JavaScript。
- 小程序：原生 WXML、WXSS、JavaScript，无需 npm 构建。
- 服务端：PHP 8.3 FPM、MySQL 8.0、Nginx。
- 部署：Docker Compose，支持在 VPS 上配合宝塔反向代理使用。
- 农历换算：`lunar-javascript`，第三方许可证保留在对应目录。

## 项目结构

```text
.
├── html/                       # 网站前台、管理后台及 API
│   ├── admin/                  # 管理后台
│   ├── api/                    # 网站与小程序接口
│   ├── inc/                    # 公共逻辑及配置
│   ├── static/                 # 前端资源
│   └── uploads/                # 运行时上传内容，不提交
├── miniprogram/                # 原生微信小程序
├── php/                        # PHP 镜像、生产配置及数据库迁移
├── nginx/                      # 容器 Nginx 配置
├── initdb/                     # 本地首次初始化 SQL 目录
├── tests/                      # 自动化检查与本地集成测试
├── docker-compose.yml          # 本地开发环境
├── compose.production.yml      # 生产环境
├── deploy.sh                   # 生产部署脚本
└── package-release.sh          # 私有站点迁移打包脚本
```

## 部署前说明

**当前仓库不包含完整的首次安装 SQL，也不包含现有站点的账号、照片或数据库。**

`php/migrate-*.php` 是已有数据库的增量迁移，不能代替首次安装。仅克隆仓库并启动容器，无法得到完整可用的网站。部署前需要准备与本项目匹配的数据库结构；迁移自己的已有站点时，可使用自己的完整数据库备份。

首次安装 SQL 和演示数据整理完成前，请勿将此仓库视为可以直接空库安装的发行包。

## 本地运行

需要 Docker、Docker Compose v2。运行自动化检查另需 Node.js，PHP 集成测试另需 Python 3。

1. 克隆仓库并进入项目目录。
2. 复制本地配置示例：

   ```bash
   cp .db.env.example .db.env
   cp html/inc/config.example.php html/inc/config.php
   mkdir -p html/uploads initdb
   ```

3. 修改 `.db.env` 和 `html/inc/config.php`，使数据库名称、账号和密码一致，替换所有示例密码。
4. 首次创建本地数据库时，将自己准备的完整 SQL 放入 `initdb/`。该目录只在 MySQL 数据卷首次初始化时自动导入。
5. 启动服务：

   ```bash
   docker compose up -d --build
   ```

6. 数据库初始化完成后，执行增量迁移：

   ```bash
   docker compose exec -T php php < php/migrate-interactions.php
   docker compose exec -T php php < php/migrate-security.php
   docker compose exec -T php php < php/migrate-calendar.php
   ```

7. 打开 `http://localhost:8090`，管理后台位于 `/admin/`。

管理员使用自己数据库中的账号。本仓库不提供公共默认账号或密码。已有数据卷不会重复执行 `initdb/` 中的 SQL，不要通过删除数据卷的方式更新网站。

## VPS 与宝塔部署

网站、PHP 接口、数据库部署在 VPS 上；小程序客户端通过微信开发者工具上传和发布。

生产环境使用 `compose.production.yml`，Nginx 默认绑定 `127.0.0.1:8090`，由宝塔或宿主机 Nginx 配置域名、HTTPS 和反向代理。

- [Docker 部署与私有迁移打包](ONE-CLICK.md)
- [详细部署、备份及回滚说明](DEPLOYMENT.md)
- [农历生日升级与权限修复](LUNAR-BIRTHDAY.md)
- [站内音乐上传配置](MUSIC-UPLOAD.md)

`package-release.sh` 用于迁移自己的现有站点，生成的包包含数据库和上传内容，属于私有备份，不能放到公开 GitHub 仓库或 Releases。

## 微信小程序

1. 复制小程序配置示例：

   ```bash
   cp miniprogram/project.config.example.json miniprogram/project.config.json
   ```

2. 将本机 `miniprogram/project.config.json` 中的 `touristappid` 替换为自己的 AppID，再用微信开发者工具导入 `miniprogram/`。真实配置文件已被 Git 忽略，仓库仅提交示例。
3. 修改 `miniprogram/config.js`，配置自己的后端地址。仓库当前保留原部署地址，运行前务必替换，避免访问原站点的真实数据。
4. 公网预览和正式发布使用手机可达的 HTTPS 服务，配置实际请求、上传和下载所使用的合法域名。手机不能通过 `localhost` 访问电脑上的网站。
5. 在网站后台“站点设置 → 小程序权限”中选择两位主人和公开纪念日。
6. 编译并分别检查访客、主人权限，再进行手机预览和上传。

不要在代码中填写 AppSecret。现有网站账号登录流程不需要 AppSecret。

小程序当前实现和发布检查见 [MINIPROGRAM.md](MINIPROGRAM.md)，接入细节见 [miniprogram/README.md](miniprogram/README.md)。

## 检查与测试

无需启动服务的主要检查：

```bash
node tests/miniprogram.cjs
node tests/important_days.cjs
node tests/mini_pages.cjs
node tests/mini_phase2.cjs
node tests/mini_policy_ui.cjs
```

本地 Docker 和数据库准备完成后，可运行：

```bash
python3 tests/smoke_miniprogram.py
python3 tests/mini_owner_flow.py
```

主人流程测试会创建临时账号和内容，并在结束后恢复权限策略、清理测试记录。集成测试仅用于本地环境。

自动化测试和模拟器检查不能代替微信真机预览及平台审核。

## 数据与使用边界

- `.gitignore` 已排除实际数据库配置、环境变量文件、SQL、上传文件、备份、部署压缩包和本机调试产物。它不会移除已经提交过的文件。
- 小程序访客无需提供微信昵称、头像、手机号或定位；主人登录及主动提交的照片、生日、文字和私信仍涉及信息处理，发布时应按实际功能完善隐私声明。
- 未公开内容不等于文件加密，现有上传文件可能通过直接链接读取，不适合存储高度私密资料。
- 私信不是端到端加密。小游戏为同一部手机轮流操作，尚不支持跨设备实时对战。
- 播放音源需自行确认授权及可用性，小程序应使用最终地址为 HTTPS 的稳定音源。

## 许可与素材

仓库尚未附项目整体的 `LICENSE`，不默认声明为 MIT 或其他开源许可。公开分发或添加许可证前，请先确认原始源码及素材的授权。

第三方库遵循各自许可证。图片、音乐及其他素材不因代码公开而自动获得使用授权。

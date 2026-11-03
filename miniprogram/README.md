# 恋爱小窝小程序

原生微信小程序，无需 npm 构建。仓库仅提供配置示例，真实 AppID 保存在本机，不提交到 Git。

## 本地运行

1. 复制 `project.config.example.json` 为 `project.config.json`，将示例 `touristappid` 替换为自己的 AppID，再用微信开发者工具导入本目录 `miniprogram`。真实配置文件和开发者私有配置均已加入 `.gitignore`。
2. 当前开发预览、体验版和正式版均使用 `https://mm.vorory.com`，会读写线上实际数据。手机扫码预览也是开发版，不能使用 localhost。
3. 在微信公众平台配置该域名的合法域名。当前机器 `project.private.config.json` 中的 `urlCheck: false` 只是本地工具设置，不能代替平台域名配置。全部页面均保留 `index.json`，共享项目配置仍开启域名校验。
4. 仅需电脑模拟器隔离调试时，可自行将 `config.js` 的 `developmentBaseUrl` 临时改为本机 Docker 的 `http://localhost:8090`；手机预览前恢复公网地址。正式地址只填写站点 origin，不包含 `/api`。

## 两位主人配置

默认关闭所有小程序管理权限，不根据“第一个登录的人”自动授权。
推荐方式：使用管理员登录网站后台，打开“站点设置 → 小程序权限”，勾选最多两位主人及允许公开的纪念日，保存后立即生效。第二位若尚无账号，可先通过网站注册，再在“用户与权限”中设为内容编辑并授予所需模块。不要把访客账号误设为主人。

可选方式：尚未在后台保存过权限时，可在服务器创建 `html/inc/miniprogram.local.php`，填你们现有的网站账号 ID。后台保存的数据库配置优先于该文件：

```php
<?php
return [
    'owner_ids' => [/* 你们两个人的 users.id，最多两位 */],
    'public_countdown_ids' => [/* 允许访客浏览的 countdowns.id，默认全部不公开 */],
];
```

使用现有后台用户管理确认账号 ID。账号必须是 admin 或 editor，且具备对应模块权限。不要填第三方账号，不要分享密码。

登录复用网站账号、密码、图形验证码、服务端 Session 和 CSRF，不需要 AppSecret，也不冒用微信身份。Session 只保存在小程序运行内存，不写本地持久存储。后续可独立加微信身份绑定。

## 功能和公开边界

- 首页：名称、头像、恋爱起始时间、已公开瞬间和清单统计。
- 相册：与原站一致，只取 `moments.status=1`，不把后台 photos 素材池当公开相册。主人可查看未公开瞬间，发布、编辑、上传及删除。
- 清单：与网站一样公开。主人可添加、完成或撤销。当前没有私密清单功能。
- 纪念日：默认不公开，仅后台明确勾选或服务器列出的 ID 对访客可见。这个设置只限制小程序接口，不会改变原网站已有的展示行为。
- 农历节日：七夕、春节、元宵、端午、中秋按农历逐年自动计算，兼容原站旧记录。使用固定版本 lunar-javascript 1.7.7，MIT 许可保留于 vendor 目录，不依赖真机的 Intl 农历支持。
- 不向访客暴露私信、账号列表、配置全集、出生日期配置、IP 或管理接口数据。主人私信仅返回明确配置的两位账号之间的会话，另一位未配置或失去主人资格时禁止访问；不接入公开聊天室。
- 歌单：访客与主人均可听，沿用网站歌单；默认不自动播放，离开页面停止。原有 HTTP 外链及其 HTTP 跳转不保证真机可播，发布前需使用有授权且最终地址为 HTTPS 的稳定音源，并配置实际域名。
- 小游戏：访客可看入口，主人可玩双人骰子、约会转盘、默契问答。为同一部手机轮流操作，不进行联网对战或存储游戏记录。
- 未公开是内容可见性，不是文件加密。现有网站 uploads 路径允许凭链接读取，不适合存储高度私密照片。

新瞬间默认未公开，打开公开开关并确认后才会同时出现在网站和小程序。尚未开放访客评论、公开聊天、订阅消息、后台音乐及微信身份绑定。主人私信和网站同账号之间的私信互通，非端到端加密。

## 真机和发布

1. 将新增 PHP 文件、修改的 `html/api/admin_api.php`、`html/admin/config.php` 和 `html/admin/assets/miniprogram.js` 部署到现有站点，保留数据库、上传文件和本地权限配置，不需要数据库迁移。
2. 把 `config.js` 的 `productionBaseUrl` 改成实际 HTTPS 站点域名；开发版真机联调还需把 `developmentBaseUrl` 改成手机可达的实际站点。手机无法连接你电脑的 localhost。
3. 在微信小程序后台配置对应 request、uploadFile 和 downloadFile 合法域名。远程图片须可通过 HTTPS 访问。
4. 导入开发者工具编译，分别检查访客和两个主人账号，再用手机预览。
5. 上传之前确认公开内容、个人信息保护指引、服务类目与平台审核要求。未完成开发者工具和真机验证前不要直接提交审核。

## 检查

只读预检：`node tests/mini_preflight.cjs` 检查本地访客 API；配置正式域名后运行 `node tests/mini_preflight.cjs --release`，验证公网 HTTPS、访客权限及公开媒体协议并列出域名。可传入站点 origin 检查候选服务器，但不会代替修改正式配置。预检不创建账号或内容，也不证明平台已配置合法域名、音源最终跳转或真机可播。

运行 `node tests/miniprogram.cjs`、`node tests/mini_pages.cjs`、`node tests/mini_phase2.cjs`、`python3 tests/smoke_miniprogram.py`、`python3 tests/mini_owner_flow.py`（Python 测试要求本地 Docker 服务已运行）。主人流程测试只创建临时账号、私信及内容，结束后恢复原权限并清理测试记录。不要在生产环境运行集成测试。

本机微信 WXML/WXSS 编译器检查可验证模板和样式，不等于开发者工具完整运行或真机测试。如果 CLI 提示服务端口关闭，请在开发者工具“设置 → 安全设置”开启服务端口，再执行：

```sh
/Applications/wechatwebdevtools.app/Contents/MacOS/cli open --project /Users/shurong/lianai-deploy-v2/miniprogram
```

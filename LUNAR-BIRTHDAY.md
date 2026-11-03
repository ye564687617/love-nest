# 农历生日更新（2026-11-03）

网站后台与小程序现在均可选择“公历生日 / 农历生日”。农历生日按出生时的农历月日逐年换算，自动显示下一次公历日期、倒计时和周岁，不需要每年改记录。

## 怎么填写

在“纪念日 → 编辑 / 新增日子”中选择：

1. 类型：生日。
2. 生日历法：农历生日。
3. 农历出生年月日：例如 `2001` 年、`9` 月、`14` 日。
4. 只有出生在闰月时才打开“出生在闰月”，然后保存。

示例中的“农历 2001 年九月十四”对应出生公历 `2001-10-30`。2026 年生日是 `2026-10-23`，2027 年是 `2027-10-13`。以 2026-11-03 为当前日期，会显示下一次 `2027-10-13`，满 26 周岁。

**公历 2001-09-14 对应农历七月廿七，和农历九月十四不同。** 从旧记录切换至农历时，表单先换算原公历出生日期；如果原记录把农历日期当公历填了，需要手动把农历年月日改成真正的生日，例如上面的 `2001 / 9 / 14`。

旧记录默认仍按公历计算，本更新不会自动修改任何人的真实生日。网站后台和小程序编辑的是同一条记录；小程序访客仍只能看已明确公开的纪念日。

## 特殊日期

- 农历出生年输入范围为 1900–2100。
- 出生在闰月：有同名闰月的年份按闰月，没有时按普通月。
- 出生在农历三十：遇到对应月份只有廿九时，按廿九过生日。
- 不存在的闰月或出生日期会阻止保存。公历 2 月 29 日的旧规则保持不变。
- 数据库 `target_date` 始终保存真实公历出生日期，新增 `birthday_calendar` 区分历法，避免把农历二月三十写入公历 DATE 字段。

## VPS 更新

更新包：`output/release/lianai-lunar-birthday-update-20261103.tar.gz`。包里只含相关网站代码、农历库和迁移文件，不含密码、站点配置、数据库或上传图片。小程序源代码在本机 `miniprogram/`，不放在此 VPS 更新包中。

先在宝塔备份当前数据库及将被替换的文件。把更新包上传到 `/opt/lianai/`，然后依次执行：

```bash
cd /opt/lianai

# 先只解压数据库升级文件，旧网站可继续运行。
sudo tar -xzf lianai-lunar-birthday-update-20261103.tar.gz php/migrate-calendar.php

# 先增加字段，再更新读取该字段的网站接口。
sudo docker compose --project-name lianai-production --env-file .deploy.env -f compose.production.yml exec -T php php < php/migrate-calendar.php

# 看到 Calendar schema ready. 后继续。
sudo tar -xzf lianai-lunar-birthday-update-20261103.tar.gz
sudo chmod 755 html html/admin html/api html/static html/static/js html/static/vendor html/static/vendor/lunar-javascript
sudo chmod 644 html/admin/countdowns.php html/api/admin_api.php html/api/miniprogram_api.php html/index.php html/static/js/important-days.js html/static/js/index.js html/static/vendor/lunar-javascript/lunar.js html/static/vendor/lunar-javascript/birthday-calendar.js html/static/vendor/lunar-javascript/LICENSE
sudo docker compose --project-name lianai-production --env-file .deploy.env -f compose.production.yml restart php
```

迁移可重复执行，不清空数据库。不要重新导入数据库，不要删除 Docker 数据卷，不要覆盖 `.deploy.env`、`html/inc/config.php`、`html/inc/miniprogram.php` 或 `html/uploads/`。

打开网站后台，编辑自己的生日并填写正确历法。用无痕窗口检查首页日期，或刷新浏览器缓存。

如果此前更新后出现 `Failed opening required ... Permission denied`，在 `/opt/lianai` 执行上面两条 `chmod` 命令并重启 PHP 即可，无需重新导入数据库。修复仅涉及本次更新文件及它们的父目录，不要把整个项目或配置文件设为 777。

## 小程序更新

VPS 更新完成后，在微信开发者工具中打开本机项目 `miniprogram/`，重新编译、扫码预览。验证主人能保存农历生日、访客只看允许公开的内容。正式版需要重新上传代码并按原流程发布；单独更新 VPS 不会更新已发布的小程序客户端。

## 已完成的本地验证

- 网站与小程序：九月十四在 2026/2027 年的对应日期、生日当天和过后、年龄及跨年。
- 闰月、三十遇小月、公历生日、2 月 29 日及原有节日的自动测试。
- 小程序表单保存参数、重新打开、无效闰月拦截。
- 本地 PHP/MySQL：历法字段保存、旧客户端更新保留历法、非法值拒绝、访客和受限账号无法修改、公开白名单。
- Playwright：实际新增、刷新后重新编辑、首页日期显示，桌面及 390px 手机宽度截图。
- PHP 语法检查、微信原生 WXML/WXSS 编译。

本次未部署 VPS、未重新上传微信正式版，未进行手机实机测试。测试使用临时记录，测试后清理。

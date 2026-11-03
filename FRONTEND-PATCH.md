# 2026-10-31 前端与站点设置补丁

将 `frontend-fix-20261031.tar.gz` 上传到服务器 `/opt/lianai`，在宝塔终端执行：

```sh
cd /opt/lianai
tar -xzf frontend-fix-20261031.tar.gz
find html -type d -exec chmod 755 {} +
chmod 644 html/index.php html/loveImg.php html/list.php html/message.php html/chat.php html/articles.php html/games.php html/admin/config.php html/static/js/img-lazy.js html/static/js/navigation-loader.js html/static/css/common.css html/static/css/moment-card.css
```

补丁只包含本轮 PHP 页面、前端 CSS/JS 以及缺失的 `html/admin/config.php`。
旧补丁保留了 Mac 上的 600/640 权限，可能导致 PHP Access denied 或静态资源 403。
如已解压旧补丁，直接执行上面的 find/chmod 即可，不需要再次解压；不要给整个 html 内所有文件 chmod 644，以免放宽数据库配置权限。
**不包含 `html/inc/config.php`、数据库、上传目录或生产密码；不需要重新导入 SQL，也不要重新跑首次部署。**
覆盖后清理浏览器该站点缓存，或用无痕窗口重新访问。静态资源版本已更新。
如果使用 CDN，刷新此次修改的页面和静态文件缓存；后台/API 不应启用缓存。

修复内容：
- 留言、聊天的待发送本地图片不再被全局懒加载包装成失败状态。
- 恢复被旧打包规则误排除的站点设置页。打包规则也已在本地修正。
- 移除每次跳转至少等待一秒的强制动画。请求超过 200ms 才显示加载提示，响应后立即隐藏。
- 相册网格图片保留固定比例占位，简化转圈样式，图片加载后立即显示。
- 合并相册评论计数查询，减少每张卡片一次数据库往返。

线上网络和原图文件大小仍会影响图片下载；本补丁没有声称已压缩历史原图或建立缩略图服务。
请检查选择图片未发送时预览、相册图片加载、后台站点设置、前进/返回四个流程。

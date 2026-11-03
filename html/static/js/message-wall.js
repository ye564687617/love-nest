/**
 * 访客留言墙 — 粉色毛玻璃瀑布流风格
 * 模块化封装（IIFE），避免与 common.js 等全局变量冲突
 * 仅暴露 onclick 所需的函数到 window
 */
(function() {
    'use strict';
    if (window.__disposeMessagePage) window.__disposeMessagePage();
    var initializedRoot = null;
    window.__disposeMessagePage = function () {
        document.removeEventListener('DOMContentLoaded', init);
        document.removeEventListener('pjax:ready', init);
    };

    // ===== 内部状态（不污染全局） =====
    var selectedMessageGift = null;
    var messages = [];
    var msgLoggedIn = false;
    var msgUserInfo = null;
    var msgCsrfToken = '';
    var messageTotal = 0;
    var giftTotal = 0;
    var hasMore = false;
    var loadingMore = false;

    function mapMessage(row) {
        return {
            id: row.id, userId: row.user_id || null,
            name: row.display_name || row.nickname || '', avatar: row.avatar || '',
            text: row.content, img: row.img || '',
            gift: row.gift_icon ? { icon: row.gift_icon, name: row.gift_name } : null,
            ipLocation: row.ip_location || row.location || '',
            clientInfo: row.client_info || '', time: row.created_at
        };
    }

    // ===== 页面初始化 =====
    function init() {
        var initDataEl = document.getElementById('initMsgData');
        if (!initDataEl || initDataEl === initializedRoot) return;
        initializedRoot = initDataEl;
        selectedMessageGift = null;
        loadingMore = false;
        if (initDataEl) {
            try {
                var list = JSON.parse(initDataEl.dataset.list || '[]');
                if (Array.isArray(list)) {
                    messages = list.map(function(row) {
                        return {
                            id: row.id,
                            userId: row.user_id || null,
                            name: row.display_name || '',
                            avatar: row.avatar || '',
                            text: row.content,
                            img: row.img || '',
                            gift: row.gift_icon ? { icon: row.gift_icon, name: row.gift_name } : null,
                            ipLocation: row.ip_location || '',
                            clientInfo: row.client_info || '',
                            time: row.created_at
                        };
                    });
                }
                msgLoggedIn = initDataEl.dataset.loggedIn === '1';
                messageTotal = Number(initDataEl.dataset.total) || 0;
                giftTotal = Number(initDataEl.dataset.giftCount) || 0;
                hasMore = messageTotal > messages.length;
                msgCsrfToken = initDataEl.dataset.csrfToken || '';
                try { msgUserInfo = JSON.parse(initDataEl.dataset.user || 'null'); } catch(e) { msgUserInfo = null; }
            } catch(e) {}
        }

        try {
            renderMessages();
            updateStats();
            updateLoadMore();
            var moreButton = document.getElementById('msgLoadMore');
            if (moreButton) moreButton.onclick = loadMore;
            var cityInput = document.getElementById('messageLocation');
            var locate = document.getElementById('messageLocate');
            var cityStatus = document.getElementById('messageLocationStatus');
            if (locate && cityInput && window.SiteLocation) {
                var touched = false;
                cityInput.addEventListener('input', function () { touched = true; });
                var locateCity = function () {
                    locate.disabled = true;
                    cityStatus.textContent = '正在获取城市…';
                    var original = cityInput.value;
                    window.SiteLocation.city().then(function (result) {
                        if (document.getElementById('messageLocation') !== cityInput) return;
                        if (!touched && cityInput.value === original) cityInput.value = result.value;
                        cityStatus.textContent = result.value ? '网络估算位置，可修改或清空' : result.message;
                        locate.disabled = false;
                    });
                };
                locate.onclick = function () { touched = false; locateCity(); };
                if (msgLoggedIn) locateCity();
            }

            // 字数统计
            var messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.placeholder = msgLoggedIn ? '写下你的祝福，分享此刻的心情~' : '请登录后留言~';
                messageInput.addEventListener('input', function() {
                    document.getElementById('current-chars').textContent = this.value.length;
                });
            }

            // 图片上传 — 选择后预览
            var imgInput = document.getElementById('msg-img-input');
            if (imgInput) {
                imgInput.addEventListener('change', function() {
                    if (!this.files || !this.files[0]) return;
                    if (!msgLoggedIn) {
                        showToast('请登录后留言~');
                        if (typeof window.showAuthCard === 'function') window.showAuthCard('login');
                        this.value = '';
                        return;
                    }
                    var file = this.files[0];
                    // 大小不限：有自动压缩（compressImage 压缩到 1.5MB），无需前端大小拦截
                    var reader = new FileReader();
                    reader.onload = function(e) {
                        document.getElementById('msgImgPreviewSrc').src = e.target.result;
                        document.getElementById('msgImgPreview').style.display = 'inline-block';
                        document.getElementById('msgImgBtn').style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                });
            }

            // 礼物区域折叠切换
            var giftToggle = document.getElementById('giftToggle');
            if (giftToggle) {
                giftToggle.addEventListener('click', function() {
                    if (!msgLoggedIn) {
                        showToast('请登录后留言~');
                        if (typeof window.showAuthCard === 'function') window.showAuthCard('login');
                        return;
                    }
                    document.getElementById('giftSection').classList.toggle('expanded');
                });
            }

            // 输入框聚焦时检查登录
            var msgInputEl = document.getElementById('message-input');
            if (msgInputEl) {
                msgInputEl.addEventListener('focus', function() {
                    if (!msgLoggedIn) {
                        this.blur();
                        showToast('请登录后留言~');
                        if (typeof window.showAuthCard === 'function') window.showAuthCard('login');
                    }
                });
            }
        } catch(e) {
            console.error('[MSG] init error:', e);
        }
    }

    // ===== 以下函数暴露到 window，供 onclick 使用 =====

    /** 打开图片选择器 */
    window.openMsgImgPicker = function() {
        if (!msgLoggedIn) {
            showToast('请登录后留言~');
            if (typeof window.showAuthCard === 'function') window.showAuthCard('login');
            return;
        }
        var input = document.getElementById('msg-img-input');
        if (input) input.click();
    };

    /** 移除已选图片 */
    window.removeMsgImage = function() {
        document.getElementById('msgImgPreview').style.display = 'none';
        document.getElementById('msgImgBtn').style.display = 'inline-flex';
        var input = document.getElementById('msg-img-input');
        if (input) input.value = '';
    };

    /** 获取待发送图片文件 */
    function getPendingMsgImgFile() {
        var input = document.getElementById('msg-img-input');
        return (input && input.files && input.files[0]) ? input.files[0] : null;
    }

    /** 上传图片到 SaaS 图床（group_id=2 其它照片），返回 URL 或 null */
    function uploadMsgImage(file) {
        if (typeof compressImage !== 'function') {
            showToast('压缩组件未加载', 'error');
            return Promise.resolve(null);
        }
        return new Promise(function(resolve) {
            // 压缩到 1.5MB，对齐图床上限
            compressImage(file, 1500, function(compressed) {
                if (!compressed) { resolve(null); return; }
                if (typeof window.setUploadProgress === 'function') {
                    window.setUploadProgress(50, '正在上传图片…');
                }
                var fd = new FormData();
                fd.append('csrf_token', msgCsrfToken);
                fd.append('file', compressed);
                fd.append('group_id', '2');   // 其它照片
                fetch('/api/upload_image.php', { method: 'POST', body: fd })
                    .then(function(r) { return r.json(); })
                    .then(function(d) {
                        if (d && d.code === 0 && d.data && d.data.url) resolve(d.data.url);
                        else { showToast((d && d.msg) || '图片上传失败', 'error'); resolve(null); }
                    })
                    .catch(function(e) { showToast('图片上传异常', 'error'); resolve(null); });
            });
        });
    }

    /** 选择留言礼物 */
    window.selectMessageGift = function(element) {
        if (!msgLoggedIn) {
            showToast('请登录后留言~');
            if (typeof window.showAuthCard === 'function') window.showAuthCard('login');
            return;
        }
        var gift = element.dataset.gift;
        var name = element.dataset.name;
        if (element.classList.contains('selected')) {
            element.classList.remove('selected');
            selectedMessageGift = null;
        } else {
            document.querySelectorAll('.msg-gift-item').forEach(function(item) {
                item.classList.remove('selected');
            });
            element.classList.add('selected');
            selectedMessageGift = { icon: gift, name: name };
        }
    };

    /** 发送留言 */
    window.sendMessage = function() {
        if (!msgLoggedIn) {
            showToast('请登录后留言~');
            if (typeof window.showAuthCard === 'function') window.showAuthCard('login');
            return;
        }

        var messageInput = document.getElementById('message-input');
        var text = messageInput.value.trim();
        if (Array.from(text).length > 200) { showToast('留言不能超过200字'); return; }
        var hasImg = getPendingMsgImgFile();

        if (!text && !hasImg) {
            showToast('请输入留言内容或上传图片~');
            return;
        }

        // 按钮防抖
        var sendBtn = document.querySelector('.msg-send-btn');
        if (sendBtn.disabled) return;
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.6';

        // 有图片：先压缩上传到图床拿 URL，再随业务 API 提交
        var doSubmit = function(imgUrl) {
            var fd = new FormData();
            fd.append('content', text);
            fd.append('csrf_token', msgCsrfToken);
            var city = document.getElementById('messageLocation');
            if (city) fd.append('location', city.value.trim());
            if (selectedMessageGift) {
                fd.append('gift_icon', selectedMessageGift.icon);
                fd.append('gift_name', selectedMessageGift.name);
            }
            if (imgUrl) fd.append('img', imgUrl);   // 图片 URL（图床地址）

            fetch('api/message_api.php', {
                method: 'POST',
                body: fd
            })
        .then(function(res) { return res.json(); })
        .then(function(result) {
            if (typeof window.hideUploadOverlay === 'function') window.hideUploadOverlay();
            sendBtn.disabled = false;
            sendBtn.style.opacity = '';
            if (result.code === 0 || result.code === 200) {
                var newMsg = {
                    id: result.data.id,
                    userId: msgUserInfo ? msgUserInfo.id : null,
                    name: result.data.name || (msgUserInfo ? msgUserInfo.display_name : ''),
                    avatar: result.data.avatar || (msgUserInfo ? msgUserInfo.avatar : ''),
                    text: text,
                    img: result.data.img || '',
                    gift: selectedMessageGift,
                    ipLocation: result.data.ip_location || '',
                    clientInfo: result.data.client_info || '',
                    time: new Date().toISOString()
                };
                messages.unshift(newMsg);
                messageTotal = result.data.total;
                giftTotal = result.data.gift_total;

                messageInput.value = '';
                document.getElementById('current-chars').textContent = '0';
                selectedMessageGift = null;
                document.querySelectorAll('.msg-gift-item').forEach(function(item) {
                    item.classList.remove('selected');
                });
                window.removeMsgImage();

                renderMessages();
                updateStats();
                updateLoadMore();
                showToast('留言发送成功！');
            } else if (result.code === 429) {
                showToast(result.msg || '留言太频繁~');
            } else if (result.code === 2 || result.code === 401) {
                msgLoggedIn = false;
                messageInput.placeholder = '请登录后留言~';
                showToast('请登录后留言~');
                if (typeof window.showAuthCard === 'function') window.showAuthCard('login');
            } else {
                showToast(result.msg || '发送失败', 'error');
            }
        })
        .catch(function() {
            if (typeof window.hideUploadOverlay === 'function') window.hideUploadOverlay();
            sendBtn.disabled = false;
            sendBtn.style.opacity = '';
            showToast('网络错误，请稍后重试');
        });
    };

        // 有图先上传到图床拿 URL，再提交；无图直接提交
        if (hasImg) {
            // 显示遮罩 + 进度条，避免上传时感觉卡顿
            if (typeof window.showUploadOverlay === 'function') {
                window.showUploadOverlay('正在发送留言');
                window.setUploadProgress(10, '正在压缩图片…');
            }
            uploadMsgImage(hasImg).then(function(url) {
                if (url) {
                    if (typeof window.setUploadProgress === 'function') {
                        window.setUploadProgress(100, '图片上传完成，正在提交…');
                    }
                    doSubmit(url);
                } else {
                    // 图片上传失败：关闭遮罩，恢复按钮
                    if (typeof window.hideUploadOverlay === 'function') window.hideUploadOverlay();
                    sendBtn.disabled = false;
                    sendBtn.style.opacity = '';
                }
            });
        } else {
            doSubmit('');
        }
    };

    /** 图片预览（点击留言中的图片放大） */
    window.previewMsgImg = function(el) {
        var src = el.src;
        if (typeof previewImageFullscreen === 'function') {
            previewImageFullscreen(src);
            return;
        }
        // fallback：动态创建全屏预览，img 需标记跳过懒加载包裹，避免被 .img-loader-wrap 隐藏/偏移
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;animation:fadeIn .2s';
        var img = document.createElement('img');
        img.src = src;
        img.setAttribute('data-lazy-skip', '1');
        img.style.cssText = 'max-width:90%;max-height:90%;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);object-fit:contain';
        overlay.appendChild(img);
        overlay.addEventListener('click', function() { overlay.remove(); });
        document.body.appendChild(overlay);
    };

    // ===== 内部渲染函数 =====

    function renderMessages() {
        var container = document.getElementById('message-list');
        var emptyEl = document.getElementById('msgEmpty');
        if (!container) return;

        if (messages.length === 0) {
            container.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';

        var html = messages.map(function(msg, index) {
            // AVATAR_COLORS 来自 common.js 的全局变量
            var colors = AVATAR_COLORS;
            var timeStr = formatTime(msg.time);

            // 头像
            var avatarHtml;
            var hasName = msg.name && msg.name.length > 0;
            var userId = hasName ? msg.userId : null;
            var clickAttr = userId ? ' onclick="showUserCard(' + userId + ', event)" style="cursor:pointer"' : '';
            if (msg.avatar) {
                avatarHtml = '<span class="msg-avatar-click"' + clickAttr + '>'
                    + '<img src="' + escapeHtml(msg.avatar) + '" class="msg-card-avatar-img" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
                    + '<div class="msg-card-avatar" style="display:none;background:' + colors[(msg.name || '?').length % colors.length] + '">' + escapeHtml((msg.name || '?').charAt(0).toUpperCase()) + '</div>'
                    + '</span>';
            } else {
                var initial = (msg.name || '?').charAt(0).toUpperCase();
                var colorIdx = (msg.name || '').length % colors.length;
                avatarHtml = '<span class="msg-avatar-click"' + clickAttr + '>'
                    + '<div class="msg-card-avatar" style="background:' + colors[colorIdx] + '">' + escapeHtml(initial) + '</div>'
                    + '</span>';
            }

            // 昵称（可点击）
            var nameClickAttr = userId ? ' onclick="showUserCard(' + userId + ', event)" style="cursor:pointer"' : '';

            // 留言图片
            var imgHtml = '';
            if (msg.img) {
                imgHtml = '<div class="msg-card-img-wrap"><img src="' + escapeHtml(msg.img) + '" class="msg-card-img" alt="" onclick="previewMsgImg(this)"></div>';
            }

            // 礼物
            var giftHtml = '';
            if (msg.gift) {
                giftHtml = '<div class="msg-card-gift">'
                    + '<span class="msg-card-gift-icon">' + escapeHtml(msg.gift.icon) + '</span>'
                    + '<span class="msg-card-gift-name">' + escapeHtml(msg.gift.name) + '</span>'
                    + '</div>';
            }

            // IP归属地 + 客户端信息
            var locationHtml = '';
            if (msg.ipLocation) {
                locationHtml = '<span class="msg-card-location">📍 ' + escapeHtml(msg.ipLocation) + '</span>';
            }
            var clientHtml = '';
            if (msg.clientInfo) {
                clientHtml = '<span class="msg-card-client">' + escapeHtml(msg.clientInfo) + '</span>';
            }

            return '<div class="msg-card" style="animation-delay:' + (Math.min(index, 10) * 0.06) + 's">'
                + '<div class="msg-card-header">'
                + avatarHtml
                + '<div class="msg-card-info">'
                + '<span class="msg-card-name"' + (nameClickAttr || '') + '>' + escapeHtml(msg.name || '匿名') + '</span>'
                + '<div class="msg-card-meta">'
                + '<span class="msg-card-time">' + timeStr + '</span>'
                + locationHtml
                + clientHtml
                + '</div>'
                + '</div>'
                + '</div>'
                + (msg.text ? '<div class="msg-card-text">' + escapeHtml(msg.text) + '</div>' : '')
                + imgHtml
                + giftHtml
                + '</div>';
        }).join('');

        container.innerHTML = html;
    }

    function formatTime(isoString) {
        return App.utils.formatTime(isoString);
    }

    function updateStats() {
        var mcEl = document.getElementById('message-count');
        var gcEl = document.getElementById('gift-count');
        if (mcEl) mcEl.textContent = messageTotal;
        if (gcEl) gcEl.textContent = giftTotal;
    }

    function updateLoadMore() {
        var button = document.getElementById('msgLoadMore');
        if (!button) return;
        button.hidden = !hasMore;
        button.disabled = loadingMore;
        button.textContent = loadingMore ? '正在加载…' : '加载更多留言';
    }

    function loadMore() {
        if (loadingMore || !hasMore || !messages.length) return;
        loadingMore = true;
        updateLoadMore();
        var root = initializedRoot;
        var status = document.getElementById('msgLoadStatus');
        if (status) status.textContent = '';
        fetch('/api/message_api.php?limit=20&before=' + encodeURIComponent(messages[messages.length - 1].id))
            .then(function (response) { return response.json(); })
            .then(function (result) {
                if (root !== initializedRoot || !root.isConnected) return;
                if (result.code !== 0) throw new Error(result.msg || '加载失败');
                var known = new Set(messages.map(function (message) { return Number(message.id); }));
                result.data.list.forEach(function (row) {
                    if (!known.has(Number(row.id))) { messages.push(mapMessage(row)); known.add(Number(row.id)); }
                });
                hasMore = result.data.has_more;
                messageTotal = result.data.total;
                giftTotal = result.data.gift_total;
                renderMessages();
                updateStats();
            })
            .catch(function () {
                if (root === initializedRoot && status) status.textContent = '加载失败，请重试';
            })
            .finally(function () {
                if (root !== initializedRoot) return;
                loadingMore = false;
                updateLoadMore();
            });
    }

    // ===== 启动：首次加载 & PJAX 切换 =====
    document.addEventListener('DOMContentLoaded', init);
    document.addEventListener('pjax:ready', init);
})();

/* 心动聊天室 - 用户头像版 */
(function () {
    'use strict';
    if (window.__disposeChatPage) window.__disposeChatPage();
    var heartbeatTimer = null;
    var refreshTimer = null;
    var refreshing = false;
    var disposed = false;
    var pageHandlers = new AbortController();
    var initializedRoot = null;
    window.__disposeChatPage = function () {
        if (disposed) return;
        disposed = true;
        clearInterval(heartbeatTimer);
        clearInterval(refreshTimer);
        pageHandlers.abort();
        document.removeEventListener('DOMContentLoaded', init);
        document.removeEventListener('pjax:ready', init);
        if (window.jQuery) window.jQuery(document).off('pjax:beforeReplace.chatPage', window.__disposeChatPage);
    };
    if (window.jQuery) window.jQuery(document).on('pjax:beforeReplace.chatPage', window.__disposeChatPage);

    // ===== 配置 =====
    var CHAT_API = 'api/chat_api.php';
    var HEARTBEAT_INTERVAL = 30000; // 30秒心跳

    // 表情列表
    var EMOJIS = [
        '💕', '🥰', '😘', '❤️', '🤗', '😍', '💗', '💖',
        '😊', '😄', '🤣', '😂', '😉', '😋', '🤩', '😎',
        '👍', '👋', '🎉', '🎊', '✨', '🌟', '💐', '🌸',
        '🌹', '🍀', '🌈', '☀️', '🌙', '⭐', '🎵', '🎶',
        '💌', '🎁', '🎂', '🍰', '☕', '🍷', '🍕', '🍔',
        '🏠', '🚗', '✈️', '🏖', '📷', '📱', '💻', '🎮',
        '🐱', '🐶', '🐼', '🦊', '🐰', '🐻', '🦁', '🐯',
        '💪', '🙏', '👏', '🤝', '💝', '💘', '💟', '♥'
    ];

    // ===== CSRF 令牌 =====
    var csrfToken = '';

    // ===== 状态 =====
    var messages = [];
    var replyingTo = null;
    var chatOpenState = true;
    var isAdminUser = false;
    var chatLoggedIn = false;
    var myUserId = 0;
    var myDisplayName = '';
    var myAvatar = '';

    // ===== DOM =====
    var msgContainer = document.getElementById('chatMessages');
    var chatInput = document.getElementById('chatInput');
    var sendBtn = document.getElementById('chatSendBtn');
    var emojiBtn = document.getElementById('emojiBtn');
    var emojiPanel = document.getElementById('emojiPanel');
    var emojiGrid = document.getElementById('emojiGrid');
    var replyBar = document.getElementById('chatReplyBar');
    var replyName = document.getElementById('replyName');
    var replyText = document.getElementById('replyText');
    var replyClose = document.getElementById('replyClose');

    var imgBtn = document.getElementById('imgBtn');
    var imgDrawer = document.getElementById('imgDrawer');
    var drawerOverlay = document.getElementById('drawerOverlay');
    var drawerCancel = document.getElementById('drawerCancel');
    var albumBtn = document.getElementById('albumBtn');
    var cameraBtn = document.getElementById('cameraBtn');
    var imgFileInput = document.getElementById('imgFileInput');
    var imgPreview = document.getElementById('imgPreview');
    var previewImg = document.getElementById('previewImg');
    var previewClose = document.getElementById('previewClose');

    var retractOverlay = document.getElementById('retractOverlay');
    var retractPreview = document.getElementById('retractPreview');
    var retractCancel = document.getElementById('retractCancel');
    var retractConfirm = document.getElementById('retractConfirm');

    var pendingRetractId = null;

    // ===== 工具函数（内部） =====
    function formatTime(date) {
        var h = date.getHours().toString().padStart(2, '0');
        var m = date.getMinutes().toString().padStart(2, '0');
        return h + ':' + m;
    }

    function formatTimeDivider(date) {
        var M = (date.getMonth() + 1).toString().padStart(2, '0');
        var D = date.getDate().toString().padStart(2, '0');
        var h = date.getHours().toString().padStart(2, '0');
        var m = date.getMinutes().toString().padStart(2, '0');
        return M + '/' + D + ' ' + h + ':' + m;
    }

    function truncate(str, len) {
        if (!str || str.length <= len) return str || '';
        return str.substring(0, len) + '...';
    }

    /**
     * 获取未读消息：截取比已有最大ID大的消息
     */
    function getMaxKnownId() {
        var maxId = 0;
        messages.forEach(function(m) { if (m.id > maxId) maxId = m.id; });
        return maxId;
    }

    // ===== 从 DOM 元素读取初始数据（兼容 PJAX，data-* 属性会被保留） =====
    function loadFromServer() {
        var initDataEl = document.getElementById('chatInitData');
        if (initDataEl) {
            try {
                var list = JSON.parse(initDataEl.dataset.list || '[]');
                if (Array.isArray(list)) {
                    messages = list.map(function(row) { return mapRow(row); });
                }
                chatOpenState = initDataEl.dataset.open === '1';
                isAdminUser = initDataEl.dataset.admin === '1';
                chatLoggedIn = initDataEl.dataset.loggedIn === '1';
                csrfToken = initDataEl.dataset.csrfToken || '';

                if (chatLoggedIn) {
                    var userData = JSON.parse(initDataEl.dataset.user || 'null');
                    if (userData) {
                        myUserId = userData.id || 0;
                        myDisplayName = userData.display_name || '';
                        myAvatar = userData.avatar || '';
                    }
                }

                updateOnlineDisplay(parseInt(initDataEl.dataset.onlineUsers) || 0, parseInt(initDataEl.dataset.onlineGuests) || 0);
            } catch(e) { console.error('[CHAT] init parse error:', e); }
        }

        if (messages.length === 0) reloadMessages();
    }

    function mapRow(row) {
        return {
            id: row.id,
            userId: row.user_id || 0,
            name: row.display_name || '匿名',
            avatar: row.avatar || '',
            content: row.content || '',
            image: row.image || '',
            reply_id: row.reply_id || 0,
            is_admin: row.is_admin || 0,
            ipLocation: row.ip_location || '',
            clientInfo: row.client_info || '',
            time: row.created_at ? new Date(row.created_at.replace(' ', 'T')).getTime() : Date.now()
        };
    }

    // ===== 渲染消息 =====
    var messagesMap = {};

    function buildMessagesMap() {
        messagesMap = {};
        messages.forEach(function(m) {
            messagesMap[m.id] = m;
        });
    }

    /**
     * 获取头像渐变色 — 使用 common.js 中的 AVATAR_COLORS 全局变量
     * 避免重复声明，与留言墙统一
     */
    function getAvatarColor(userId) {
        var colors = typeof AVATAR_COLORS !== 'undefined' ? AVATAR_COLORS : [
            'linear-gradient(135deg, #FF6B8B, #FF9EB5)',
            'linear-gradient(135deg, #42A5F5, #90CAF9)',
            'linear-gradient(135deg, #AB47BC, #CE93D8)',
            'linear-gradient(135deg, #26A69A, #80CBC4)',
            'linear-gradient(135deg, #FF7043, #FFAB91)',
            'linear-gradient(135deg, #7E57C2, #B39DDB)',
            'linear-gradient(135deg, #EC407A, #F48FB1)',
            'linear-gradient(135deg, #FFA726, #FFD54F)'
        ];
        return colors[(userId || 0) % colors.length];
    }

    function renderMessage(data) {
        var isSelf = data.userId > 0 && data.userId === myUserId;
        var initial = (data.name || '?').charAt(0).toUpperCase();

        var el = document.createElement('div');
        el.className = 'chat-msg' + (isSelf ? ' self' : '');
        if (data.is_admin) el.classList.add('msg-admin');
        el.setAttribute('data-msg-id', data.id);

        // 头像
        var avatarHtml;
        var hasName = data.name && data.name.length > 0;
        var clickable = hasName && data.userId > 0;
        var clickAttr = clickable ? ' onclick="showUserCard(' + data.userId + ', event)" style="cursor:pointer"' : '';
        if (data.avatar) {
            avatarHtml = '<span class="chat-avatar-click"' + clickAttr + '>'
                + '<img src="' + escapeHtml(data.avatar) + '" class="chat-avatar-img" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
                + '<div class="chat-avatar" style="display:none;background:' + getAvatarColor(data.userId) + '">' + escapeHtml(initial) + '</div>'
                + '</span>';
        } else {
            avatarHtml = '<span class="chat-avatar-click"' + clickAttr + '>'
                + '<div class="chat-avatar" style="background:' + getAvatarColor(data.userId) + '">' + escapeHtml(initial) + '</div>'
                + '</span>';
        }

        var nameClickAttr = clickable ? ' onclick="showUserCard(' + data.userId + ', event)" style="cursor:pointer"' : '';

        // 气泡内容
        var bubbleHtml = '';

        // 引用回复
        if (data.reply_id && messagesMap[data.reply_id]) {
            var rMsg = messagesMap[data.reply_id];
            bubbleHtml += '<div class="reply-quote" data-quote-id="' + data.reply_id + '">' +
                '<span class="quote-name">' + escapeHtml(rMsg.name) + '</span>' +
                '<span class="quote-text">' + escapeHtml(truncate(rMsg.content || '[图片]', 40)) + '</span>' +
                '</div>';
        }

        // 图片
        if (data.image) {
            bubbleHtml += '<img class="bubble-img" src="' + escapeHtml(data.image) + '" alt="图片" loading="lazy">';
        }

        // 文字
        if (data.content) {
            bubbleHtml += '<div class="bubble-text">' + escapeHtml(data.content) + '</div>';
        }

        // 底部信息：时间 + 归属地 + 客户端
        var metaHtml = '<div class="chat-bubble-meta">';
        var timeStr = formatTime(new Date(data.time));
        metaHtml += '<span class="bubble-time">' + timeStr + '</span>';
        if (data.ipLocation) {
            metaHtml += '<span class="bubble-location">📍 ' + escapeHtml(data.ipLocation) + '</span>';
        }
        if (data.clientInfo) {
            metaHtml += '<span class="bubble-client">' + escapeHtml(data.clientInfo) + '</span>';
        }
        metaHtml += '</div>';

        // 操作按钮
        var canRetract = isSelf || isAdminUser;
        var actionHtml =
            '<div class="chat-msg-actions">' +
            '<span class="msg-action-btn" data-action="reply" data-msg-id="' + data.id + '">回复</span>' +
            '<span class="msg-action-btn" data-action="copy" data-msg-id="' + data.id + '">复制</span>' +
            (canRetract ? '<span class="msg-action-btn action-retract" data-action="retract" data-msg-id="' + data.id + '">撤回</span>' : '') +
            '</div>';

        var nameHtml = isSelf ? '' : '<span class="chat-msg-name"' + (nameClickAttr || '') + '>' + escapeHtml(data.name) + '</span>';

        el.innerHTML =
            '<div class="chat-avatar-wrap">' + avatarHtml + '</div>' +
            '<div class="chat-msg-body">' +
            nameHtml +
            '<div class="chat-bubble">' + bubbleHtml + metaHtml + '</div>' +
            actionHtml +
            '</div>';

        msgContainer.appendChild(el);
    }

    function addTimeDivider(date) {
        var el = document.createElement('div');
        el.className = 'chat-time-divider';
        el.textContent = formatTimeDivider(date);
        msgContainer.appendChild(el);
    }

    function renderAllMessages(followLatest) {
        var oldScrollTop = msgContainer.scrollTop;
        var welcome = msgContainer.querySelector('.chat-system-msg:not(.chat-retracted-msg)');
        msgContainer.innerHTML = '';
        if (welcome) msgContainer.appendChild(welcome);

        buildMessagesMap();

        var lastTime = 0;
        messages.forEach(function(msg) {
            if (msg.time - lastTime > 5 * 60 * 1000) {
                addTimeDivider(new Date(msg.time));
            }
            renderMessage(msg);
            lastTime = msg.time;
        });

        if (followLatest !== false) scrollToBottom();
        else msgContainer.scrollTop = oldScrollTop;
    }

    // ===== 回复功能 =====
    function setReply(msgId) {
        if (!chatLoggedIn) {
            showToast('请登录后发言');
            if (typeof window.showAuthCard === 'function') window.showAuthCard('login');
            return;
        }
        var msg = messagesMap[msgId];
        if (!msg) return;

        replyingTo = { name: msg.name, content: msg.content, msgId: msg.id };
        replyName.textContent = msg.name;
        replyText.textContent = truncate(msg.content || '[图片]', 50);
        replyBar.style.display = 'flex';
        chatInput.placeholder = '回复 ' + msg.name + '...';
        chatInput.focus();
    }

    function clearReply() {
        replyingTo = null;
        replyBar.style.display = 'none';
        chatInput.placeholder = '说点什么吧...';
    }

    // ===== 发送消息（带 CSRF 令牌） =====
    var pendingImageFile = null;

    // 上传图片到 SaaS 图床（group_id=2 其它照片），返回 URL 或 null
    function uploadChatImage(file) {
        if (typeof compressImage !== 'function') {
            showToast('压缩组件未加载', 'error');
            return Promise.resolve(null);
        }
        return new Promise(function(resolve) {
            console.log('[DEBUG-chat] uploadChatImage 开始, file=', file ? file.name : null);
            // 压缩到 1.5MB，对齐图床上限
            compressImage(file, 1500, function(compressed) {
                console.log('[DEBUG-chat] compressImage 回调, compressed=', compressed ? (compressed.type + ' ' + compressed.size) : null);
                if (!compressed) { console.warn('[DEBUG-chat] 压缩失败, resolve(null)'); resolve(null); return; }
                if (typeof window.setUploadProgress === 'function') {
                    window.setUploadProgress(50, '正在上传图片…');
                }
                var fd = new FormData();
                fd.append('csrf_token', csrfToken);
                fd.append('file', compressed);
                fd.append('group_id', '2');   // 其它照片
                fetch('/api/upload_image.php', { method: 'POST', body: fd })
                    .then(function(r) { return r.json(); })
                    .then(function(d) {
                        console.log('[DEBUG-chat] saas_upload 响应:', d);
                        if (d && d.code === 0 && d.data && d.data.url) {
                            console.log('[DEBUG-chat] 上传成功 url=', d.data.url);
                            resolve(d.data.url);
                        }
                        else { showToast((d && d.msg) || '图片上传失败', 'error'); console.warn('[DEBUG-chat] 上传未返回url, resolve(null)'); resolve(null); }
                    })
                    .catch(function(e) { console.error('[DEBUG-chat] 上传异常:', e); showToast('图片上传异常', 'error'); resolve(null); });
            });
        });
    }

    function sendMessage() {
        var content = chatInput.value.trim();
        if (!content && !pendingImageFile) return;

        if (!chatLoggedIn) {
            showToast('请登录后发言');
            if (typeof window.showAuthCard === 'function') window.showAuthCard('login');
            return;
        }

        if (!chatOpenState) {
            showToast('聊天室已关闭~');
            return;
        }

        // 按钮防抖
        if (sendBtn.disabled) return;
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.6';

        console.log('[DEBUG-chat] sendMessage 开始: content=', content, ', pendingImageFile=', pendingImageFile ? (pendingImageFile.name + ' ' + pendingImageFile.size) : null);
        // 有图：先压缩上传图床拿 URL，再随业务 API 提交
        var doSubmit = function(imgUrl) {
            console.log('[DEBUG-chat] doSubmit 调用, imgUrl=', imgUrl);
            var fd = new FormData();
            fd.append('action', 'send');
            fd.append('content', content);
            fd.append('csrf_token', csrfToken);
            if (imgUrl) fd.append('image', imgUrl);   // 图片 URL（图床地址）
            if (replyingTo) {
                fd.append('reply_id', replyingTo.msgId);
            }

            fetch(CHAT_API, {
                method: 'POST',
                body: fd,
                credentials: 'same-origin'
            })
        .then(function(r){ return r.json(); })
        .then(function(result) {
            if (typeof window.hideUploadOverlay === 'function') window.hideUploadOverlay();
            sendBtn.disabled = false;
            sendBtn.style.opacity = '';
            if (result.code === 0 || result.code === 200) {
                chatInput.value = '';
                clearReply();
                window.removeChatImage();
                chatInput.focus();
                reloadMessages();
                showToast('发送成功');
            } else if (result.code === 429) {
                showToast(result.msg || '发送太频繁~');
            } else if (result.code === 2 || result.code === 401) {
                chatLoggedIn = false;
                showToast('请登录后发言');
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

        // 有图先上传图床拿 URL，再提交；无图直接提交
        if (pendingImageFile) {
            console.log('[DEBUG-chat] 有图, 进入上传分支');
            // 显示遮罩 + 进度条，避免上传时感觉卡顿
            if (typeof window.showUploadOverlay === 'function') {
                window.showUploadOverlay('正在发送消息');
                window.setUploadProgress(10, '正在压缩图片…');
            }
            uploadChatImage(pendingImageFile).then(function(url) {
                console.log('[DEBUG-chat] uploadChatImage 返回 url=', url);
                if (url) {
                    if (typeof window.setUploadProgress === 'function') {
                        window.setUploadProgress(100, '图片上传完成，正在提交…');
                    }
                    doSubmit(url);
                } else {
                    // 图片上传失败：关闭遮罩，恢复按钮
                    console.warn('[DEBUG-chat] 图片上传失败(无url), 不提交');
                    if (typeof window.hideUploadOverlay === 'function') window.hideUploadOverlay();
                    sendBtn.disabled = false;
                    sendBtn.style.opacity = '';
                }
            });
        } else {
            console.warn('[DEBUG-chat] pendingImageFile 为空, 直接 doSubmit("")');
            doSubmit('');
        }
    }

    /** 移除已选图片（供 onclick 调用） */
    window.removeChatImage = function() {
        pendingImageFile = null;
        var previewSrc = document.getElementById('chatImgPreviewSrc');
        var previewBar = document.getElementById('chatImgPreviewBar');
        var fileInput = document.getElementById('imgFileInput');
        if (previewSrc) previewSrc.src = '';
        if (previewBar) previewBar.style.display = 'none';
        if (fileInput) fileInput.value = '';
    };

    // ===== 重新从服务器拉取消息（增量更新） =====
    function reloadMessages(background) {
        if (disposed || refreshing) return;
        refreshing = true;
        fetch(CHAT_API + '?limit=100', { credentials: 'same-origin', signal: pageHandlers.signal })
            .then(function(r){ return r.json(); })
            .then(function(res) {
                if (!disposed && (res.code === 0 || res.code === 200) && res.data && res.data.list) {
                    var nextMessages = res.data.list.map(function(row) { return mapRow(row); });
                    var followLatest = !background || msgContainer.scrollHeight - msgContainer.scrollTop - msgContainer.clientHeight < 80;
                    if (JSON.stringify(nextMessages) !== JSON.stringify(messages)) {
                        messages = nextMessages;
                        renderAllMessages(followLatest);
                    }

                    var mc = document.getElementById('msgCount');
                    if (mc) mc.textContent = res.data.total;
                    var tc = document.getElementById('todayCount');
                    if (tc) tc.textContent = res.data.today;
                }
            })
            .catch(function(err){ if (err.name !== 'AbortError') console.error('[CHAT] fetch error:', err); })
            .finally(function(){ refreshing = false; });
    }

    // ===== 图片相关 =====
    function openImgDrawer() {
        if (!chatLoggedIn) {
            showToast('请登录后发言');
            if (typeof window.showAuthCard === 'function') window.showAuthCard('login');
            return;
        }
        imgDrawer.classList.add('show');
    }
    function closeImgDrawer() { imgDrawer.classList.remove('show'); }

    function handleImageSelect(e) {
        console.log('[DEBUG-chat] handleImageSelect 触发, files=', e.target.files, 'id=', e.target.id);
        var file = e.target.files[0];
        if (!file) { console.warn('[DEBUG-chat] 未选中文件'); return; }
        console.log('[DEBUG-chat] 选中文件: name=', file.name, 'size=', file.size, 'type=', file.type);
        // 大小不限：有自动压缩（compressImage 压缩到 1.5MB），无需前端大小拦截
        if (!/^image\/(jpeg|png|gif|webp)$/.test(file.type)) {
            console.warn('[DEBUG-chat] 格式不支持: ', file.type);
            showToast('仅支持 JPG/PNG/GIF/WebP 格式');
            e.target.value = '';
            return;
        }

        // 本地预览
        var reader = new FileReader();
        reader.onload = function(evt) {
            document.getElementById('chatImgPreviewSrc').src = evt.target.result;
            document.getElementById('chatImgPreviewBar').style.display = 'flex';
        };
        reader.readAsDataURL(file);
        pendingImageFile = file;
        console.log('[DEBUG-chat] 已设置 pendingImageFile =', pendingImageFile);
        closeImgDrawer();
        e.target.value = '';
    }

    function showImagePreview(src) {
        previewImg.src = src;
        imgPreview.classList.add('show');
    }
    function closeImagePreview() {
        imgPreview.classList.remove('show');
        previewImg.src = '';
    }

    // ===== 消息操作 =====
    function handleMsgAction(msgId, action) {
        var msg = messagesMap[msgId];
        if (!msg) return;

        if (action === 'reply') {
            setReply(msgId);
        } else if (action === 'copy') {
            copyToClipboard(msg.content || '[图片]');
            showToast('已复制');
        } else if (action === 'retract') {
            if (!chatLoggedIn) {
                showToast('请登录后操作');
                if (typeof window.showAuthCard === 'function') window.showAuthCard('login');
                return;
            }
            var isSelf = msg.userId === myUserId;
            if (isSelf || isAdminUser) {
                showRetractConfirm(msgId);
            } else {
                showToast('只能撤回自己的消息');
            }
        }
    }

    function showRetractConfirm(msgId) {
        pendingRetractId = msgId;
        var msg = messagesMap[msgId];
        retractPreview.innerHTML = '<span class="retract-preview-content">"' + escapeHtml(truncate(msg ? msg.content || '[图片]' : '', 50)) + '"</span>';
        retractOverlay.classList.add('show');
    }

    function hideRetractConfirm() {
        retractOverlay.classList.remove('show');
        pendingRetractId = null;
    }

    function doRetract() {
        if (!pendingRetractId) return;
        var fd = new URLSearchParams();
        fd.append('action', 'retract');
        fd.append('msg_id', pendingRetractId);
        fd.append('csrf_token', csrfToken);

        fetch(CHAT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString(),
            credentials: 'same-origin'
        })
        .then(function(r){ return r.json(); })
        .then(function(result) {
            if (result.code === 0 || result.code === 200) {
                hideRetractConfirm();
                showToast('已撤回');
                reloadMessages();
            } else {
                showToast(result.msg || '撤回失败');
            }
        })
        .catch(function(){ showToast('网络错误'); });
    }

    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(function(){ fallbackCopy(text); });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch(e) {}
        document.body.removeChild(ta);
    }

    /** 切换聊天室全屏（需登录） */
    window.toggleChatFullscreen = function() {
        if (!chatLoggedIn) {
            showToast('请登录后使用全屏显示');
            if (typeof window.showAuthCard === 'function') window.showAuthCard('login');
            return;
        }
        var container = document.querySelector('.chat-container');
        if (!container) return;
        container.classList.toggle('fullscreen');
        var expandIcon = document.querySelector('.fs-icon-expand');
        var compressIcon = document.querySelector('.fs-icon-compress');
        var btnText = document.querySelector('.fs-btn-text');
        if (container.classList.contains('fullscreen')) {
            if (expandIcon) expandIcon.style.display = 'none';
            if (compressIcon) compressIcon.style.display = '';
            if (btnText) btnText.textContent = '退出全屏';
        } else {
            if (expandIcon) expandIcon.style.display = '';
            if (compressIcon) compressIcon.style.display = 'none';
            if (btnText) btnText.textContent = '全屏显示';
        }
    };

    function scrollToMessage(msgId) {
        var el = msgContainer.querySelector('[data-msg-id="' + msgId + '"]');
        if (!el) { showToast('原消息已不存在'); return; }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var bubble = el.querySelector('.chat-bubble');
        if (bubble) {
            bubble.style.transition = 'background 0.3s ease';
            bubble.style.background = 'rgba(255,107,139,0.15)';
            setTimeout(function(){ bubble.style.background = ''; }, 1200);
        }
    }

    // ===== 在线人数 =====
    function updateOnlineDisplay(users, guests) {
        var total = (users || 0) + (guests || 0);
        var badge = document.getElementById('headerOnlineCount');
        if (badge) badge.textContent = total;
        var ou = document.getElementById('onlineUsers');
        if (ou) ou.textContent = users || 0;
        var og = document.getElementById('onlineGuests');
        if (og) og.textContent = guests || 0;
    }

    function sendHeartbeat() {
        fetch(CHAT_API + '?action=heartbeat', { credentials: 'same-origin', signal: pageHandlers.signal })
            .then(function(r){ return r.json(); })
            .then(function(res) {
                if (!disposed && (res.code === 0 || res.code === 200) && res.data) {
                    updateOnlineDisplay(res.data.onlineUsers, res.data.onlineGuests);
                }
            })
            .catch(function(){});
    }

    // ===== 表情面板 =====
    function initEmojiPanel() {
        EMOJIS.forEach(function(emoji) {
            var btn = document.createElement('button');
            btn.className = 'emoji-item';
            btn.textContent = emoji;
            btn.addEventListener('click', function() {
                chatInput.value += emoji;
                chatInput.focus();
            });
            emojiGrid.appendChild(btn);
        });
    }

    function toggleEmojiPanel() {
        emojiPanel.classList.toggle('show');
        emojiBtn.classList.toggle('active');
    }

    // ===== 滚动 =====
    function scrollToBottom() {
        requestAnimationFrame(function(){
            msgContainer.scrollTop = msgContainer.scrollHeight;
        });
    }

    // ===== 初始化 =====
    function init() {
        var root = document.getElementById('chatInitData');
        if (!root) { clearInterval(heartbeatTimer); return; }
        if (root === initializedRoot) return;
        initializedRoot = root;
        // 重新获取 DOM（PJAX 切换后 DOM 已替换）
        msgContainer = document.getElementById('chatMessages') || msgContainer;
        chatInput = document.getElementById('chatInput') || chatInput;
        sendBtn = document.getElementById('chatSendBtn') || sendBtn;
        emojiBtn = document.getElementById('emojiBtn') || emojiBtn;
        emojiPanel = document.getElementById('emojiPanel') || emojiPanel;
        emojiGrid = document.getElementById('emojiGrid') || emojiGrid;
        replyBar = document.getElementById('chatReplyBar') || replyBar;
        replyName = document.getElementById('replyName') || replyName;
        replyText = document.getElementById('replyText') || replyText;
        replyClose = document.getElementById('replyClose') || replyClose;
        imgBtn = document.getElementById('imgBtn') || imgBtn;
        imgDrawer = document.getElementById('imgDrawer') || imgDrawer;
        drawerOverlay = document.getElementById('drawerOverlay') || drawerOverlay;
        drawerCancel = document.getElementById('drawerCancel') || drawerCancel;
        albumBtn = document.getElementById('albumBtn') || albumBtn;
        cameraBtn = document.getElementById('cameraBtn') || cameraBtn;
        imgFileInput = document.getElementById('imgFileInput') || imgFileInput;
        imgPreview = document.getElementById('imgPreview') || imgPreview;
        previewImg = document.getElementById('previewImg') || previewImg;
        previewClose = document.getElementById('previewClose') || previewClose;
        retractOverlay = document.getElementById('retractOverlay') || retractOverlay;
        retractPreview = document.getElementById('retractPreview') || retractPreview;
        retractCancel = document.getElementById('retractCancel') || retractCancel;
        retractConfirm = document.getElementById('retractConfirm') || retractConfirm;

        loadFromServer();
        chatInput.placeholder = chatLoggedIn ? '说点什么吧...' : '请登录后发言~';
        initEmojiPanel();
        sendHeartbeat();

        if (messages.length > 0) renderAllMessages();

        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });

        chatInput.addEventListener('focus', function() {
            if (!chatLoggedIn) {
                this.blur();
                showToast('请登录后发言');
                if (typeof window.showAuthCard === 'function') window.showAuthCard('login');
            }
        });

        emojiBtn.addEventListener('click', function(e){ e.preventDefault(); toggleEmojiPanel(); });

        msgContainer.addEventListener('click', function(e) {
            var actionBtn = e.target.closest('.msg-action-btn');
            if (actionBtn) {
                var msgId = actionBtn.getAttribute('data-msg-id');
                var action = actionBtn.getAttribute('data-action');
                if (msgId && action) handleMsgAction(parseInt(msgId), action);
                return;
            }
            var bubbleImg = e.target.closest('.bubble-img');
            if (bubbleImg) { showImagePreview(bubbleImg.src); return; }
            var quoteEl = e.target.closest('.reply-quote');
            if (quoteEl) {
                var quoteId = quoteEl.getAttribute('data-quote-id');
                if (quoteId) scrollToMessage(quoteId);
                return;
            }
        });

        retractCancel.addEventListener('click', hideRetractConfirm);
        retractConfirm.addEventListener('click', doRetract);
        retractOverlay.addEventListener('click', function(e){ if (e.target === retractOverlay) hideRetractConfirm(); });

        replyClose.addEventListener('click', clearReply);

        imgBtn.addEventListener('click', function(e){ e.preventDefault(); openImgDrawer(); });
        drawerOverlay.addEventListener('click', closeImgDrawer);
        drawerCancel.addEventListener('click', closeImgDrawer);
        albumBtn.addEventListener('click', function(){ closeImgDrawer(); setTimeout(function(){ imgFileInput.click(); }, 300); });
        cameraBtn.addEventListener('click', function(){ closeImgDrawer(); setTimeout(function(){ imgFileInput.setAttribute('capture','environment'); imgFileInput.click(); setTimeout(function(){ imgFileInput.removeAttribute('capture'); }, 500); }, 300); });
        imgFileInput.addEventListener('change', handleImageSelect);
        previewClose.addEventListener('click', closeImagePreview);
        imgPreview.addEventListener('click', function(e){ if (e.target === imgPreview) closeImagePreview(); });

        document.addEventListener('click', function(e) {
            if (!emojiPanel.contains(e.target) && e.target !== emojiBtn) {
                emojiPanel.classList.remove('show'); emojiBtn.classList.remove('active');
            }
        }, {signal: pageHandlers.signal});

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeImgDrawer(); closeImagePreview();
                if (retractOverlay.classList.contains('show')) hideRetractConfirm();
            }
        }, {signal: pageHandlers.signal});

        clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(function () { if (document.getElementById('chatInitData') === initializedRoot) sendHeartbeat(); }, HEARTBEAT_INTERVAL);
        clearInterval(refreshTimer);
        refreshTimer = setInterval(function () {
            if (!document.hidden && document.getElementById('chatInitData') === initializedRoot) reloadMessages(true);
        }, 5000);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) { reloadMessages(true); sendHeartbeat(); }
        }, {signal: pageHandlers.signal});
    }

    // ===== 首次加载 & PJAX 切换 =====
    document.addEventListener('DOMContentLoaded', init);
    document.addEventListener('pjax:ready', init);
    if (document.readyState !== 'loading') init();
})();

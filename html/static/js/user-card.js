/**
 * 用户个人信息悬浮卡片
 * 全局组件，点击任一用户头像时显示
 * 依赖：toastr.js 的 showToast, common.js 的 escapeHtml 和 showAuthCard
 */
(function() {
    'use strict';

    // 注入 CSS
    (function() {
        if (document.getElementById('uc-styles')) return;
        var s = document.createElement('style');
        s.id = 'uc-styles';
        s.textContent = ''
+ '.uc-overlay{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.3);opacity:0;transition:opacity 0.2s}'
+ '.uc-card{position:fixed;z-index:99999;width:340px;max-width:90vw;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.15);opacity:0;transform:scale(0.92) translateY(10px);transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1);overflow:hidden;pointer-events:auto}'
+ '.uc-card-inner{position:relative;padding:0}'
+ '.uc-header{display:flex;gap:14px;padding:20px 20px 14px;align-items:flex-start}'
+ '.uc-avatar-wrap{flex-shrink:0}'
+ '.uc-avatar-img,.uc-avatar-letter{width:52px;height:52px;border-radius:50%;object-fit:cover;display:block}'
+ '.uc-avatar-letter{display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:600}'
+ '.uc-header-info{flex:1;min-width:0}'
+ '.uc-name-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}'
+ '.uc-name{font-size:17px;font-weight:700;color:#1a1a2e}'
+ '.uc-role-tag{font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(255,107,139,0.1);color:#FF6B8B;font-weight:500;white-space:nowrap}'
+ '.uc-info-item{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:12px;color:#888}'
+ '.uc-info-label{flex-shrink:0}'
+ '.uc-info-value{color:#666}'
+ '.uc-bio{padding:4px 20px 10px;font-size:13px;color:#999;font-style:italic;line-height:1.5}'
+ '.uc-divider{height:1px;background:rgba(0,0,0,0.05);margin:0 20px}'
+ '.uc-stats{display:flex;padding:14px 20px;gap:0}'
+ '.uc-stat-item{flex:1;text-align:center}'
+ '.uc-stat-num{display:block;font-size:18px;font-weight:700;color:#1a1a2e}'
+ '.uc-stat-label{display:block;font-size:11px;color:#aaa;margin-top:2px}'
+ '.uc-footer{padding:10px 20px;font-size:12px;color:#aaa}'
+ '.uc-actions{display:flex;gap:8px;padding:10px 20px 18px}'
+ '.uc-btn{flex:1;padding:9px 0;border:none;border-radius:10px;font-size:13px;cursor:pointer;transition:all 0.2s;font-weight:500}'
+ '.uc-btn-primary{background:#FF6B8B;color:#fff}'
+ '.uc-btn-primary:hover{background:#ff5278}'
+ '.uc-btn-outline{background:rgba(0,0,0,0.04);color:#666}'
+ '.uc-btn-outline:hover{background:rgba(0,0,0,0.08)}'
+ '.uc-btn-warning{background:#fff3e0;color:#e65100}'
+ '.uc-btn-warning:hover{background:#ffe0b2}'
+ '.pc-overlay{position:fixed;inset:0;z-index:99997;background:rgba(0,0,0,0.35);opacity:0;transition:opacity 0.2s}'
+ '.pc-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.9);width:420px;max-width:92vw;height:560px;max-height:80vh;z-index:99999;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.18);display:flex;flex-direction:column;overflow:hidden;opacity:0;transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1)}'
+ '.pc-msg-me .pc-bubble{background:#FF6B8B;color:#fff}'
+ '.pc-msg-other .pc-bubble{background:#fff;color:#333}'
+ '.uc-close-btn{position:absolute;top:8px;right:8px;width:28px;height:28px;border:none;background:rgba(0,0,0,0.04);border-radius:50%;color:#999;font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;z-index:1}'
+ '.uc-close-btn:hover{background:rgba(0,0,0,0.1);color:#333}';
        document.head.appendChild(s);
    })();

    var CARD_API = 'api/user_card_api.php';
    var MSG_API  = 'api/private_msg_api.php';
    var REPORT_API = 'api/report_api.php';
    var currentUserId = 0;
    var cardEl = null;
    var overlayEl = null;
    var isLoading = false;

    /** 创建卡片 DOM（仅一次） */
    function createCardDOM() {
        if (cardEl) return;

        overlayEl = document.createElement('div');
        overlayEl.className = 'uc-overlay';
        overlayEl.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.3);opacity:0;transition:opacity 0.2s;';

        cardEl = document.createElement('div');
        cardEl.className = 'uc-card';
        cardEl.style.cssText = 'position:fixed;z-index:99999;width:340px;max-width:90vw;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.15);opacity:0;transform:scale(0.92) translateY(10px);transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1);overflow:hidden;pointer-events:auto;';
        cardEl.innerHTML = '<div class="uc-loading" style="padding:60px 0;text-align:center;color:#999;font-size:14px;">加载中...</div>';

        document.body.appendChild(overlayEl);
        document.body.appendChild(cardEl);

        overlayEl.addEventListener('click', close);
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') close();
        });
    }

    /** 打开卡片 */
    window.showUserCard = function(userId, event) {
        if (!userId || userId <= 0) return;
        if (isLoading) return;

        // 阻止事件冒泡（避免点自己时关闭）
        if (event) { event.stopPropagation(); }

        // 保存点击事件以便禁言/解禁后重新显示卡片
        if (event) { window.__ucLastClickEvent = event; }

        currentUserId = userId;
        createCardDOM();

        // 显示加载状态
        cardEl.innerHTML = '<div class="uc-loading" style="padding:60px 0;text-align:center;color:#999;font-size:14px;">⌛ 加载中...</div>';

        // 根据点击位置定位卡片
        positionCard(event);

        // 显示遮罩 + 卡片
        overlayEl.style.opacity = '1';
        overlayEl.style.pointerEvents = 'auto';
        cardEl.style.opacity = '1';
        cardEl.style.transform = 'scale(1) translateY(0)';
        cardEl.style.pointerEvents = 'auto';

        // 请求数据
        isLoading = true;
        var fd = new URLSearchParams();
        fd.append('action', 'get_card');
        fd.append('user_id', userId);

        fetch(CARD_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString(),
            credentials: 'same-origin'
        })
        .then(function(r) { return r.json(); })
        .then(function(res) {
            isLoading = false;
            if (res.code === 0 && res.data) {
                // 缓存当前用户信息
                if (res.data._current) {
                    window.__ucCurrentUser = res.data._current;
                }
                renderCard(res.data);
            } else {
                cardEl.innerHTML = '<div class="uc-loading" style="padding:60px 0;text-align:center;color:#e74c3c;font-size:14px;">❌ ' + (res.msg || '加载失败') + '</div>';
            }
            // 5秒后自动关闭错误状态
            if (res.code !== 0 || !res.data) {
                setTimeout(function() {
                    if (overlayEl) overlayEl.style.opacity = '0';
                    if (cardEl) {
                        cardEl.style.opacity = '0';
                        cardEl.style.pointerEvents = 'none';
                    }
                }, 3000);
            }
        })
        .catch(function() {
            isLoading = false;
            cardEl.innerHTML = '<div class="uc-loading" style="padding:60px 0;text-align:center;color:#e74c3c;font-size:14px;">❌ 网络错误</div>';
        });
    };

    /** 定位卡片 */
    function positionCard(event) {
        if (!cardEl || !event) return;

        // 先重置位置，让浏览器计算卡片尺寸
        cardEl.style.left = '';
        cardEl.style.right = '';
        cardEl.style.top = '';
        cardEl.style.bottom = '';
        cardEl.style.transform = 'scale(0.92) translateY(10px)';

        // 获取点击位置
        var cx = event.clientX, cy = event.clientY;
        var cw = 340, ch;
        var vw = window.innerWidth, vh = window.innerHeight;

        // 预估卡片高度（渲染后调整）
        setTimeout(function() {
            if (!cardEl) return;
            var rect = cardEl.getBoundingClientRect();
            ch = rect.height;

            var left, top;
            // 水平：点击点在左侧放右侧，右侧放左侧
            if (cx < vw / 2) {
                left = Math.min(cx + 15, vw - cw - 10);
            } else {
                left = Math.max(cx - cw - 15, 10);
            }
            left = Math.max(10, Math.min(left, vw - cw - 10));

            // 垂直：居中偏上
            top = Math.max(15, Math.min(cy - 60, vh - ch - 15));
            top = Math.max(15, top);

            cardEl.style.left = left + 'px';
            cardEl.style.top = top + 'px';
            cardEl.style.right = '';
            cardEl.style.bottom = '';
        }, 10);
    }

    /** 构建底部操作按钮 HTML */
    function buildActionsHtml(data) {
        var cur = data._current || {};
        var isLoggedIn = cur.logged_in;
        var curId = cur.id || 0;
        var curRole = cur.role || 0;
        var targetId = data.id || 0;
        var targetRole = data.role || 0;
        var isSelf = isLoggedIn && curId === targetId;
        var isOwnerPartner = false;
        var isAdmin = false;
        var isBanned = data.is_banned;
        var buttons = [];

        // 发私信 — 所有人都可见，未登录/自己时点击提示
        if (!isSelf) {
            var pmBtn = '<button class="uc-btn uc-btn-primary" onclick="';
            if (!isLoggedIn) {
                pmBtn += 'showToast(\'请先登录\');if(typeof window.showAuthCard===\'function\')window.showAuthCard(\'login\')';
            } else {
                pmBtn += 'openPrivateChat(' + targetId + ',this.dataset.nickname)';
            }
            pmBtn += '" data-nickname="' + escHtml(data.display_name) + '">✉️ 发私信</button>';
            buttons.push(pmBtn);
        }

        if (isSelf) return buttons.join('');

        // 站长/副站长(1-2) → 管理员(3)或普通用户(4)：禁言/解禁
        if (isOwnerPartner && targetRole >= 3) {
            if (isBanned) {
                buttons.push('<button class="uc-btn uc-btn-warning" onclick="unbanTargetUser(' + targetId + ')">🔓 解除禁言</button>');
            } else {
                buttons.push('<button class="uc-btn uc-btn-warning" onclick="banTargetUser(' + targetId + ')">🔇 禁言</button>');
            }
            return buttons.join('');
        }

        // 管理员(3) → 普通用户(4)：禁言/解禁
        if (isAdmin && targetRole >= 4) {
            if (isBanned) {
                buttons.push('<button class="uc-btn uc-btn-warning" onclick="unbanTargetUser(' + targetId + ')">🔓 解除禁言</button>');
            } else {
                buttons.push('<button class="uc-btn uc-btn-warning" onclick="banTargetUser(' + targetId + ')">🔇 禁言</button>');
            }
            return buttons.join('');
        }

        // 管理员(3) → 管理员/站长/副站长(1-3)：只显示私信，不显示禁言
        if (isAdmin && targetRole <= 3 && targetRole !== 3) {
            return buttons.join('');
        }

        // 管理员(3) → 管理员(3)；普通用户(4) → 管理员(3)/普通用户(4)：显示举报
        if (((curRole === 3 && targetRole === 3) || (curRole === 4 && targetRole >= 3)) && !isSelf) {
            var reportBtn = '<button class="uc-btn uc-btn-outline" onclick="';
            if (!isLoggedIn) {
                reportBtn += 'showToast(\'请先登录\');if(typeof window.showAuthCard===\'function\')window.showAuthCard(\'login\')';
            } else {
                reportBtn += 'reportTargetUser(' + targetId + ',this.dataset.nickname)';
            }
            reportBtn += '" data-nickname="' + escHtml(data.display_name) + '">🚫 举报</button>';
            buttons.push(reportBtn);
        }

        return buttons.join('');
    }

    /** 禁言目标用户（1小时） */
    window.banTargetUser = function(userId) {
        if (!confirm('确定对该用户禁言1小时？')) return;
        var fd = new URLSearchParams();
        fd.append('action', 'ban');
        fd.append('user_id', userId);
        fetch(CARD_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString(),
            credentials: 'same-origin'
        })
        .then(function(r) { return r.json(); })
        .then(function(res) {
            if (res.code === 0) {
                showToast(res.msg || '该用户已被禁言1小时');
                close();
                // 延迟刷新卡片以反映最新状态
                setTimeout(function() {
                    if (window.__ucCurrentUser) {
                        var evt = window.__ucLastClickEvent;
                        if (evt) showUserCard(userId, evt);
                    }
                }, 400);
            } else {
                showToast(res.msg || '操作失败');
            }
        })
        .catch(function() { showToast('网络错误'); });
    };

    /** 解除目标用户禁言 */
    window.unbanTargetUser = function(userId) {
        if (!confirm('确定解除该用户的禁言？')) return;
        var fd = new URLSearchParams();
        fd.append('action', 'unban');
        fd.append('user_id', userId);
        fetch(CARD_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString(),
            credentials: 'same-origin'
        })
        .then(function(r) { return r.json(); })
        .then(function(res) {
            if (res.code === 0) {
                showToast(res.msg || '已解除禁言');
                close();
                setTimeout(function() {
                    if (window.__ucCurrentUser) {
                        var evt = window.__ucLastClickEvent;
                        if (evt) showUserCard(userId, evt);
                    }
                }, 400);
            } else {
                showToast(res.msg || '操作失败');
            }
        })
        .catch(function() { showToast('网络错误'); });
    };

    /** 举报目标用户 */
    window.reportTargetUser = function(userId, userName) {
        var reason = prompt('请输入举报原因（最长500字）：\n举报用户：' + (userName || ''));
        if (!reason || !reason.trim()) return;
        if (reason.length > 500) { showToast('原因过长，最多500字'); return; }

        var fd = new URLSearchParams();
        fd.append('action', 'submit');
        fd.append('reported_id', userId);
        fd.append('reason', reason.trim());
        fd.append('csrf_token', (window.__ucCurrentUser || {}).csrf_token || window.__userCsrfToken || '');

        fetch(REPORT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString(),
            credentials: 'same-origin'
        })
        .then(function(r) { return r.json(); })
        .then(function(res) {
            if (res.code === 0) {
                showToast(res.msg || '举报已提交');
                close();
            } else {
                showToast(res.msg || '提交失败');
            }
        })
        .catch(function() { showToast('网络错误'); });
    };

    /** 渲染卡片内容 */
    function renderCard(data) {
        var avatarHtml;
        if (data.avatar) {
            avatarHtml = '<img src="' + escapeHtml(data.avatar) + '" class="uc-avatar-img" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
                + '<div class="uc-avatar-letter" style="display:none;">' + escapeHtml((data.display_name || '?').charAt(0).toUpperCase()) + '</div>';
        } else {
            var colors = ['#FF6B8B','#FF8E9E','#E8A0BF','#C9A7EB','#7EC8E3','#81C784'];
            var colorIdx = (data.id || 0) % colors.length;
            avatarHtml = '<div class="uc-avatar-letter" style="display:flex;background:' + colors[colorIdx] + '">' + escapeHtml((data.display_name || '?').charAt(0).toUpperCase()) + '</div>';
        }

        var birthdayHtml = data.birthday ? '<div class="uc-info-item"><span class="uc-info-label">🎂</span><span class="uc-info-value">' + data.birthday + '</span></div>' : '';
        var registerHtml = data.created_at ? '<div class="uc-info-item"><span class="uc-info-label">📅</span><span class="uc-info-value">注册于 ' + data.created_at.substring(0, 10) + '</span></div>' : '';
        var lastActiveHtml = data.last_active ? '<div class="uc-info-item"><span class="uc-info-label">🔔</span><span class="uc-info-value">最后活跃 ' + data.last_active + '</span></div>' : '';
        var bioHtml = '<div class="uc-bio" style="' + (data.bio ? 'color:#777' : 'color:#ccc') + '">' + (data.bio ? '"' + escHtml(data.bio) + '"' : '无') + '</div>';

        var stats = data.stats || {};
        var statHtml = '<div class="uc-stats">'
            + '<div class="uc-stat-item"><span class="uc-stat-num">' + (stats.moments || 0) + '</span><span class="uc-stat-label">动态</span></div>'
            + '<div class="uc-stat-item"><span class="uc-stat-num">' + (stats.messages || 0) + '</span><span class="uc-stat-label">留言</span></div>'
            + '<div class="uc-stat-item"><span class="uc-stat-num">' + (stats.chats || 0) + '</span><span class="uc-stat-label">聊天</span></div>'
            + '<div class="uc-stat-item"><span class="uc-stat-num">' + (stats.comments || 0) + '</span><span class="uc-stat-label">评论</span></div>'
            + '</div>';

        cardEl.innerHTML = '<div class="uc-card-inner">'
            + '<button class="uc-close-btn" onclick="closeUserCard()" title="关闭">✕</button>'
            + '<div class="uc-header">'
                + '<div class="uc-avatar-wrap">' + avatarHtml + '</div>'
                + '<div class="uc-header-info">'
                    + '<div class="uc-name-row">'
                        + '<span class="uc-name">' + escapeHtml(data.display_name) + '</span>'
                        + '<span class="uc-role-tag">' + data.role_label + '</span>'
                    + '</div>'
                    + birthdayHtml + registerHtml
                + '</div>'
            + '</div>'
            + bioHtml
            + '<div class="uc-divider"></div>'
            + statHtml
            + '<div class="uc-divider"></div>'
            + '<div class="uc-footer">'
                + lastActiveHtml
            + '</div>'
            + '<div class="uc-actions">'
                + buildActionsHtml(data)
            + '</div>'
        + '</div>';

        // 重新定位
        var evt = { clientX: parseInt(cardEl.style.left) + 30, clientY: parseInt(cardEl.style.top) + 30 };
        positionCard(evt);
    }

    /** 关闭卡片 */
    function close() {
        if (overlayEl) {
            overlayEl.style.opacity = '0';
            overlayEl.style.pointerEvents = 'none';
        }
        if (cardEl) {
            cardEl.style.opacity = '0';
            cardEl.style.transform = 'scale(0.92) translateY(10px)';
            cardEl.style.pointerEvents = 'none';
        }
        currentUserId = 0;
    }

    /** 全局关闭卡片（供 onclick 调用） */
    window.closeUserCard = close;

    /** 辅助转义 */
    function escHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    /** 打开私信窗口 */
    window.openPrivateChat = function(partnerId, partnerName) {
        // 检查是否已登录
        var cur = _getCurrentUser();
        if (!cur.logged_in) {
            showToast('请先登录');
            if (typeof window.showAuthCard === 'function') window.showAuthCard('login');
            return;
        }
        // 检查是否给自己发私信
        if (cur.id === partnerId) {
            showToast('不能给自己发私信哦~');
            return;
        }
        close();
        setTimeout(function() {
            showPrivateChatModal(partnerId, partnerName);
        }, 250);
    };

    /** 从最近一次卡片响应获取当前用户信息 */
    function _getCurrentUser() {
        // 先从最近渲染的数据中取
        var stored = window.__ucCurrentUser;
        if (stored) return stored;
        // 从页面上的 chat/message 数据中取
        var initDataEl = document.getElementById('chatInitData');
        if (initDataEl && initDataEl.dataset.loggedIn === '1') {
            var userData = { logged_in: true };
            try {
                var user = JSON.parse(initDataEl.dataset.user || 'null');
                if (user) { userData.id = user.id || 0; userData.role = 0; }
            } catch(e) {}
            return userData;
        }
        return { logged_in: false, id: 0, role: 0 };
    }

    // ========== 私信窗口 ==========
    var chatModal = null;
    var chatOverlay = null;
    var currentPartnerId = 0;
    var chatPollTimer = null;

    function showPrivateChatModal(partnerId, partnerName) {
        currentPartnerId = partnerId;

        if (!chatModal) {
            chatOverlay = document.createElement('div');
            chatOverlay.className = 'pc-overlay';
            chatOverlay.style.cssText = 'position:fixed;inset:0;z-index:99997;background:rgba(0,0,0,0.35);opacity:0;transition:opacity 0.2s;';
            document.body.appendChild(chatOverlay);
            chatOverlay.addEventListener('click', closePrivateChat);

            chatModal = document.createElement('div');
            chatModal.className = 'pc-modal';
            chatModal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.9);width:420px;max-width:92vw;height:560px;max-height:80vh;z-index:99999;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.18);display:flex;flex-direction:column;overflow:hidden;opacity:0;transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1);';
            document.body.appendChild(chatModal);
        }

        // 加载消息
        chatModal.innerHTML = '<div class="pc-header" style="padding:14px 18px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">'
            + '<span style="font-weight:600;font-size:15px;">✉️ 与 ' + escHtml(partnerName) + '</span>'
            + '<button onclick="closePrivateChat()" style="background:none;border:none;font-size:18px;cursor:pointer;color:#999;padding:4px;">✕</button>'
            + '</div>'
            + '<div class="pc-messages" id="pcMessages" style="flex:1;overflow-y:auto;padding:14px 18px;background:#f8f8fa;"></div>'
            + '<div class="pc-input-area" style="padding:10px 14px;border-top:1px solid #f0f0f0;display:flex;gap:8px;flex-shrink:0;">'
            + '<input type="text" id="pcInput" placeholder="输入消息..." style="flex:1;border:1px solid #e0e0e0;border-radius:20px;padding:8px 14px;font-size:13px;outline:none;" onkeydown="if(event.key===\'return\'||event.key===\'Enter\')sendPrivateMsg()">'
            + '<button onclick="sendPrivateMsg()" style="background:#FF6B8B;color:#fff;border:none;border-radius:20px;padding:8px 18px;font-size:13px;cursor:pointer;flex-shrink:0;">发送</button>'
            + '</div>';

        chatOverlay.style.opacity = '1';
        chatModal.style.opacity = '1';
        chatModal.style.transform = 'translate(-50%,-50%) scale(1)';

        loadPrivateMessages();

        // 轮询新消息
        clearInterval(chatPollTimer);
        chatPollTimer = setInterval(loadPrivateMessages, 5000);

        // 聚焦输入框
        setTimeout(function() {
            var input = document.getElementById('pcInput');
            if (input) input.focus();
        }, 300);
    }

    function loadPrivateMessages() {
        var msgContainer = document.getElementById('pcMessages');
        if (!msgContainer) return;

        var fd = new URLSearchParams();
        fd.append('action', 'messages');
        fd.append('partner_id', currentPartnerId);
        fd.append('limit', 50);

        fetch(MSG_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString(),
            credentials: 'same-origin'
        })
        .then(function(r) { return r.json(); })
        .then(function(res) {
            if (res.code === 0 && res.data && res.data.messages) {
                renderPrivateMessages(res.data.messages);
                var read = new URLSearchParams();
                read.append('action', 'read');
                read.append('peer_id', currentPartnerId);
                read.append('csrf_token', (window.__ucCurrentUser || {}).csrf_token || window.__userCsrfToken || '');
                fetch(MSG_API, { method:'POST', body:read, credentials:'same-origin' }).catch(function() {});
            }
        })
        .catch(function() {});
    }

    function renderPrivateMessages(msgs) {
        var container = document.getElementById('pcMessages');
        if (!container) return;

        var html = '';
        msgs.forEach(function(m) {
            html += '<div class="pc-msg ' + (m.is_me ? 'pc-msg-me' : 'pc-msg-other') + '" style="display:flex;' + (m.is_me ? 'justify-content:flex-end' : 'justify-content:flex-start') + ';margin-bottom:10px;">'
                + '<div style="max-width:75%;padding:9px 14px;border-radius:' + (m.is_me ? '16px 4px 16px 16px' : '4px 16px 16px 16px') + ';background:' + (m.is_me ? '#FF6B8B' : '#fff') + ';color:' + (m.is_me ? '#fff' : '#333') + ';font-size:13px;line-height:1.5;box-shadow:0 1px 3px rgba(0,0,0,0.06);word-break:break-word;">'
                + escHtml(m.content)
                + '<div style="font-size:10px;opacity:0.6;margin-top:4px;text-align:right;">' + (m.created_at ? m.created_at.substring(11, 16) : '') + '</div>'
                + '</div></div>';
        });

        container.innerHTML = html || '<div style="text-align:center;color:#bbb;padding:40px 0;font-size:13px;">暂无消息，发送第一条吧~</div>';
        container.scrollTop = container.scrollHeight;
    }

    window.sendPrivateMsg = function() {
        var input = document.getElementById('pcInput');
        if (!input) return;
        var content = input.value.trim();
        if (!content) return;

        var fd = new URLSearchParams();
        fd.append('action', 'send');
        fd.append('to_uid', currentPartnerId);
        fd.append('content', content);
        fd.append('csrf_token', (window.__ucCurrentUser || {}).csrf_token || window.__userCsrfToken || '');

        fetch(MSG_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString(),
            credentials: 'same-origin'
        })
        .then(function(r) { return r.json(); })
        .then(function(res) {
            if (res.code === 0) {
                input.value = '';
                loadPrivateMessages();
            } else {
                showToast(res.msg || '发送失败');
            }
        })
        .catch(function() { showToast('网络错误'); });
    };

    window.closePrivateChat = function() {
        clearInterval(chatPollTimer);
        if (chatOverlay) chatOverlay.style.opacity = '0';
        if (chatModal) {
            chatModal.style.opacity = '0';
            chatModal.style.transform = 'translate(-50%,-50%) scale(0.9)';
        }
    };

})();

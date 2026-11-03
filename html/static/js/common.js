/**
 * 共用JS - 提取自各HTML页面
 */

// ===== 统一 Toast 提示（右上角，粉色主题） =====
(function() {
    // toastr 全局配置
    function initToastr() {
        if (typeof toastr === 'undefined') return;
        toastr.options = {
            positionClass: 'toast-top-right',
            timeOut: 2500,
            extendedTimeOut: 1000,
            closeButton: false,
            debug: false,
            progressBar: true,
            preventDuplicates: true,
            newestOnTop: true,
            showEasing: 'swing',
            hideEasing: 'linear',
            showMethod: 'fadeIn',
            hideMethod: 'fadeOut',
            showDuration: 300,
            hideDuration: 300
        };
    }

    // 页面加载后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToastr);
    } else {
        initToastr();
    }
})();

/**
 * 全局 showToast — 所有页面统一使用
 * @param {string} text 提示文字
 * @param {string} type 类型：'success'|'error'|'warning'|'info'，默认 'success'
 */
function showToast(text, type) {
    type = type || 'success';
    if (typeof toastr !== 'undefined') {
        toastr[type](text);
        return;
    }
    // toastr 不可用时的 fallback
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:12px;right:12px;background:rgba(255,107,139,0.95);color:#fff;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:500;z-index:999999;box-shadow:0 4px 16px rgba(255,107,139,0.3);animation:_toastIn .3s ease;max-width:320px;word-break:break-word;';
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity .3s';
        setTimeout(function() { toast.remove(); }, 300);
    }, 2500);
}

// Toast 动画注入
(function() {
    if (document.getElementById('_toastKeyframes')) return;
    var s = document.createElement('style');
    s.id = '_toastKeyframes';
    s.textContent = '@keyframes _toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}';
    document.head.appendChild(s);
})();

// 三击跳转
let clickCount = 0;
let lastClickTime = 0;
function handleTripleClick() {
    const currentTime = new Date().getTime();
    if (currentTime - lastClickTime > 300) {
        clickCount = 0;
    }
    clickCount++;
    lastClickTime = currentTime;
    if (clickCount === 3) {
        window.location.href = "/admin/";
    }
}

// 计算恋爱时间（新版 - 替代旧版 show_date_time）
function updateLoveTime() {
    var _date = window.__TOGETHER_DATE__ || '2025-02-14';
    var _time = window.__TOGETHER_TIME__ || '23:35';
    const startTime = new Date(_date + 'T' + _time + ':00').getTime();
    const now = new Date().getTime();
    const diff = now - startTime;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const tianEl = document.getElementById('tian');
    const shiEl = document.getElementById('shi');
    const fenEl = document.getElementById('fen');
    const miaoEl = document.getElementById('miao');

    if (tianEl) tianEl.textContent = days;
    if (shiEl) shiEl.textContent = hours;
    if (fenEl) fenEl.textContent = minutes;
    if (miaoEl) miaoEl.textContent = seconds < 10 ? '0' + seconds : seconds;
}

// 每秒更新一次时间（保存定时器ID，PJAX切换时可清理）
updateLoveTime();
var _loveTimeInterval = setInterval(updateLoveTime, 1000);

// ===== 全局工具函数 =====

/**
 * HTML 转义 - 委托给 App.utils
 * 所有 innerHTML 拼接处必须使用此函数
 */
function escapeHtml(str) {
    return App.utils.escapeHtml(str);
}

/**
 * 相对时间格式化 - 委托给 App.utils
 * @param {number|string} timestamp - Unix 时间戳（秒）或日期字符串
 * @returns {string} 如 "刚刚"、"5分钟前"、"2小时前"、"3天前"
 */
function formatRelativeTime(timestamp) {
    return App.utils.formatRelativeTime(timestamp);
}

/**
 * 头像颜色 - 委托给 App.utils
 */
var AVATAR_COLORS = App.utils.AVATAR_COLORS;

function getAvatarColor(name) {
    return App.utils.getAvatarColor(name);
}

// ===== 通用上传遮罩 + 进度条（全站共用） =====
// 用于"先上传图片到图床再提交"的场景，避免用户感觉卡顿。
// 用法：showUploadOverlay('正在发送') → setUploadProgress(50,'正在上传图片…','2/5') → hideUploadOverlay()
(function() {
    var ov = null;
    function ensureOverlay() {
        if (ov && document.getElementById('uploadOverlay')) return ov;
        ov = document.getElementById('uploadOverlay');
        if (ov) return ov;
        ov = document.createElement('div');
        ov.id = 'uploadOverlay';
        ov.style.cssText =
            'position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;' +
            'background:rgba(0,0,0,.55);';
        ov.innerHTML =
            '<div style="width:min(320px,86vw);padding:26px 22px;border-radius:14px;background:#fff;text-align:center;' +
            'box-shadow:0 12px 40px rgba(0,0,0,.3);">' +
            '<div id="uploadOvTitle" style="font-weight:700;margin-bottom:16px;">正在发送</div>' +
            '<div style="height:10px;border-radius:999px;overflow:hidden;background:rgba(0,0,0,.1);">' +
            '<div id="uploadOvBar" style="height:100%;width:0%;border-radius:999px;background:var(--gradient,linear-gradient(90deg,#f06,#f96));transition:width .3s;"></div>' +
            '</div>' +
            '<div id="uploadOvPercent" style="font-size:13px;margin-top:8px;color:#888;">0%</div>' +
            '<div id="uploadOvStatus" style="font-size:14px;margin-top:14px;font-weight:600;color:#444;">正在上传图片…</div>' +
            '<div id="uploadOvSub" style="font-size:12px;margin-top:6px;color:#999;"></div>' +
            '</div>';
        document.body.appendChild(ov);
        return ov;
    }
    window.showUploadOverlay = function(title) {
        var o = ensureOverlay();
        if (title) o.querySelector('#uploadOvTitle').textContent = title;
        o.querySelector('#uploadOvBar').style.width = '0%';
        o.querySelector('#uploadOvPercent').textContent = '0%';
        o.querySelector('#uploadOvStatus').textContent = '正在上传图片…';
        o.querySelector('#uploadOvSub').textContent = '';
        o.style.display = 'flex';
    };
    window.setUploadProgress = function(pct, status, sub) {
        var o = ensureOverlay();
        pct = Math.max(0, Math.min(100, pct));
        o.querySelector('#uploadOvBar').style.width = pct + '%';
        o.querySelector('#uploadOvPercent').textContent = Math.round(pct) + '%';
        if (status) o.querySelector('#uploadOvStatus').textContent = status;
        if (typeof sub !== 'undefined') o.querySelector('#uploadOvSub').textContent = sub || '';
    };
    window.hideUploadOverlay = function() {
        if (ov && ov.style) ov.style.display = 'none';
    };
})();

// 向下滚动提示 - 跳动爱心引导线
(function() {
    var hint = document.getElementById('scrollHint');
    if (!hint) return;
    var hidden = false;
    function hideHint() {
        if (hidden) return;
        hidden = true;
        hint.classList.add('fade-out');
        setTimeout(function() { if (hint.parentNode) hint.parentNode.removeChild(hint); }, 800);
    }
    // 用户滚动时隐藏
    window.addEventListener('scroll', function onScroll() {
        if (window.scrollY > 80) { hideHint(); window.removeEventListener('scroll', onScroll); }
    });
    // 10秒后自动隐藏
    setTimeout(hideHint, 10000);
    // 点击滚动到内容区
    hint.addEventListener('click', function() {
        var target = document.querySelector('.section, .posts-section, .index-section, main > div:not(.fade-hearts-showcase)');
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
        }
    });
})();

/**
 * 统一图片上传函数
 * 
 * 使用方式：
 *   uploadImage(file, 'avatar').then(function(url) { ... });
 *   uploadImage(file, 'comment').then(function(url) { ... });
 * 
 * @param {File} file - 文件对象（来自 input.files[0]）
 * @param {string} type - 上传类型：avatar / comment / moment / general
 * @param {object} [opts] - 可选配置
 * @param {number} [opts.maxSize] - 最大字节数（前端预校验，默认 5MB）
 * @param {string} [opts.csrfToken] - CSRF token（moment类型必须）
 * @returns {Promise<string>} 图片相对URL
 */
function uploadImage(file, type, opts) {
    opts = opts || {};
    type = type || 'general';
    var maxSize = opts.maxSize || 5 * 1024 * 1024;

    return new Promise(function(resolve, reject) {
        if (!file) { reject('未选择文件'); return; }
        if (!/^image\/(jpeg|png|gif|webp)$/.test(file.type)) {
            reject('仅支持 JPG/PNG/GIF/WebP 格式'); return;
        }
        if (file.size > maxSize) {
            var maxMB = Math.round(maxSize / 1024 / 1024 * 10) / 10;
            reject('图片不能超过' + maxMB + 'MB'); return;
        }

        var fd = new FormData();
        fd.append('file', file);
        fd.append('type', type);
        var token = opts.csrfToken || window.__userCsrfToken || (document.querySelector('[data-csrf-token]') || {}).dataset?.csrfToken || '';
        if (token) fd.append('csrf_token', token);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'api/upload_image.php', true);
        if (opts.csrfToken) xhr.setRequestHeader('X-CSRF-TOKEN', opts.csrfToken);

        xhr.onload = function() {
            // 检查 HTTP 状态码
            if (xhr.status >= 400) {
                reject('服务器错误 (' + xhr.status + ')');
                return;
            }
            try {
                var res = JSON.parse(xhr.responseText);
                if (res.code === 0 && res.data && res.data.url) {
                    resolve(res.data.url);
                } else {
                    reject(res.msg || '上传失败');
                }
            } catch (e) {
                // 响应不是 JSON（可能是 PHP 错误页面）
                var snippet = (xhr.responseText || '').substring(0, 80);
                console.error('[上传错误] 响应不是JSON:', snippet);
                reject('上传失败，请检查控制台');
            }
        };
        xhr.onerror = function() { reject('网络错误'); };
        xhr.send(fd);
    });
}

// 登录状态检查：更新右上角 UI（所有页面通用）
(function() {
    fetch('api/user_api.php?action=info', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(res) {
            if (res.code === 0 && res.data && res.data.logged_in) {
                var nick = res.data.nickname || '博主';
                window.__userCsrfToken = res.data.csrf_token;
                document.querySelectorAll('.header-user-name').forEach(function(el) { el.textContent = nick; });
                var headerUser = document.getElementById('headerUser');
                if (headerUser) headerUser.classList.remove('header-user--guest');
                document.querySelectorAll('.header-user-avatar').forEach(function(el) {
                    el.classList.remove('header-guest-icon');
                    el.textContent = '';
                    var image = document.createElement('img');
                    image.src = res.data.avatar || '/uploads/demo/avatar_boy.jpg';
                    image.alt = '用户头像';
                    image.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
                    el.appendChild(image);
                });
                var menu = document.querySelector('#userDropdown .user-dropdown-menu');
                if (menu) {
                    menu.textContent = '';
                    {
                        var adminLink = document.createElement('a');
                        adminLink.className = 'dropdown-item';
                        adminLink.href = '/admin/';
                        adminLink.textContent = res.data.can_manage_content ? '后台管理' : '账户管理';
                        menu.appendChild(adminLink);
                    }
                    var logoutButton = document.createElement('button');
                    logoutButton.className = 'dropdown-item';
                    logoutButton.textContent = '退出登录';
                    logoutButton.onclick = function(event) {
                        event.stopPropagation();
                        var body = new FormData();
                        body.append('action', 'logout');
                        body.append('csrf_token', window.__userCsrfToken);
                        fetch('/api/user_api.php', { method: 'POST', body: body }).then(function(r) { return r.json(); }).then(function(result) {
                            if (result.code === 0) location.reload();
                            else showToast(result.msg || '退出失败', 'error');
                        }).catch(function() { showToast('网络错误，请重试', 'error'); });
                    };
                    menu.appendChild(logoutButton);
                }
                document.querySelectorAll('.header-user-guest-badge').forEach(function(el) {
                    el.textContent = res.data.is_admin ? '博主' : '用户';
                    el.style.background = '#ff6b81';
                    el.style.color = '#fff';
                });
            }
        })
        .catch(function() {});
})();

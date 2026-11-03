/* 动态卡片交互 — 统一入口
 * 点击卡片内容/照片区域弹出悬浮详情卡片
 * 点击弹窗内图片进入单图浏览模式
 * 点赞对接 API（无需登录）
 * 评论功能（需登录，弹窗下方评论区）
 */

// 全局登录状态
var _momentLoggedIn = false;
var _momentUserInfo = null;
var _momentCsrfToken = '';
if (window.__disposeMomentPage) window.__disposeMomentPage();
window.__disposeMomentPage = (function (refresh, initialize, pickImage) {
    return function () {
        document.removeEventListener('pjax:ready', refresh);
        window.removeEventListener('focus', refresh);
        document.removeEventListener('DOMContentLoaded', initialize);
        document.removeEventListener('pjax:ready', initialize);
        document.removeEventListener('change', pickImage);
    };
})(refreshMomentUser, initCardInteraction, handleMomentCommentImage);

// 读取前端上传 CSRF 令牌（用于评论图片上传到 SaaS）
(function () {
    var csrfEl = document.getElementById('momentCsrfToken');
    if (csrfEl) _momentCsrfToken = csrfEl.textContent.trim() || '';
})();

// Refresh identity after PJAX navigation and returning from the admin tab.
function refreshMomentUser() {
    fetch('api/user_api.php?action=info', { method: 'GET' })
        .then(function (r) { return r.json(); })
        .then(function (res) {
            if (res.code === 0 && res.data) {
                _momentLoggedIn = !!res.data.logged_in;
                _momentUserInfo = res.data;
                _momentCsrfToken = res.data.csrf_token || '';
                var liked = {};
                (res.data.liked_moments || []).forEach(function (id) {
                    id = parseInt(id, 10);
                    if (isNaN(id)) return;
                    liked[id] = true;
                    if (id >= 1000000) liked['photo_' + (id - 1000000)] = true;
                });
                document.querySelectorAll('.moment-card[data-moment-id]').forEach(function (card) {
                    var button = card.querySelector('.moment-like-btn');
                    if (!button) return;
                    var isLiked = !!liked[card.dataset.momentId];
                    button.classList.toggle('liked', isLiked);
                    var icon = button.querySelector('.like-icon');
                    if (icon) icon.textContent = isLiked ? '♥' : '♡';
                });
            }
        })
        .catch(function () {});
}
refreshMomentUser();
document.addEventListener('pjax:ready', refreshMomentUser);
window.addEventListener('focus', refreshMomentUser);

document.addEventListener('DOMContentLoaded', initCardInteraction);
// 关键：PJAX 无刷新切换回相册页后，新渲染的卡片是全新 DOM 节点，
// 原生 DOMContentLoaded 不会再次触发，必须用 pjax:ready 重新初始化/绑定。
document.addEventListener('pjax:ready', initCardInteraction);

function initCardInteraction() {
    // 事件委托：只在 document 上绑定一次持久监听器，
    // 对所有现在/未来的 .moment-card（含 PJAX 渲染）都生效，天然跨导航。
    if (window.__momentCardDelegated) return;
    window.__momentCardDelegated = true;

    document.addEventListener('click', function (e) {
        var card = e.target.closest('.moment-card');
        if (!card) return;

        // 不拦截底部操作按钮（它们自带 onclick）
        if (e.target.closest('.moment-footer')) return;

        // 只有点击内容或照片区域才触发弹窗
        var isContent = e.target.closest('.moment-content');
        var isImages = e.target.closest('.moment-images');
        if (!isContent && !isImages) return;

        openMomentPopup(card);
    });
}

// ========== 卡片点赞（无需登录，不可取消） ==========

function toggleLike(btn) {
    var card = btn.closest('.moment-card');
    var momentId = card ? card.dataset.momentId : '';
    if (!momentId) return;

    // 已点赞 → 提示不可重复
    if (btn.classList.contains('liked')) {
        showToast('您已点赞 ♥', 'warning');
        return;
    }

    var iconSpan = btn.querySelector('.like-icon');
    var countSpan = btn.querySelector('.like-count');
    var currentCount = parseInt(countSpan.textContent) || 0;

    // 乐观更新
    btn.classList.add('liked');
    iconSpan.textContent = '♥';
    countSpan.textContent = currentCount + 1;
    btn.style.transform = 'scale(1.15)';
    setTimeout(function () { btn.style.transform = ''; }, 200);

    // 发送 API
    var data = new FormData();
    data.append('action', 'like');
    data.append('moment_id', momentId);

    fetch('api/moment_api.php', { method: 'POST', body: data })
        .then(function (r) { return r.json(); })
        .then(function (res) {
            if (res.code === 0 && res.data) {
                countSpan.textContent = res.data.likes;
                if (_momentUserInfo && res.data.liked) rememberMomentLike(momentId);
                if (res.data.liked) {
                    btn.classList.add('liked');
                    iconSpan.textContent = '♥';
                } else {
                    btn.classList.remove('liked');
                    iconSpan.textContent = '♡';
                }
            } else {
                // 回滚
                btn.classList.remove('liked');
                iconSpan.textContent = '♡';
                countSpan.textContent = currentCount;
            }
        })
        .catch(function () {
            // 回滚
            btn.classList.remove('liked');
            iconSpan.textContent = '♡';
            countSpan.textContent = currentCount;
        });
}

// ========== 弹窗核心 ==========

// ===== 独立全屏层查看大图（带左右切换/页码/点击关闭） =====
function mpFsEnsureStyle() {
    if (document.getElementById('mp-fullscreen-style')) return;
    var s = document.createElement('style');
    s.id = 'mp-fullscreen-style';
    s.textContent =
        '#mp-fullscreen{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.92);}'
        + '#mp-fullscreen.on{display:flex;animation:mpFsFade .2s ease;}'
        + '@keyframes mpFsFade{from{opacity:0}to{opacity:1}}'
        + '.mp-fs-close{position:absolute;top:16px;right:16px;z-index:2;width:40px;height:40px;border:none;background:rgba(255,255,255,.15);color:#fff;font-size:22px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}'
        + '.mp-fs-close:hover{background:rgba(255,255,255,.3);}'
        + '.mp-fs-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:2;width:44px;height:44px;border:none;background:rgba(255,255,255,.15);color:#fff;font-size:28px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}'
        + '.mp-fs-nav:hover{background:rgba(255,255,255,.3);}'
        + '.mp-fs-nav.prev{left:16px;}'
        + '.mp-fs-nav.next{right:16px;}'
        + '.mp-fs-nav.hidden{display:none;}'
        + '.mp-fs-image{max-width:92vw;max-height:88vh;object-fit:contain;border-radius:8px;transition:opacity .15s;}'
        + '.mp-fs-counter{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);padding:5px 14px;background:rgba(0,0,0,.5);color:#fff;font-size:13px;border-radius:12px;}';
    document.head.appendChild(s);
}

function mpFullscreenShow(idx) {
    var data = window.__mpFsData || [];
    if (data.length === 0) return;
    mpFsEnsureStyle();

    var el = document.getElementById('mp-fullscreen');
    if (el) el.remove();

    el = document.createElement('div');
    el.id = 'mp-fullscreen';
    el.innerHTML =
        '<button class="mp-fs-close" onclick="mpFullscreenClose()">✕</button>'
        + '<button class="mp-fs-nav prev" onclick="mpFullscreenNav(-1)">‹</button>'
        + '<img class="mp-fs-image" src="" alt="">'
        + '<button class="mp-fs-nav next" onclick="mpFullscreenNav(1)">›</button>'
        + '<div class="mp-fs-counter"></div>';
    // 点击背景关闭
    el.addEventListener('click', function (e) {
        if (e.target === el) mpFullscreenClose();
    });
    // 触摸滑动切换图片（移动端）
    var fsTouchStart = 0;
    el.addEventListener('touchstart', function (e) {
        fsTouchStart = e.changedTouches[0].screenX;
    });
    el.addEventListener('touchend', function (e) {
        var diff = fsTouchStart - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 50) {
            mpFullscreenNav(diff > 0 ? 1 : -1);
        }
    });
    document.body.appendChild(el);

    window.__mpFsIndex = Math.max(0, Math.min(idx, data.length - 1));
    mpFullscreenRender();
    document.body.style.overflow = 'hidden';
    el.classList.add('on');
}

// 单张图片全屏层（无左右切换/页码），用于评论图片等单图查看
function mpFullscreenShowSingle(src) {
    if (!src) return;
    mpFsEnsureStyle();

    var el = document.getElementById('mp-fullscreen');
    if (el) el.remove();

    el = document.createElement('div');
    el.id = 'mp-fullscreen';
    el.innerHTML =
        '<button class="mp-fs-close" onclick="mpFullscreenClose()">✕</button>'
        + '<img class="mp-fs-image" src="" alt="">';
    // 点击背景关闭
    el.addEventListener('click', function (e) {
        if (e.target === el) mpFullscreenClose();
    });
    document.body.appendChild(el);

    var img = el.querySelector('.mp-fs-image');
    img.setAttribute('data-lazy-skip', '1');
    img.src = src;
    document.body.style.overflow = 'hidden';
    el.classList.add('on');
}

function mpFullscreenRender() {
    var el = document.getElementById('mp-fullscreen');
    if (!el) return;
    var data = window.__mpFsData || [];
    var idx = window.__mpFsIndex || 0;
    var img = el.querySelector('.mp-fs-image');
    var counter = el.querySelector('.mp-fs-counter');
    var prevBtn = el.querySelector('.mp-fs-nav.prev');
    var nextBtn = el.querySelector('.mp-fs-nav.next');

    img.setAttribute('data-lazy-skip', '1');  // 避免被懒加载引擎包裹隐藏
    img.style.opacity = '0';
    setTimeout(function () {
        img.src = data[idx].src;
        img.alt = data[idx].alt || '';
        img.style.opacity = '1';
    }, 120);

    counter.textContent = (idx + 1) + ' / ' + data.length;
    prevBtn.classList.toggle('hidden', data.length <= 1);
    nextBtn.classList.toggle('hidden', data.length <= 1);
}

function mpFullscreenNav(dir) {
    var data = window.__mpFsData || [];
    if (data.length === 0) return;
    var idx = window.__mpFsIndex || 0;
    idx = (idx + dir + data.length) % data.length;
    window.__mpFsIndex = idx;
    mpFullscreenRender();
}

function mpFullscreenClose() {
    var el = document.getElementById('mp-fullscreen');
    if (el) el.remove();
    window.__mpFsData = null;
    window.__mpFsIndex = 0;
    document.body.style.overflow = document.getElementById('moment-popup') ? 'hidden' : '';
}

function openMomentPopup(card) {
    var header = card.querySelector('.moment-header');
    var content = card.querySelector('.moment-content');
    var footer = card.querySelector('.moment-footer');
    var imageGrid = card.querySelector('.moment-images-grid');
    var momentId = card.dataset.momentId || '';
    var likedId = String(momentId).indexOf('photo_') === 0 ? 1000000 + Number(String(momentId).slice(6)) : Number(momentId);
    if (((_momentUserInfo || {}).liked_moments || []).some(function(id) { return Number(id) === likedId; })) {
        var knownButton = card.querySelector('.moment-like-btn');
        if (knownButton) knownButton.classList.add('liked');
    }

    // 提取头部信息
    var dateDay = header.querySelector('.date-day').textContent;
    var dateYear = header.querySelector('.date-year').textContent;
    var weatherIcon = (header.querySelector('.weather-icon') || {}).textContent || '';
    var weatherText = (header.querySelector('.moment-weather span:last-child') || {}).textContent || '';
    var location = (header.querySelector('.moment-location') || {}).textContent || '';

    // 提取文案（保留换行）
    var text = '';
    if (content) {
        var textEl = content.querySelector('.moment-text');
        if (textEl) text = textEl.innerHTML;
    }

    // 提取头像/性别信息
    var avatarSrc = '', genderClass = '', genderIcon = '';
    var authorId = parseInt(card.dataset.authorId) || 0;
    if (footer) {
        var avatar = footer.querySelector('.moment-avatar');
        if (avatar) avatarSrc = avatar.src || avatar.getAttribute('data-src') || '';
        var gender = footer.querySelector('.moment-gender');
        if (gender) {
            genderClass = gender.classList.contains('male') ? 'male' : 'female';
            genderIcon = gender.textContent;
        }
    }

    // 提取点赞信息
    var likeCount = 0;
    var isLiked = false;
    var likeBtn = card.querySelector('.moment-like-btn');
    if (likeBtn) {
        likeCount = parseInt(likeBtn.querySelector('.like-count').textContent) || 0;
        isLiked = likeBtn.classList.contains('liked');
    }

    // 收集图片
    var imageData = [];
    if (imageGrid) {
        var images = imageGrid.querySelectorAll('img');
        images.forEach(function (img) {
            imageData.push({
                src: img.src || img.getAttribute('data-src') || '',
                alt: img.alt || ''
            });
        });
    }

    // 创建弹窗
    var popup = document.getElementById('moment-popup');
    if (popup) popup.remove();

    popup = document.createElement('div');
    popup.id = 'moment-popup';
    popup.dataset.momentId = momentId;
    document.body.appendChild(popup);

    // 生成图片HTML
    var imagesHTML = '';
    if (imageData.length > 0) {
        var colStyle = 'repeat(3, 1fr)';
        if (imageData.length === 1) colStyle = '1fr';
        else if (imageData.length === 2) colStyle = 'repeat(2, 1fr)';
        else if (imageData.length === 4) colStyle = 'repeat(2, 1fr)';

        var imgsHTML = '';
        imageData.forEach(function (img, idx) {
            imgsHTML += '<div class="img-loader-wrap"><span class="img-loader-spinner"></span><span class="img-lost-icon"><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></span><img src="' + escHtml(img.src) + '" alt="' + escHtml(img.alt) + '" data-index="' + idx + '" onload="this.parentNode.classList.add(\'img-loaded\')" onerror="this.parentNode.classList.add(\'img-error\')"></div>';
        });

        imagesHTML = '<div class="mp-images">'
            + '<div class="mp-images-grid" style="grid-template-columns: ' + colStyle + '">' + imgsHTML + '</div>'
            + '</div>';
    }

    var likeIcon = isLiked ? '♥' : '♡';
    var likedClass = isLiked ? ' liked' : '';

    popup.innerHTML = '<div class="mp-overlay"></div>'
        + '<div class="mp-card">'
        + '<button class="mp-close"><svg class="iconfont icon-guanbi" aria-hidden="true"><use href="#icon-guanbi" xlink:href="#icon-guanbi"></use></svg></button>'
        // ===== 可滚动区域 =====
        + '<div class="mp-scroll-body">'
        + '<div class="mp-header">'
        + '<div class="mp-time"><div class="mp-date-day">' + dateDay + '</div><div class="mp-date-year">' + dateYear + '</div></div>'
        + '<div class="mp-meta">'
        + '<div class="mp-weather"><span class="mp-weather-icon">' + escHtml(weatherIcon) + '</span><span>' + escHtml(weatherText) + '</span></div>'
        + (location ? '<div class="mp-location">📍 ' + escHtml(location) + '</div>' : '')
        + '</div></div>'
        + imagesHTML
        + (text ? '<div class="mp-content"><p class="mp-text">' + text + '</p></div>' : '')
        + '<div class="mp-footer">'
        + '<div class="mp-user">'
        + (avatarSrc ? '<img src="' + avatarSrc + '" class="mp-avatar"' + (authorId > 0 ? ' onclick="showUserCard(' + authorId + ', event)" style="cursor:pointer"' : '') + '>' : '')
        + (genderIcon ? '<span class="mp-gender ' + genderClass + '">' + genderIcon + '</span>' : '')
        + '</div>'
        + '<button class="mp-like-btn' + likedClass + '" onclick="mpToggleLike(this)">'
        + '<span class="mp-like-icon">' + likeIcon + '</span>'
        + '<span class="mp-like-count">' + likeCount + '</span>'
        + '</button></div>'
        // ===== 评论区 =====
        + '<div class="mp-comments-section">'
        + '<div class="mp-comments-header"><span class="mp-comments-title">评论</span><span class="mp-comments-count"></span></div>'
        + '<div class="mp-comments-list"></div>'
        + '</div>'
        + '</div>'
        // ===== 固定底部输入栏 =====
        + '<div class="mp-comment-input-area">'
        + '<div class="mp-comment-img-preview" id="mpCommentImgPreview" style="display:none">'
        + '<img id="mpCommentImgThumb" src="" alt="">'
        + '<span class="mp-comment-img-remove" onclick="mpRemoveCommentImg()">×</span>'
        + '</div>'
        + '<div class="mp-comment-input-wrapper">'
        + '<button class="mp-comment-img-btn" onclick="mpPickCommentImg()" title="添加图片"><svg class="iconfont icon-xiangce" aria-hidden="true"><use href="#icon-xiangce" xlink:href="#icon-xiangce"></use></svg></button>'
        + '<input type="file" id="mpCommentImgInput" accept="image/*" style="display:none">'
        + '<input type="text" class="mp-comment-input" placeholder="写评论..." maxlength="500">'
        + '<button class="mp-comment-send-btn" onclick="mpSubmitComment()">发送</button>'
        + '</div>'
        + '</div>'
        + '</div>';

    // 注入样式（只注入一次）
    if (!document.getElementById('moment-popup-style')) {
        var style = document.createElement('style');
        style.id = 'moment-popup-style';
        style.textContent = getMomentPopupCSS();
        document.head.appendChild(style);
    }

    // 显示弹窗
    requestAnimationFrame(function () {
        popup.classList.add('active');
    });
    document.body.style.overflow = 'hidden';

    // ---- 弹窗内交互 ----

    // 网格图片点击 → 弹出独立全屏层查看大图（带左右切换/页码/点击关闭）
    var gridImages = popup.querySelectorAll('.mp-images-grid img');
    gridImages.forEach(function (img, idx) {
        img.addEventListener('click', function (e) {
            e.stopPropagation();
            // 记录当前弹窗的图片集，供全屏层切换使用
            window.__mpFsData = imageData;
            window.__mpFsIndex = idx;
            mpFullscreenShow(idx);
        });
    });

    // 弹窗内点赞（不可取消）
    window.mpToggleLike = function (btn) {
        var mid = popup.dataset.momentId || '';

        // 已点赞 → 提示不可重复
        if (btn.classList.contains('liked')) {
            showToast('您已点赞 ♥', 'warning');
            return;
        }

        var iconSpan = btn.querySelector('.mp-like-icon');
        var countSpan = btn.querySelector('.mp-like-count');
        var count = parseInt(countSpan.textContent) || 0;

        // 乐观更新
        btn.classList.add('liked');
        iconSpan.textContent = '♥';
        count += 1;
        btn.style.transform = 'scale(1.15)';
        setTimeout(function () { btn.style.transform = ''; }, 200);
        countSpan.textContent = count;

        // 同步卡片上的点赞
        var cardLikeBtn = document.querySelector('.moment-card[data-moment-id="' + mid + '"] .moment-like-btn');
        if (cardLikeBtn) {
            var cardIcon = cardLikeBtn.querySelector('.like-icon');
            var cardCount = cardLikeBtn.querySelector('.like-count');
            cardIcon.textContent = '♥';
            cardCount.textContent = count;
            cardLikeBtn.classList.add('liked');
        }

        // 发送 API
        var data = new FormData();
        data.append('action', 'like');
        data.append('moment_id', mid);

        fetch('api/moment_api.php', { method: 'POST', body: data })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res.code !== 0 || !res.data) throw new Error(res.msg || '点赞失败');
                if (res.code === 0 && res.data) {
                    if (_momentUserInfo) rememberMomentLike(mid);
                    countSpan.textContent = res.data.likes;
                    if (cardLikeBtn) {
                        var cC = cardLikeBtn.querySelector('.like-count');
                        cC.textContent = res.data.likes;
                    }
                }
            }).catch(function () {
                btn.classList.remove('liked');
                iconSpan.textContent = '♡';
                countSpan.textContent = count - 1;
                if (cardLikeBtn) {
                    cardLikeBtn.classList.remove('liked');
                    cardLikeBtn.querySelector('.like-icon').textContent = '♡';
                    cardLikeBtn.querySelector('.like-count').textContent = count - 1;
                }
                showToast('点赞失败，请重试', 'error');
            });
    };

    // ---- 评论区 ----
    loadComments(momentId);

    // 评论输入框回车发送
    var commentInput = popup.querySelector('.mp-comment-input');
    commentInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            mpSubmitComment();
        }
    });

    // 点击评论输入框时检查登录
    commentInput.addEventListener('focus', function () {
        if (!_momentLoggedIn) {
            this.blur();
            showToast('请登录后评论~', 'warning');
            closePopup();
            setTimeout(function () {
                showAuthCard('login');
            }, 350);
        }
    });

    // 关闭弹窗
    function closePopup() {
        popup.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(function () { popup.remove(); }, 300);
    }

    popup.querySelector('.mp-close').addEventListener('click', closePopup);
    popup.querySelector('.mp-overlay').addEventListener('click', closePopup);

    document.addEventListener('keydown', function handler(e) {
        if (!document.getElementById('moment-popup')) {
            document.removeEventListener('keydown', handler);
            return;
        }
        if (e.key === 'Escape') {
            // 优先关闭全屏层，其次关闭弹窗
            if (document.getElementById('mp-fullscreen')) { mpFullscreenClose(); return; }
            closePopup();
        }
        // 全屏层打开时，方向键切换图片
        if (document.getElementById('mp-fullscreen')) {
            if (e.key === 'ArrowLeft') mpFullscreenNav(-1);
            if (e.key === 'ArrowRight') mpFullscreenNav(1);
        }
    });
}

// ========== 评论功能 ==========

function loadComments(momentId) {
    var popup = document.getElementById('moment-popup');
    if (!popup) return;

    var listEl = popup.querySelector('.mp-comments-list');
    var countEl = popup.querySelector('.mp-comments-count');
    listEl.innerHTML = '<div class="mp-comments-loading">加载中...</div>';

    fetch('api/moment_api.php?action=comments&moment_id=' + momentId, { method: 'GET' })
        .then(function (r) { return r.json(); })
        .then(function (res) {
            if (res.code === 0 && res.data) {
                var comments = res.data.comments;
                countEl.textContent = res.data.total > 0 ? '(' + res.data.total + ')' : '';

                if (!comments || comments.length === 0) {
                    listEl.innerHTML = '<div class="mp-comments-empty">暂无评论，来说点什么吧~</div>';
                    return;
                }

                var html = '';
                comments.forEach(function (c) {
                    var replyTag = '';
                    if (c.reply_id > 0 && c.reply_nickname) {
                        replyTag = '<span class="mp-comment-reply-tag">回复 <span class="mp-comment-reply-name">' + escHtml(c.reply_nickname) + '</span></span>';
                    }
                    var imgHtml = '';
                    if (c.img) {
                        imgHtml = '<div class="mp-comment-img-wrap"><img class="mp-comment-img" src="' + escHtml(c.img) + '" alt="" onclick="mpFullscreenShowSingle(this.src)"></div>';
                    }
                    html += '<div class="mp-comment-item" data-comment-id="' + c.id + '">'
                        + '<img class="mp-comment-avatar" src="' + escHtml(c.avatar) + '" alt=""' + (c.user_id > 0 ? ' onclick="showUserCard(' + c.user_id + ', event)" style="cursor:pointer"' : '') + '>'
                        + '<div class="mp-comment-body">'
                        + '<span class="mp-comment-nickname"' + (c.user_id > 0 ? ' onclick="showUserCard(' + c.user_id + ', event)" style="cursor:pointer"' : '') + '>' + escHtml(c.nickname) + '</span>'
                        + replyTag
                        + '<span class="mp-comment-content">' + escHtml(c.content) + '</span>'
                        + imgHtml
                        + '<span class="mp-comment-time">' + timeAgo(c.created_at) + '</span>'
                        + '<span class="mp-comment-reply-btn" data-reply-id="' + c.id + '" data-user-id="' + c.user_id + '" data-nickname="' + escHtml(c.nickname) + '">回复</span>'
                        + '</div></div>';
                });
                listEl.innerHTML = html;
                listEl.querySelectorAll('.mp-comment-reply-btn').forEach(function (button) {
                    button.onclick = function () { mpReplyTo(Number(this.dataset.replyId), Number(this.dataset.userId), this.dataset.nickname); };
                });
            }
        })
        .catch(function () {
            listEl.innerHTML = '<div class="mp-comments-empty">加载失败</div>';
        });
}

// 回复某条评论
window.mpReplyTo = function (commentId, userId, nickname) {
    if (!_momentLoggedIn) {
        showToast('请登录后评论~', 'warning');
        var popup = document.getElementById('moment-popup');
        if (popup) {
            popup.classList.remove('active');
            document.body.style.overflow = '';
            setTimeout(function () { popup.remove(); }, 300);
        }
        setTimeout(function () {
            showAuthCard('login');
        }, 350);
        return;
    }

    var popup = document.getElementById('moment-popup');
    if (!popup) return;

    var input = popup.querySelector('.mp-comment-input');
    input.placeholder = '回复 ' + nickname + '...';
    input.dataset.replyId = commentId;
    input.dataset.replyUserId = userId;
    input.focus();
};

// 上传评论图片到 SaaS 图床（group_id=2 其它照片），返回 URL 或 null
function uploadCommentImage(file) {
    if (typeof compressImage !== 'function') {
        mpShowToast('压缩组件未加载');
        return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
        // 压缩到 1.5MB，对齐图床上限
        compressImage(file, 1500, function (compressed) {
            if (!compressed) { resolve(null); return; }
            if (typeof window.setUploadProgress === 'function') {
                window.setUploadProgress(50, '正在上传图片…');
            }
            var fd = new FormData();
            fd.append('csrf_token', _momentCsrfToken);
            fd.append('file', compressed);
            fd.append('group_id', '2');   // 其它照片
            fetch('/api/upload_image.php', { method: 'POST', body: fd })
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    if (d && d.code === 0 && d.data && d.data.url) resolve(d.data.url);
                    else { mpShowToast((d && d.msg) || '图片上传失败'); resolve(null); }
                })
                .catch(function () { mpShowToast('图片上传异常'); resolve(null); });
        });
    });
}

// 提交评论
window.mpSubmitComment = function () {
    if (!_momentLoggedIn) {
        showToast('请登录后评论~', 'warning');
        var popup = document.getElementById('moment-popup');
        if (popup) {
            popup.classList.remove('active');
            document.body.style.overflow = '';
            setTimeout(function () { popup.remove(); }, 300);
        }
        setTimeout(function () {
            showAuthCard('login');
        }, 350);
        return;
    }

    var popup = document.getElementById('moment-popup');
    if (!popup) return;

    var input = popup.querySelector('.mp-comment-input');
    var content = input.value.trim();

    var momentId = popup.dataset.momentId || '';
    var replyId = parseInt(input.dataset.replyId || '0');

    // 检查是否有图片
    var imgFile = document.getElementById('mpCommentImgInput');
    var hasFile = imgFile && imgFile.files && imgFile.files[0];
    var hasBase64 = !!_mpCommentImgData;

    // 既无文字也无图片 → 不提交
    if (!content && !hasFile && !hasBase64) return;

    // 禁用发送按钮，显示上传中
    var sendBtn = popup.querySelector('.mp-comment-send-btn');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = '上传中...';
    }

    // 先上传图片到图床拿 URL，再带 URL 提交评论
    var doSubmit = function (imgUrl) {
        var data = new FormData();
        data.append('action', 'comment');
        data.append('moment_id', momentId);
        data.append('content', content);
        data.append('csrf_token', _momentCsrfToken);
        if (replyId > 0) data.append('reply_id', replyId);
        if (imgUrl) data.append('img', imgUrl);   // 图片 URL（图床地址）

        fetch('api/moment_api.php', { method: 'POST', body: data })
    .then(function (r) {
        if (!r.ok) throw new Error('服务器返回 ' + r.status);
        return r.text().then(function (text) {
            try { return JSON.parse(text); }
            catch (e) {
                console.error('[评论] 服务器返回非JSON:', text.substring(0, 300));
                throw new Error('服务器返回异常，请查看控制台');
            }
        });
    })
    .then(function (res) {
        if (res.code === 0) {
            showToast('评论成功', 'success');
            input.value = '';
            input.placeholder = '写评论...';
            delete input.dataset.replyId;
            delete input.dataset.replyUserId;
            _mpCommentImgData = '';
            var preview = document.getElementById('mpCommentImgPreview');
            if (preview) preview.style.display = 'none';
            var imgInput = document.getElementById('mpCommentImgInput');
            if (imgInput) imgInput.value = '';
            // 重新加载评论
            loadComments(momentId);
            // 更新卡片上的评论数
            var cardCommentBtn = document.querySelector('.moment-card[data-moment-id="' + momentId + '"] .moment-comment-btn .comment-count-label');
            if (cardCommentBtn) {
                var cur = parseInt(cardCommentBtn.textContent) || 0;
                cardCommentBtn.textContent = cur + 1;
            }
        } else if (res.code === 2 || res.code === 401) {
            showToast('请登录后评论~', 'warning');
            var p = document.getElementById('moment-popup');
            if (p) {
                p.classList.remove('active');
                document.body.style.overflow = '';
                setTimeout(function () { p.remove(); }, 300);
            }
            setTimeout(function () {
                showAuthCard('login');
            }, 350);
        } else {
            mpShowToast(res.msg || '评论失败');
        }
    })
    .catch(function (err) {
        console.error('[评论错误]', err);
        var msg = typeof err === 'string' ? err : (err && err.message ? err.message : '网络错误，请检查控制台');
        mpShowToast(msg);
    })
    .finally(function () {
        if (typeof window.hideUploadOverlay === 'function') window.hideUploadOverlay();
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = '发送';
        }
    });
    };

    // 有图：先上传图床拿 URL，再提交；无图直接提交
    var hasFile = imgFile && imgFile.files && imgFile.files[0];
    if (hasFile) {
        // 显示遮罩 + 进度条，避免上传时感觉卡顿
        if (typeof window.showUploadOverlay === 'function') {
            window.showUploadOverlay('正在发送评论');
            window.setUploadProgress(10, '正在压缩图片…');
        }
        uploadCommentImage(hasFile).then(function (url) {
            if (url) {
                if (typeof window.setUploadProgress === 'function') {
                    window.setUploadProgress(100, '图片上传完成，正在提交…');
                }
                doSubmit(url);
            } else {
                // 图片上传失败：关闭遮罩，恢复按钮
                if (typeof window.hideUploadOverlay === 'function') window.hideUploadOverlay();
                if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '发送'; }
            }
        });
    } else if (hasBase64) {
        // base64 → Blob 后上传
        if (typeof window.showUploadOverlay === 'function') {
            window.showUploadOverlay('正在发送评论');
            window.setUploadProgress(10, '正在处理图片…');
        }
        try {
            var byteStr = atob(_mpCommentImgData.split(',')[1] || '');
            var ab = new ArrayBuffer(byteStr.length);
            var ia = new Uint8Array(ab);
            for (var i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
            var blob = new Blob([ab], { type: 'image/jpeg' });
            uploadCommentImage(blob).then(function (url) {
                if (url) doSubmit(url);
                else {
                    if (typeof window.hideUploadOverlay === 'function') window.hideUploadOverlay();
                    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '发送'; }
                }
            });
        } catch (e) {
            if (typeof window.hideUploadOverlay === 'function') window.hideUploadOverlay();
            mpShowToast('图片处理失败');
            if (sendBtn) sendBtn.textContent = '发送';
        }
    } else {
        doSubmit('');
    }
};

// 评论图片选择
var _mpCommentImgData = '';

window.mpPickCommentImg = function () {
    if (!_momentLoggedIn) {
        showToast('请登录后评论~', 'warning');
        if (typeof showAuthCard === 'function') showAuthCard('login');
        return;
    }
    var input = document.getElementById('mpCommentImgInput');
    if (input) {
        input.value = ''; // 允许重复选择同一文件
        input.click();
    }
};

// 评论图片选择后处理
function handleMomentCommentImage(e) {
    if (e.target.id !== 'mpCommentImgInput') return;
    var file = e.target.files[0];
    if (!file) return;
    // 大小不限：有自动压缩（compressImage 压缩到 1.5MB），无需前端大小拦截
    var reader = new FileReader();
    reader.onload = function (ev) {
        _mpCommentImgData = ev.target.result;
        var preview = document.getElementById('mpCommentImgPreview');
        var thumb = document.getElementById('mpCommentImgThumb');
        if (preview && thumb) {
            thumb.src = _mpCommentImgData;
            preview.style.display = 'flex';
        }
    };
    reader.readAsDataURL(file);
}
document.addEventListener('change', handleMomentCommentImage);

function rememberMomentLike(momentId) {
    var id = String(momentId).indexOf('photo_') === 0
        ? 1000000 + Number(String(momentId).slice(6)) : Number(momentId);
    if (!_momentUserInfo.liked_moments.some(function (value) { return Number(value) === id; })) {
        _momentUserInfo.liked_moments.push(id);
    }
}

window.mpRemoveCommentImg = function () {
    _mpCommentImgData = '';
    var preview = document.getElementById('mpCommentImgPreview');
    if (preview) preview.style.display = 'none';
};

// Toast 消息：使用全局 showToast（右上角 toastr）
function mpShowToast(msg) {
    if (typeof showToast === 'function') {
        showToast(msg, 'error');
        return;
    }
    // fallback：弹窗内 toast
    var popup = document.getElementById('moment-popup');
    if (!popup) return;
    var toast = document.createElement('div');
    toast.className = 'mp-toast';
    toast.textContent = msg;
    popup.querySelector('.mp-card').appendChild(toast);
    setTimeout(function () { toast.classList.add('active'); }, 10);
    setTimeout(function () {
        toast.classList.remove('active');
        setTimeout(function () { toast.remove(); }, 300);
    }, 2000);
}

// HTML 转义 — 使用 App.utils 统一实现
function escHtml(str) {
    return App.utils.escapeHtml(str);
}

// 时间显示 — 使用 App.utils 统一实现
function timeAgo(dateStr) {
    return App.utils.formatRelativeTime(dateStr);
}

// ========== 弹窗 CSS ==========

function getMomentPopupCSS() {
    return `
    /* 悬浮弹窗遮罩 */
    #moment-popup {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        z-index: 10000; display: flex; align-items: center; justify-content: center;
        padding: 20px; box-sizing: border-box;
        opacity: 0; visibility: hidden; transition: all 0.3s ease;
    }
    #moment-popup.active {
        opacity: 1; visibility: visible;
    }
    .mp-overlay {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    }

    /* 卡片容器 */
    .mp-card {
        position: relative; width: 100%; max-width: 560px;
        max-height: 90vh; background: #fff;
        border-radius: 20px; overflow: visible;
        box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        display: flex; flex-direction: column;
        animation: mpSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes mpSlideUp {
        from { opacity: 0; transform: translateY(30px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* 关闭按钮 */
    .mp-close {
        position: absolute; top: 12px; right: 12px; z-index: 10;
        width: 36px; height: 36px;
        border: none; background: rgba(0,0,0,0.06); color: #666;
        font-size: 16px; cursor: pointer; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s;
    }
    .mp-close:hover { background: rgba(0,0,0,0.12); color: #333; }

    /* 可滚动区域 */
    .mp-scroll-body {
        flex: 1; overflow-y: auto; overflow-x: hidden;
        min-height: 0;
        border-radius: 20px 20px 0 0;
    }

    /* 头部 */
    .mp-header {
        padding: 18px 52px 14px 20px; display: flex;
        justify-content: space-between; align-items: flex-start;
        border-bottom: 1px solid rgba(0,0,0,0.04);
    }
    .mp-time { display: flex; flex-direction: column; gap: 2px; }
    .mp-date-day {
        font-size: 24px; font-weight: 700; color: #1a1a2e;
        font-family: 'Noto Serif SC', serif; letter-spacing: 1px; line-height: 1.1;
    }
    .mp-date-year {
        font-size: 12px; color: #aaa; line-height: 1;
    }
    .mp-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .mp-weather { display: flex; align-items: center; gap: 5px; font-size: 14px; color: #444; }
    .mp-weather-icon { font-size: 18px; }
    .mp-location { font-size: 12px; color: #999; }

    /* 图片区 */
    .mp-images {
        padding: 14px 20px; position: relative; flex-shrink: 0;
    }
    .mp-images-grid {
        display: grid; gap: 6px;
    }
    .mp-images-grid .img-loader-wrap {
        position: relative;
        width: 100%;
        aspect-ratio: 1;
        border-radius: 10px;
        overflow: hidden;
        background: rgba(240, 224, 230, 0.3);
    }
    .mp-images-grid img {
        width: 100%; aspect-ratio: 1; object-fit: cover;
        border-radius: 10px; cursor: pointer; transition: transform 0.2s, opacity 0.4s ease;
        position: relative; z-index: 1;
    }
    .mp-images-grid img:hover { transform: scale(1.02); }
    .mp-images-grid .img-loaded img { opacity: 1; }
    .mp-images-grid .img-loader-wrap:not(.img-loaded) img { opacity: 0; }

    /* 弹窗内图片加载动画 */
    .mp-images-grid .img-loader-spinner {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        z-index: 0; width: 36px; height: 36px;
        border: 3px dotted #e8b4c0; border-style: solid solid dotted dotted;
        border-radius: 50%; box-sizing: border-box;
        animation: imgRotation 2s linear infinite;
    }
    .mp-images-grid .img-loader-spinner::after {
        content: ''; box-sizing: border-box;
        position: absolute; left: 0; right: 0; top: 0; bottom: 0;
        margin: auto; border: 3px dotted #FF3D00; border-style: solid solid dotted;
        width: 18px; height: 18px; border-radius: 50%;
        animation: imgRotationBack 1s linear infinite;
        transform-origin: center center;
    }
    .mp-images-grid .img-loader-wrap.img-loaded .img-loader-spinner {
        opacity: 0; transition: opacity 0.3s ease;
    }
    /* 弹窗内图片加载失败 */
    .mp-images-grid .img-loader-wrap.img-error .img-loader-spinner {
        display: none;
    }
    .mp-images-grid .img-lost-icon {
        display: none;
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        z-index: 0; flex-direction: column;
        align-items: center; gap: 6px;
        color: #c88; font-size: 28px;
        animation: imgLostPulse 2s ease-in-out infinite;
    }
    .mp-images-grid .img-loader-wrap.img-error .img-lost-icon {
        display: flex;
    }
    .mp-images-grid .img-lost-icon::after {
        content: '照片丢失'; font-size: 11px;
        color: #d99; letter-spacing: 1px;
        animation: imgLostText 2.5s ease-in-out infinite;
    }
    .mp-images-grid .img-loader-wrap.img-error {
        background: rgba(240, 220, 220, 0.4);
    }
    .mp-images-grid .img-loader-wrap.img-error img {
        display: none;
    }
    @keyframes imgRotation {
        0% { transform: translate(-50%, -50%) rotate(0deg); }
        100% { transform: translate(-50%, -50%) rotate(360deg); }
    }
    @keyframes imgRotationBack {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(-360deg); }
    }
    @keyframes imgLostPulse {
        0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
        50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
    }
    @keyframes imgLostText {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
    }



    /* 文案 */
    .mp-content { padding: 14px 20px; }
    .mp-text {
        font-size: 15px; line-height: 1.8; color: #333;
        font-family: 'Noto Serif SC', serif; margin: 0;
    }

    /* 底部 */
    .mp-footer {
        padding: 12px 20px; display: flex;
        justify-content: space-between; align-items: center;
        border-top: 1px solid rgba(0,0,0,0.04);
    }
    .mp-user { display: flex; align-items: center; gap: 8px; }
    .mp-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
    .mp-gender { font-size: 14px; }
    .mp-gender.male { color: #5DADE2; }
    .mp-gender.female { color: #F8BBD9; }
    .mp-like-btn {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 6px 14px; border-radius: 18px;
        border: 1px solid rgba(0,0,0,0.08); background: transparent;
        font-size: 13px; color: #888; cursor: pointer; transition: all 0.2s;
    }
    .mp-like-btn:hover {
        background: rgba(248,187,217,0.12); border-color: rgba(248,187,217,0.3); color: #E91E63;
    }
    .mp-like-btn.liked { color: #E91E63; background: rgba(248,187,217,0.18); border-color: rgba(233,30,99,0.2); }
    .mp-like-icon { font-size: 15px; }
    .mp-like-count { font-size: 12px; font-weight: 500; }

    /* ===== 评论区 ===== */
    .mp-comments-section {
        padding: 0 20px 16px;
        border-top: 1px solid rgba(0,0,0,0.05);
        margin-top: 4px;
    }
    .mp-comments-header {
        display: flex; align-items: center; gap: 6px;
        padding: 12px 0 8px; font-size: 14px; color: #333;
    }
    .mp-comments-title { font-weight: 600; }
    .mp-comments-count { font-size: 12px; color: #999; }

    .mp-comments-list {
        margin-bottom: 10px;
    }
    .mp-comments-loading,
    .mp-comments-empty {
        text-align: center; padding: 20px 0; color: #bbb; font-size: 13px;
    }

    /* 单条评论 */
    .mp-comment-item {
        display: flex; gap: 8px;
        padding: 8px 0;
        border-bottom: 1px solid rgba(0,0,0,0.03);
    }
    .mp-comment-item:last-child { border-bottom: none; }
    .mp-comment-avatar {
        width: 28px; height: 28px; border-radius: 50%;
        object-fit: cover; flex-shrink: 0;
    }
    .mp-comment-body {
        flex: 1; min-width: 0;
        display: flex; flex-wrap: wrap; align-items: center;
        gap: 4px 6px; line-height: 1.5;
    }
    .mp-comment-nickname {
        font-size: 13px; font-weight: 600; color: #5DADE2;
        cursor: pointer;
    }
    .mp-comment-nickname.female { color: #F8BBD9; }
    .mp-comment-reply-tag {
        font-size: 11px; color: #aaa;
    }
    .mp-comment-reply-name {
        color: #888; font-weight: 500;
    }
    .mp-comment-content {
        font-size: 13px; color: #333; line-height: 1.5;
        width: 100%; word-break: break-all;
    }
    .mp-comment-time {
        font-size: 11px; color: #bbb;
    }
    .mp-comment-reply-btn {
        font-size: 11px; color: #999; cursor: pointer;
        transition: color 0.2s;
    }
    .mp-comment-reply-btn:hover { color: #E91E63; }

    /* 评论图片 */
    .mp-comment-img-wrap { margin-top: 6px; }
    .mp-comment-img {
        max-width: 180px; max-height: 180px; object-fit: cover;
        border-radius: 10px; cursor: pointer; transition: transform 0.2s;
        border: 1px solid rgba(0,0,0,0.06);
    }
    .mp-comment-img:hover { transform: scale(1.02); }

    /* 评论图片上传预览 */
    .mp-comment-img-preview {
        display: flex; align-items: center; gap: 8px;
        padding: 6px 12px; margin-bottom: 4px;
    }
    .mp-comment-img-preview img {
        width: 48px; height: 48px; object-fit: cover;
        border-radius: 8px; border: 1px solid rgba(0,0,0,0.08);
    }
    .mp-comment-img-remove {
        width: 20px; height: 20px; border-radius: 50%;
        background: rgba(255,60,60,0.85); color: #fff;
        font-size: 14px; line-height: 20px; text-align: center;
        cursor: pointer; transition: background 0.2s;
    }
    .mp-comment-img-remove:hover { background: #e33; }

    /* 评论图片上传按钮 */
    .mp-comment-img-btn {
        border: none; background: transparent; font-size: 18px;
        cursor: pointer; padding: 0 10px; color: #999;
        transition: color 0.2s; flex-shrink: 0;
    }
    .mp-comment-img-btn:hover { color: #FF6B8B; }

    /* 评论输入区 — 固定在卡片底部 */
    .mp-comment-input-area {
        flex-shrink: 0;
        display: flex; gap: 8px; align-items: center;
        padding: 10px 20px;
        background: #fff;
        border-top: 1px solid rgba(0,0,0,0.06);
        border-radius: 0 0 20px 20px;
    }
    .mp-comment-input-wrapper {
        display: flex; width: 100%;
        border: 1px solid rgba(0,0,0,0.1);
        border-radius: 20px; overflow: hidden;
        background: #f9f9f9;
        transition: border-color 0.2s;
    }
    .mp-comment-input-wrapper:focus-within {
        border-color: rgba(248,187,217,0.5);
    }
    .mp-comment-input {
        flex: 1; border: none; outline: none;
        padding: 8px 14px; font-size: 13px;
        background: transparent; color: #333;
    }
    .mp-comment-input::placeholder {
        color: #bbb;
    }
    .mp-comment-send-btn {
        border: none; background: linear-gradient(135deg, #FF6B8B, #FF8E53);
        color: #fff; font-size: 12px; font-weight: 600;
        padding: 0 16px; cursor: pointer;
        transition: opacity 0.2s;
    }
    .mp-comment-send-btn:hover { opacity: 0.85; }

    /* Toast 消息 */
    .mp-toast {
        position: absolute; bottom: 70px; left: 50%;
        transform: translateX(-50%) translateY(10px);
        background: rgba(0,0,0,0.75); color: #fff;
        padding: 8px 20px; border-radius: 20px;
        font-size: 13px; z-index: 100;
        opacity: 0; transition: all 0.3s ease;
        pointer-events: none; white-space: nowrap;
    }
    .mp-toast.active {
        opacity: 1; transform: translateX(-50%) translateY(0);
    }

    /* 响应式 */
    @media (max-width: 768px) {
        #moment-popup { padding: 10px; }
        .mp-card { max-width: 100%; max-height: 95vh; border-radius: 16px; }
        .mp-close { width: 32px; height: 32px; font-size: 14px; }
        .mp-header { padding: 14px 16px 12px; }
        .mp-images { padding: 12px 16px; }
        .mp-content { padding: 12px 16px; }
        .mp-text { font-size: 14px; }
        .mp-footer { padding: 10px 16px; }
        .mp-comments-section { padding: 0 16px 12px; }
        .mp-comment-input-area { padding: 8px 16px; }
    }
    `;
}

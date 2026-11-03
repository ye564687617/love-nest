/* 恋爱清单功能 */
if (window.__disposeChecklistPage) window.__disposeChecklistPage();
var _checklistEvents = new AbortController();
window.__disposeChecklistPage = (function (initialize, events) {
    return function () {
        document.removeEventListener('DOMContentLoaded', initialize);
        document.removeEventListener('pjax:ready', initialize);
        events.abort();
    };
})(_checklistInit, _checklistEvents);

function _checklistInit() {
    var root = document.querySelector('.checklist-item') || document.getElementById('image-preview');
    if (!root || root.dataset.checklistReady) return;
    root.dataset.checklistReady = '1';
    initImagePreview();
    initChecklistMomentClick();
    animateProgress();
}

document.addEventListener('DOMContentLoaded', _checklistInit);
document.addEventListener('pjax:ready', _checklistInit);

// ===== 点击绑定了动态的清单卡片，弹出动态记录卡片 =====
function initChecklistMomentClick() {
    var items = document.querySelectorAll('.checklist-item[data-moment-id]');
    items.forEach(function(item) {
        if (item.hasAttribute('onclick')) return;
        item.style.cursor = 'pointer';
        item.addEventListener('click', function(e) {
            // 如果点击的是操作区的按钮（如图片预览），不触发
            if (e.target.closest('.check-actions')) return;

            var momentId = parseInt(item.dataset.momentId);
            if (!momentId) return;

            var momentsData = window.__CHECKLIST_MOMENTS__ || {};
            var mData = momentsData[momentId];
            if (!mData) return;

            // 构建临时 .moment-card 元素
            var card = buildTempMomentCard(mData);
            openMomentPopup(card);
        });
    });
}

// 从动态数据构建临时 .moment-card DOM（供 openMomentPopup 解析）
function buildTempMomentCard(m) {
    var escape = App.utils.escapeHtml;
    var card = document.createElement('div');
    card.className = 'moment-card';
    card.dataset.momentId = m.id;

    var genderClass = m.author_gender === 1 ? 'male' : 'female';
    var genderIcon = m.author_gender === 1 ? '♂' : '♀';

    var imagesHTML = '';
    if (m.images && m.images.length > 0) {
        var imgsHTML = '';
        m.images.forEach(function(src, idx) {
            imgsHTML += '<img src="' + escape(src) + '" alt="" data-index="' + idx + '">';
        });
        imagesHTML = '<div class="moment-images-grid">' + imgsHTML + '</div>';
    }

    card.innerHTML =
        '<div class="moment-header">'
        + '<div class="moment-date">'
        + '<span class="date-day">' + escape(m.date_day || '') + '</span>'
        + '<span class="date-year">' + escape(m.date_year || '') + '</span>'
        + '</div>'
        + '<div class="moment-meta">'
        + '<div class="moment-weather"><span class="weather-icon">' + escape(m.weather_icon || '') + '</span><span>' + escape(m.weather_label || '') + '</span></div>'
        + (m.location ? '<div class="moment-location">' + escape(m.location) + '</div>' : '')
        + '</div></div>'
        + '<div class="moment-images">' + imagesHTML + '</div>'
        + (m.content ? '<div class="moment-content"><p class="moment-text">' + (m.content || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g, '<br>') + '</p></div>' : '')
        + '<div class="moment-footer">'
        + (m.author_avatar ? '<img src="' + escape(m.author_avatar) + '" class="moment-avatar">' : '')
        + '<span class="moment-gender ' + genderClass + '">' + genderIcon + '</span>'
        + '<button class="moment-like-btn' + (m.is_liked ? ' liked' : '') + '">'
        + '<span class="like-icon">' + (m.is_liked ? '♥' : '♡') + '</span>'
        + '<span class="like-count">' + m.likes + '</span>'
        + '</button></div>';

    return card;
}

// 图片预览功能（未绑定动态但有图片的清单项）
function initImagePreview() {
    var preview = document.getElementById('image-preview');
    if (!preview) return;

    var overlay = preview.querySelector('.preview-overlay');
    var closeBtn = preview.querySelector('.preview-close');

    // 点击遮罩关闭
    overlay.addEventListener('click', closeImagePreview);
    closeBtn.addEventListener('click', closeImagePreview);

    // 键盘关闭
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && preview.classList.contains('active')) {
            closeImagePreview();
        }
    }, { signal: _checklistEvents.signal });
}

// 打开图片预览悬浮卡片
function openImagePreview(imgElement) {
    var preview = document.getElementById('image-preview');
    var previewImg = preview.querySelector('.preview-image');
    var previewTitle = preview.querySelector('.preview-title');
    
    // 获取图片信息
    var imgSrc = imgElement.getAttribute('data-src') || imgElement.src;
    var imgAlt = imgElement.alt || '';
    
    // 获取清单标题
    var checklistItem = imgElement.closest('.checklist-item');
    var title = checklistItem ? checklistItem.querySelector('.check-title').textContent : imgAlt;
    
    previewImg.src = imgSrc;
    previewImg.alt = imgAlt;
    if (previewTitle) {
        previewTitle.textContent = title;
    }
    
    preview.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// 关闭图片预览
function closeImagePreview() {
    var preview = document.getElementById('image-preview');
    preview.classList.remove('active');
    document.body.style.overflow = '';
}

// 进度条动画
function animateProgress() {
    var progressFill = document.querySelector('.progress-fill');
    if (!progressFill) return;

    // 获取目标宽度
    var targetWidth = progressFill.style.width;
    
    // 先设置为0
    progressFill.style.width = '0%';
    
    // 延迟后动画显示
    setTimeout(function() {
        progressFill.style.width = targetWidth;
    }, 300);
}

// 全局函数暴露
window.openImagePreview = openImagePreview;

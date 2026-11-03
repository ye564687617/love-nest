/**
 * 全局图片懒加载引擎 v3
 *
 * 策略：
 * - 所有 <img> 自动补 loading="lazy"
 * - 仅对白名单容器包裹 .img-loader-wrap（spinner + 裂图兜底）
 * - 其余图片 CSS shimmer 加载反馈（不改 DOM，不破布局）
 * - 统一最小显示 1s：快网速/缓存下加载动画也不闪
 * - 头像/图标/emoji 直接跳过
 */
(function () {
    'use strict';

    var MIN_LOADER_MS = 0; // Show decoded images immediately, including cached ones.

    // ===== 白名单：仅这些容器内的图片包裹 .img-loader-wrap =====
    var WRAP_SELECTORS = [
        '.moment-images-grid'   // loveImg.php / list.php 动态卡片网格
    ];

    // ===== CSS ::after spinner 容器（不包裹 DOM，由 CSS 伪元素画 spinner） =====
    var SPINNER_CONTAINERS = [
        '.album-main-story',    // index.php 相册时光 左侧大图
        '.album-item'           // index.php 相册时光 右侧小图
    ];

    // ===== 黑名单：这些图片不做任何处理 =====
    var SKIP_CLASSES = /avatar|icon|emoji|badge|logo/i;
    var SKIP_SELECTORS = [
        '.story-avatar',
        '.msg-compose-avatar',
        '.msg-img-preview',
        '.chat-img-preview-bar',
        '.mobile-music-btn',
        '.header-user',
        '.mp-single-image',   // 弹窗单图：已有自身切换加载反馈，不包裹
        '.preview-img',       // 聊天室全屏预览图：固定居中样式，不被包裹
        '[data-lazy-skip]',   // 通用：标记了 skip 的图片（全屏预览等）不包裹
        'svg'
    ];

    function shouldSkip(img) {
        if (img.dataset.lazySkip !== undefined) return true;
        if (img.closest('.img-loader-wrap')) return true;
        var cls = img.className || '';
        if (SKIP_CLASSES.test(cls)) return true;
        for (var i = 0; i < SKIP_SELECTORS.length; i++) {
            if (img.closest(SKIP_SELECTORS[i])) return true;
        }
        return false;
    }

    function shouldWrap(img) {
        if (img.closest('.img-loader-wrap')) return false;
        for (var i = 0; i < WRAP_SELECTORS.length; i++) {
            if (img.closest(WRAP_SELECTORS[i])) return true;
        }
        return false;
    }

    /** 获取 img 所在的 spinner 容器（通过 CSS ::after 显示 spinner） */
    function getSpinnerContainer(img) {
        for (var i = 0; i < SPINNER_CONTAINERS.length; i++) {
            var c = img.closest(SPINNER_CONTAINERS[i]);
            if (c) return c;
        }
        return null;
    }

    /** 相册时光容器：用 CSS ::after spinner，零 DOM 变更。持久监听（支持刷新换图） */
    function initContainerSpinner(img, container) {
        var start = Date.now();
        container.dataset.lazyStart = start;

        function onLoaded() {
            scheduleFinish(start, function () {
                container.classList.add('img-loaded');
                container.classList.remove('img-error');
            });
            // 不移除监听器：刷新换图时需再次触发
        }
        function onError() {
            container.classList.add('img-error');
            container.classList.remove('img-loaded');
        }
        img.addEventListener('load', onLoaded);
        img.addEventListener('error', onError);
        // 已缓存
        if (img.complete && img.naturalWidth > 0) {
            scheduleFinish(start, function () {
                container.classList.add('img-loaded');
            });
            container.classList.remove('img-loaded'); // 确保触发 CSS ::after
            container.classList.remove('img-error');
        }
    }

    /** 延迟标记完成：如果距今不足 MIN_LOADER_MS，补齐差值再触发 */
    function scheduleFinish(start, fn) {
        var elapsed = Date.now() - start;
        var delay = elapsed < MIN_LOADER_MS ? (MIN_LOADER_MS - elapsed) : 0;
        if (delay > 0) {
            setTimeout(fn, delay);
        } else {
            fn();
        }
    }

    /** 包裹图片状态管理：图立即可见，spinner 延迟隐藏 */
    function initImgState(img, wrap) {
        var start = Date.now();
        wrap.dataset.lazyStart = start;

        function onLoaded() {
            // 图片立即显示（不等待最小时间）
            img.style.opacity = '1';
            // spinner 单独延迟隐藏，保持最小显示时长
            scheduleFinish(start, function () {
                wrap.classList.add('img-loaded');
                wrap.classList.remove('img-error');
            });
            img.removeEventListener('load', onLoaded);
            img.removeEventListener('error', onError);
        }
        function onError() {
            wrap.classList.add('img-error');
            wrap.classList.remove('img-loaded');
            img.removeEventListener('load', onLoaded);
            img.removeEventListener('error', onError);
        }
        img.addEventListener('load', onLoaded);
        img.addEventListener('error', onError);
        if (img.complete) {
            if (img.naturalWidth > 0) onLoaded();
            else if (img.src && img.src !== location.href) onError();
        }
    }

    function wrapImage(img) {
        var wrap = document.createElement('div');
        wrap.className = 'img-loader-wrap';
        var spinner = document.createElement('span');
        spinner.className = 'img-loader-spinner';
        wrap.appendChild(spinner);
        var lost = document.createElement('span');
        lost.className = 'img-lost-icon';
        lost.innerHTML = '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
        wrap.appendChild(lost);
        img.parentNode.insertBefore(wrap, img);
        wrap.appendChild(img);
        // 标记已处理，防止 MutationObserver 重复包裹
        img.dataset.lazyDone = '1';
        initImgState(img, wrap);
    }

    function handleImage(img) {
        if (!img || img.tagName !== 'IMG') return;
        if (!img.getAttribute('src') || /^(?:data:|blob:)/i.test(img.getAttribute('src'))) return;
        if (shouldSkip(img)) return;

        if (!img.hasAttribute('loading')) {
            img.setAttribute('loading', 'lazy');
        }

        // 白名单容器内包裹
        if (shouldWrap(img)) {
            wrapImage(img);
            return;
        }

        // CSS ::after spinner 容器（相册时光等，不改 DOM）
        var sc = getSpinnerContainer(img);
        if (sc) {
            if (!sc.dataset.lazyInited) {
                sc.dataset.lazyInited = '1';
                initContainerSpinner(img, sc);
            }
            return; // 容器 ::after 负责 spinner
        }

        // 已包裹或已处理过则跳过（MutationObserver 重复回调保护）
        if (img.closest('.img-loader-wrap') || img.dataset.lazyDone) return;

        // 其余图片统一包裹 .img-loader-wrap：加载中隐藏图片显示 spinner，
        // 加载完成淡入显示（与白名单网格图片体验一致）
        if (!img.closest('.img-loader-wrap')) {
            wrapImage(img);
        }
    }

    function scanAll() {
        document.querySelectorAll('img').forEach(handleImage);
    }

    // ===== MutationObserver =====
    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType === 1) {
                    if (node.tagName === 'IMG') handleImage(node);
                    node.querySelectorAll && node.querySelectorAll('img').forEach(handleImage);
                }
            });
        });
    });

    function start() {
        if (!document.body) {
            setTimeout(start, 20);
            return;
        }
        observer.observe(document.body, { childList: true, subtree: true });
        scanAll();
    }

    start();
})();

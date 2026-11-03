/**
 * App 命名空间 — 全局工具与核心功能
 * 
 * 所有页面共享的基础工具函数，通过 App.xxx 统一管理
 * 关键函数同时挂载到 window（向后兼容）
 */
var App = App || {};

// ========== 工具函数 ==========
App.utils = {
    /**
     * HTML 转义 - 防止 XSS
     * 所有 innerHTML 拼接处必须使用此函数
     */
    escapeHtml: function(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * 相对时间格式化
     * @param {number|string} timestamp - Unix 时间戳（秒）或日期字符串
     * @returns {string} 如 "刚刚"、"5分钟前"、"2小时前"、"3天前"
     */
    formatRelativeTime: function(timestamp) {
        if (!timestamp) return '';
        var date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
        var now = new Date();
        var diff = Math.floor((now - date) / 1000);
        if (diff < 60) return '刚刚';
        if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
        if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
        if (diff < 2592000) return Math.floor(diff / 86400) + '天前';
        if (diff < 31536000) return Math.floor(diff / 2592000) + '个月前';
        return Math.floor(diff / 31536000) + '年前';
    },

    /**
     * 时间显示（兼容 MySQL datetime 格式）
     * @param {string} isoString - 日期字符串，如 "2025-05-20 14:30:00"
     * @returns {string} 格式化后的时间
     */
    formatTime: function(isoString) {
        if (!isoString) return '';
        var date = new Date(isoString.replace ? isoString.replace(' ', 'T') : isoString);
        if (isNaN(date.getTime())) return isoString;
        var now = new Date();
        var diff = now - date;

        if (diff < 60000)    return '刚刚';
        if (diff < 3600000)  return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';

        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        var hours = String(date.getHours()).padStart(2, '0');
        var minutes = String(date.getMinutes()).padStart(2, '0');

        if (year === now.getFullYear()) {
            return month + '.' + day + ' ' + hours + ':' + minutes;
        }
        return year + '.' + month + '.' + day;
    },

    /**
     * 头像颜色（根据字符串生成一致的颜色）
     */
    AVATAR_COLORS: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
        '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA'
    ],

    getAvatarColor: function(name) {
        if (!name) return App.utils.AVATAR_COLORS[0];
        var hash = 0;
        for (var i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return App.utils.AVATAR_COLORS[Math.abs(hash) % App.utils.AVATAR_COLORS.length];
    },

    /**
     * 通用图片全屏预览
     */
    previewImage: function(src) {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.88);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;animation:fadeIn .2s';
        var img = document.createElement('img');
        img.src = src;
        // 标记跳过懒加载包裹，避免全屏预览图被 .img-loader-wrap 隐藏/破坏布局
        img.setAttribute('data-lazy-skip', '1');
        img.style.cssText = 'max-width:90%;max-height:90%;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);object-fit:contain';
        overlay.appendChild(img);
        overlay.addEventListener('click', function() { overlay.remove(); });
        document.body.appendChild(overlay);
    }
};

// ========== 认证模块 ==========
App.auth = {
    showCard: function(mode) {
        if (typeof showAuthCard === 'function') showAuthCard(mode);
    },
    logout: function() {
        if (typeof userLogout === 'function') userLogout();
    }
};

// ========== 上传模块 ==========
App.upload = {
    /**
     * 统一图片上传
     * @param {File} file - 文件对象
     * @param {string} type - 上传类型：avatar / comment / moment / general
     * @param {object} [opts] - 可选配置
     * @returns {Promise<string>} 图片相对URL
     */
    image: function(file, type, opts) {
        // 委托给全局 uploadImage 函数（定义在 common.js）
        if (typeof uploadImage === 'function') {
            return uploadImage(file, type, opts);
        }
        return Promise.reject('uploadImage 未加载');
    }
};

// ========== Toast 模块 ==========
App.toast = {
    show: function(text, type) {
        if (typeof showToast === 'function') {
            showToast(text, type);
        }
    },
    success: function(text) { App.toast.show(text, 'success'); },
    error: function(text) { App.toast.show(text, 'error'); },
    warning: function(text) { App.toast.show(text, 'warning'); },
    info: function(text) { App.toast.show(text, 'info'); }
};

// ========== 向后兼容：全局函数别名 ==========
// 保留旧的全局函数名，指向 App 命名空间
window.App = App;

/**
 * 页面交互JS - 提取自各HTML页面底部的jQuery脚本
 */
$(function () {
    // 卡片点击跳转
    $('.card, .card-b').click(function() {
        var link = $(this).find('a').get(0);
        if (link) {
            link.click();
        }
    });

    // 留言按钮滚动
    $('#MessageBtn').click(function() {
        var targetOffset = $('#MessageArea').offset().top;
        if ($(window).scrollTop() !== targetOffset) {
            $('html, body').animate({
                scrollTop: targetOffset
            }, 800);
        }
    });

    // 视频播放器
    $('video').each(function() {
        var video = $(this);
        setupVideoPlayer(video);
    });

    // 图片灯箱效果
    // 旧版图片：使用 Spotlight.js 灯箱
    $(".love_img img,.lovelist img,.little_texts img").addClass("spotlight");

    // 动态卡片图片：由 moment-interaction.js 的 openMomentPopup 统一处理

    // 留言墙图片也用此预览
    $(document).on('click', '.msg-card-img', function () {
        var src = this.src;
        if (!src) return;
        previewImageFullscreen(src);
    });

    // 滚动变色
    window.addEventListener('scroll', function () {
        let scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        if (scrollTop > 500) {
            $('.wenan').css({'color': '#333333'});
            $('.alogo').css({'color': '#333333'});
        }
        if (scrollTop < 500) {
            $('.wenan').css({'color': 'rgb(97 97 97)'});
            $('.alogo').css({'color': 'rgb(97 97 97)'});
        }
    });

    // 图片加载状态已由全局 img-lazy.js（MutationObserver）统一管理
});

/**
 * 通用图片全屏预览 - 委托给 App.utils
 */
function previewImageFullscreen(src) {
    App.utils.previewImage(src);
}

(function () {
    'use strict';
    if (window.__navigationLoaderBound) return;
    window.__navigationLoaderBound = true;
    var timer = null;
    var watchdog = null;
    function hide() {
        clearTimeout(timer);
        clearTimeout(watchdog);
        var loader = document.getElementById('global-loader');
        if (loader) loader.classList.add('loaded');
    }
    function show() {
        clearTimeout(timer);
        clearTimeout(watchdog);
        timer = setTimeout(function () {
            var loader = document.getElementById('global-loader');
            if (loader) loader.classList.remove('loaded');
        }, 200);
        watchdog = setTimeout(hide, 8000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hide, { once: true });
    else hide();
    window.addEventListener('pageshow', hide);
    if (window.jQuery) {
        window.jQuery(document).on('pjax:send.navigationLoader', show);
        window.jQuery(document).on('pjax:success.navigationLoader pjax:error.navigationLoader pjax:end.navigationLoader pjax:popstate.navigationLoader', hide);
    }
})();

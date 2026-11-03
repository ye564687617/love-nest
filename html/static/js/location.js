(function () {
    'use strict';
    let pending;
    window.SiteLocation = {
        city() {
            if (!pending) {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3500);
                pending = fetch('/api/location_api.php', { credentials: 'same-origin', signal: controller.signal })
                    .then(response => {
                        if (!response.ok) throw new Error('Location request failed');
                        return response.json();
                    }).then(result => {
                        if (result.code !== 0) throw new Error(result.msg);
                        const value = result.data.location || '';
                        if (!value) pending = null;
                        return { value, message: result.msg };
                    }).catch(() => {
                        pending = null;
                        return { value: '', message: '位置获取失败，可手动填写' };
                    }).finally(() => clearTimeout(timeout));
            }
            return pending;
        }
    };
})();

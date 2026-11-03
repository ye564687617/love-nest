(function () {
    'use strict';
    window.Personal = {
        async api(endpoint, action, values) {
            var options = { credentials: 'same-origin' };
            if (values !== undefined) {
                var body = new FormData();
                body.append('csrf_token', Admin.csrf());
                Object.keys(values).forEach(function (key) { body.append(key, values[key]); });
                options.method = 'POST';
                options.body = body;
            }
            var response = await fetch('/api/' + endpoint + '_api.php?action=' + encodeURIComponent(action), options);
            var result = await response.json();
            if (result.code !== 0) throw new Error(result.msg || '操作失败');
            return result.data;
        },
        error(error) { toastr.error(error.message || '网络错误，请重试'); }
    };
})();

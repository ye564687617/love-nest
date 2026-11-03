/**
 * 统一前端 API 客户端
 * 提供 App.api.get / App.api.post，统一：
 *   1. 自动附加 CSRF token（读取页面中的 input[name=csrf_token] 或 meta[name=csrf-token]）
 *   2. 统一解析后端 json_out 结构 {code,msg,data}
 *   3. 失败时回调 onError（默认调用全局 Toast，若存在）
 *   4. 自动拼接 api/ 前缀（传入 'xxx_api' 或 'xxx_api.php' 皆可）
 *
 * 用法：
 *   App.api.post('chat_api', {action:'send', content:'hi'})
 *     .then(res => { if(res.code===0){ ...res.data } })
 *     .catch(err => { ... });
 *
 * 兼容旧代码：现有各页面直接 fetch('api/xxx_api.php') 的写法继续可用，无需改动。
 */
;(function (global) {
    'use strict';

    var App = global.App || (global.App = {});

    // ---- CSRF token 统一读取 ----
    function getCsrfToken() {
        var input = document.querySelector('input[name="csrf_token"]');
        if (input && input.value) return input.value;
        var meta = document.querySelector('meta[name="csrf-token"]');
        if (meta && meta.getAttribute('content')) return meta.getAttribute('content');
        return '';
    }

    // ---- 路径归一：补全 api/ 前缀与 .php 后缀 ----
    function normalizeUrl(url) {
        if (/^https?:\/\//.test(url)) return url;
        var parts = url.replace(/^\//, '').split('?');
        var name = parts.shift().replace(/^api\//, '');
        if (!/\.php$/.test(name)) name += /_api$/.test(name) ? '.php' : '_api.php';
        return '/api/' + name + (parts.length ? '?' + parts.join('?') : '');
    }

    function buildBody(data, csrf) {
        if (data instanceof FormData) {
            if (!data.has('csrf_token')) data.append('csrf_token', csrf);
            return data;
        }
        var fd = new FormData();
        fd.append('csrf_token', csrf);
        if (data && typeof data === 'object') {
            Object.keys(data).forEach(function (k) {
                var v = data[k];
                if (v !== null && v !== undefined) fd.append(k, v);
            });
        }
        return fd;
    }

    function parseResponse(res) {
        // 兼容后端 json_out：{code,msg,data} ；code===0 视为成功
        if (res && typeof res === 'object' && 'code' in res) {
            return res;
        }
        // 兼容直接返回数据
        return { code: 0, msg: '', data: res };
    }

    function notifyError(msg) {
        if (global.Toast && typeof global.Toast.error === 'function') {
            global.Toast.error(msg || '请求失败');
        } else if (global.showToast && typeof global.showToast === 'function') {
            global.showToast(msg || '请求失败', 'error');
        } else {
            console.error('[App.api]', msg);
        }
    }

    function request(url, method, data, options) {
        options = options || {};
        var csrf = getCsrfToken();
        var body = (method === 'GET')
            ? null
            : buildBody(data, csrf);

        var init = {
            method: method,
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin'
        };
        if (csrf) init.headers['X-CSRF-Token'] = csrf;
        if (body) init.body = body;

        return fetch(normalizeUrl(url), init)
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (json) {
                var res = parseResponse(json);
                if (res.code !== 0 && options.throwOnError !== false) {
                    var err = new Error(res.msg || '操作失败');
                    err.res = res;
                    throw err;
                }
                return res;
            })
            .catch(function (err) {
                if (options.silent !== true && !(err.res)) {
                    notifyError(err.message);
                } else if (err.res && options.silent !== true) {
                    notifyError(err.res.msg);
                }
                throw err;
            });
    }

    App.api = {
        get: function (url, data, options) {
            // GET 也把参数拼到 query（含 csrf），与 POST 保持一致
            var qs = '';
            var csrf = getCsrfToken();
            var params = [];
            if (csrf) params.push('csrf_token=' + encodeURIComponent(csrf));
            if (data && typeof data === 'object') {
                Object.keys(data).forEach(function (k) {
                    var v = data[k];
                    if (v !== null && v !== undefined) params.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
                });
            }
            if (params.length) qs = (normalizeUrl(url).indexOf('?') === -1 ? '?' : '&') + params.join('&');
            return request(normalizeUrl(url) + qs, 'GET', null, options);
        },
        post: function (url, data, options) {
            return request(url, 'POST', data, options);
        }
    };
})(window);

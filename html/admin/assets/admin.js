/**
 * 后台通用 JS：Admin 命名空间
 * Admin.api(module, action, data) -> Promise，统一走 api/admin_api.php
 * Admin.modal(title, html) / Admin.closeModal()
 * Admin.confirm(msg) -> Promise<boolean>
 * Admin.pickImage(cb) 图片选择器（上传或输入 URL）
 */
;(function (global, $) {
    'use strict';
    var Admin = global.Admin || (global.Admin = {});

    function csrf() {
        var m = document.querySelector('meta[name=csrf-token]');
        if (m) return m.getAttribute('content');
        var i = document.querySelector('input[name=csrf_token]');
        return i ? i.value : '';
    }

    Admin.csrf = csrf;

    Admin.el = function (id) { return document.getElementById(id); };
    Admin.submit = async function (button, action) {
        if (button.disabled) return;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        try { return await action(); }
        catch (error) { if (!error.notified) toastr.error(error.message || '操作失败，请重试'); }
        finally { button.disabled = false; button.removeAttribute('aria-busy'); }
    };

    Admin.api = function (module, action, data, method) {
        data = data || {};
        method = method || 'POST';
        var fd = new FormData();
        fd.append('csrf_token', csrf());
        Object.keys(data).forEach(function (k) {
            var v = data[k];
            if (Array.isArray(v)) {
                v.forEach(function (item) { fd.append(k + '[]', item); });
            } else if (v !== null && v !== undefined) {
                fd.append(k, v);
            }
        });
        return fetch('/api/admin_api.php?module=' + encodeURIComponent(module) + '&action=' + encodeURIComponent(action), {
            method: method, body: method === 'POST' ? fd : undefined, credentials: 'same-origin'
        }).then(function (r) { return r.json(); }).then(function (res) {
            if (res.code !== 0) { var error = new Error(res.msg || '操作失败'); error.business = true; throw error; }
            if (res.msg && res.msg !== 'ok') toastr.success(res.msg);
            return res.data;
        }).catch(function (e) {
            toastr.error(e.business ? e.message : '网络错误，请重试');
            e.notified = true;
            throw e;
        });
    };

    Admin.get = function (module, action, params) {
        var q = Object.keys(params || {}).map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        }).join('&');
        return fetch('/api/admin_api.php?module=' + encodeURIComponent(module) + '&action=' + encodeURIComponent(action) + (q ? '&' + q : ''), {
            credentials: 'same-origin'
        }).then(function (r) { return r.json(); }).then(function (res) {
            if (res.code !== 0) throw new Error(res.msg);
            return res.data;
        });
    };

    // ---- 弹窗 ----
    Admin.modal = function (title, html) {
        $('#modalBox').html('<h3 id="adminModalTitle">' + Admin.esc(title) + '</h3><button type="button" class="icon-btn modal-dismiss" aria-label="关闭弹窗" onclick="Admin.closeModal()"><i class="fa-solid fa-xmark"></i></button>' + html);
        $('#modalBox').attr({role:'dialog', 'aria-modal':'true', 'aria-labelledby':'adminModalTitle', tabindex:'-1'});
        $('#modalMask').show();
        document.body.style.overflow = 'hidden';
        Admin.el('modalBox').focus();
    };
    var modalParents = [];
    Admin.closeModal = function () {
        if (Admin.confirmCancel) { var cancel = Admin.confirmCancel; Admin.confirmCancel = null; cancel(false); }
        $('#modalBox').empty();
        if (modalParents.length) {
            $('#modalBox').append(modalParents.pop());
            Admin.el('modalBox').focus();
        } else {
            $('#modalMask').hide();
            document.body.style.overflow = '';
        }
    };
    $(document).on('click', '#modalMask', function (e) {
        if (e.target.id === 'modalMask' && Admin.confirmCancel) Admin.closeModal();
    });
    $(document).on('keydown', function (event) {
        if (!$('#modalMask').is(':visible')) return;
        if (event.key === 'Escape') { event.preventDefault(); Admin.closeModal(); }
        if (event.key === 'Tab') {
            var controls = Array.from(Admin.el('modalBox').querySelectorAll('button:not(:disabled),input:not(:disabled),textarea,select,a[href],[contenteditable="true"]')).filter(function (el) { return el.getClientRects().length; });
            if (!controls.length) return;
            if (event.shiftKey && (document.activeElement === controls[0] || document.activeElement === Admin.el('modalBox'))) { event.preventDefault(); controls[controls.length - 1].focus(); }
            else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus(); }
        }
    });
    $(function () {
        document.querySelectorAll('.tbl').forEach(function (table) {
            if (table.closest('.table-scroll')) return;
            var wrapper = document.createElement('div'); wrapper.className = 'table-scroll'; table.before(wrapper); wrapper.appendChild(table);
        });
    });

    Admin.confirm = function (msg) {
        return new Promise(function (resolve) {
            if ($('#modalMask').is(':visible')) modalParents.push($('#modalBox').contents().detach());
            Admin.modal('请确认', '<p style="color:#666;line-height:1.8">' + Admin.esc(msg) + '</p>' +
                '<div class="actions"><button class="btn ghost" id="cfNo">取消</button>' +
                '<button class="btn danger" id="cfYes">确认</button></div>');
            Admin.confirmCancel = resolve;
            $('#cfNo').on('click', function () { Admin.closeModal(); });
            $('#cfYes').on('click', function () { Admin.confirmCancel = null; Admin.closeModal(); resolve(true); });
        });
    };

    Admin.esc = function (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };

    Admin.time = function (dt) { return (dt || '').slice(0, 16).replace('T', ' '); };

    // ---- 图片选择器：上传 / URL 二选一 ----
    Admin.pickImage = function (cb) {
        if ($('#modalMask').is(':visible')) {
            // Detach, rather than serialize, to preserve draft values and event handlers.
            modalParents.push($('#modalBox').contents().detach());
        }
        Admin.modal('选择图片',
            '<div class="field"><label>上传图片</label><input type="file" id="pickFile" accept="image/*"></div>' +
            '<div class="field"><label>或直接填写图片 URL</label><input type="text" id="pickUrl" placeholder="https://..."></div>' +
            '<div class="actions"><button class="btn ghost" onclick="Admin.closeModal()">取消</button>' +
            '<button class="btn primary" id="pickOk">确定</button></div>');
        $('#pickOk').on('click', function () {
            var button = this;
            if (button.disabled) return;
            var file = $('#pickFile')[0].files[0];
            var url = $('#pickUrl').val().trim();
            if (file) {
                var fd = new FormData();
                fd.append('csrf_token', csrf());
                fd.append('file', file);
                button.disabled = true;
                toastr.info('上传中…');
                fetch('/api/upload_image.php', { method: 'POST', body: fd, credentials: 'same-origin' })
                    .then(function (r) { return r.json(); }).then(function (res) {
                        if (Admin.el('pickOk') !== button) return;
                        if (res.code !== 0) { toastr.error(res.msg); return; }
                        Admin.closeModal(); cb(res.data.url);
                    }).catch(function () { if (Admin.el('pickOk') === button) toastr.error('图片上传失败，请重试'); })
                    .finally(function () { button.disabled = false; });
            } else if (url) {
                if (!/^(https?:\/\/|\/(?!\/))/i.test(url)) {
                    toastr.warning('请输入 http(s) 图片地址或站内路径');
                    return;
                }
                Admin.closeModal(); cb(url);
            } else {
                toastr.warning('请先上传或填写 URL');
            }
        });
    };

    Admin.pickMedia = function (photos, callback, limit) {
        modalParents.push($('#modalBox').contents().detach());
        Admin.modal('从相册选择', '<div class="moment-thumbs" id="mediaLibrary">' + photos.map(function (p) {
            return '<label class="moment-thumb"><img src="' + Admin.esc(p.src) + '" alt="相册照片"><input type="checkbox" value="' + p.id + '" style="position:absolute;top:6px;left:6px;width:18px;height:18px"></label>';
        }).join('') + '</div><div class="actions"><button class="btn ghost" onclick="Admin.closeModal()">取消</button><button class="btn primary" id="mediaPickOk">添加所选</button></div>');
        Admin.el('mediaPickOk').onclick = function () {
            var ids = Array.from(Admin.el('mediaLibrary').querySelectorAll('input:checked')).map(function (i) { return Number(i.value); });
            if (ids.length > limit) return toastr.warning('最多还能添加 ' + limit + ' 张');
            var urls = photos.filter(function (p) { return ids.includes(Number(p.id)); }).map(function (p) { return p.src; });
            Admin.closeModal(); callback(urls);
        };
    };

    Admin.logout = function () {
        fetch('/api/user_api.php', {
            method: 'POST', credentials: 'same-origin',
            body: (() => { var f = new FormData(); f.append('csrf_token', csrf()); f.append('action', 'logout'); return f; })()
        }).then(function () { location.href = '/admin/login.php'; });
    };

    // 分页小组件
    Admin.pager = function (el, page, total, per, onGo) {
        var pages = Math.max(1, Math.ceil(total / per));
        if (pages <= 1) { el.innerHTML = ''; return; }
        var h = '<div style="display:flex;gap:8px;align-items:center;justify-content:center;margin-top:16px">';
        h += '<button class="btn small ghost" ' + (page <= 1 ? 'disabled' : '') + ' data-p="' + (page - 1) + '">上一页</button>';
        h += '<span class="muted">' + page + ' / ' + pages + '</span>';
        h += '<button class="btn small ghost" ' + (page >= pages ? 'disabled' : '') + ' data-p="' + (page + 1) + '">下一页</button></div>';
        el.innerHTML = h;
        el.querySelectorAll('button[data-p]').forEach(function (b) {
            b.onclick = function () { onGo(parseInt(b.dataset.p, 10)); };
        });
    };
})(window, jQuery);

/**
 * 首页逻辑 - 一周年倒计时 & 随机相册
 */

(function () {
    'use strict';

    if (window.__disposeIndexPage) window.__disposeIndexPage();
    var pageEvents = new AbortController();
    var pageTimers = new Set();
    var disposed = false;
    function setTimeout(callback, delay) {
        var timer = window.setTimeout(function () {
            pageTimers.delete(timer);
            if (!disposed) callback();
        }, delay);
        pageTimers.add(timer);
        return timer;
    }
    function setInterval(callback, delay) {
        var timer = window.setInterval(callback, delay);
        pageTimers.add(timer);
        return timer;
    }
    function fetch(url, options) {
        return window.fetch(url, Object.assign({}, options, { signal: pageEvents.signal }));
    }
    function dispose() {
        if (disposed) return;
        disposed = true;
        pageEvents.abort();
        pageTimers.forEach(function (timer) { window.clearTimeout(timer); window.clearInterval(timer); });
        pageTimers.clear();
        if (window.jQuery) window.jQuery(document).off('pjax:beforeReplace.indexPage', dispose);
        if (window._idxToggle === _idxToggle) delete window._idxToggle;
    }
    window.__disposeIndexPage = dispose;
    if (window.jQuery) window.jQuery(document).on('pjax:beforeReplace.indexPage', dispose);

    // ===== 动态数据源（来自数据库 moment_images + love_moments） =====
    var ALL_MOMENTS = window.__ALBUM_DATA__ || [];

    // 兼容：保留 ALL_PHOTOS 用于数据统计
    var ALL_PHOTOS = [];
    ALL_MOMENTS.forEach(function(m) {
        m.images.forEach(function(img) { ALL_PHOTOS.push(img); });
    });

    // ===== 工具：Fisher-Yates 洗牌算法 =====
    function shuffle(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = a[i];
            a[i] = a[j];
            a[j] = tmp;
        }
        return a;
    }

    // ===== 随机相册渲染 =====
    var refreshBtn = document.getElementById('albumRefresh');

    // 当前展示的动态数据
    var currentMoment = null;
    var sideMoments = [];

    // 仅保留有图片的动态（首页相册至少要有图）
    function getValidMoments() {
        return ALL_MOMENTS.filter(function (m) {
            return m.images && m.images.length > 0 && m.images[0];
        });
    }

    function renderAlbum() {
        var validMoments = getValidMoments();
        if (validMoments.length === 0) return;

        var shuffled = shuffle(validMoments);
        if (currentMoment && shuffled.length > 1 && shuffled[0].id === currentMoment.id) {
            var next = shuffled[0]; shuffled[0] = shuffled[1]; shuffled[1] = next;
        }
        // 左侧大图：随机选1条动态
        var mainMoment = shuffled[0];
        currentMoment = mainMoment;
        var storyImg = document.getElementById('storyImage');
        var storyDate = document.getElementById('storyDate');
        var storyAvatar = document.getElementById('storyAvatar');
        var storyLocation = document.getElementById('storyLocation');
        var storyWrap = document.querySelector('.album-main-story');

        if (storyImg) {
            storyWrap.classList.remove('fade-in', 'img-loaded', 'img-error');
            void storyWrap.offsetWidth;
            // 显示该动态的第一张图
            storyImg.src = mainMoment.images[0] || '';
            if (storyImg.complete && storyImg.naturalWidth > 0) storyWrap.classList.add('img-loaded');
            storyImg.alt = mainMoment.author_name + ' ' + mainMoment.moment_date;
            storyAvatar.src = mainMoment.author_avatar;
            storyDate.textContent = mainMoment.moment_date;
            storyLocation.textContent = mainMoment.location;
            var storyContent = document.getElementById('storyContent');
            if (storyContent) storyContent.textContent = mainMoment.content;
            storyWrap.classList.add('fade-in');
        }

        // 右侧2张椭圆：从剩余中随机选2条动态（不重复左侧大图）
        var sideCandidates = shuffled.slice(1);
        // 不足时复用大图，保证位置始终有图
        if (sideCandidates.length < 2) {
            while (sideCandidates.length < 2) {
                sideCandidates.push(mainMoment);
            }
        }
        sideMoments = sideCandidates.slice(0, 2);
        var sideItems = document.querySelectorAll('.album-side-grid .album-item');
        for (var j = 0; j < sideItems.length; j++) {
            var item = sideItems[j];
            item.classList.remove('fade-in', 'img-loaded', 'img-error');
            void item.offsetWidth;
            var sideImg = item.querySelector('img');
            var m = sideMoments[j];
            if (m && m.images && m.images[0]) {
                sideImg.src = m.images[0];
                sideImg.alt = m.author_name + ' ' + m.moment_date;
                sideImg.style.display = '';
                sideImg.style.cursor = 'pointer';
            } else {
                // 没有任何可用图片：隐藏整个 item，不显示破图占位
                sideImg.src = '';
                sideImg.style.display = 'none';
            }
            item.classList.add('fade-in');
            item.style.animationDelay = (j * 60) + 'ms';
        }

        // 装饰分页指示器（随机指向，纯装饰）
        var albumDots = document.querySelectorAll('.album-card .dot');
        var activeIdx = Math.floor(Math.random() * albumDots.length);
        albumDots.forEach(function (d) { d.classList.remove('active'); });
        if (albumDots[activeIdx]) albumDots[activeIdx].classList.add('active');
    }

    // 刷新按钮点击
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            // 旋转动画
            refreshBtn.classList.add('spinning');
            setTimeout(function () {
                refreshBtn.classList.remove('spinning');
            }, 650);
            renderAlbum();
        });
    }

    // 页面加载时初始化相册
    if (ALL_MOMENTS.length === 0 || getValidMoments().length === 0) {
        // 无任何动态：展示空状态提示，不显示破图
        var emptyEl = document.getElementById('albumEmpty');
        var albumGridEl = document.querySelector('.album-grid');
        if (emptyEl) emptyEl.style.display = '';
        if (albumGridEl) albumGridEl.style.display = 'none';
    } else {
        var emptyEl2 = document.getElementById('albumEmpty');
        var albumGridEl2 = document.querySelector('.album-grid');
        if (emptyEl2) emptyEl2.style.display = 'none';
        if (albumGridEl2) albumGridEl2.style.display = '';
        renderAlbum();
    }

    // ===== 点击照片 → 弹出动态悬浮卡片 =====
    // 利用 moment-interaction.js 的 openMomentPopup，构造临时 .moment-card 元素

    function buildTempMomentCard(momentData) {
        var safe = App.utils.escapeHtml;
        var gClass = momentData.author_gender === 1 ? 'male' : 'female';
        var gIcon = momentData.author_gender === 1 ? '♂' : '♀';
        var dateDay = momentData.date_day || '';
        var dateYear = momentData.date_year || '';

        // 构建图片 grid HTML
        var imgCount = momentData.images.length;
        var gridClass = imgCount > 0 ? 'count-' + Math.min(imgCount, 4) : '';
        var imgsHTML = '';
        momentData.images.forEach(function(url) {
            imgsHTML += '<img src="' + safe(url) + '" alt="' + safe(momentData.content || '') + '">';
        });

        var card = document.createElement('div');
        card.className = 'moment-card';
        card.dataset.momentId = momentData.id;
        card.dataset.authorId = momentData.author_id || 0;
        card.dataset.date = momentData.moment_date;
        card.style.display = 'none'; // 隐藏临时元素
        card.innerHTML =
            '<div class="moment-header">' +
                '<div class="moment-time">' +
                    '<div class="date-day">' + dateDay + '</div>' +
                    '<div class="date-year">' + dateYear + '</div>' +
                '</div>' +
                '<div class="moment-meta">' +
                    '<div class="moment-weather">' +
                        '<span class="weather-icon">' + (momentData.weather_icon || '') + '</span>' +
                        '<span>' + (momentData.weather_label || '') + '</span>' +
                    '</div>' +
                    '<div class="moment-location">' + safe(momentData.location || '') + '</div>' +
                '</div>' +
            '</div>' +
            (imgCount > 0 ?
                '<div class="moment-images">' +
                    '<div class="moment-images-grid ' + gridClass + '">' + imgsHTML + '</div>' +
                '</div>' : '') +
            (momentData.content ?
                '<div class="moment-content">' +
                    '<p class="moment-text">' + safe(momentData.content).replace(/\n/g, '<br>') + '</p>' +
                '</div>' : '') +
            '<div class="moment-footer">' +
                '<div class="moment-user">' +
                    '<img src="' + safe(momentData.author_avatar) + '" alt="' + safe(momentData.author_name) + '" class="moment-avatar">' +
                    '<span class="moment-gender ' + gClass + '">' + gIcon + '</span>' +
                '</div>' +
                '<div class="moment-actions">' +
                    '<button class="moment-like-btn">' +
                        '<span class="like-icon">♡</span>' +
                        '<span class="like-count">' + momentData.likes + '</span>' +
                    '</button>' +
                    '<button class="moment-comment-btn">' +
                        '<span class="comment-icon">💬</span>' +
                        '<span class="comment-count-label"></span>' +
                    '</button>' +
                '</div>' +
            '</div>';

        return card;
    }

    // 点击故事大图
    var storyImageEl = document.getElementById('storyImage');
    if (storyImageEl) {
        storyImageEl.style.cursor = 'pointer';
        storyImageEl.addEventListener('click', function () {
            if (!currentMoment) return;
            var tempCard = buildTempMomentCard(currentMoment);
            document.body.appendChild(tempCard);
            if (typeof openMomentPopup === 'function') {
                openMomentPopup(tempCard);
            }
            // 弹窗创建后移除临时元素（数据已被读取）
            setTimeout(function() { if (tempCard.parentNode) tempCard.parentNode.removeChild(tempCard); }, 100);
        });
    }

    // 点击右侧小图
    document.querySelectorAll('.album-side-grid .album-item').forEach(function(item, idx) {
        item.style.cursor = 'pointer';
        item.addEventListener('click', function() {
            if (sideMoments[idx]) {
                var tempCard = buildTempMomentCard(sideMoments[idx]);
                document.body.appendChild(tempCard);
                if (typeof openMomentPopup === 'function') {
                    openMomentPopup(tempCard);
                }
                setTimeout(function() { if (tempCard.parentNode) tempCard.parentNode.removeChild(tempCard); }, 100);
            }
        });
    });

    // ===== 一周年倒计时 =====
    var _togetherDate = window.__TOGETHER_DATE__ || '2025-02-14';
    var _togetherTime = window.__TOGETHER_TIME__ || '23:35';
    var START_DATE  = new Date(_togetherDate + 'T' + _togetherTime + ':00').getTime();
    var DAY_MS = 1000 * 60 * 60 * 24;
    var CIRCUMFERENCE = 2 * Math.PI * 82; // ≈ 515.22

    var daysEl     = document.getElementById('countdownDays');
    var descEl     = document.getElementById('countdownDesc');
    var progressEl = document.getElementById('countdownProgress');

    function updateCountdown() {
        var start = new Date(START_DATE);
        if (isNaN(start.getTime())) return;
        var now = new Date();
        function anniversary(year) {
            var day = Math.min(start.getDate(), new Date(year, start.getMonth() + 1, 0).getDate());
            return new Date(year, start.getMonth(), day);
        }
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var targetYear = Math.max(start.getFullYear() + 1, now.getFullYear());
        var target = anniversary(targetYear);
        if (target < today) target = anniversary(++targetYear);
        var previous = anniversary(targetYear - 1);
        // Calendar-day differences stay stable across daylight-saving transitions.
        function calendarDay(date) { return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS; }
        var countdown = calendarDay(target) - calendarDay(today);
        var yearNumber = targetYear - start.getFullYear();

        if (daysEl) daysEl.textContent = countdown;

        if (countdown === 0) {
            if (descEl) descEl.textContent = '🎉 今天是我们在一起的第 ' + yearNumber + ' 周年！';
        } else {
            if (descEl) descEl.textContent = '距离我们的第 ' + yearNumber + ' 周年还有：' + countdown + ' 天';
        }

        var progress = Math.max(0, Math.min(1, (calendarDay(today) - calendarDay(previous)) / (calendarDay(target) - calendarDay(previous))));
        var offset = CIRCUMFERENCE * (1 - progress);
        if (progressEl) progressEl.setAttribute('stroke-dashoffset', offset);
    }

    updateCountdown();
    setTimeout(updateCountdown, 400);
    setInterval(updateCountdown, 60000);

    // ===== 音乐播放器（与全局歌单播放器同步） =====
    var musicNameEl = document.getElementById('musicName');
    var musicArtistEl = document.getElementById('musicArtist');
    var musicCoverImg = document.getElementById('musicCoverImg');
    var musicDiscEl = document.getElementById('musicDisc');
    var playBtn = document.getElementById('musicPlay');
    var prevBtn = document.getElementById('musicPrev');
    var nextBtn = document.getElementById('musicNext');
    var progressFill = document.getElementById('musicProgressFill');
    var currentEl = document.getElementById('musicCurrent');
    var durationEl = document.getElementById('musicDuration');
    var progressBar = document.getElementById('musicProgressBar');

    function _idxFormatTime(sec) {
        if (isNaN(sec) || sec < 0) return '0:00';
        var m = Math.floor(sec / 60);
        var s = Math.floor(sec % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    // 同步卡片显示为当前全局播放器的歌
    function _idxSyncToPlayer() {
        if (typeof PLAYLIST === 'undefined' || PLAYLIST.length === 0) return;
        var displayIdx = (typeof _plIndex !== 'undefined' && _plIndex >= 0) ? _plIndex : 0;
        var song = PLAYLIST[displayIdx];
        if (!song) return;
        if (musicNameEl) musicNameEl.textContent = song.name;
        if (musicArtistEl) musicArtistEl.textContent = song.artist;
        if (musicCoverImg) musicCoverImg.src = song.cover;

        // 同步播放状态
        if (typeof _plAudio !== 'undefined') {
            var playing = !_plAudio.paused && !_plAudio.ended;
            if (musicDiscEl) {
                if (playing) musicDiscEl.classList.add('playing');
                else musicDiscEl.classList.remove('playing');
            }
            if (playBtn) {
                playBtn.innerHTML = playing
                    ? '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/></svg>'
                    : '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
            }
            // 同步进度
            if (_plAudio.duration) {
                var pct = (_plAudio.currentTime / _plAudio.duration * 100).toFixed(1);
                if (progressFill) progressFill.style.width = pct + '%';
                if (currentEl) currentEl.textContent = _idxFormatTime(_plAudio.currentTime);
                if (durationEl) durationEl.textContent = _idxFormatTime(_plAudio.duration);
            }
        }
    }

    // 初始化：同步到全局播放器当前状态
    _idxSyncToPlayer();

    // 播放/暂停：直接使用全局播放器
    function _idxToggle() {
        if (typeof _plAudio === 'undefined') return;
        if (!_plAudio.paused && !_plAudio.ended) {
            _plPause();
        } else {
            _plPlay();
        }
    }
    window._idxToggle = _idxToggle;

    if (playBtn) playBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        _idxToggle();
    });

    if (prevBtn) prevBtn.addEventListener('click', function() {
        if (typeof _plPrev === 'function') _plPrev();
    });

    if (nextBtn) nextBtn.addEventListener('click', function() {
        if (typeof _plNext === 'function') _plNext();
    });

    // 进度条点击
    if (progressBar) {
        progressBar.addEventListener('click', function(e) {
            if (typeof _plAudio === 'undefined' || !_plAudio.duration) return;
            var rect = progressBar.getBoundingClientRect();
            var pct = (e.clientX - rect.left) / rect.width;
            _plAudio.currentTime = pct * _plAudio.duration;
        });
    }

    // 监听全局播放器事件来同步卡片UI
    if (typeof _plAudio !== 'undefined') {
        ['play', 'pause', 'playing'].forEach(function (event) {
            _plAudio.addEventListener(event, _idxSyncToPlayer, { signal: pageEvents.signal });
        });
    }

    // ===== 数据统计 =====
    var statOnlineEl = document.getElementById('statOnline');
    var statAlbumEl = document.getElementById('statAlbum');
    var statMessageEl = document.getElementById('statMessage');

    // 相册数量（来自数据库动态数量）
    if (statAlbumEl) statAlbumEl.textContent = ALL_MOMENTS.length;

    // 聊天在线人数 & 留言数量 - 通过API获取
    function fetchStats() {
        // 从聊天API获取真实在线人数
        fetch('api/chat_api.php?action=heartbeat', { credentials: 'same-origin' })
            .then(function(r){ return r.json(); })
            .then(function(res){
                if (res.code === 0 && statOnlineEl) {
                    var total = (res.data.onlineUsers || 0) + (res.data.onlineGuests || 0);
                    statOnlineEl.textContent = total;
                }
            })
            .catch(function(){
                if (statOnlineEl) statOnlineEl.textContent = '0';
            });

        // 从数据库获取真实留言数量
        fetch('api/message_api.php?limit=1', { credentials: 'same-origin' })
            .then(function(r){ return r.json(); })
            .then(function(res){
                if (res.code === 0 && statMessageEl) statMessageEl.textContent = res.data.total || 0;
            })
            .catch(function(){
                if (statMessageEl) statMessageEl.textContent = '0';
            });
    }

    fetchStats();

    // ===== 恋爱清单进度 =====
    var LIST_DONE = Number((window.__LOVELIST_STATS__ || {}).done) || 0;
    var LIST_TOTAL = Number((window.__LOVELIST_STATS__ || {}).total) || 0;
    var LIST_CIRC = 2 * Math.PI * 42; // ≈ 263.89

    var listPercentEl = document.getElementById('listPercent');
    var listRingFill = document.getElementById('listRingFill');
    var listDoneEl = document.getElementById('listDone');
    var listTotalEl = document.getElementById('listTotal');

    function updateListProgress() {
        var pct = LIST_TOTAL > 0 ? LIST_DONE / LIST_TOTAL : 0;
        var offset = LIST_CIRC * (1 - pct);
        if (listPercentEl) listPercentEl.textContent = Math.round(pct * 100) + '%';
        if (listRingFill) listRingFill.setAttribute('stroke-dashoffset', offset.toFixed(2));
        if (listDoneEl) listDoneEl.textContent = LIST_DONE;
        if (listTotalEl) listTotalEl.textContent = LIST_TOTAL;
    }

    // 延迟触发圆环动画
    setTimeout(updateListProgress, 600);

    // ===== 重要日子倒计时网格 =====
    var COUNTDOWN_EVENTS = [];
    var rawDays = window.__IMPORTANT_DAYS__ || [];
    rawDays.forEach(function(d) {
        var evt = {
            id: d.id,
            category: d.category,
            name: d.name,
            emoji: d.icon,
            color: d.color,
            barBg: d.bar_bg,
            targetDate: d.target_date,
            festival_key: d.festival_key,
            birthday_calendar: d.birthday_calendar
        };
        if (d.date_type === 'mapped' && d.date_map) {
            // 农历/浮动日期映射
            evt.dateMap = d.date_map;
        } else if (d.month && d.day) {
            // 阳历固定日期
            evt.month = d.month;
            evt.day = d.day;
        }
        COUNTDOWN_EVENTS.push(evt);
    });

    var MINI_CIRC = 2 * Math.PI * 40; // ≈ 251.33

    function getNextOccurrence(evt) {
        if (window.ImportantDays && evt.targetDate) return window.ImportantDays.next(evt);
        if (evt.targetDate && evt.category === 'countdown') {
            return new Date(evt.targetDate + 'T00:00:00');
        }
        var now = new Date();
        var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 映射日期查找（农历/浮动节日）
        if (evt.dateMap) {
            for (var y = now.getFullYear(); y <= now.getFullYear() + 2; y++) {
                if (evt.dateMap[y]) {
                    var d = new Date(evt.dateMap[y] + 'T00:00:00');
                    if (d >= todayStart) return d;
                }
            }
        }

        // 固定日期
        if (evt.month && evt.day) {
            var target = new Date(now.getFullYear(), evt.month - 1, evt.day);
            if (target < todayStart) {
                target = new Date(now.getFullYear() + 1, evt.month - 1, evt.day);
            }
            return target;
        }
        return null;
    }

    function getPrevOccurrence(evt) {
        if (window.ImportantDays && evt.targetDate) return window.ImportantDays.previous(evt);
        if (evt.targetDate && evt.category === 'countdown') return null;
        var now = new Date();
        var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 映射日期查找
        if (evt.dateMap) {
            for (var y = now.getFullYear() + 1; y >= now.getFullYear() - 1; y--) {
                if (evt.dateMap[y]) {
                    var d = new Date(evt.dateMap[y] + 'T00:00:00');
                    if (d < todayStart) return d;
                }
            }
        }

        if (evt.month && evt.day) {
            var target = new Date(now.getFullYear(), evt.month - 1, evt.day);
            if (target >= todayStart) {
                target = new Date(now.getFullYear() - 1, evt.month - 1, evt.day);
            }
            return target;
        }
        return null;
    }

    function renderCountdownGrid() {
        var grid = document.getElementById('countdownGrid');
        if (!grid) return;

        var now = new Date();
        var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 计算每个事件
        var items = COUNTDOWN_EVENTS.map(function (evt) {
            var next = getNextOccurrence(evt);
            var prev = getPrevOccurrence(evt);
            var days = next ? Math.ceil((next - todayStart) / 86400000) : 999;
            var totalDays = (next && prev) ? Math.ceil((next - prev) / 86400000) : 365;
            var progress = totalDays > 0 ? (totalDays - days) / totalDays : 0;
            return { evt: evt, next: next, days: days, progress: Math.max(0, Math.min(1, progress)) };
        });

        // 按剩余天数排序
        items.sort(function (a, b) { return a.days - b.days; });

        var html = '';
        items.forEach(function (item, idx) {
            var evt = item.evt;
            var offset = (MINI_CIRC * (1 - item.progress)).toFixed(2);
            var isToday = item.days === 0;
            var dateStr = '';
            if (item.next) {
                dateStr = (item.next.getMonth() + 1) + '月' + item.next.getDate() + '日';
            }

            html += '<div class="cd-item' + (isToday ? ' cd-item-today' : '') + '" style="animation-delay:' + (idx * 80) + 'ms">';
            html += '  <div class="cd-item-emoji">' + evt.emoji + '</div>';
            var safeName = document.createElement('span');
            safeName.textContent = evt.name;
            html += '  <div class="cd-item-name">' + safeName.innerHTML + '</div>';
            html += '  <div class="cd-item-ring">';
            html += '    <svg class="cd-ring-svg" viewBox="0 0 100 100">';
            html += '      <circle cx="50" cy="50" r="40" fill="none" stroke="#F0E0DA" stroke-width="6"/>';
            html += '      <circle cx="50" cy="50" r="40" fill="none" stroke="' + evt.color + '" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + MINI_CIRC.toFixed(2) + '" stroke-dashoffset="' + offset + '" transform="rotate(-90 50 50)" style="opacity:0.85;transition:stroke-dashoffset 1.2s ease-out ' + (idx * 0.1 + 0.3) + 's"/>';
            html += '    </svg>';
            html += '    <div class="cd-item-center">';
            if (isToday) {
                html += '      <span class="cd-item-today-label" style="color:' + evt.color + '">今天！</span>';
            } else if (!item.next) {
                html += '      <span class="cd-item-today-label">暂不可用</span>';
            } else {
                html += '      <span class="cd-item-num" style="color:' + evt.color + '">' + Math.abs(item.days) + '</span>';
                html += '      <span class="cd-item-unit" style="color:' + evt.color + '">' + (item.days < 0 ? '天前' : '天') + '</span>';
            }
            html += '    </div>';
            html += '  </div>';
            html += '  <div class="cd-item-bar">';
            html += '    <div class="cd-item-bar-fill" style="width:' + (item.progress * 100).toFixed(1) + '%;background:' + evt.barBg + ';animation-delay:' + (idx * 0.1 + 0.5) + 's"></div>';
            html += '  </div>';
            html += '  <div class="cd-item-date">' + dateStr + '</div>';
            html += '</div>';
        });

        grid.innerHTML = html;
    }

    renderCountdownGrid();

    // ===== 倒计时网格滑动控制 =====
    // 核心：所有滑动（箭头/分页点/拖拽/触摸）统一到同一坐标系——
    // 以"一列步长 step = 实测列宽 + gap"为唯一基准，从根上消除吸附/翻页对不齐。
    (function initCdScroll() {
        var grid = document.getElementById('countdownGrid');
        var arrowL = document.getElementById('cdArrowLeft');
        var arrowR = document.getElementById('cdArrowRight');
        var dotsWrap = document.getElementById('cdDots');
        if (!grid || !arrowL || !arrowR || !dotsWrap) return;
        var scrollArea = grid.closest('.cd-scroll-area');

        var items = grid.querySelectorAll('.cd-item');
        if (items.length === 0) return;

        var totalItems = items.length;
        var gap = 14, colW = 128, step = colW + gap, colsPerPage = 2, totalPages = 1;

        // 实测列宽 + gap，得到唯一步长 step；据此推每页列数与总页数
        function measure() {
            var cs = window.getComputedStyle(grid);
            gap = parseFloat(cs.columnGap || cs.gap) || 14;
            var first = grid.querySelector('.cd-item');
            colW = first ? first.getBoundingClientRect().width : 128;
            step = colW + gap;
            colsPerPage = Math.max(Math.floor((grid.clientWidth + gap) / step), 1);
            var totalCols = Math.ceil(totalItems / 2); // 双行布局，列数 = 向上取整(总数/2)
            totalPages = Math.max(Math.ceil(totalCols / colsPerPage), 1);
        }
        measure();

        // 不需要滑动则隐藏所有控件
        if (totalPages <= 1 && grid.scrollWidth <= grid.clientWidth + 4) {
            arrowL.classList.remove('visible');
            arrowR.classList.remove('visible');
            dotsWrap.classList.add('hidden');
            if (scrollArea) scrollArea.classList.remove('can-scroll-right');
            return;
        }

        // 渲染分页点
        function renderDots() {
            var html = '';
            for (var i = 0; i < totalPages; i++) {
                html += '<span class="cd-dot' + (i === 0 ? ' active' : '') + '" data-page="' + i + '"></span>';
            }
            dotsWrap.innerHTML = html;
            dotsWrap.classList.toggle('hidden', totalPages <= 1);
        }
        renderDots();

        // 当前页 = 当前滚动位置 / 每页宽度(step*colsPerPage)
        function getCurrentPage() {
            var pageW = step * colsPerPage;
            if (pageW < 1) return 0;
            return Math.round(grid.scrollLeft / pageW);
        }

        // 滚到第 page 页——落点为"列步长的整数倍"，天然对齐列 snap 点
        function scrollToPage(page) {
            page = Math.max(0, Math.min(page, totalPages - 1));
            var target = page * colsPerPage * step;
            var maxScroll = grid.scrollWidth - grid.clientWidth;
            grid.scrollTo({ left: Math.min(target, maxScroll), behavior: 'smooth' });
        }

        // 更新箭头/分页点/渐隐遮罩（基于实际滚动位置，最精确）
        function updateState() {
            var maxScroll = grid.scrollWidth - grid.clientWidth;
            var atStart = grid.scrollLeft <= 4;
            var atEnd = grid.scrollLeft >= maxScroll - 4;
            arrowL.classList.toggle('visible', !atStart);
            arrowR.classList.toggle('visible', !atEnd);
            if (scrollArea) scrollArea.classList.toggle('can-scroll-right', !atEnd);
            var page = getCurrentPage();
            var dots = dotsWrap.querySelectorAll('.cd-dot');
            dots.forEach(function (d, i) { d.classList.toggle('active', i === page); });
        }

        // 箭头点击：翻一整页
        arrowL.addEventListener('click', function () { scrollToPage(getCurrentPage() - 1); });
        arrowR.addEventListener('click', function () { scrollToPage(getCurrentPage() + 1); });

        // 分页点点击
        dotsWrap.addEventListener('click', function (e) {
            var dot = e.target.closest('.cd-dot');
            if (!dot) return;
            scrollToPage(parseInt(dot.dataset.page, 10));
        });

        // 滚动时更新状态
        var scrollTimer;
        grid.addEventListener('scroll', function () {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(updateState, 80);
        }, { passive: true });

        // PC 端鼠标滚轮：纵向滚动 → 横向滚动，更顺手
        grid.addEventListener('wheel', function (e) {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                grid.scrollLeft += e.deltaY;
                e.preventDefault();
            }
        }, { passive: false });

        // ===== 鼠标拖拽滚动（电脑端） =====
        var isDragging = false, moved = false, startX = 0, scrollStart = 0;

        grid.addEventListener('mousedown', function (e) {
            isDragging = true;
            moved = false;
            startX = e.pageX;
            scrollStart = grid.scrollLeft;
            grid.style.cursor = 'grabbing';
            grid.style.scrollSnapType = 'none'; // 拖拽期间关闭吸附，避免与手动定位打架
            e.preventDefault();
        });

        document.addEventListener('mousemove', function (e) {
            if (!isDragging) return;
            var dx = e.pageX - startX;
            if (Math.abs(dx) > 3) moved = true;
            grid.scrollLeft = scrollStart - dx;
        }, { signal: pageEvents.signal });

        document.addEventListener('mouseup', function () {
            if (!isDragging) return;
            isDragging = false;
            grid.style.cursor = '';
            grid.style.scrollSnapType = '';
            if (!moved) return;
            // 松手：吸附到最近一列（同为 step 倍数，与 CSS proximity 一致，不回跳）
            setTimeout(function () {
                var col = Math.round(grid.scrollLeft / step);
                var maxScroll = grid.scrollWidth - grid.clientWidth;
                grid.scrollTo({ left: Math.min(col * step, maxScroll), behavior: 'smooth' });
                updateState();
            }, 40);
        }, { signal: pageEvents.signal });

        // 初始状态
        setTimeout(updateState, 300);

        // 窗口尺寸变化时重算 step / 分页
        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                measure();
                renderDots();
                updateState();
            }, 200);
        }, { signal: pageEvents.signal });
    })();

    // ===== 工具函数 =====
    function escapeHtml2(str) {
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function formatRelativeTime(isoString) {
        var date = new Date(isoString);
        var now = new Date();
        var diff = now - date;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
        var M = String(date.getMonth() + 1).padStart(2, '0');
        var D = String(date.getDate()).padStart(2, '0');
        var h = String(date.getHours()).padStart(2, '0');
        var m = String(date.getMinutes()).padStart(2, '0');
        return M + '.' + D + ' ' + h + ':' + m;
    }

    function formatChatTime(isoString) {
        var date = new Date(isoString);
        var h = String(date.getHours()).padStart(2, '0');
        var m = String(date.getMinutes()).padStart(2, '0');
        return h + ':' + m;
    }

    // 根据用户ID生成头像背景色
    function getAvatarBgColor(userId) {
        var colors = ['#E88A7A','#7AC5E8','#A0D468','#EDAB5E','#AC92EC','#4FC1E9','#FF6B8B','#50C9A8','#F6BB42','#8CC152'];
        return colors[userId % colors.length];
    }

    // ===== 留言墙卡片（从数据库API获取） =====
    var MSG_API = 'api/message_api.php?limit=10';
    var msgCardBody = document.getElementById('messageCardBody');

    function renderMessageCard(data) {
        if (!msgCardBody) return;
        var list = data.list || [];

        if (list.length === 0) {
            msgCardBody.innerHTML = '<div class="extra-empty"><span class="extra-empty-icon">💌</span>还没有留言，快来写下第一条吧！</div>';
            return;
        }

        var html = '';
        list.forEach(function (row, idx) {
            var name = row.display_name || '访客';
            var initial = name.charAt(0).toUpperCase();
            var avatarHtml;
            if (row.avatar) {
                avatarHtml = '<img class="msg-avatar-img" src="' + escapeHtml2(row.avatar) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
                    + '<div class="msg-avatar" style="display:none;background:' + getAvatarBgColor(row.user_id || 0) + ';color:#fff">' + escapeHtml2(initial) + '</div>';
            } else {
                avatarHtml = '<div class="msg-avatar" style="background:' + getAvatarBgColor(row.user_id || 0) + ';color:#fff">' + escapeHtml2(initial) + '</div>';
            }

            var giftHtml = row.gift_icon ? ' <span class="msg-gift">' + escapeHtml2(row.gift_icon) + ' ' + escapeHtml2(row.gift_name) + '</span>' : '';
            var locationHtml = row.ip_location ? '<span class="msg-location">📍' + escapeHtml2(row.ip_location) + '</span>' : '';

            html += '<div class="msg-item" style="animation-delay:' + (idx * 80) + 'ms">';
            html += '  <div class="msg-avatar-wrap">' + avatarHtml + '</div>';
            html += '  <div class="msg-content">';
            html += '    <div class="msg-top"><span class="msg-name">' + escapeHtml2(name) + '</span>' + giftHtml + locationHtml + '<span class="msg-time">' + formatRelativeTime(row.created_at) + '</span></div>';
            if (row.img) {
                html += '    <img class="msg-img" src="' + escapeHtml2(row.img) + '" alt="图片" loading="lazy">';
            }
            html += '    <div class="msg-text">' + escapeHtml2(row.content) + '</div>';
            html += '  </div>';
            html += '</div>';
        });

        msgCardBody.innerHTML = html;
    }

    // 从API加载留言
    if (msgCardBody) {
        fetch(MSG_API, { credentials: 'same-origin' })
            .then(function(r){ return r.json(); })
            .then(function(res){
                if (res.code === 0) renderMessageCard(res.data);
                else renderMessageCard({ list: [] });
            })
            .catch(function(){ renderMessageCard({ list: [] }); });
    }

    // 留言自动滚动
    (function () {
        if (!msgCardBody) return;
        var scrollEl = msgCardBody;
        var paused = false;
        scrollEl.addEventListener('mouseenter', function () { paused = true; });
        scrollEl.addEventListener('mouseleave', function () { paused = false; });
        scrollEl.addEventListener('touchstart', function () { paused = true; }, { passive: true });
        scrollEl.addEventListener('touchend', function () { paused = false; }, { passive: true });

        setInterval(function () {
            if (paused) return;
            if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2) {
                scrollEl.scrollTop = 0;
            } else {
                scrollEl.scrollTop += 1;
            }
        }, 60);
    })();

    // ===== 聊天室卡片（从数据库API获取最新5条） =====
    var CHAT_API = 'api/chat_api.php?limit=5';
    var chatCardBody = document.getElementById('chatCardBody');

    function renderChatCard(data) {
        if (!chatCardBody) return;
        var list = data.list || [];

        // 硬删除后不再有撤回标记，直接使用列表
        var activeMsgs = list;

        if (activeMsgs.length === 0) {
            chatCardBody.innerHTML = '<div class="extra-empty"><span class="extra-empty-icon">💬</span>聊天室还没有消息，快来聊天吧！</div>';
            return;
        }

        // 只取最新5条
        var recent = activeMsgs.slice(-5);
        var html = '';
        recent.forEach(function (msg, idx) {
            var name = msg.display_name || '访客';
            var initial = name.charAt(0).toUpperCase();
            var bgColor = getAvatarBgColor(msg.user_id || 0);

            // 头像：有图片用图片，无图片用首字母
            var avatarHtml;
            if (msg.avatar) {
                avatarHtml = '<img class="chat-avatar-img" src="' + escapeHtml2(msg.avatar) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
                    + '<div class="chat-avatar" style="display:none;background:' + bgColor + '">' + escapeHtml2(initial) + '</div>';
            } else {
                avatarHtml = '<div class="chat-avatar" style="background:' + bgColor + '">' + escapeHtml2(initial) + '</div>';
            }

            html += '<div class="chat-item" style="animation-delay:' + (idx * 80) + 'ms">';
            html += '  <div class="chat-avatar-wrap">' + avatarHtml + '</div>';
            html += '  <div class="chat-content">';
            html += '    <div class="chat-top"><span class="chat-nickname" style="color:' + bgColor + '">' + escapeHtml2(name) + '</span>';
            if (msg.is_admin) {
                html += '<span class="chat-admin-badge">官</span>';
            }
            html += '<span class="chat-time">' + formatChatTime(msg.created_at) + '</span></div>';
            if (msg.image) {
                html += '    <img class="chat-bubble-img" src="' + escapeHtml2(msg.image) + '" alt="图片" loading="lazy">';
            }
            if (msg.content) {
                html += '    <div class="chat-bubble">' + escapeHtml2(msg.content) + '</div>';
            }
            html += '  </div>';
            html += '</div>';
        });

        chatCardBody.innerHTML = html;
        // 滚动到底部
        chatCardBody.scrollTop = chatCardBody.scrollHeight;
    }

    // 从API加载聊天消息
    if (chatCardBody) {
        fetch(CHAT_API, { credentials: 'same-origin' })
            .then(function(r){ return r.json(); })
            .then(function(res){
                if (res.code === 0) renderChatCard(res.data);
                else renderChatCard({ list: [] });
            })
            .catch(function(){ renderChatCard({ list: [] }); });
    }

    // ===== 相册分页指示器（纯装饰，无点击切换） =====
})();

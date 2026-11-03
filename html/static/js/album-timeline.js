/* 时间轴筛选交互 + Masonry 布局 */
(function () {
    if (window.__disposeAlbumTimeline) window.__disposeAlbumTimeline();
    var initializedRoot = null;
    window.__disposeAlbumTimeline = function () {
        document.removeEventListener('DOMContentLoaded', init);
        document.removeEventListener('pjax:ready', init);
    };
    var MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    var MONTH_EMOJI = ['', '', '', '', '', '', '', '', '', '', '', ''];

    var currentYear = 2025;
    var selectedMonth = 'all';
    var timelineData = {};

    // ========== Masonry 布局 ==========

    // Preserve card order while removing wrappers from older layouts.
    function layoutMasonry() {
        var container = document.querySelector('.moments-container');
        if (!container) return;

        var cards = Array.from(container.querySelectorAll('.moment-card'));
        cards.forEach(function (card, index) {
            if (!card.hasAttribute('data-layout-order')) card.dataset.layoutOrder = index;
        });
        cards.sort(function (a, b) { return Number(a.dataset.layoutOrder) - Number(b.dataset.layoutOrder); });

        // 先把所有卡片（包括隐藏的）移回 container，防止删除旧列时丢失
        cards.forEach(function (card) {
            container.appendChild(card);
        });

        // 移除旧的列容器（此时卡片已安全移出）
        container.querySelectorAll('.masonry-column').forEach(function (col) { col.remove(); });

        // CSS owns responsive columns, including before scripts load or after failures.
    }

    // ========== 时间轴交互 ==========

    // 解析卡片数据，提取年月
    function parseCards() {
        timelineData = {};
        var cards = document.querySelectorAll('.moment-card');
        cards.forEach(function (card) {
            var timeEl = card.querySelector('.moment-time');
            if (!timeEl) return;

            var dayEl = timeEl.querySelector('.date-day');
            var yearEl = timeEl.querySelector('.date-year');
            if (!dayEl || !yearEl) return;

            var dayStr = dayEl.textContent.trim();   // MM-DD
            var yearStr = yearEl.textContent.trim();  // YYYY

            var year = parseInt(yearStr);
            var month = null;

            // 解析月份：MM-DD → 取 MM
            var parts = dayStr.split('-');
            if (parts.length >= 1) {
                month = parseInt(parts[0]);
            }

            if (year && month) {
                card.setAttribute('data-year', year);
                card.setAttribute('data-month', month);

                if (!timelineData[year]) timelineData[year] = {};
                if (!timelineData[year][month]) timelineData[year][month] = 0;
                timelineData[year][month]++;
            }
        });

        if (Object.keys(timelineData).length === 0) {
            timelineData[2025] = {};
        }
    }

    // 获取可用年份列表
    function getYears() {
        return Object.keys(timelineData).map(Number).sort();
    }

    // 渲染时间轴节点
    function renderTimeline() {
        var track = document.getElementById('timelineTrack');
        if (!track) return;

        // 清除旧节点（保留 timeline-line）
        var line = track.querySelector('.timeline-line');
        track.innerHTML = '';
        if (line) track.appendChild(line);

        var yearData = timelineData[currentYear] || {};
        var hasData = Object.keys(yearData).length > 0;

        // "全部"节点
        var allNode = createNode('all', '全部', 0, true);
        track.appendChild(allNode);

        // 1-12月节点
        for (var m = 1; m <= 12; m++) {
            var count = yearData[m] || 0;
            var node = createNode(m, MONTH_NAMES[m - 1], count, false);
            track.appendChild(node);
        }

        // 更新选中状态
        updateActiveState();

        // 更新年份箭头
        updateYearNav();
    }

    // 创建单个节点
    function createNode(month, label, count, isAll) {
        var node = document.createElement('div');
        node.className = 'timeline-node' + (isAll ? ' all-node' : '') + (count === 0 && !isAll ? ' empty' : '');
        node.setAttribute('data-month', month);

        var dot = document.createElement('div');
        dot.className = 'timeline-dot';

        // 计数显示在圆点内部
        if (count > 0 || isAll) {
            var countEl = document.createElement('span');
            countEl.className = 'timeline-count';
            var countValue;
            if (isAll) {
                // "全部"显示所有年份的总数
                countValue = 0;
                for (var y in timelineData) {
                    var yearData = timelineData[y];
                    for (var k in yearData) { countValue += yearData[k]; }
                }
            } else {
                countValue = count;
            }
            countEl.textContent = countValue;
            countEl.setAttribute('data-count', countValue);
            dot.appendChild(countEl);
            dot.classList.add('has-count');
        }

        node.appendChild(dot);

        var labelEl = document.createElement('span');
        labelEl.className = 'timeline-label';
        if (isAll) {
            labelEl.textContent = label;
        } else {
            var emojiEl = document.createElement('span');
            emojiEl.className = 'timeline-label-emoji';
            emojiEl.textContent = MONTH_EMOJI[month - 1] || '';
            labelEl.appendChild(emojiEl);
            var textEl = document.createElement('span');
            textEl.textContent = label;
            labelEl.appendChild(textEl);
        }
        node.appendChild(labelEl);

        // 点击事件（无数据月份不可点）
        if (count > 0 || isAll) {
            node.addEventListener('click', function () {
                selectedMonth = month;
                updateActiveState();
                filterCards();
            });
        }

        return node;
    }

    // 更新选中状态
    function updateActiveState() {
        var nodes = document.querySelectorAll('.timeline-node');
        nodes.forEach(function (n) {
            var m = n.getAttribute('data-month');
            if (m === 'all') m = 'all';
            else m = parseInt(m);

            var dot = n.querySelector('.timeline-dot');
            var countEl = dot ? dot.querySelector('.timeline-count') : null;

            if (m === selectedMonth) {
                n.classList.add('active');
                if (dot) dot.classList.add('heart');
                if (countEl) countEl.textContent = '♥';
            } else {
                n.classList.remove('active');
                if (dot) dot.classList.remove('heart');
                if (countEl) {
                    var origCount = countEl.getAttribute('data-count');
                    countEl.textContent = origCount || '';
                }
            }
        });
    }

    // 更新年份导航
    function updateYearNav() {
        var years = getYears();
        var yearText = document.getElementById('timelineYear');
        var prevBtn = document.getElementById('yearPrev');
        var nextBtn = document.getElementById('yearNext');

        if (yearText) yearText.textContent = currentYear;

        if (prevBtn) {
            var hasPrev = years.indexOf(currentYear) > 0;
            prevBtn.classList.toggle('disabled', !hasPrev);
        }
        if (nextBtn) {
            var idx = years.indexOf(currentYear);
            var hasNext = idx < years.length - 1;
            nextBtn.classList.toggle('disabled', !hasNext);
        }
    }

    // 筛选卡片
    function filterCards() {
        var cards = document.querySelectorAll('.moment-card');
        cards.forEach(function (card) {
            var cardYear = parseInt(card.getAttribute('data-year'));
            var cardMonth = parseInt(card.getAttribute('data-month'));

            if (isNaN(cardYear) || isNaN(cardMonth)) {
                card.style.display = '';
                return;
            }

            if (selectedMonth === 'all') {
                // "全部"显示所有年份的记录
                card.style.display = '';
            } else {
                card.style.display = (cardYear === currentYear && cardMonth === selectedMonth) ? '' : 'none';
            }
        });

        // 重新分配 masonry 布局
        layoutMasonry();
    }

    // 初始化
    function init() {
        var root = document.getElementById('albumTimeline');
        if (!root || root === initializedRoot) return;
        initializedRoot = root;
        parseCards();

        // 默认年份取数据中最小的年份
        var years = getYears();
        if (years.length > 0) {
            currentYear = years[0];
        }

        renderTimeline();
        filterCards();

        // 年份切换
        var prevBtn = document.getElementById('yearPrev');
        var nextBtn = document.getElementById('yearNext');

        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                var years = getYears();
                var idx = years.indexOf(currentYear);
                if (idx > 0) {
                    currentYear = years[idx - 1];
                    selectedMonth = 'all';
                    renderTimeline();
                    filterCards();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                var years = getYears();
                var idx = years.indexOf(currentYear);
                if (idx < years.length - 1) {
                    currentYear = years[idx + 1];
                    selectedMonth = 'all';
                    renderTimeline();
                    filterCards();
                }
            });
        }

        // 鼠标拖动滑动时间轴
        var wrapper = document.querySelector('.timeline-track-wrapper');
        if (wrapper) {
            var isDown = false;
            var startX;
            var scrollLeft;

            wrapper.addEventListener('mousedown', function (e) {
                isDown = true;
                wrapper.style.cursor = 'grabbing';
                startX = e.pageX - wrapper.offsetLeft;
                scrollLeft = wrapper.scrollLeft;
            });

            wrapper.addEventListener('mouseleave', function () {
                isDown = false;
                wrapper.style.cursor = '';
            });

            wrapper.addEventListener('mouseup', function () {
                isDown = false;
                wrapper.style.cursor = '';
            });

            wrapper.addEventListener('mousemove', function (e) {
                if (!isDown) return;
                e.preventDefault();
                var x = e.pageX - wrapper.offsetLeft;
                var walk = (x - startX) * 1.5;
                wrapper.scrollLeft = scrollLeft - walk;
            });
        }

        // 首次 masonry 布局
        layoutMasonry();

        // 窗口 resize 时重新布局
        // 防重绑定：多次 PJAX 切回会反复执行 init，避免叠加大量 handler 造成卡顿
        if (!window.__albumTimelineResizeBound) {
            window.__albumTimelineResizeBound = true;
            var resizeTimer;
            window.addEventListener('resize', function () {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(layoutMasonry, 200);
            });
        }
    }

    // DOM 加载后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 关键：PJAX 无刷新切换回相册页后需要重建 masonry 布局、时间轴节点和月份筛选
    document.addEventListener('pjax:ready', init);
})();

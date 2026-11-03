/**
 * 浏览器端图片压缩工具（独立模块，可全局调用）
 * 纯原生实现，无任何第三方依赖。
 *
 * 调用方式:
 *   compressImage(file, maxSizeKB, callback);
 *
 * 压缩策略（二分质量搜索 + 保险兜底）:
 *   1. 使用 URL.createObjectURL，避免大文件 dataURL 内存暴增。
 *   2. Canvas 尺寸上限 4096px（超过等比缩放），防止全分辨率编码崩浏览器。
 *   3. ratio < 0.25 时直接估算安全初始 scale，不从 scale=1.0 裸起步。
 *   4. 固定尺寸下对 quality 做二分搜索：只接受“体积 <= 上限”的结果，
 *      返回其中画质最高（体积最大）者——保证【绝不返回超标文件】导致图床拒绝。
 *   5. 若当前尺寸下即使最低画质仍超标，则缩小尺寸后再次二分搜索。
 *   6. 每轮从原图出发，避免 JPEG 累积失真。
 *   7. 全链路 try-catch + console.log，便于排查。
 */
(function (global) {
    'use strict';

    var TOLERANCE_MB    = 0.2;
    var STRICT_ROUNDS   = 3;
    var MAX_ATTEMPTS    = 5;
    var QUALITY_MAX     = 0.92;
    var QUALITY_MIN     = 0.30;
    var SCALE_MIN       = 0.10;
    var CANVAS_MAX_PX   = 4096;   // canvas 单边尺寸上限，防浏览器崩溃

    function compressImage(file, maxSizeKB, callback) {
        try {
            if (!file || !(file instanceof Blob)) {
                console.warn('[compress] 无效文件');
                callback(null);
                return;
            }
        } catch (e) {
            console.warn('[compress] instanceof 检测异常:', e);
            callback(null);
            return;
        }

        var targetBytes    = maxSizeKB * 1024;
        var toleranceBytes = TOLERANCE_MB * 1024 * 1024;
        var originalSize   = file.size;

        if (originalSize <= targetBytes) {
            console.log('[compress] 原图体积 ' + (originalSize/1024/1024).toFixed(2) + 'MB 已在上限内，不压缩');
            callback(file);
            return;
        }

        var outputType = 'image/jpeg';
        if (file.type === 'image/png' || file.type === 'image/webp') {
            outputType = file.type;
        }

        var objectUrl;
        try {
            objectUrl = URL.createObjectURL(file);
        } catch (e) {
            console.error('[compress] 创建 objectURL 失败:', e);
            callback(null);
            return;
        }

        var img = new Image();

        img.onload = function () {
            URL.revokeObjectURL(objectUrl);

            try {
                var actualW = img.width;
                var actualH = img.height;

                if (!actualW || !actualH) {
                    console.error('[compress] 图片尺寸异常:', actualW, '×', actualH);
                    callback(null);
                    return;
                }

                var ratio = targetBytes / originalSize;

                var scale;
                if (ratio >= 0.25) {
                    scale = 1.0;
                } else {
                    scale = Math.sqrt(ratio * 3);
                    scale = Math.max(0.20, scale);
                }
                var canvasLimitScale = CANVAS_MAX_PX / Math.max(actualW, actualH);
                if (canvasLimitScale < 1.0) {
                    scale = Math.min(scale, canvasLimitScale);
                }

                var quality = Math.min(QUALITY_MAX, 0.30 + 0.60 * ratio);

                console.log('[compress] 开始 → 原图 ' + (originalSize/1024/1024).toFixed(2) +
                    'MB ' + actualW + '×' + actualH +
                    ' | 目标 ' + (targetBytes/1024/1024).toFixed(2) + 'MB' +
                    ' | ratio=' + ratio.toFixed(3) +
                    ' | 初始 q=' + quality.toFixed(3) + ' s=' + scale.toFixed(3));

                // 二分质量搜索：在固定尺寸下对 quality 做二分，只接受“体积 <= 上限”的结果，
                // 返回其中画质最高（体积最大）者。从根本上保证【绝不返回超标文件】。
                var searchScale = scale;

                function encodeAt(q, sc, done) {
                    var w = Math.max(1, Math.round(actualW * sc));
                    var h = Math.max(1, Math.round(actualH * sc));
                    var cv = document.createElement('canvas');
                    cv.width = w; cv.height = h;
                    try {
                        cv.getContext('2d').drawImage(img, 0, 0, w, h);
                    } catch (e) {
                        console.error('[compress] drawImage 异常:', e);
                        done(null);
                        return;
                    }
                    console.log('[compress] 编码 canvas ' + w + '×' + h + ' q=' + q.toFixed(3) + ' s=' + sc.toFixed(3));
                    cv.toBlob(function (blob) {
                        if (!blob) { done(null); return; }
                        done(blob);
                    }, outputType, q);
                }

                function searchQuality(sc, done) {
                    var lo = QUALITY_MIN, hi = QUALITY_MAX;
                    var best = null;   // 体积 <= 上限 中的最优（最大）结果
                    var attempts = 0;
                    (function step() {
                        if (attempts >= MAX_ATTEMPTS) { done(best); return; }
                        attempts++;
                        var q = (lo + hi) / 2;
                        encodeAt(q, sc, function (blob) {
                            if (!blob) { done(best); return; }
                            var size = blob.size;
                            console.log('[compress] q=' + q.toFixed(3) + ' → ' +
                                (size / 1024 / 1024).toFixed(2) + 'MB' +
                                (size <= targetBytes ? ' ✓达标' : ' ✗超标'));
                            if (size <= targetBytes) {
                                best = new File([blob], file.name, { type: outputType, lastModified: Date.now() });
                                lo = q;                        // 仍可尝试更高画质
                                if (hi - lo < 0.02) { done(best); return; }
                                step();
                            } else {
                                hi = q;                        // 需降低画质
                                if (hi - lo < 0.02) { done(best); return; }
                                step();
                            }
                        });
                    })();
                }

                (function run(sc) {
                    searchQuality(sc, function (res) {
                        if (res) {
                            console.log('[compress] 完成，输出 ' + (res.size / 1024 / 1024).toFixed(2) +
                                'MB（<= 上限 ' + (targetBytes / 1024 / 1024).toFixed(2) + 'MB）');
                            callback(res);
                            return;
                        }
                        // 当前尺寸下即使最低画质仍超标 → 缩小尺寸后重试
                        var nextSc = Math.max(SCALE_MIN, sc * 0.7);
                        if (nextSc < sc - 1e-6 && sc > SCALE_MIN + 1e-6) {
                            console.log('[compress] 当前尺寸最低画质仍超标，缩小尺寸重试');
                            run(nextSc);
                        } else {
                            console.warn('[compress] 无法压缩到体积上限内');
                            callback(null);
                        }
                    });
                })(searchScale);
            } catch (e) {
                console.error('[compress] img.onload 体内异常:', e);
                callback(null);
            }
        };

        img.onerror = function () {
            URL.revokeObjectURL(objectUrl);
            console.error('[compress] 图片加载失败');
            callback(null);
        };

        img.src = objectUrl;
    }

    global.compressImage = compressImage;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = compressImage;
    }
})(typeof window !== 'undefined' ? window : this);

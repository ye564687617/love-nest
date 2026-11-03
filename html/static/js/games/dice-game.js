// 幸运骰子游戏逻辑

let diceCurrentPlayer = 'female'; // female 或 male
let diceFirstPlayer = 'female';
let femaleScore = 0;
let maleScore = 0;
let isRolling = false;
let diceAutoCloseTimer = null;
let diceWatchdogTimer = null;   // 看门狗：动画异常中断时兜底解锁，避免按钮卡死

// 开始骰子游戏
function startDiceGame() {
    document.querySelector('.game-selector').style.display = 'none';
    document.getElementById('dice-game-container').style.display = 'block';
    document.getElementById('dice-selector').style.display = 'block';
    document.getElementById('dice-area').style.display = 'none';

    // 重置游戏
    resetDiceGame();
}

// 重置骰子游戏
function resetDiceGame() {
    femaleScore = 0;
    maleScore = 0;
    diceCurrentPlayer = 'female';
    diceFirstPlayer = 'female';
    isRolling = false;

    // 清除定时器
    if (diceAutoCloseTimer) {
        clearTimeout(diceAutoCloseTimer);
        diceAutoCloseTimer = null;
    }

    document.getElementById('female-score').textContent = '?';
    document.getElementById('male-score').textContent = '?';

    // 重置骰子外观：角度归零、点数回到初始图标、清掉动画状态类
    const diceBox = document.getElementById('dice-box');
    if (diceBox) {
        diceBox.style.transform = 'rotate(0deg)';
        diceBox.classList.remove('rolling', 'landing');
    }
    const diceEl = document.querySelector('.dice');
    if (diceEl) {
        diceEl.style.transform = 'rotate(0deg)';
        diceEl.textContent = '🎲';
    }

    // 重置按钮状态
    const rollBtn = document.getElementById('roll-dice-btn');
    if (rollBtn) {
        rollBtn.disabled = false;
    }
}

// 选择先手玩家
function selectFirstPlayer(player) {
    diceFirstPlayer = player;
    diceCurrentPlayer = player;

    // 切换到游戏界面
    document.getElementById('dice-selector').style.display = 'none';
    document.getElementById('dice-area').style.display = 'block';

    // 更新回合提示
    updateTurnIndicator();
}

// 更新回合提示
function updateTurnIndicator() {
    const playerName = diceCurrentPlayer === 'female' ? '女方' : '男方';
    const playerIcon = diceCurrentPlayer === 'female' ? '👸' : '🤴';
    document.getElementById('dice-turn-indicator').innerHTML = `
        <span class="turn-player">${playerIcon} ${playerName}</span> 的回合
    `;
}

// 释放投掷锁：任何结束 / 异常路径都走它，保证按钮一定能恢复可用
function releaseRollLock() {
    isRolling = false;
    const btn = document.getElementById('roll-dice-btn');
    if (btn) btn.disabled = false;
    const box = document.getElementById('dice-box');
    if (box) box.classList.remove('rolling', 'landing');
}

// 投掷骰子
function rollDice() {
    if (isRolling) return;

    isRolling = true;
    document.getElementById('roll-dice-btn').disabled = true;

    // 看门狗：若动画因任何原因没能正常收尾，6.5 秒后强制解锁
    // （滚动最长 5 秒 + 落定回弹 0.46 秒，需留出余量，避免动画未结束就被解锁）
    if (diceWatchdogTimer) clearTimeout(diceWatchdogTimer);
    diceWatchdogTimer = setTimeout(releaseRollLock, 6500);

    const diceBox = document.getElementById('dice-box');
    const diceElement = document.querySelector('.dice');
    const diceIcons = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

    // 结果先定好，动画只负责"表现过程"，避免结尾再抽一次
    const finalScore = Math.floor(Math.random() * 6) + 1;

    // 从「当前角度」接着转，连续投掷时角度是连续的，不会跳回 0 度
    const prevMatch = /rotate\(\s*([-\d.]+)deg\s*\)/.exec(diceElement.style.transform || '');
    let rotation = prevMatch ? parseFloat(prevMatch[1]) : 0;

    // 盒子跳动 + 骰子自转
    diceBox.classList.remove('landing');
    diceBox.classList.add('rolling');

    // 缓出节奏：切换间隔从 45ms 起按 1.13 倍递增，先快后慢
    // 总时长随机 3~5 秒，结束时自然减速停下
    const TOTAL = 3000 + Math.random() * 2000;
    let elapsed = 0;
    let interval = 45;

    (function tick() {
        try {
            diceElement.textContent = diceIcons[Math.floor(Math.random() * 6)];
            rotation += 55 + Math.random() * 95;
            diceElement.style.transform = `rotate(${rotation}deg)`;

            elapsed += interval;
            interval *= 1.13;

            if (elapsed >= TOTAL) {
                // 动画正常收尾 → 撤销看门狗
                if (diceWatchdogTimer) clearTimeout(diceWatchdogTimer);

                // 落到 360° 的整数倍：骰子摆正，且始终顺势向前，不会出现角度回跳
                rotation = Math.ceil(rotation / 360) * 360;
                diceElement.style.transform = `rotate(${rotation}deg)`;

                // 停止滚动 → 落定回弹
                diceBox.classList.remove('rolling');
                diceBox.classList.add('landing');
                setTimeout(function () {
                    diceBox.classList.remove('landing');
                }, 800);

                showDiceResult(finalScore);
                return;
            }
        } catch (err) {
            // 动画中途出错也必须解锁，绝不能把按钮留在禁用状态
            releaseRollLock();
            return;
        }
        setTimeout(tick, interval);
    })();
}

// 显示骰子结果
function showDiceResult(score) {
    // 保存分数
    if (diceCurrentPlayer === 'female') {
        femaleScore = score;
        document.getElementById('female-score').textContent = score;
    } else {
        maleScore = score;
        document.getElementById('male-score').textContent = score;
    }

    // 更新骰子显示 - 最终静止状态，显示对应点数
    // 角度已由 rollDice 定格为 360° 的整数倍，这里不再重置，避免视觉跳变
    const diceElement = document.querySelector('.dice');
    const diceIcons = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    diceElement.textContent = diceIcons[score - 1];

    // 显示中间结果卡片
    showIntermediateResult(score);
}

// 显示中间结果卡片（每次投掷后）
function showIntermediateResult(score) {
    const playerName = diceCurrentPlayer === 'female' ? '女方' : '男方';
    const playerIcon = diceCurrentPlayer === 'female' ? '👸' : '🤴';

    document.getElementById('intermediate-icon').textContent = playerIcon;
    document.getElementById('intermediate-title').textContent = `${playerName}投出了`;
    document.getElementById('intermediate-score').textContent = score + ' 点';

    // 显示卡片
    document.getElementById('intermediate-modal').classList.add('active');

    // 5秒后自动关闭
    diceAutoCloseTimer = setTimeout(() => {
        closeIntermediateAndContinue();
    }, 5000);
}

// 关闭中间卡片并继续
function closeIntermediateAndContinue() {
    // 清除定时器
    if (diceAutoCloseTimer) {
        clearTimeout(diceAutoCloseTimer);
        diceAutoCloseTimer = null;
    }

    // 关闭卡片
    document.getElementById('intermediate-modal').classList.remove('active');

    // 短暂延迟后继续（160ms：比原来的 300ms 更跟手）
    setTimeout(() => {
        if (diceCurrentPlayer === diceFirstPlayer) {
            // 切换到第二个玩家
            diceCurrentPlayer = diceCurrentPlayer === 'female' ? 'male' : 'female';
            updateTurnIndicator();
        } else {
            // 两人都投完了,显示结果
            showFinalResult();
        }
        // 关键：无论「换人」还是「本局结束」都要解锁。
        // 否则最后一轮结束后若用 × / 遮罩关掉结果弹窗，投掷按钮会一直禁用、点了没反应。
        releaseRollLock();
    }, 160);
}

// 显示最终结果
function showFinalResult() {
    let resultTitle = '';
    let resultContent = '';
    let resultIcon = '🏆';

    if (femaleScore > maleScore) {
        resultTitle = '女方获胜!';
        resultContent = '👸 女方以 ' + femaleScore + ' 点获胜!';
        resultIcon = '👑';
    } else if (maleScore > femaleScore) {
        resultTitle = '男方获胜!';
        resultContent = '🤴 男方以 ' + maleScore + ' 点获胜!';
        resultIcon = '👑';
    } else {
        resultTitle = '平局!';
        resultContent = '双方都是 ' + femaleScore + ' 点,平局!';
        resultIcon = '🤝';
    }

    // 更新弹窗内容
    document.getElementById('dice-result-icon').textContent = resultIcon;
    document.getElementById('dice-result-title').textContent = resultTitle;
    document.getElementById('dice-result-content').textContent = resultContent;
    document.getElementById('modal-female-score').textContent = femaleScore;
    document.getElementById('modal-male-score').textContent = maleScore;

    // 显示弹窗
    document.getElementById('dice-result-modal').classList.add('active');
}

// 关闭骰子结果弹窗
// 本局已结束，无论用哪种方式（× / 遮罩 / 再玩一次）关闭，
// 都回到「选择先手」界面，避免停留在已结束的投掷区造成状态错乱
function closeDiceModal() {
    document.getElementById('dice-result-modal').classList.remove('active');
    resetDiceGame();
    document.getElementById('dice-selector').style.display = 'block';
    document.getElementById('dice-area').style.display = 'none';
}

// 再玩一次
function retryDice() {
    closeDiceModal();
}

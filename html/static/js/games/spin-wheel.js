// 幸运转盘游戏逻辑

let canvas = null;
let ctx = null;
let currentWheelType = 'food';
let wheelOptions = [];
let isSpinning = false;
let currentRotation = 0;
let wheelHistory = [];

// 转盘配置
const wheelConfig = {
    food: {
        options: ['火锅', '烧烤', '日料', '西餐', '中餐', '韩料', '快餐', '甜品'],
        colors: ['#FF6B9D', '#BC13FE', '#0FF0FC', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9']
    },
    play: {
        options: ['看电影', '逛街', '公园', '游乐园', '爬山', '海边', 'KTV', '咖啡馆'],
        colors: ['#0FF0FC', '#BC13FE', '#FF6B9D', '#F7DC6F', '#98D8C8', '#85C1E9', '#FFA07A', '#BB8FCE']
    },
    custom: {
        options: ['选项1', '选项2', '选项3', '选项4', '选项5', '选项6'],
        colors: ['#BC13FE', '#0FF0FC', '#FF6B9D', '#F7DC6F', '#98D8C8', '#85C1E9']
    }
};

// 开始转盘游戏
function startSpinWheel() {
    document.querySelector('.game-selector').style.display = 'none';
    document.getElementById('spin-wheel-container').style.display = 'block';
    
    // 初始化画布
    if (!canvas) {
        canvas = document.getElementById('spin-wheel-canvas');
        ctx = canvas.getContext('2d');
    }
    
    // 初始化转盘，默认选择"今天吃什么"
    currentWheelType = 'food';
    wheelOptions = wheelConfig.food.options.slice();
    
    // 设置选中状态
    document.querySelectorAll('.wheel-type-card').forEach(card => {
        card.classList.remove('active');
    });
    document.querySelector('.wheel-type-card').classList.add('active');
    
    // 绘制转盘
    drawWheel();
}

// 选择转盘类型
function selectWheelType(type, evt) {
    currentWheelType = type;
    
    // 更新选中状态
    document.querySelectorAll('.wheel-type-card').forEach(card => {
        card.classList.remove('active');
    });
    (evt || event).target.closest('.wheel-type-card').classList.add('active');
    
    // 显示/隐藏自定义输入框
    const customArea = document.getElementById('custom-options');
    if (type === 'custom') {
        customArea.style.display = 'block';
        // 应用默认自定义选项
        wheelOptions = wheelConfig.custom.options.slice();
    } else {
        customArea.style.display = 'none';
        wheelOptions = wheelConfig[type].options.slice();
    }
    
    // 绘制转盘
    drawWheel();
    
    // 清除之前的结果
    document.getElementById('wheel-result').style.display = 'none';
}

// 应用自定义选项
function applyCustomOptions() {
    const textarea = document.getElementById('custom-textarea');
    const text = textarea.value.trim();
    
    if (!text) {
        toastr.warning('请输入至少一个选项哦~');
        return;
    }
    
    // 解析选项(每行一个)
    const options = text.split('\n').filter(opt => opt.trim()).map(opt => opt.trim());
    
    if (options.length < 2) {
        toastr.warning('至少需要2个选项哦~');
        return;
    }
    
    if (options.length > 12) {
        toastr.warning('最多支持12个选项~');
        return;
    }
    
    wheelOptions = options;
    wheelConfig.custom.options = options;
    
    // 根据选项数量生成颜色
    const colors = generateColors(options.length);
    wheelConfig.custom.colors = colors;
    
    // 重新绘制转盘
    drawWheel();
    
    toastr.success('自定义选项已应用！');
}

// 生成颜色
function generateColors(count) {
    const baseColors = ['#FF6B9D', '#BC13FE', '#0FF0FC', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
}

// 绘制转盘
function drawWheel() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const sliceAngle = (2 * Math.PI) / wheelOptions.length;
    const colors = wheelConfig[currentWheelType].colors;
    
    // 绘制每个扇形
    wheelOptions.forEach((option, index) => {
        const startAngle = index * sliceAngle + currentRotation;
        const endAngle = startAngle + sliceAngle;
        
        // 绘制扇形
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        
        // 设置颜色
        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();
        
        // 绘制边框
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 绘制文字
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px "Noto Sans SC", sans-serif';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        
        // 根据文字长度调整位置
        const text = option.length > 6 ? option.substring(0, 6) + '...' : option;
        ctx.fillText(text, radius - 30, 6);
        ctx.restore();
    });
    
    // 绘制中心圆
    ctx.beginPath();
    ctx.arc(centerX, centerY, 55, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = 'rgba(188, 19, 254, 0.3)';
    ctx.lineWidth = 3;
    ctx.stroke();
}

// 开始转动
function spinTheWheel() {
    if (isSpinning) return;
    
    isSpinning = true;
    document.getElementById('spin-btn').disabled = true;
    
    // 隐藏之前的结果
    document.getElementById('wheel-result').style.display = 'none';
    
    // 随机旋转角度 (至少5圈 + 随机角度)
    const minRotations = 5;
    const randomAngle = Math.random() * 2 * Math.PI;
    const targetRotation = currentRotation + (minRotations * 2 * Math.PI) + randomAngle;
    
    // 动画参数
    const duration = 4000; // 4秒
    const startTime = Date.now();
    const startRotation = currentRotation;
    
    // 缓动函数
    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    // 动画循环
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = easeOutCubic(progress);
        
        currentRotation = startRotation + (targetRotation - startRotation) * easeProgress;
        
        drawWheel();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // 动画结束
            isSpinning = false;
            document.getElementById('spin-btn').disabled = false;
            
            // 计算结果
            showWheelResult();
        }
    }
    
    animate();
}

// 显示转盘结果
function showWheelResult() {
    // 计算指针指向的扇区 (指针在顶部)
    const sliceAngle = (2 * Math.PI) / wheelOptions.length;
    
    // 标准化当前旋转角度到 0-2π
    let normalizedRotation = currentRotation % (2 * Math.PI);
    if (normalizedRotation < 0) normalizedRotation += 2 * Math.PI;
    
    // 指针在顶部 (270度或 3π/2)
    const pointerAngle = (3 * Math.PI / 2 - normalizedRotation + 2 * Math.PI) % (2 * Math.PI);
    
    // 计算指向哪个扇区
    const selectedIndex = Math.floor(pointerAngle / sliceAngle);
    const result = wheelOptions[selectedIndex];
    
    // 弹窗显示结果
    document.getElementById('modal-result').textContent = result;
    document.getElementById('wheel-result-modal').classList.add('active');
    
    // 添加到历史记录
    addToHistory(result);
    
    // 庆祝效果
    celebrate();
}

// 关闭转盘结果弹窗
function closeWheelModal() {
    document.getElementById('wheel-result-modal').classList.remove('active');
}

// 添加到历史记录
function addToHistory(result) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    wheelHistory.unshift({
        result: result,
        time: timeStr
    });
    
    // 只保留最近10条记录
    if (wheelHistory.length > 10) {
        wheelHistory.pop();
    }
    
    // 更新历史记录显示
    updateHistoryDisplay();
}

// 更新历史记录显示
function updateHistoryDisplay() {
    const historyContainer = document.getElementById('wheel-history');
    const historyList = document.getElementById('history-list');
    
    if (wheelHistory.length === 0) {
        historyContainer.style.display = 'none';
        return;
    }
    
    historyContainer.style.display = 'block';
    
    const html = wheelHistory.map((item, index) => `
        <div class="history-item">
            <span class="history-time">${item.time}</span>
            <span class="history-result">${item.result}</span>
        </div>
    `).join('');
    
    historyList.innerHTML = html;
}

// 庆祝效果(简单的页面震动)
function celebrate() {
    const container = document.getElementById('spin-wheel-container');
    container.style.animation = 'shake 0.5s';
    setTimeout(() => {
        container.style.animation = '';
    }, 500);
}

// 添加震动动画
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

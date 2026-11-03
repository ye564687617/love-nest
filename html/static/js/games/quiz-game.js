// 情侣问答游戏逻辑

let currentQuestions = [];
let currentPlayer = 1;
let currentQuestionIndex = 0;
let player1Answers = [];
let player2Answers = [];
let totalQuestions = 10;

// 开始问答游戏
function startQuizGame() {
    document.querySelector('.game-selector').style.display = 'none';
    document.getElementById('quiz-game-container').style.display = 'block';
    document.getElementById('quiz-tutorial').style.display = 'block';
    document.getElementById('quiz-area').style.display = 'none';
    document.getElementById('quiz-result').style.display = 'none';
}

// 返回游戏选择器
function backToGameSelector() {
    document.querySelector('.game-selector').style.display = 'flex';
    document.getElementById('quiz-game-container').style.display = 'none';
    document.getElementById('spin-wheel-container').style.display = 'none';
    document.getElementById('dice-game-container').style.display = 'none';
    
    // 重置问答游戏
    resetQuiz();
}

// 重置问答游戏
function resetQuiz() {
    currentPlayer = 1;
    currentQuestionIndex = 0;
    player1Answers = [];
    player2Answers = [];
}

// 开始测试
function startQuiz() {
    // 获取随机题目
    currentQuestions = getRandomQuestions(totalQuestions);
    
    // 切换到答题界面
    document.getElementById('quiz-tutorial').style.display = 'none';
    document.getElementById('quiz-area').style.display = 'block';
    document.getElementById('total-questions').textContent = totalQuestions;
    
    // 显示第一题
    showQuestion();
}

// 显示当前问题
function showQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    
    // 更新进度
    document.getElementById('current-question').textContent = currentQuestionIndex + 1;
    document.getElementById('q-num').textContent = currentQuestionIndex + 1;
    
    // 更新当前玩家提示
    const playerName = currentPlayer === 1 ? '女方' : '男方';
    const playerIcon = currentPlayer === 1 ? '👩' : '👨';
    document.getElementById('current-player-indicator').innerHTML = `
        <span class="player-name">${playerIcon} ${playerName}</span> 的回合
    `;
    
    // 显示问题
    document.getElementById('question-text').textContent = question.question;
    
    // 显示选项
    const optionsHtml = question.options.map((option, index) => `
        <div class="answer-option" onclick="selectAnswer(${index})">${option}</div>
    `).join('');
    
    document.getElementById('answer-options').innerHTML = optionsHtml;
}

// 选择答案
function selectAnswer(answerIndex) {
    // 保存答案
    if (currentPlayer === 1) {
        player1Answers.push(answerIndex);
    } else {
        player2Answers.push(answerIndex);
    }
    
    // 添加选中效果
    const options = document.querySelectorAll('.answer-option');
    options[answerIndex].classList.add('selected');
    
    // 延迟后继续
    setTimeout(() => {
        // 切换玩家或下一题
        if (currentPlayer === 1) {
            // 切换到玩家2回答同一题
            currentPlayer = 2;
            showQuestion();
        } else {
            // 两人都回答完了,进入下一题
            currentQuestionIndex++;
            currentPlayer = 1;
            
            if (currentQuestionIndex < totalQuestions) {
                showQuestion();
            } else {
                // 所有题目完成,显示结果
                showResult();
            }
        }
    }, 500);
}

// 显示结果
function showResult() {
    document.getElementById('quiz-area').style.display = 'none';
    document.getElementById('quiz-result').style.display = 'block';
    
    // 计算默契度
    let sameCount = 0;
    for (let i = 0; i < player1Answers.length; i++) {
        if (player1Answers[i] === player2Answers[i]) {
            sameCount++;
        }
    }
    
    const matchScore = Math.round((sameCount / totalQuestions) * 100);
    
    // 动画显示分数
    animateScore(matchScore);
    
    // 设置结果信息
    document.getElementById('same-count').textContent = sameCount;
    document.getElementById('total-count').textContent = totalQuestions;
    
    // 设置结果消息
    const message = getResultMessage(matchScore);
    document.getElementById('result-message').textContent = message;
}

// 动画显示分数
function animateScore(targetScore) {
    let currentScore = 0;
    const scoreElement = document.getElementById('match-score');
    const duration = 1500;
    const increment = targetScore / (duration / 16);
    
    const timer = setInterval(() => {
        currentScore += increment;
        if (currentScore >= targetScore) {
            currentScore = targetScore;
            clearInterval(timer);
        }
        scoreElement.textContent = Math.round(currentScore);
    }, 16);
}

// 根据分数获取结果消息
function getResultMessage(score) {
    if (score === 100) {
        return '💯 太厉害了！你们简直是天生一对,心有灵犀！';
    } else if (score >= 80) {
        return '🌟 默契度超高！你们非常了解对方,继续加油！';
    } else if (score >= 60) {
        return '💕 不错的默契！你们对彼此有很好的了解~';
    } else if (score >= 40) {
        return '😊 还有进步空间哦,多沟通多交流会更好！';
    } else if (score >= 20) {
        return '💪 要多多了解对方啦,一起努力吧！';
    } else {
        return '😅 看来你们需要更多时间相处哦~';
    }
}

// 再玩一次
function retryQuiz() {
    resetQuiz();
    document.getElementById('quiz-tutorial').style.display = 'block';
    document.getElementById('quiz-result').style.display = 'none';
}

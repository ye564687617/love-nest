      // 滚动显示标题栏 - 优化版（带节流）
        let lastScrollTop = 0;
        const headerBar = document.querySelector('.header-bar');
        const mobileBottomNav = document.getElementById('mobileBottomNav');
        let scrollTicking = false;
        
        window.addEventListener('scroll', function() {
            if (scrollTicking) return;
            scrollTicking = true;
            requestAnimationFrame(function() {
                scrollTicking = false;
                let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > 100) { // 滚动超过100px显示标题栏
                headerBar.classList.add('show');
                // 手机端底栏与顶部栏同步显示
                if(mobileBottomNav) mobileBottomNav.classList.add('show');
                
                // 根据滚动位置调整透明度
                const opacity = Math.min(0.97, 0.6 + scrollTop / 800);
                headerBar.style.backgroundColor = `rgba(255, 255, 255, ${opacity})`;
            } else {
                headerBar.classList.remove('show');
                // 手机端底栏与顶部栏同步隐藏
                if(mobileBottomNav) mobileBottomNav.classList.remove('show');
                headerBar.style.backgroundColor = '';
            }
            
            lastScrollTop = scrollTop;
            }); // end requestAnimationFrame
        });

        // 创建爱心飞散效果
        function createHeartParticles(element) {
            const container = document.querySelector('.hearts-container');
            const heart = document.querySelector('.heart-pulse');
            const rect = heart.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            // 创建20个小爱心
            for (let i = 0; i < 20; i++) {
                const particle = document.createElement('div');
                particle.className = 'heart-particle';
                
                // 随机角度
                const angle = Math.random() * Math.PI * 2;
                // 计算起点位置（从爱心中心开始）
                const startX = 0;
                const startY = 0;
                // 计算终点位置
                const distance = 50 + Math.random() * 150;
                const endX = Math.cos(angle) * distance;
                const endY = Math.sin(angle) * distance;
                // 中间点
                const midX = endX * 0.7;
                const midY = endY * 0.7;
                
                // 随机动画参数
                const duration = 1 + Math.random() * 2;
                const delay = Math.random() * 0.5;
                const size = 10 + Math.random() * 15;
                
                particle.style.left = `${centerX - size/2}px`;
                particle.style.top = `${centerY - size/2}px`;
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                particle.style.setProperty('--mid-x', `${midX}px`);
                particle.style.setProperty('--mid-y', `${midY}px`);
                particle.style.setProperty('--end-x', `${endX}px`);
                particle.style.setProperty('--end-y', `${endY}px`);
                particle.style.animation = `fadeHeartFloat ${duration}s ease-out ${delay}s forwards`;
                
                container.appendChild(particle);
                
                // 动画结束后移除元素
                particle.addEventListener('animationend', function() {
                    particle.remove();
                });
            }
        }

        // 处理头像点击事件
        document.querySelectorAll('.fade-avatar').forEach(element => {
            element.addEventListener('click', function() {
                createHeartParticles(this);
            });
        });
        
        // 处理鼠标进入事件-头像
        document.querySelectorAll('.avatar-frame').forEach(frame => {
            frame.addEventListener('mouseenter', function() {
                createHeartParticles(this);
            });
        });
        
        // 处理头像点击事件-时间
        document.querySelectorAll('.time-unit').forEach(element => {
            element.addEventListener('click', function() {
                createHeartParticles(this);
            });
        });
        
         // 处理鼠标进入事件-时间
        document.querySelectorAll('.time-unit').forEach(frame => {
            frame.addEventListener('mouseenter', function() {
                createHeartParticles(this);
            });
        });
        
            // 处理心跳点击事件
        document.querySelectorAll('.center-heart').forEach(element => {
            element.addEventListener('click', function() {
                createHeartParticles(this);
            });
        });
        
        // 处理心跳进入事件
        document.querySelectorAll('.center-heart').forEach(frame => {
            frame.addEventListener('mouseenter', function() {
                createHeartParticles(this);
            });
        });
        
         // 加载完页面后执行心跳
        window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.querySelectorAll('.center-heart').forEach(element => {
            createHeartParticles(element); // 直接执行，无需点击触发
        });
    }, 1500); // 延迟1.5秒）
});

// 用户下拉菜单
function toggleUserMenu() {
    const userEl = document.getElementById('headerUser');
    if (!userEl) return;
    // 未登录（访客）态：点击直接唤起登录卡片，缩短操作路径
    if (userEl.classList.contains('header-user--guest')) {
        if (typeof showAuthCard === 'function') showAuthCard('login');
        return;
    }
    userEl.classList.toggle('open');
}

// 点击外部关闭下拉菜单
document.addEventListener('click', function(e) {
    const userEl = document.getElementById('headerUser');
    if (userEl && !userEl.contains(e.target)) {
        userEl.classList.remove('open');
    }
});

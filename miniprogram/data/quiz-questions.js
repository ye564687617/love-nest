// 情侣问答题库（60道题目）
const quizQuestions = [
    // 喜好类
    {
        question: "对方最喜欢的水果是什么？",
        options: ["草莓", "苹果", "香蕉", "西瓜", "葡萄", "橙子"],
        category: "preferences"
    },
    {
        question: "对方最喜欢的季节是？",
        options: ["春天", "夏天", "秋天", "冬天"],
        category: "preferences"
    },
    {
        question: "对方最喜欢的颜色是？",
        options: ["红色", "蓝色", "粉色", "白色", "黑色", "绿色"],
        category: "preferences"
    },
    {
        question: "对方更喜欢猫还是狗？",
        options: ["猫", "狗", "都喜欢", "都不喜欢"],
        category: "preferences"
    },
    {
        question: "对方更喜欢早起还是晚睡？",
        options: ["早起", "晚睡", "看情况"],
        category: "preferences"
    },
    {
        question: "对方更喜欢哪种天气？",
        options: ["晴天", "雨天", "阴天", "雪天"],
        category: "preferences"
    },
    {
        question: "对方更喜欢海边还是山上？",
        options: ["海边", "山上", "都喜欢", "都不喜欢"],
        category: "preferences"
    },
    {
        question: "对方更喜欢热闹还是安静？",
        options: ["热闹", "安静", "看情况"],
        category: "preferences"
    },
    // 食物类
    {
        question: "对方更喜欢吃甜还是咸的？",
        options: ["甜", "咸", "都喜欢", "都不喜欢"],
        category: "food"
    },
    {
        question: "对方最喜欢喝什么饮料？",
        options: ["奶茶", "咖啡", "果汁", "白开水", "汽水", "茶"],
        category: "food"
    },
    {
        question: "对方最喜欢吃什么类型的食物？",
        options: ["中餐", "西餐", "日料", "韩料", "东南亚菜", "火锅"],
        category: "food"
    },
    {
        question: "对方更喜欢吃辣吗？",
        options: ["超爱吃辣", "一般", "不太能吃", "完全不吃"],
        category: "food"
    },
    {
        question: "对方更喜欢吃饭还是面食？",
        options: ["米饭", "面食", "都喜欢"],
        category: "food"
    },
    {
        question: "对方最喜欢吃哪种肉类？",
        options: ["猪肉", "牛肉", "鸡肉", "羊肉", "海鲜", "素食"],
        category: "food"
    },
    // 性格类
    {
        question: "对方害怕什么？",
        options: ["虫子", "高", "黑暗", "鬼", "不怕这些", "其他"],
        category: "personality"
    },
    {
        question: "对方更内向还是外向？",
        options: ["内向", "外向", "中间"],
        category: "personality"
    },
    {
        question: "对方更理性还是感性？",
        options: ["理性", "感性", "平衡"],
        category: "personality"
    },
    {
        question: "对方更注重过程还是结果？",
        options: ["过程", "结果", "都注重"],
        category: "personality"
    },
    {
        question: "对方更喜欢独自做事还是团队协作？",
        options: ["独自", "团队", "看情况"],
        category: "personality"
    },
    {
        question: "对方遇到困难时会怎么做？",
        options: ["自己解决", "寻求帮助", "先思考再行动", "容易放弃"],
        category: "personality"
    },
    {
        question: "对方更喜欢计划还是随性？",
        options: ["喜欢计划", "随性而行", "看情况"],
        category: "personality"
    },
    // 娱乐类
    {
        question: "对方更喜欢什么样的约会方式？",
        options: ["看电影", "逛街购物", "户外运动", "宅在家里", "美食探店", "旅行"],
        category: "dating"
    },
    {
        question: "对方最喜欢什么类型的电影？",
        options: ["喜剧", "爱情", "动作", "科幻", "恐怖", "悬疑"],
        category: "entertainment"
    },
    {
        question: "对方最喜欢的音乐类型是？",
        options: ["流行", "古典", "摇滚", "民谣", "电子", "说唱"],
        category: "entertainment"
    },
    {
        question: "对方更喜欢看书还是看剧？",
        options: ["看书", "看剧", "都喜欢", "都不喜欢"],
        category: "entertainment"
    },
    {
        question: "对方喜欢玩游戏吗？",
        options: ["超爱玩", "偶尔玩", "不太玩", "不玩"],
        category: "entertainment"
    },
    {
        question: "对方更喜欢运动还是休息？",
        options: ["运动", "休息", "看心情"],
        category: "entertainment"
    },
    // 生活习惯
    {
        question: "对方最喜欢的时间段是？",
        options: ["早晨", "中午", "下午", "晚上", "深夜"],
        category: "habits"
    },
    {
        question: "对方最喜欢什么样的周末？",
        options: ["宅家休息", "外出游玩", "朋友聚会", "陪伴家人", "运动健身"],
        category: "habits"
    },
    {
        question: "对方更喜欢熬夜还是早睡？",
        options: ["熬夜", "早睡", "看情况"],
        category: "habits"
    },
    {
        question: "对方起床后第一件事是什么？",
        options: ["看手机", "洗脸刷牙", "喝水", "运动", "发呆"],
        category: "habits"
    },
    {
        question: "对方更喜欢整洁还是随意？",
        options: ["整洁", "随意", "看情况"],
        category: "habits"
    },
    // 价值观
    {
        question: "对方最在意的事情是？",
        options: ["事业", "感情", "家庭", "健康", "快乐", "金钱"],
        category: "values"
    },
    {
        question: "对方更喜欢礼物还是陪伴？",
        options: ["礼物", "陪伴", "都喜欢"],
        category: "values"
    },
    {
        question: "对方更喜欢哪种表达爱的方式？",
        options: ["言语表达", "行动证明", "送礼物", "身体接触", "陪伴"],
        category: "values"
    },
    {
        question: "对方对未来最期待的是？",
        options: ["事业成功", "家庭美满", "环游世界", "简单快乐", "其他"],
        category: "values"
    },
    {
        question: "对方更喜欢购物还是存钱？",
        options: ["购物", "存钱", "看情况"],
        category: "values"
    },
    {
        question: "对方最珍惜的是？",
        options: ["回忆", "现在", "未来", "人际关係", "自我成长"],
        category: "values"
    },
    {
        question: "对方认为最重要的是？",
        options: ["真诚", "信任", "理解", "包容", "沟通"],
        category: "values"
    },
    // 旅行类
    {
        question: "对方最想去的旅行地点类型？",
        options: ["海边度假", "古城古镇", "现代都市", "自然风光", "国外旅行", "乡村田园"],
        category: "travel"
    },
    {
        question: "对方更喜欢自由行还是跟团？",
        options: ["自由行", "跟团", "看情况"],
        category: "travel"
    },
    {
        question: "对方旅行的目的是？",
        options: ["放松心情", "探索新事物", "拍照打卡", "品尝美食", "购物"],
        category: "travel"
    },
    {
        question: "对方旅行时更喜欢什么交通方式？",
        options: ["飞机", "高铁", "自驾", "轮船", "步行"],
        category: "travel"
    },
    // 工作学习
    {
        question: "对方更喜欢独处还是社交？",
        options: ["独处", "社交", "平衡"],
        category: "work"
    },
    {
        question: "对方对工作的态度是？",
        options: ["事业为重", "工作生活平衡", "佛系对待"],
        category: "work"
    },
    {
        question: "对方更喜欢哪种学习方式？",
        options: ["看书", "看视频", "实践", "听讲座", "讨论"],
        category: "work"
    },
    // 社交类
    {
        question: "对方朋友多吗？",
        options: ["很多", "一般", "较少", "很少"],
        category: "social"
    },
    {
        question: "对方更喜欢线上聊天还是线下见面？",
        options: ["线上聊天", "线下见面", "都喜欢"],
        category: "social"
    },
    {
        question: "对方在聚会中通常是？",
        options: ["组织者", "参与者", "旁观者", "不太参加聚会"],
        category: "social"
    },
    // 感情类
    {
        question: "对方对你的第一印象是什么？",
        options: ["温柔", "有趣", "帅气/漂亮", "聪明", "高冷", "可爱"],
        category: "relationship"
    },
    {
        question: "对方更喜欢主动还是被动？",
        options: ["主动", "被动", "看情况"],
        category: "relationship"
    },
    {
        question: "对方认为恋爱中最重要的是？",
        options: ["信任", "沟通", "浪漫", "陪伴", "理解"],
        category: "relationship"
    },
    {
        question: "对方更喜欢惊喜还是稳定？",
        options: ["惊喜", "稳定", "都喜欢"],
        category: "relationship"
    },
    {
        question: "对方吵架后会怎么做？",
        options: ["主动道歉", "等对方道歉", "冷静后沟通", "冷战"],
        category: "relationship"
    },
    {
        question: "对方更喜欢浪漫还是实际？",
        options: ["浪漫", "实际", "平衡"],
        category: "relationship"
    },
    // 其他类
    {
        question: "对方更喜欢手机还是电脑？",
        options: ["手机", "电脑", "都喜欢"],
        category: "others"
    },
    {
        question: "对方更喜欢夏天还是冬天？",
        options: ["夏天", "冬天", "都喜欢", "都不喜欢"],
        category: "others"
    },
    {
        question: "对方更喜欢城市还是农村？",
        options: ["城市", "农村", "都喜欢"],
        category: "others"
    },
    {
        question: "对方对生活态度是？",
        options: ["乐观", "悲观", "中立"],
        category: "others"
    },
    {
        question: "对方更喜欢冒险还是安稳？",
        options: ["冒险", "安稳", "看情况"],
        category: "others"
    }
];

// Source: html/static/data/quiz-questions.js; keep the site's existing questions.
module.exports = quizQuestions;

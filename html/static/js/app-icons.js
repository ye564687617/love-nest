/**
 * App.icons — 前端图标/表情统一配置
 * 与后端 includes/icons.php 保持同步
 */
App.icons = App.icons || {};

// ========== 礼物列表 ==========
App.icons.gifts = [
    { icon: '🌹', name: '玫瑰花' },
    { icon: '💐', name: '花束' },
    { icon: '🍫', name: '巧克力' },
    { icon: '💎', name: '钻石' },
    { icon: '❤️', name: '爱心' },
    { icon: '💕', name: '双心' },
    { icon: '🎂', name: '蛋糕' },
    { icon: '☕', name: '咖啡' },
];

// ========== 天气映射 ==========
App.icons.weather = {
    sunny:      { icon: '☀️', label: '晴' },
    cloudy:     { icon: '☁️', label: '多云' },
    partly:     { icon: '🌤️', label: '多云转晴' },
    overcast:   { icon: '🌥️', label: '阴' },
    rainy:      { icon: '🌧️', label: '小雨' },
    heavy_rain: { icon: '⛈️', label: '大雨' },
    thunder:    { icon: '🌩️', label: '雷阵雨' },
    snowy:      { icon: '❄️', label: '雪' },
    windy:      { icon: '💨', label: '大风' },
    foggy:      { icon: '🌫️', label: '雾' },
    hot:        { icon: '🔥', label: '高温' },
    cold:       { icon: '🥶', label: '寒冷' },
    valentine:  { icon: '❤️', label: '情人节' },
};

App.icons.weatherIcon = function(code) {
    return (App.icons.weather[code] || {}).icon || '🌤️';
};

App.icons.weatherLabel = function(code) {
    return (App.icons.weather[code] || {}).label || code;
};

// ========== 纪念日可选图标 ==========
App.icons.dayEmojis = ['💕','🥰','❤️','💖','🎉','🎊','✨','🌟','💐','🌸','🌹','🍀','🌈','☀️','🌙','⭐','🎵','🎶','💌','🎁','🎂','🍰','🏠','💍','👶','🐱','🐶','💝','💘','🎆','🎈','🏆','🥂','🥳','😘','🤗','💗','💓','🎀'];

// ========== 月份 emoji ==========
App.icons.monthEmoji = ['🌨', '💝', '🌸', '🌈', '🌺', '☀️', '🏖', '🎵', '🌙', '🍁', '🍂', '❄️'];

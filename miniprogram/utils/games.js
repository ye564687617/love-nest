const questions = require('../data/quiz-questions');
const presets = {
  food:['火锅', '烧烤', '日料', '西餐', '中餐', '韩料', '快餐', '甜品'],
  play:['看电影', '逛街', '公园', '游乐园', '爬山', '海边', 'KTV', '咖啡馆']
};
function randomIndex(size, random = Math.random) { return Math.min(size - 1, Math.max(0, Math.floor(random() * size))); }
function sample(count = 10, random = Math.random) {
  const bank = questions.slice();
  for (let i = bank.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1, random);
    [bank[i], bank[j]] = [bank[j], bank[i]];
  }
  return bank.slice(0, Math.max(0, count));
}
function customOptions(text) {
  const list = text.split(/[\n,，]/).map(value => value.trim()).filter(Boolean);
  if (list.length < 2 || list.length > 12 || list.some(value => value.length > 12)) throw new Error('请填写 2–12 个选项，每项不超过 12 字');
  return list;
}
module.exports = {presets, sample, customOptions, randomIndex};

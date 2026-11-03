const fixed = { valentine:[2,14], new_year:[1,1], national:[10,1], christmas:[12,25], love520:[5,20] };
const { Lunar } = require('../vendor/lunar-javascript/lunar');
const birthdays = require('../vendor/lunar-javascript/birthday-calendar');
const lunar = { qixi:[7,7], spring:[1,1], lantern:[1,15], dragon_boat:[5,5], mid_autumn:[8,15] };
const legacy = { '七夕':'qixi', '春节':'spring', '元宵节':'lantern', '端午节':'dragon_boat', '中秋节':'mid_autumn', '情人节':'valentine', '元旦':'new_year', '国庆节':'national', '圣诞节':'christmas', '520':'love520' };
function describe(row, now = new Date()) {
  if (row.kind === 'birthday' && row.birthday_calendar === 'lunar') {
    try {
      const next = birthdays.find(row.target_date, now, false);
      if (!next) throw new Error('生日日期超出范围');
      const target = next.date;
      const days = Math.round((Date.UTC(target.getFullYear(),target.getMonth(),target.getDate()) - Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);
      return {days, label:days === 0 ? '就是今天' : '还有 ' + days + ' 天', next_date:target.getFullYear()+'-'+String(target.getMonth()+1).padStart(2,'0')+'-'+String(target.getDate()).padStart(2,'0'), age:next.age, birthday_label:birthdays.label(row.target_date)};
    } catch (error) { return {days:null,label:'请检查农历出生日期',next_date:'',age:null}; }
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const parts = row.target_date.split('-').map(Number);
  const yearly = row.kind !== 'countdown';
  const key = row.festival_key || (row.kind === 'festival' ? legacy[row.title] : '');
  const pair = fixed[key] || [parts[1], parts[2]];
  let year = yearly ? today.getFullYear() : parts[0];
  function date(y) { return new Date(y, pair[0] - 1, Math.min(pair[1], new Date(y, pair[0], 0).getDate())); }
  let target = date(year);
  if (yearly && target < today) target = date(++year);
  if (row.kind === 'birthday' && year < parts[0]) target = date(year = parts[0]);
  if (lunar[key]) {
    const pair = lunar[key];
    for (let lunarYear = today.getFullYear() - 1; lunarYear <= today.getFullYear() + 1; lunarYear++) {
      const solar = Lunar.fromYmd(lunarYear,pair[0],pair[1]).getSolar();
      const date = new Date(solar.getYear(),solar.getMonth()-1,solar.getDay());
      if (date >= today) { target = date; break; }
    }
  }
  const days = Math.round((Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  const iso = target.getFullYear() + '-' + String(target.getMonth()+1).padStart(2,'0') + '-' + String(target.getDate()).padStart(2,'0');
  return { days, label: days === 0 ? '就是今天' : days > 0 ? '还有 ' + days + ' 天' : '已过 ' + Math.abs(days) + ' 天', next_date: iso, age: row.kind === 'birthday' ? year - parts[0] : null };
}
module.exports = { describe };

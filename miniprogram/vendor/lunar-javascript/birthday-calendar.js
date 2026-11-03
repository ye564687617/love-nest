;(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./lunar'));
  else root.BirthdayCalendar = factory(root);
})(typeof globalThis === 'undefined' ? this : globalThis, function(lib) {
  'use strict';
  function birth(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('请选择出生日期');
    var p = value.split('-').map(Number);
    var solar = lib.Solar.fromYmd(p[0], p[1], p[2]);
    if (solar.toYmd() !== value) throw new Error('出生日期无效');
    return solar.getLunar();
  }
  function fromLunar(year, month, day, leap) {
    year = Number(year); month = Number(month); day = Number(day);
    if (!Number.isInteger(year) || year < 1900 || year > 2100 ||
        !Number.isInteger(month) || month < 1 || month > 12 ||
        !Number.isInteger(day) || day < 1 || day > 30) throw new Error('请填写正确的农历出生年月日');
    var signed = leap ? -month : month;
    var actual = lib.LunarYear.fromYear(year).getMonth(signed);
    if (!actual || day > actual.getDayCount()) throw new Error('该农历年月没有这一天，请检查闰月和日期');
    return lib.Lunar.fromYmd(year, signed, day).getSolar().toYmd();
  }
  function fields(value) {
    var lunar = birth(value);
    return {year:lunar.getYear(), month:Math.abs(lunar.getMonth()), day:lunar.getDay(), leap:lunar.getMonth() < 0};
  }
  function label(value) {
    var lunar = birth(value);
    return '农历' + lunar.getMonthInChinese() + '月' + lunar.getDayInChinese();
  }
  function occurrence(value, lunarYear) {
    var original = birth(value);
    var month = original.getMonth();
    var year = lib.LunarYear.fromYear(lunarYear);
    // Leap-month birthdays use the regular month when that leap month is absent.
    var actual = year.getMonth(month) || year.getMonth(Math.abs(month));
    var lunar = lib.Lunar.fromYmd(lunarYear, actual.getMonth(), Math.min(original.getDay(), actual.getDayCount()));
    var solar = lunar.getSolar();
    return {date:new Date(solar.getYear(), solar.getMonth()-1, solar.getDay()), age:lunarYear-original.getYear()};
  }
  function find(value, now, previous) {
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var y = lib.Solar.fromYmd(today.getFullYear(),today.getMonth()+1,today.getDate()).getLunar().getYear();
    var candidates = [];
    for (var year = y-2; year <= y+2; year++) {
      var item = occurrence(value, year);
      if (item.age >= 0 && (previous ? item.date < today : item.date >= today)) candidates.push(item);
    }
    candidates.sort(function(a,b) {return a.date-b.date;});
    return previous ? candidates[candidates.length-1] : candidates[0];
  }
  return {fromLunar:fromLunar, fields:fields, label:label, find:find};
});

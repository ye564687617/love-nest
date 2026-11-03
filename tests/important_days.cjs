const assert=require('node:assert/strict');
const fs=require('node:fs');
globalThis.BirthdayCalendar=require('../html/static/vendor/lunar-javascript/birthday-calendar');
require('../html/static/js/important-days.js');
const days=globalThis.ImportantDays;
const mini=require('../miniprogram/utils/calendar');
const birthdays=globalThis.BirthdayCalendar;
assert.equal(birthdays.fromLunar(2001,9,14,false),'2001-10-30');
assert.equal(birthdays.label('2001-09-14'),'农历七月廿七');
const lunarBirthday={kind:'birthday',target_date:'2001-10-30',birthday_calendar:'lunar'};
for (const [now,next,age] of [
  [new Date(2026,0,1),'2026-10-23',25],
  [new Date(2026,9,23),'2026-10-23',25],
  [new Date(2026,9,24),'2027-10-13',26],
  [new Date(2026,10,3),'2027-10-13',26],
]) {
  for(const calendar of [days,mini]) {
    assert.equal(calendar.describe(lunarBirthday,now).next_date,next);
    assert.equal(calendar.describe(lunarBirthday,now).age,age);
  }
}
assert.equal(days.iso(days.previous(lunarBirthday,new Date(2026,10,3))),'2026-10-23');
assert.throws(()=>birthdays.fromLunar(2001,9,31,false));
assert.throws(()=>birthdays.fromLunar(2001,9,14,true));
assert.equal(birthdays.fromLunar(2023,2,1,true),'2023-03-22');
for(const row of [
  {kind:'birthday',birthday_calendar:'lunar',target_date:birthdays.fromLunar(2022,12,30,false)},
  {kind:'birthday',birthday_calendar:'lunar',target_date:birthdays.fromLunar(2023,2,1,true)},
]) {
  for(let year=2024;year<=2030;year++) {
    assert.equal(days.describe(row,new Date(year,0,1)).next_date,mini.describe(row,new Date(year,0,1)).next_date);
  }
}
assert.equal(days.describe({kind:'birthday',target_date:'2001-09-14'},new Date(2026,9,31)).next_date,'2027-09-14');
assert.equal(days.describe({kind:'birthday',target_date:'2001-09-14'},new Date(2026,9,31)).age,26);
assert.equal(days.describe({kind:'birthday',target_date:'2001-09-14'},new Date(2026,8,14)).label,'就是今天！');
assert.equal(days.describe({kind:'birthday',target_date:'2000-02-29'},new Date(2027,0,1)).next_date,'2027-02-28');
assert.equal(days.describe({kind:'festival',festival_key:'qixi'},new Date(2026,0,1)).next_date,'2026-08-19');
assert.equal(days.describe({kind:'festival',title:'七夕',target_date:'2026-08-19'},new Date(2026,9,31)).next_date,'2027-08-08');
assert.equal(days.describe({kind:'festival',festival_key:'spring'},new Date(2026,0,1)).next_date,'2026-02-17');
assert.equal(days.describe({kind:'festival',festival_key:'mid_autumn'},new Date(2026,0,1)).next_date,'2026-09-25');
assert.equal(days.describe({kind:'festival',festival_key:'valentine'},new Date(2026,9,31)).next_date,'2027-02-14');
assert.equal(days.iso(days.previous({kind:'festival',festival_key:'qixi'},new Date(2026,9,31))),'2026-08-19');
assert.equal(days.iso(days.previous({kind:'birthday',target_date:'2000-02-29'},new Date(2027,0,1))),'2026-02-28');
assert.equal(days.describe({kind:'countdown',target_date:'2025-01-01'},new Date(2026,0,1)).label,'已过 365 天');
const css=fs.readFileSync('html/static/css/moment-card.css','utf8');
assert.match(css,/grid-template-columns: minmax\(0, 1fr\)/);
assert.match(css,/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css,/\.masonry-column\s*\{\s*display: contents !important;/);
const timeline=fs.readFileSync('html/static/js/album-timeline.js','utf8');
assert.ok(!timeline.includes("col.className = 'masonry-column'"));
console.log('PASS birthday dates/ages, leap-day policy, solar/lunar festivals, legacy Qixi, fixed countdown and CSS-driven album columns');

<?php
require_once __DIR__ . '/inc/layout.php';
admin_head('纪念日');
?>
<div class="card">
  <div class="card-title"><i class="fa-solid fa-calendar-heart"></i>纪念日 / 倒计时
    <span style="flex:1"></span>
    <button class="btn small primary" onclick="Countdowns.openModal()"><i class="fa-solid fa-plus"></i>新增日子</button>
  </div>
  <table class="tbl">
    <thead><tr><th style="width:35%">标题</th><th>日期</th><th>类型</th><th>还有</th><th style="width:150px">操作</th></tr></thead>
    <tbody id="cdBody"></tbody>
  </table>
  <div class="empty-tip" id="cdEmpty" style="display:none">还没有添加重要日子，记录下你们的纪念日吧~</div>
</div>

<script src="/static/vendor/lunar-javascript/lunar.js"></script>
<script src="/static/vendor/lunar-javascript/birthday-calendar.js?v=20261103"></script>
<script src="/static/js/important-days.js?v=20261103"></script>
<script>
const Countdowns = {
  rows: [],

  init() { this.load(); },

  load() {
    Admin.get('countdowns', 'list').then(d => {
      this.rows = d.list;
      Admin.el('cdEmpty').style.display = d.list.length ? 'none' : 'block';
      Admin.el('cdBody').innerHTML = d.list.map(c => {
        const info = ImportantDays.describe(c);
        const festival = ImportantDays.festivals.find(f => f.key === ImportantDays.keyOf(c));
        const dateLabel = c.kind === 'birthday' && c.birthday_calendar === 'lunar' ? BirthdayCalendar.label(c.target_date) : festival ? (festival.lunar ? '农历 ' : '每年 ') + festival.month + '月' + festival.day + '日' : c.target_date;
        return `
        <tr>
          <td>${Admin.esc(c.title)}</td>
          <td class="muted">${Admin.esc(dateLabel)}${c.kind === 'birthday' ? '<br><small>出生日期</small>' : ''}${info.next_date ? '<br><small>下次：' + Admin.esc(info.next_date) + (info.age !== null ? ' · 满' + info.age + '周岁' : '') + '</small>' : ''}</td>
          <td><span class="badge">${({anniversary:'纪念日',birthday:'生日',festival:'节日',countdown:'倒计时'})[c.kind] || '倒计时'}</span></td>
          <td><b style="color:#ff6b8b">${Admin.esc(info.label)}</b></td>
          <td>
            <button class="btn small" onclick="Countdowns.openModal(${c.id})">编辑</button>
            <button class="btn small danger" onclick="Countdowns.del(${c.id})">删除</button>
          </td>
        </tr>`; }).join('');
    });
  },

  openModal(id) {
    const c = id ? (this.rows.find(x => x.id == id) || {}) : {};
    Admin.modal(id ? '编辑日子' : '新增日子', `
      <div class="field"><label>类型</label>
        <select id="cdKind" onchange="Countdowns.syncKind()">
          <option value="countdown" ${!c.kind || c.kind === 'countdown' ? 'selected' : ''}>倒计时</option>
          <option value="anniversary" ${c.kind === 'anniversary' ? 'selected' : ''}>纪念日</option>
          <option value="birthday" ${c.kind === 'birthday' ? 'selected' : ''}>生日</option>
          <option value="festival" ${c.kind === 'festival' ? 'selected' : ''}>节日</option>
        </select></div>
      <div class="field" id="cdFestivalField"><label>选择节日</label>
        <select id="cdFestival" onchange="Countdowns.syncFestival()">
          <option value="">自定义节日（阳历）</option>
          ${ImportantDays.festivals.map(f => '<option value="' + f.key + '"' + (ImportantDays.keyOf(c) === f.key ? ' selected' : '') + '>' + f.name + (f.lunar ? '（农历）' : '') + '</option>').join('')}
        </select></div>
      <div class="field"><label>标题</label>
        <input type="text" id="cdTitle" value="${Admin.esc(c.title || '')}" placeholder="例如：一周年纪念日"></div>
      <div class="field" id="cdDateField"><label id="cdDateLabel">日期</label>
        <input type="date" id="cdDate" value="${Admin.esc(c.target_date || '')}"></div>
      <div class="field" id="cdCalendarField"><label for="cdCalendar">生日历法</label>
        <select id="cdCalendar"><option value="solar">公历生日</option><option value="lunar" ${c.birthday_calendar === 'lunar' ? 'selected' : ''}>农历生日</option></select></div>
      <div class="field" id="cdLunarField"><label>农历出生年月日</label>
        <div style="display:grid;grid-template-columns:minmax(0,1.4fr) repeat(2,minmax(0,1fr));gap:8px"><input id="cdLunarYear" style="min-width:0" type="number" min="1900" max="2100" placeholder="年" aria-label="农历出生年"><input id="cdLunarMonth" style="min-width:0" type="number" min="1" max="12" placeholder="月" aria-label="农历出生月"><input id="cdLunarDay" style="min-width:0" type="number" min="1" max="30" placeholder="日" aria-label="农历出生日"></div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input id="cdLunarLeap" style="width:18px;height:18px;margin:0;flex:none" type="checkbox">出生在闰月</label></div>
      <p class="muted" id="cdHint" role="status"></p>
      <div class="actions"><button class="btn ghost" onclick="Admin.closeModal()">取消</button>
      <button class="btn primary" id="cdOk">${id ? '保存' : '添加'}</button></div>`);
    if (c.target_date) {
      const lunar = BirthdayCalendar.fields(c.target_date);
      Admin.el('cdLunarYear').value = lunar.year;
      Admin.el('cdLunarMonth').value = lunar.month;
      Admin.el('cdLunarDay').value = lunar.day;
      Admin.el('cdLunarLeap').checked = lunar.leap;
    }
    Admin.el('cdCalendar').onchange = () => {
      const date = Admin.el('cdDate').value;
      if (Admin.el('cdCalendar').value === 'lunar' && date) {
        const lunar = BirthdayCalendar.fields(date);
        Admin.el('cdLunarYear').value = lunar.year;
        Admin.el('cdLunarMonth').value = lunar.month;
        Admin.el('cdLunarDay').value = lunar.day;
        Admin.el('cdLunarLeap').checked = lunar.leap;
      }
      this.syncKind();
    };
    ['cdLunarYear','cdLunarMonth','cdLunarDay','cdLunarLeap'].forEach(id => Admin.el(id).onchange = () => this.syncHint());
    this.syncKind();
    Admin.el('cdDate').onchange = () => this.syncHint();
    Admin.el('cdOk').onclick = () => {
      const title = Admin.el('cdTitle').value.trim();
      let target_date = Admin.el('cdDate').value;
      const kind = Admin.el('cdKind').value;
      const birthday_calendar = kind === 'birthday' ? Admin.el('cdCalendar').value : 'solar';
      if (birthday_calendar === 'lunar') {
        try { target_date = this.lunarDate(); }
        catch (error) { return toastr.warning(error.message); }
      }
      const festival_key = kind === 'festival' ? Admin.el('cdFestival').value : '';
      if (festival_key) {
        const next = ImportantDays.next({kind, festival_key});
        if (!next) return toastr.warning('当前浏览器无法计算农历日期，请更新浏览器');
        target_date = ImportantDays.iso(next);
      }
      if (!title) return toastr.warning('请输入标题');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(target_date)) return toastr.warning('请选择正确日期');
      if (kind === 'birthday' && target_date > ImportantDays.iso(new Date())) return toastr.warning('请选择真实出生日期，不能晚于今天');
      const data = { title, target_date, kind, festival_key, birthday_calendar };
      if (id) data.id = id;
      Admin.submit(Admin.el('cdOk'), async () => {
        await Admin.api('countdowns', id ? 'update' : 'create', data);
        Admin.closeModal(); this.load();
      });
    };
  },

  syncKind() {
    const kind = Admin.el('cdKind').value;
    Admin.el('cdFestivalField').hidden = kind !== 'festival';
    Admin.el('cdCalendarField').hidden = kind !== 'birthday';
    Admin.el('cdLunarField').hidden = kind !== 'birthday' || Admin.el('cdCalendar').value !== 'lunar';
    Admin.el('cdDateLabel').textContent = kind === 'birthday' ? '出生日期（阳历）' : kind === 'anniversary' ? '纪念日开始日期' : '日期';
    Admin.el('cdDate').max = kind === 'birthday' ? ImportantDays.iso(new Date()) : '';
    this.syncFestival();
  },

  syncFestival() {
    const selected = Admin.el('cdKind').value === 'festival' ? Admin.el('cdFestival').value : '';
    const festival = ImportantDays.festivals.find(f => f.key === selected);
    Admin.el('cdDateField').hidden = !!festival || (Admin.el('cdKind').value === 'birthday' && Admin.el('cdCalendar').value === 'lunar');
    Admin.el('cdTitle').readOnly = !!festival;
    if (festival) Admin.el('cdTitle').value = festival.name;
    this.syncHint();
  },

  syncHint() {
    const kind = Admin.el('cdKind').value;
    const row = {kind, target_date:Admin.el('cdDate').value, festival_key:kind === 'festival' ? Admin.el('cdFestival').value : ''};
    if (kind === 'birthday' && Admin.el('cdCalendar').value === 'lunar') {
      try {
        row.target_date = this.lunarDate();
        row.birthday_calendar = 'lunar';
        Admin.el('cdDate').value = row.target_date;
      } catch (error) { Admin.el('cdHint').textContent = error.message; return; }
    }
    const info = ImportantDays.describe(row);
    Admin.el('cdHint').textContent = kind === 'birthday' ? (row.birthday_calendar === 'lunar' ? BirthdayCalendar.label(row.target_date) + '，每年换算公历日期。无同名闰月时按普通月，小月无三十时按廿九。' : '每年按公历出生月日过生日。') + (info.next_date ? '下次：' + info.next_date + '，满' + info.age + '周岁。' : '') : row.festival_key ? '每年自动计算节日日期。' + (info.next_date ? '下次：' + info.next_date : info.label) : kind === 'festival' ? '自定义节日按阳历每年重复。' : '';
  },

  lunarDate() {
    return BirthdayCalendar.fromLunar(Admin.el('cdLunarYear').value, Admin.el('cdLunarMonth').value, Admin.el('cdLunarDay').value, Admin.el('cdLunarLeap').checked);
  },

  del(id) {
    Admin.confirm('确定删除这个日子吗？').then(ok => {
      if (ok) Admin.api('countdowns', 'delete', { id }).then(() => this.load());
    });
  },
};
Countdowns.init();
</script>
<?php admin_foot(); ?>

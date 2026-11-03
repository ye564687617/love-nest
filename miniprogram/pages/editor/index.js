const api = require('../../utils/api');
const birthdays = require('../../vendor/lunar-javascript/birthday-calendar');
const kinds = ['countdown', 'anniversary', 'birthday', 'festival'];
const festivals = ['','valentine','qixi','new_year','spring','lantern','dragon_boat','mid_autumn','national','christmas','love520'];
Page({
  data: { module: '', id: 0, title: '', content: '', location: '', images: [], previews: [],
    birthday_calendar:'solar', birthdayCalendarIndex:0, birthdayCalendars:['公历生日','农历生日'],
    lunarYear:'', lunarMonth:'', lunarDay:'', lunarLeap:false, birthdayHint:'',
    status: false, done: false, target_date: '', kindIndex: 0, kinds: ['倒计时', '纪念日', '生日', '节日'],
    festival_key: '', festivalIndex:0, festivals:['自定义公历节日','情人节','七夕','元旦','春节','元宵节','端午节','中秋节','国庆节','圣诞节','520'], saving: false, ready: false, dirty: false, error: '' },
  async onLoad(query) {
    const module = query.module;
    if (!['moments','lovelist','countdowns'].includes(module)) { this.setData({ error: '页面不存在' }); return; }
    this.setData({ module });
    this.getOpenerEventChannel().on('record', row => {
      const images = row.originalImages || row.images || [];
      this.setData({ id: row.id, title: row.title || '', content: row.content || '', location: row.location || '',
        images, previews: images.map(api.media), status: Number(row.status) === 1, done: Number(row.done) === 1,
        target_date: row.target_date || '', kindIndex: Math.max(0, kinds.indexOf(row.kind)), festival_key: row.festival_key || '', festivalIndex:Math.max(0,festivals.indexOf(row.festival_key || '')) });
      this.setData({birthday_calendar:row.birthday_calendar || 'solar',birthdayCalendarIndex:row.birthday_calendar === 'lunar' ? 1 : 0});
      if (row.target_date) {
        const lunar = birthdays.fields(row.target_date);
        this.setData({lunarYear:String(lunar.year),lunarMonth:String(lunar.month),lunarDay:String(lunar.day),lunarLeap:lunar.leap});
      }
      this.birthdayPreview();
    });
    try {
      const session = await api.session();
      if (!session.owner || !session.permissions.includes(module)) throw new Error('没有此内容的管理权限');
      this.setData({ ready: true });
      if (wx.enableAlertBeforeUnload) wx.enableAlertBeforeUnload({ message:'尚未保存的内容会丢失。' });
      wx.setNavigationBarTitle({ title: { moments:'记录瞬间', lovelist:'恋爱心愿', countdowns:'重要日子' }[module] });
    } catch (error) { this.setData({ error: error.message }); }
  },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value, dirty:true }); this.birthdayPreview(); },
  changeBirthdayCalendar(event) {
    const index = Number(event.detail.value);
    if (index && this.data.target_date) {
      const lunar = birthdays.fields(this.data.target_date);
      this.setData({lunarYear:String(lunar.year),lunarMonth:String(lunar.month),lunarDay:String(lunar.day),lunarLeap:lunar.leap});
    }
    this.setData({birthdayCalendarIndex:index,birthday_calendar:index ? 'lunar' : 'solar',dirty:true});
    this.birthdayPreview();
  },
  lunarDate() { return birthdays.fromLunar(this.data.lunarYear,this.data.lunarMonth,this.data.lunarDay,this.data.lunarLeap); },
  birthdayPreview() {
    if (this.data.kindIndex !== 2 || this.data.birthday_calendar !== 'lunar') return;
    try {
      const date = this.lunarDate();
      const info = require('../../utils/calendar').describe({kind:'birthday',birthday_calendar:'lunar',target_date:date});
      this.setData({target_date:date,birthdayHint:birthdays.label(date)+'，下次公历 '+info.next_date});
    } catch (error) {this.setData({birthdayHint:error.message});}
  },
  changeKind(event) { this.setData({ kindIndex: Number(event.detail.value), festival_key: '', festivalIndex:0, dirty:true }); this.birthdayPreview(); },
  changeFestival(event) {
    const index = Number(event.detail.value);
    this.setData({festivalIndex:index,festival_key:festivals[index],dirty:true,
      ...(index ? {title:this.data.festivals[index]} : {})});
  },
  async chooseImages() {
    if (this.data.saving || !this.data.ready) return;
    const count = 9 - this.data.images.length;
    if (count <= 0) return;
    this.setData({ saving: true, error: '' });
    try {
      const result = await new Promise((resolve, reject) => wx.chooseMedia({ count, mediaType:['image'], sizeType:['compressed'], success:resolve, fail:reject }));
      // Keep each successful upload in the draft even if a later upload fails.
      for (const file of result.tempFiles) {
        if (file.size > 5 * 1024 * 1024) throw new Error('图片最大 5MB');
        const url = await api.upload(file.tempFilePath);
        this.setData({ images: this.data.images.concat(url), previews: this.data.previews.concat(api.media(url)), dirty:true });
      }
    } catch (error) { if (!String(error.errMsg || '').includes('cancel')) this.setData({ error: error.message || '选择图片失败' }); }
    finally { this.setData({ saving: false }); }
  },
  removeImage(event) {
    if (this.data.saving) return;
    const index = Number(event.currentTarget.dataset.index);
    this.setData({ images: this.data.images.filter((_, i) => i !== index), previews: this.data.previews.filter((_, i) => i !== index), dirty:true });
  },
  async submit() {
    if (this.data.saving || !this.data.ready) return;
    const d = this.data;
    const data = { id: d.id };
    if (d.module === 'moments') Object.assign(data, { content:d.content, location:d.location, images:JSON.stringify(d.images), status:d.status ? 1 : 0 });
    if (d.module === 'lovelist') Object.assign(data, { title:d.title, done:d.done ? 1 : 0 });
    if (d.module === 'countdowns') {
      let target = d.target_date;
      if (kinds[d.kindIndex] === 'birthday' && d.birthday_calendar === 'lunar') {
        try {target = this.lunarDate();}
        catch (error) {this.setData({error:error.message});return;}
      }
      Object.assign(data, { title:d.title, target_date:target, kind:kinds[d.kindIndex], festival_key:d.festival_key,
        birthday_calendar:kinds[d.kindIndex] === 'birthday' ? d.birthday_calendar : 'solar' });
    }
    if (d.module === 'moments' ? !d.content.trim() && !d.images.length : !d.title.trim()) { this.setData({ error:'请先填写内容' }); return; }
    if (d.module === 'countdowns' && !data.target_date) { this.setData({ error:'请选择日期' }); return; }
    this.setData({ saving:true, error:'' });
    try {
      if (d.module === 'moments' && d.status) {
        const result = await new Promise((resolve, reject) => wx.showModal({ title:'公开这条瞬间？', content:'所有小程序访客和网站访客都能看到文字及图片。', success:resolve, fail:() => reject(new Error('确认窗口打开失败，请重试')) }));
        if (!result.confirm) return;
      }
      await api.manage(d.module, d.id ? 'update' : 'create', data);
      if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
      wx.showToast({ title:'已保存', icon:'success' });
      wx.navigateBack();
    } catch (error) { this.setData({ error:error.message }); }
    finally { this.setData({ saving:false }); }
  },
  async remove() {
    if (!this.data.id || this.data.saving || !this.data.ready) return;
    this.setData({ saving:true, error:'' });
    try {
      const result = await new Promise((resolve, reject) => wx.showModal({ title:'删除这条记录？', content:'删除后无法恢复，也会同步删除网站上的记录。', confirmColor:'#ad365d', success:resolve, fail:() => reject(new Error('确认窗口打开失败，请重试')) }));
      if (!result.confirm) return;
      await api.manage(this.data.module, 'delete', { id:this.data.id });
      if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
      wx.navigateBack();
    }
    catch (error) { this.setData({ error:error.message }); }
    finally { this.setData({ saving:false }); }
  }
});

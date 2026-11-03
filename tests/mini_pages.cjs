const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../miniprogram');
let definition;
const api = {
  session:async () => ({owner:true,permissions:['moments','lovelist','countdowns']}),
  request:async action => {
    if (action === 'home') return {site:{title:'Fixture',love_start:'2025-02-14 06:35:00',boy_avatar:'/b.jpg',girl_avatar:'/g.jpg'},moments:[],checklist:{total:2,done:1}};
    if (action === 'moments') return {list:[],has_more:false};
    if (action === 'lovelist') return {list:[{id:1,title:'Test',done:0},{id:2,title:'Done',done:1}]};
    if (action === 'countdowns') return {list:[]};
  },
  media:value => value ? 'https://example.test' + value : '', moment:row => row,
  manage:async (...args) => { calls.push(args); },
  upload:async () => '/uploads/a.png'
};
let calls = [], changes = 0, navigated = 0, confirmed = true, record;
let clockId=0;
const clocks=new Map();
const wx = {
  setNavigationBarTitle() {}, stopPullDownRefresh() {}, showToast() {},
  navigateBack() { navigated++; }, enableAlertBeforeUnload() {}, disableAlertBeforeUnload() {},
  showModal(options) { options.success({confirm:confirmed}); }
};
function instance(def) {
  return Object.assign({}, def, { data:structuredClone(def.data),
    setData(values) { changes++; Object.assign(this.data, values); },
    getOpenerEventChannel() { return {on(event, listener) { record = listener; }}; }
  });
}
const context = vm.createContext({Page:value => {definition = value;},wx,module:{exports:{}},
  require:() => api});
vm.runInContext(fs.readFileSync(path.join(root,'utils/page.js'),'utf8'),context);
const register = context.module.exports;
function loadPage(name) {
  const ctx = vm.createContext({Page:value => {definition=value;},wx,
    setInterval:callback => {clocks.set(++clockId,callback);return clockId;},
    clearInterval:id => clocks.delete(id),
    getApp:() => ({globalData:{session:{nickname:'Fixture'}}}),
    require:id => id.endsWith('/page') ? register : id.endsWith('/calendar') ? require('../miniprogram/utils/calendar') : id.endsWith('/birthday-calendar') ? require('../miniprogram/vendor/lunar-javascript/birthday-calendar') : api });
  vm.runInContext(fs.readFileSync(path.join(root,'pages',name,'index.js'),'utf8'),ctx);
  return instance(definition);
}
(async () => {
  for (const name of ['home','album','days','checklist']) {
    const page = loadPage(name);
    await page.load();
    assert.equal(page.data.error,'',name);
    assert.equal(page.data.loading,false,name);
    assert.equal(page.data.canMoments,true);
  }
  const list = loadPage('checklist');
  await list.load();
  assert.equal(list.data.done,1);
  list.filter({currentTarget:{dataset:{value:'0'}}});
  assert.equal(list.data.visible.length,1);
  await list.toggle({currentTarget:{dataset:{item:{id:1,title:'Test',done:0}}}});
  assert.equal(calls.at(-1)[2].done,1);
  const home=loadPage('home');
  home.load=async () => {};
  await home.onShow();
  await home.onShow();
  assert.equal(clocks.size,1,'reopening home keeps only one live clock');
  home._loveStart=Date.now()-90061000;
  home.updateClock();
  assert.equal(home.data.days,1);
  assert.equal(home.data.hours,'01');
  assert.equal(home.data.minutes,'01');
  home.onHide();
  assert.equal(clocks.size,0,'hidden home stops its clock');
  home.setData({moments:[{id:1,images:['a','b']},{id:2,images:['c']}]});
  home.showStory(0); home.nextStory();
  assert.equal(home.data.story.id,2);
  assert.equal(home.data.sidePhotos.length,2);
  const editor = loadPage('editor');
  await editor.onLoad({module:'moments'});
  assert.equal(editor.data.ready,true);
  record({id:42,images:['https://example.test/uploads/a.png'],originalImages:['/uploads/a.png'],status:0,content:'Existing'});
  assert.equal(editor.data.images[0],'/uploads/a.png','editing preserves canonical media paths');
  editor.setData({status:true});
  confirmed = false;
  const before = calls.length;
  await editor.submit();
  assert.equal(calls.length,before,'cancelled publication never saves');
  assert.equal(editor.data.saving,false);
  confirmed = true;
  await editor.submit();
  assert.equal(calls.at(-1)[2].status,1);
  assert.equal(navigated,1);
  const empty = loadPage('editor');
  await empty.onLoad({module:'lovelist'});
  await empty.submit();
  assert.ok(empty.data.error);
  const birthday = loadPage('editor');
  await birthday.onLoad({module:'countdowns'});
  birthday.changeKind({detail:{value:'2'}});
  birthday.changeBirthdayCalendar({detail:{value:'1'}});
  for (const [field,value] of Object.entries({title:'Fixture lunar birthday',lunarYear:'2001',lunarMonth:'9',lunarDay:'14'})) {
    birthday.input({currentTarget:{dataset:{field}},detail:{value}});
  }
  assert.equal(birthday.data.target_date,'2001-10-30');
  assert.match(birthday.data.birthdayHint,/农历九月十四/);
  await birthday.submit();
  assert.equal(calls.at(-1)[2].birthday_calendar,'lunar');
  assert.equal(calls.at(-1)[2].target_date,'2001-10-30');
  const savedBirthday = calls.at(-1)[2];
  const reopened = loadPage('editor');
  await reopened.onLoad({module:'countdowns'});
  record({...savedBirthday,id:456});
  assert.equal(reopened.data.birthdayCalendarIndex,1);
  assert.equal(reopened.data.lunarDay,'14');
  const savedCalls = calls.length;
  reopened.input({currentTarget:{dataset:{field:'lunarLeap'}},detail:{value:true}});
  await reopened.submit();
  assert.equal(calls.length,savedCalls,'invalid leap month cannot save');
  assert.match(reopened.data.error,/农历/);
  const savedSession = api.session;
  api.session = async () => ({owner:false,permissions:[]});
  const album = loadPage('album');
  album.setData({owner:true,list:[{id:1,status:0}],manageMode:true});
  await album.load();
  assert.equal(album.data.manageMode,false);
  assert.equal(album.data.list.length,0,'revoked access clears hidden data');
  const blocked = loadPage('editor');
  await blocked.onLoad({module:'moments'});
  assert.equal(blocked.data.ready,false);
  assert.ok(blocked.data.error);
  api.session = savedSession;
  const savedRequest = api.request;
  const racing = loadPage('album');
  racing.setData({owner:true,canMoments:true,manageMode:true});
  let resolveOld;
  api.request = () => new Promise(resolve => {resolveOld=resolve;});
  const oldRequest = racing.fetchPage(1);
  racing.onHide();
  resolveOld({list:[{id:999,status:0}],has_more:false});
  await oldRequest;
  assert.equal(racing.data.list.length,0,'hidden response cannot return after leaving album');
  racing._active = true;
  let resolveScope;
  api.request = () => new Promise(resolve => {resolveScope=resolve;});
  const oldScope = racing.fetchPage(1);
  racing.setData({manageMode:false});
  resolveScope({list:[{id:999,status:0}],has_more:false});
  await oldScope;
  assert.equal(racing.data.list.length,0,'old private scope cannot replace public list');
  let finishDate;
  api.request=() => new Promise(resolve => {finishDate=resolve;});
  const previousDate=racing.fetchPage(1);
  racing.setData({year:2025,month:1});
  finishDate({list:[{id:111,status:1}],has_more:false});
  await previousDate;
  assert.equal(racing.data.list.length,0,'old date response cannot overwrite a new filter');
  api.session = async () => ({owner:true,permissions:['lovelist']});
  api.request = savedRequest;
  racing.setData({manageMode:true,list:[{id:999,status:0}]});
  await racing.load();
  assert.equal(racing.data.manageMode,false,'module revocation exits private scope');
  assert.equal(racing.data.list.length,0);
  api.session = savedSession;
  const queued = loadPage('checklist');
  let finishFirst, fetchCount=0;
  queued.fetchData = async () => { if (++fetchCount === 1) await new Promise(resolve => {finishFirst=resolve;}); };
  const firstLoad=queued.load();
  await new Promise(setImmediate);
  await queued.load();
  finishFirst(); await firstLoad;
  assert.equal(fetchCount,2,'reload during a request is queued instead of lost');
  const imageEditor=loadPage('editor');
  await imageEditor.onLoad({module:'moments'});
  let picker, picked=0;
  wx.chooseMedia=options => {picked++; picker=options;};
  const picking=imageEditor.chooseImages();
  await imageEditor.chooseImages();
  assert.equal(picked,1,'lock before native image picker opens');
  picker.fail({errMsg:'chooseMedia:fail cancel'}); await picking;
  assert.equal(imageEditor.data.saving,false,'cancel releases image picker lock');
  const originalModal=wx.showModal;
  let dialog, dialogs=0;
  wx.showModal=options => {dialogs++; dialog=options;};
  imageEditor.setData({id:123});
  const deleting=imageEditor.remove(); await imageEditor.remove();
  assert.equal(dialogs,1,'delete confirmation cannot open twice');
  dialog.success({confirm:false}); await deleting;
  assert.equal(imageEditor.data.saving,false);
  wx.showModal=options => options.fail();
  await imageEditor.remove();
  assert.equal(imageEditor.data.saving,false,'modal failure releases delete lock');
  assert.match(imageEditor.data.error,/确认窗口/);
  wx.showModal=originalModal;
  const mine=loadPage('mine');
  await mine.login();
  assert.match(mine.data.formError,/请填写/,'empty login validated before network request');
  let finishCaptcha, captchaRequests=0;
  api.captcha=() => {captchaRequests++; return new Promise(resolve => {finishCaptcha=resolve;});};
  const refreshing=mine.refreshCaptcha();
  const duplicateRefresh=mine.refreshCaptcha();
  assert.equal(captchaRequests,1,'captcha refresh requests are serialized');
  await mine.login();
  assert.match(mine.data.formError,/正在加载/);
  finishCaptcha('fixture-image');
  await Promise.all([refreshing,duplicateRefresh]);
  assert.equal(mine.data.captchaImage,'fixture-image');
  assert.equal(mine.data.captchaLoading,false);
  mine.setData({submitting:true});
  await mine.refreshCaptcha();
  assert.equal(captchaRequests,1,'captcha cannot change during login');
  mine.setData({submitting:false});
  api.captcha=async () => {throw new Error('fixture captcha failure');};
  await mine.refreshCaptcha();
  assert.equal(mine.data.captchaLoading,false,'captcha failure unlocks retry');
  assert.equal(mine.data.formError,'fixture captcha failure');
  let retriedCaptcha=0;
  api.login=async () => {throw new Error('fixture login rejected');};
  api.captcha=async () => {retriedCaptcha++; return 'new-image';};
  mine.setData({username:'fixture',password:'fixture',captchaText:'fixture'});
  await mine.login();
  assert.equal(mine.data.submitting,false);
  assert.equal(retriedCaptcha,1,'failed login refreshes captcha after unlocking');
  assert.equal(mine.data.captchaImage,'new-image');
  assert.equal(mine.data.captchaText,'');
  assert.ok(changes > 20);
  console.log('PASS page loading, permission flags, checklist, editor image paths, cancelled publication, validation and access revocation');
})().catch(error => { console.error(error); process.exitCode=1; });

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../miniprogram');
const environments = require('../miniprogram/config');
assert.equal(environments.resolveBaseUrl('develop'), environments.developmentBaseUrl);
if (environments.productionBaseUrl) {
  for (const environment of ['develop', 'trial', 'release']) {
    assert.equal(environments.resolveBaseUrl(environment), 'https://mm.vorory.com',
      environment + ' must reach the public backend, including phone QR previews');
  }
}
if (!environments.productionBaseUrl) {
  assert.throws(() => environments.resolveBaseUrl('trial'), /HTTPS/);
  assert.throws(() => environments.resolveBaseUrl('release'), /HTTPS/);
  assert.throws(() => environments.resolveBaseUrl('unknown'), /HTTPS/);
}
const example = JSON.parse(fs.readFileSync(path.join(root, 'project.config.example.json')));
assert.equal(example.appid, 'touristappid', 'published config must use a placeholder');
const localConfig = path.join(root, 'project.config.json');
const config = fs.existsSync(localConfig) ? JSON.parse(fs.readFileSync(localConfig)) : example;
assert.match(config.appid, /^(?:touristappid|wx[a-f0-9]{16})$/, 'local AppID must be valid or a placeholder');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json')));
for (const page of app.pages) {
  for (const ext of ['.js', '.wxml', '.json']) assert.ok(fs.existsSync(path.join(root, page + ext)), page + ext);
  const template = fs.readFileSync(path.join(root, page + '.wxml'), 'utf8');
  assert.ok(!/wx:if="(?!\{\{)/.test(template), page + ': conditional must be bound');
  assert.ok(!template.includes('&amp;&amp;'), page + ': WXML expressions are not HTML');
}
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', file]);
    else if (file.endsWith('.json')) JSON.parse(fs.readFileSync(file));
  }
}
scan(root);
const calendar = require('../miniprogram/utils/calendar');
assert.equal(calendar.describe({ kind:'birthday', target_date:'2000-02-29' }, new Date(2027,0,1)).next_date, '2027-02-28');
assert.equal(calendar.describe({ kind:'birthday', target_date:'2001-09-14' }, new Date(2026,9,31)).age, 26);
assert.equal(calendar.describe({ kind:'festival', target_date:'2026-08-19', festival_key:'qixi' }, new Date(2026,9,31)).next_date, '2027-08-08');
assert.equal(calendar.describe({ kind:'festival', title:'七夕', target_date:'2026-08-19' }, new Date(2026,9,31)).next_date, '2027-08-08');
assert.equal(calendar.describe({ kind:'festival', target_date:'2026-01-01', festival_key:'spring' }, new Date(2026,0,1)).next_date, '2026-02-17');
let captured;
const state = { globalData:{} };
let logged = false;
const context = vm.createContext({ module:{exports:{}}, require:() => ({baseUrl:'https://example.test'}), getApp:() => state,
  wx: {
    request(options) {
      captured = options;
      const data = options.data || {};
      const payload = data.action === 'session' ? { owner:logged, permissions:[], csrf_token:'csrf-fixture' }
        : data.action === 'login' ? { csrf_token:'rotated-fixture' } : {};
      if (data.action === 'login') logged = true;
      if (options.responseType === 'arraybuffer') options.success({ statusCode:200, data:new ArrayBuffer(1), header:{} });
      else options.success({ data:{ code:0, data:payload }, cookies:['PHPSESSID=session-fixture; HttpOnly; Path=/'] });
    },
    arrayBufferToBase64:() => 'AA=='
  }
});
vm.runInContext(fs.readFileSync(path.join(root, 'utils/api.js'), 'utf8'), context);
(async () => {
  const api = context.module.exports;
  await api.session();
  await api.login({ username:'owner', password:'test', captcha:'ABCD' });
  assert.equal(state.globalData.session.owner, true);
  await api.manage('lovelist', 'update', { id:1, title:'test', done:1 });
  assert.equal(captured.data.csrf_token, 'csrf-fixture');
  assert.equal(captured.data.action, 'manage');
  assert.equal(captured.header.Cookie, 'PHPSESSID=session-fixture');
  assert.equal(api.media('/uploads/test.jpg'), 'https://example.test/uploads/test.jpg');
  assert.match(await api.captcha(), /^data:image\/png;base64,/);
  console.log('PASS project structure, JS syntax, JSON, calendar, session cookies, CSRF and captcha');
})().catch(error => { console.error(error); process.exitCode = 1; });

const config = require('../config');
let cookie = '';
let csrf = '';
let pendingSession;
const base = () => config.baseUrl.replace(/\/$/, '');
function media(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return base() + '/' + path.replace(/^\/+/, '');
}
function remember(response) {
  const header = response.header || {};
  const values = response.cookies && response.cookies.length ? response.cookies : [header['Set-Cookie'] || header['set-cookie'] || ''];
  values.forEach(value => {
    const match = String(value).match(/(?:^|[,;]\s*)(PHPSESSID=[^;,\s]+)/);
    if (match) cookie = match[1];
  });
}
function request(action, data = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    wx.request({
      url: base() + '/api/miniprogram_api.php', method,
      data: Object.assign({}, data, { action }, method === 'POST' ? { csrf_token: csrf } : {}),
      header: { 'content-type': 'application/x-www-form-urlencoded', Cookie: cookie },
      timeout: 15000,
      success(response) {
        remember(response);
        const body = response.data;
        if (body && body.code === 0) resolve(body.data);
        else {
          const error = new Error((body && body.msg) || '服务暂时不可用');
          error.code = body && body.code;
          reject(error);
        }
      },
      fail() { reject(new Error('连接失败，请检查服务地址和网络')); }
    });
  });
}
function session() {
  if (!pendingSession) pendingSession = request('session').then(value => {
    csrf = value.csrf_token;
    getApp().globalData.session = value;
    return value;
  }).finally(() => { pendingSession = null; });
  return pendingSession;
}
async function login(data) {
  await session();
  const result = await request('login', data, 'POST');
  csrf = result.csrf_token;
  return session();
}
async function logout() {
  await session();
  // Existing logout retains the site's CSRF and session rotation behavior.
  await new Promise((resolve, reject) => wx.request({
    url: base() + '/api/user_api.php', method: 'POST',
    data: { action: 'logout', csrf_token: csrf },
    header: { 'content-type': 'application/x-www-form-urlencoded', Cookie: cookie },
    timeout: 15000,
    success(response) { remember(response); response.data && response.data.code === 0 ? resolve() : reject(new Error(response.data && response.data.msg || '退出失败，请重试')); },
    fail() { reject(new Error('退出失败，请重试')); }
  }));
  return session();
}
async function captcha() {
  return new Promise((resolve, reject) => wx.request({
    url: base() + '/captcha.php?type=login&t=' + Date.now(), responseType: 'arraybuffer', timeout: 15000,
    header: { Cookie: cookie },
    success(response) {
      remember(response);
      if (response.statusCode !== 200) return reject(new Error('验证码加载失败'));
      resolve('data:image/png;base64,' + wx.arrayBufferToBase64(response.data));
    }, fail() { reject(new Error('验证码加载失败')); }
  }));
}
async function manage(module, operation, data) {
  await session();
  return request('manage', Object.assign({}, data, { module, operation }), 'POST');
}
async function upload(filePath) {
  await session();
  return new Promise((resolve, reject) => wx.uploadFile({
    url: base() + '/api/miniprogram_api.php?action=upload', filePath, name: 'file',
    formData: { csrf_token: csrf }, header: { Cookie: cookie }, timeout: 30000,
    success(response) {
      remember(response);
      try { const body = JSON.parse(response.data); if (body.code !== 0) throw new Error(body.msg); resolve(body.data.url); }
      catch (error) { reject(error); }
    }, fail() { reject(new Error('图片上传失败')); }
  }));
}
function moment(row) {
  return Object.assign({}, row, { avatar: media(row.avatar), originalImages:row.images.slice(), images: row.images.map(media),
    date:row.created_at.slice(0,10), dateMonth:row.created_at.slice(5,10), dateYear:row.created_at.slice(0,4) });
}
async function mutate(action, data) {
  await session();
  return request(action, data, 'POST');
}
module.exports = { request, session, login, logout, captcha, manage, upload, media, moment, mutate };

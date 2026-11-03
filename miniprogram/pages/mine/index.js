const api = require('../../utils/api');
require('../../utils/page')({
  data: { nickname: '', username: '', password: '', captchaText: '', captchaImage: '', captchaLoading: false, submitting: false, formError: '' },
  async fetchData() {
    const session = getApp().globalData.session;
    this.setData({ nickname: session.nickname });
    if (!session.owner) await this.refreshCaptcha();
  },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  openFeature(event) {
    const page = event.currentTarget.dataset.page;
    if (['music', 'chat', 'games'].includes(page)) wx.navigateTo({url:'/pages/' + page + '/index'});
  },
  async refreshCaptcha() {
    if (this.data.submitting) return;
    if (this._captchaPending) return;
    const requestId = this._captchaRequest = (this._captchaRequest || 0) + 1;
    this.setData({captchaImage:'', captchaText:'', captchaLoading:true});
    this._captchaPending = api.captcha();
    try {
      const captchaImage = await this._captchaPending;
      if (requestId === this._captchaRequest) this.setData({captchaImage});
    }
    catch (error) { if (requestId === this._captchaRequest) this.setData({ formError: error.message }); }
    finally { this._captchaPending = null; this.setData({captchaLoading:false}); }
  },
  async login() {
    if (this.data.submitting) return;
    if (this.data.captchaLoading) {
      this.setData({formError:'验证码正在加载，请稍候'}); return;
    }
    if (!this.data.username.trim() || !this.data.password || !this.data.captchaText.trim()) {
      this.setData({formError:'请填写账号、密码和验证码'}); return;
    }
    this.setData({ submitting: true, formError: '' });
    let refresh = false;
    try {
      await api.login({ username: this.data.username, password: this.data.password, captcha: this.data.captchaText });
      this.setData({ password: '', captchaText: '', captchaImage: '' });
      await this.load();
    } catch (error) { this.setData({ formError: error.message }); refresh = true; }
    finally { this.setData({ submitting: false }); }
    if (refresh) await this.refreshCaptcha();
  },
  async logout() {
    try { await api.logout(); await this.load(); }
    catch (error) { this.setData({ formError: error.message }); }
  }
});

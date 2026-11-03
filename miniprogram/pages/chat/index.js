const api = require('../../utils/api');
Page({
  data: {loading:true, owner:false, partner:'', list:[], draft:'', error:'', sending:false, older:false, hasMore:false},
  onShow() { this._active = true; this.start(); },
  onHide() { this.stop(); },
  onUnload() { this.stop(); },
  stop() {
    this._active = false;
    this._epoch = (this._epoch || 0) + 1;
    clearTimeout(this._timer);
    this.setData({list:[], draft:'', owner:false, partner:'', sending:false, older:false});
  },
  valid(epoch) { return this._active && epoch === this._epoch; },
  async start() {
    const epoch = this._epoch = (this._epoch || 0) + 1;
    clearTimeout(this._timer);
    this._partnerId = null;
    this._readThrough = 0;
    this.setData({loading:true, error:'', list:[], hasMore:false});
    try {
      const session = await api.session();
      if (!this.valid(epoch)) return;
      this.setData({owner:session.owner});
      if (!session.owner) throw new Error('请先以小窝主人身份登录');
      await this.fetchMessages({}, epoch, true);
    } catch (error) { if (this.valid(epoch)) this.handleError(error); }
    finally {
      if (this.valid(epoch)) { this.setData({loading:false}); this.schedule(epoch); }
    }
  },
  handleError(error) {
    const revoked = [401,403,409].includes(error.code);
    if (revoked) { this._epoch++; clearTimeout(this._timer); }
    this.setData(Object.assign({error:error.message}, revoked ? {list:[], partner:'', owner:false, draft:'', hasMore:false, loading:false, sending:false, older:false} : {}));
  },
  schedule(epoch) {
    if (!this.valid(epoch)) return;
    clearTimeout(this._timer);
    if (this.data.owner) this._timer = setTimeout(() => this.poll(epoch), 5000);
  },
  async poll(epoch) {
    try {
      if (!this.valid(epoch)) return;
      const last = this.data.list[this.data.list.length - 1];
      await this.fetchMessages(last ? {after:last.id} : {}, epoch, !last);
    } catch (error) { if (this.valid(epoch)) this.handleError(error); }
    finally { this.schedule(epoch); }
  },
  async fetchMessages(query, epoch, initial) {
    const result = await api.request('chat', query);
    if (!this.valid(epoch)) return;
    if (this._partnerId && result.partner_id !== this._partnerId) {
      // A new owner pair is a different conversation, not another message page.
      await this.start();
      return;
    }
    this._partnerId = result.partner_id;
    const merged = new Map(this.data.list.map(row => [row.id, row]));
    result.list.forEach(row => merged.set(row.id, Object.assign({}, row, {is_read:Number(row.is_read) === 1})));
    const list = Array.from(merged.values()).sort((a,b) => a.id - b.id);
    const patch = {list, partner:result.partner, error:''};
    if (initial || query.before) patch.hasMore = result.has_more;
    this.setData(patch);
    if (!query.before && result.list.length && wx.pageScrollTo) wx.pageScrollTo({scrollTop:999999, duration:200});
    const last = list[list.length - 1];
    if (last && last.id > this._readThrough) {
      await api.mutate('chat_read', {through:last.id, partner_id:this._partnerId});
      if (this.valid(epoch)) this._readThrough = last.id;
    }
    return result;
  },
  async loadOlder() {
    if (this.data.older || !this.data.hasMore || !this.data.owner) return;
    const epoch = this._epoch;
    this.setData({older:true});
    try { await this.fetchMessages({before:this.data.list[0].id}, epoch); }
    catch (error) { if (this.valid(epoch)) this.handleError(error); }
    finally { if (this.valid(epoch)) this.setData({older:false}); }
  },
  input(event) { this.setData({draft:event.detail.value}); },
  async send() {
    if (this.data.sending || this.data.loading || !this.data.owner || !this._partnerId || !this.data.draft.trim()) return;
    const epoch = this._epoch;
    const content = this.data.draft.trim();
    this.setData({sending:true, error:''});
    try {
      await api.mutate('chat_send', {content, partner_id:this._partnerId});
      if (!this.valid(epoch)) return;
      if (this.data.draft.trim() === content) this.setData({draft:''});
      await this.poll(epoch);
    } catch (error) { if (this.valid(epoch)) this.handleError(error); }
    finally { if (this.valid(epoch)) this.setData({sending:false}); }
  },
  login() { wx.switchTab({url:'/pages/mine/index'}); }
});

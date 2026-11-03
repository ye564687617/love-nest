const api = require('../../utils/api');
require('../../utils/page')({
  data: { list: [], page: 0, hasMore: false, moreLoading: false, manageMode: false, summary:{total:0,cities:0,record_days:0},
    years:[], year:0, month:0, months:[1,2,3,4,5,6,7,8,9,10,11,12] },
  onShow() { this._active = true; return this.load(); },
  async fetchData() { await this.fetchPage(1); },
  async fetchPage(page) {
    if (this._active === false) return;
    const scope = this.data.manageMode ? 'manage' : 'public';
    const year = this.data.year, month = this.data.month;
    const requestId = this._requestId = (this._requestId || 0) + 1;
    const result = await api.request('moments', { page, scope, year, month });
    if (requestId !== this._requestId || scope !== (this.data.manageMode ? 'manage' : 'public') || year !== this.data.year || month !== this.data.month) return;
    this.setData({ list: (page === 1 ? [] : this.data.list).concat(result.list.map(api.moment)), page, hasMore: result.has_more,
      years:result.years || [], summary:result.summary || {total:result.list.length,cities:0,record_days:0} });
  },
  async more() {
    if (!this.data.hasMore || this.data.moreLoading || this.data.loading) return;
    this.setData({ moreLoading: true });
    try { await this.fetchPage(this.data.page + 1); }
    catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
    finally { this.setData({ moreLoading: false }); }
  },
  onReachBottom() { return this.more(); },
  onHide() {
    this._active = false;
    this._requestId = (this._requestId || 0) + 1;
    if (this.data.manageMode) this.setData({list:[], page:0, hasMore:false,summary:{total:0,cities:0,record_days:0},years:[],year:0,month:0});
  },
  toggleScope(event) {
    if (!this.data.canMoments) return;
    this._requestId = (this._requestId || 0) + 1;
    this.setData({ manageMode: event.detail.value, list:[], page:0, hasMore:false,summary:{total:0,cities:0,record_days:0},years:[],year:0,month:0 });
    return this.load();
  },
  selectYear(event) { return this.setDate(this.data.years[Number(event.detail.value)] || 0, 0); },
  selectMonth(event) {
    const month = Number(event.currentTarget.dataset.month);
    return this.setDate(month ? (this.data.year || this.data.years[0] || new Date().getFullYear()) : 0, month);
  },
  setDate(year, month) {
    this._requestId = (this._requestId || 0)+1;
    this.setData({year,month,list:[],page:0,hasMore:false});
    return this.load();
  }
});

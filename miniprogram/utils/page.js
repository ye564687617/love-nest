const api = require('./api');
module.exports = function page(options) {
  const defaults = {
    data: { loading: true, error: '', owner: false, permissions: [], canMoments: false, canChecklist: false, canDays: false },
    onShow() { this.load(); },
    onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
    async load() {
      if (this._loading) { this._reloadRequested = true; return; }
      this._loading = true;
      this.setData({ loading: true, error: '' });
      try {
        const session = await api.session();
        if (this.data.owner && !session.owner && this.data.list) this.setData({ list: [] });
        this.setData({ owner: session.owner, permissions: session.permissions,
          canMoments: session.owner && session.permissions.includes('moments'),
          canChecklist: session.owner && session.permissions.includes('lovelist'),
          canDays: session.owner && session.permissions.includes('countdowns') });
        if ((!session.owner || !session.permissions.includes('moments')) && this.data.manageMode) this.setData({ manageMode: false, list:[], summary:{total:0,cities:0,record_days:0},years:[],year:0,month:0 });
        await this.fetchData();
      } catch (error) { this.setData({ error: error.message }); }
      finally {
        this._loading = false; this.setData({ loading: false });
        if (this._reloadRequested) { this._reloadRequested = false; await this.load(); }
      }
    },
    preview(event) {
      wx.previewImage({ current: event.currentTarget.dataset.current, urls: event.currentTarget.dataset.images });
    },
    edit(event) {
      const { module, item } = event.currentTarget.dataset;
      if (!this.data.owner || !this.data.permissions.includes(module)) return;
      wx.navigateTo({ url: '/pages/editor/index?module=' + module, success(result) {
        if (item) result.eventChannel.emit('record', item);
      } });
    },
    onShareAppMessage() { return { title: '来看看我们的恋爱小窝', path: '/pages/home/index' }; }
  };
  Page(Object.assign(defaults, options, { data: Object.assign({}, defaults.data, options.data) }));
};

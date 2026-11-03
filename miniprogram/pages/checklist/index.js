const api = require('../../utils/api');
require('../../utils/page')({
  data: { list: [], done: 0, percent:0, filter: 'all', visible: [] },
  async fetchData() {
    const result = await api.request('lovelist');
    const done = result.list.filter(item => Number(item.done) === 1).length;
    this.setData({ list: result.list, done, percent:result.list.length ? Math.round(done/result.list.length*100) : 0 });
    this.applyFilter();
  },
  filter(event) { this.setData({ filter: event.currentTarget.dataset.value }); this.applyFilter(); },
  applyFilter() { this.setData({ visible: this.data.list.filter(item => this.data.filter === 'all' || Number(item.done) === Number(this.data.filter)) }); },
  async toggle(event) {
    if (!this.data.canChecklist || this._saving) return;
    const item = event.currentTarget.dataset.item;
    this._saving = true;
    try { await api.manage('lovelist', 'update', { id: item.id, title: item.title, done: Number(item.done) ? 0 : 1 }); await this.load(); }
    catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
    finally { this._saving = false; }
  }
});

const api = require('../../utils/api');
const calendar = require('../../utils/calendar');
require('../../utils/page')({
  data: { list: [] },
  async fetchData() {
    const result = await api.request('countdowns');
    this.setData({ list: result.list.map(row => Object.assign({}, row, calendar.describe(row))) });
  }
});

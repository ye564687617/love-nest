const api = require('../../utils/api');
const calendar = require('../../utils/calendar');
require('../../utils/page')({
  data: { site:null, moments:[], days:0, hours:'00', minutes:'00', seconds:'00', story:null, sidePhotos:[], storyIndex:0, checklistPercent:0, anniversaryDays:0, anniversaryDate:'', song:null },
  onShow() {
    this._active = true;
    clearInterval(this._clock);
    this.updateClock();
    this._clock = setInterval(() => this.updateClock(), 1000);
    return this.load();
  },
  onHide() { this._active = false; clearInterval(this._clock); },
  onUnload() { this.onHide(); },
  async fetchData() {
    const data = await api.request('home');
    const site = data.site;
    site.boy_avatar = api.media(site.boy_avatar);
    site.girl_avatar = api.media(site.girl_avatar);
    this._loveStart = new Date(site.love_start.replace(' ', 'T') + '+08:00').getTime();
    const china = new Date(Date.now()+8*3600000);
    const today = new Date(china.getUTCFullYear(),china.getUTCMonth(),china.getUTCDate());
    const anniversary = calendar.describe({kind:'anniversary',target_date:site.love_start.slice(0,10)},today);
    const anniversaryDays = Math.round((Date.parse(anniversary.next_date+'T00:00:00+08:00') - (Date.UTC(china.getUTCFullYear(),china.getUTCMonth(),china.getUTCDate())-8*3600000)) / 86400000);
    this.setData(Object.assign({}, data, { site, moments: data.moments.map(api.moment),
      checklistPercent:data.checklist.total ? Math.round(Number(data.checklist.done)/Number(data.checklist.total)*100) : 0,
      anniversaryDays:Number.isFinite(anniversaryDays) ? Math.max(0,anniversaryDays) : 0, anniversaryDate:anniversary.next_date }));
    this.updateClock();
    this.showStory(0);
    wx.setNavigationBarTitle({ title: site.title });
    try {
      const playlist = await api.request('playlist');
      if (this._active !== false) this.setData({song:playlist && playlist.list.length ? Object.assign({},playlist.list[0],{cover:api.media(playlist.list[0].cover)}) : null});
    } catch (_) { if (this._active !== false) this.setData({song:null}); }
  },
  updateClock() {
    const elapsed = Number.isFinite(this._loveStart) ? Math.max(0,Math.floor((Date.now()-this._loveStart)/1000)) : 0;
    this.setData({days:Math.floor(elapsed/86400),hours:String(Math.floor(elapsed/3600)%24).padStart(2,'0'),
      minutes:String(Math.floor(elapsed/60)%60).padStart(2,'0'),seconds:String(elapsed%60).padStart(2,'0')});
  },
  showStory(index) {
    const stories = this.data.moments.filter(item => item.images.length);
    if (!stories.length) { this.setData({story:null,sidePhotos:[]}); return; }
    const storyIndex = index % stories.length;
    const story = stories[storyIndex];
    const all = stories.flatMap(item => item.images);
    this.setData({story, storyIndex, sidePhotos:all.filter(photo => photo !== story.images[0]).slice(0,2)});
  },
  nextStory() { this.showStory(this.data.storyIndex+1); },
  goAlbum() { wx.switchTab({ url:'/pages/album/index' }); },
  open(event) {
    const page = event.currentTarget.dataset.page;
    if (['days','checklist','mine'].includes(page)) wx.switchTab({url:'/pages/'+page+'/index'});
    else if (['music','games','chat'].includes(page)) wx.navigateTo({url:'/pages/'+page+'/index'});
  }
});

const api = require('../../utils/api');
const createPlayer = require('../../utils/player');
function clock(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
}
Page({
  data: {loading:true, error:'', list:[], track:null, index:-1, playing:false, buffering:false, progress:0, elapsed:'0:00', durationText:'0:00', playbackError:''},
  onShow() { this._active = true; this.load(); },
  onHide() { this.release(); },
  onUnload() { this.release(); },
  release() {
    this._active = false;
    this._epoch = (this._epoch || 0) + 1;
    if (this._player) this._player.destroy();
    this._player = null;
    this.setData({playing:false, buffering:false});
  },
  async load() {
    const epoch = this._epoch = (this._epoch || 0) + 1;
    if (this._player) this._player.destroy();
    this._player = null;
    this.setData({loading:true, error:'', playbackError:'', track:null, list:[], progress:0, index:-1});
    try {
      const result = await api.request('playlist');
      if (!this._active || epoch !== this._epoch) return;
      const list = result.list.map(song => {
        const src = api.media(song.src);
        return Object.assign({}, song, {src, cover:api.media(song.cover), insecure:/^http:\/\//i.test(src)});
      });
      this._player = createPlayer(state => {
        if (!this._active || epoch !== this._epoch) return;
        this.setData({track:state.track, index:state.index, playing:state.playing, buffering:state.buffering,
          progress:state.duration ? Math.min(100, state.current / state.duration * 100) : 0,
          elapsed:clock(state.current), durationText:clock(state.duration), playbackError:state.error});
      });
      this.setData({list});
      this._player.setTracks(list);
    } catch (error) { if (this._active && epoch === this._epoch) this.setData({error:error.message}); }
    finally { if (this._active && epoch === this._epoch) this.setData({loading:false}); }
  },
  select(event) { if (this._player) this._player.select(Number(event.currentTarget.dataset.index)); },
  toggle() { if (this._player) this._player.toggle(); },
  next() { if (this._player) this._player.next(); },
  previous() { if (this._player) this._player.previous(); },
  seek(event) { if (this._player) this._player.seek(event.detail.value); },
  onShareAppMessage() { return {title:'听听我们喜欢的歌', path:'/pages/music/index'}; }
});

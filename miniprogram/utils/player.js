// One foreground player per music page; leaving the page releases native audio.
module.exports = function player(onChange) {
  const audio = wx.createInnerAudioContext();
  let disposed = false;
  let tracks = [];
  let index = -1;
  const state = {playing:false, buffering:false, current:0, duration:0, error:'', index:-1, track:null};
  function update(patch) {
    if (disposed) return;
    Object.assign(state, patch);
    onChange(Object.assign({}, state));
  }
  function select(next, autoplay = true) {
    if (disposed || !tracks.length) return;
    index = (next + tracks.length) % tracks.length;
    audio.stop();
    update({index, track:tracks[index], current:0, duration:0, playing:false, buffering:autoplay, error:''});
    audio.src = tracks[index].src;
    if (autoplay) audio.play();
  }
  audio.onPlay(() => update({playing:true, buffering:false, error:''}));
  audio.onPause(() => update({playing:false, buffering:false}));
  audio.onStop(() => update({playing:false, buffering:false}));
  audio.onWaiting(() => update({buffering:true}));
  audio.onCanplay(() => update({buffering:false, duration:Number(audio.duration) || 0}));
  audio.onTimeUpdate(() => update({current:Number(audio.currentTime) || 0, duration:Number(audio.duration) || 0}));
  audio.onError(() => update({playing:false, buffering:false, error:'这首歌暂时无法播放，请重试或切换下一首'}));
  audio.onEnded(() => select(index + 1));
  return {
    setTracks(list) { tracks = list; if (list.length) select(0, false); else { audio.stop(); update({index:-1, track:null, playing:false}); } },
    select,
    toggle() {
      if (disposed || index < 0) return;
      if (state.playing || state.buffering) audio.pause();
      else { update({error:'', buffering:true}); audio.play(); }
    },
    next() { select(index + 1); },
    previous() { select(index - 1); },
    seek(percent) {
      if (!disposed && state.duration > 0) audio.seek(Math.min(100, Math.max(0, Number(percent) || 0)) * state.duration / 100);
    },
    destroy() { if (!disposed) { disposed = true; audio.destroy(); } }
  };
};

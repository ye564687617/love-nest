const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
for (const page of ['index', 'loveImg', 'list', 'message', 'chat', 'articles']) {
  const source = fs.readFileSync(`html/${page}.php`, 'utf8');
  const start = source.indexOf('    var _plAudio = new Audio();');
  const end = source.indexOf('    // ===== 歌单弹窗', start);
  assert.ok(start > 0 && end > start);
  assert.match(source, /display=swap" rel="stylesheet" media="print"/);
  for (const playing of [false, true]) {
    let saved, audio;
    class Audio {
      constructor() { audio = this; this.currentTime = 0; this.readyState = 0; this.listeners = {}; }
      getAttribute(name) { return this[name]; }
      addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
      play() { this.playCalls = (this.playCalls || 0) + 1; return Promise.resolve(); }
      pause() {}
    }
    const ctx = vm.createContext({
      Audio, PLAYLIST: [{ src: '/song.mp3', lyrics: '' }],
      document: { getElementById: () => null, querySelector: () => null },
      window: { addEventListener() {} }, setInterval() {},
      localStorage: {
        getItem: () => JSON.stringify({ index: 0, playing, currentTime: 42, volume: 0 }),
        setItem: (key, value) => { saved = JSON.parse(value); }
      }
    });
    vm.runInContext(source.slice(start, end), ctx);
    assert.equal(audio.preload, 'none');
    assert.equal(audio.volume, 0, 'muted volume survives refresh');
    if (!playing) assert.equal(audio.src, undefined, 'paused restore makes no audio request');
    ctx._plSaveState();
    assert.equal(saved.currentTime, 42, 'deferred seek survives periodic state save');
    ctx._plPlay();
    assert.equal(audio.src, '/song.mp3');
    for (const handler of audio.listeners.loadedmetadata || []) handler();
    assert.equal(audio.currentTime, 42);
    ctx._plLoad(0);
    assert.equal(ctx._plResumeTime, 0, 'track change clears old seek');
  }
  console.log('PASS', page, 'nonblocking font, deferred audio, resume and mute');
}

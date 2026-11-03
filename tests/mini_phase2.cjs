const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../miniprogram');
const games = require('../miniprogram/utils/games');
assert.equal(games.randomIndex(6, () => 0), 0);
assert.equal(games.randomIndex(6, () => .99999), 5);
const sample = games.sample(60, () => .4);
assert.equal(new Set(sample).size, sample.length);
assert.equal(games.sample().length, 10);
assert.throws(() => games.customOptions('one'));
assert.deepEqual(games.customOptions('甲\n乙，丙'), ['甲','乙','丙']);
let timers = new Map(), counter = 0, definition;
const wx = {switchTab() {}, createCanvasContext() {return new Proxy({}, {get:() => () => {}});}};
const api = {session:async () => ({owner:true}), request:async () => ({list:[],partner:'Peer',partner_id:10,has_more:false}), mutate:async () => ({}), media:value => value};
function page(name) {
  const context = vm.createContext({Page:def => {definition=def;}, wx,
    setTimeout:fn => {timers.set(++counter,fn); return counter;}, clearTimeout:id => timers.delete(id),
    require:id => id.endsWith('/games') ? games : id.endsWith('/player') ? createPlayer : api});
  vm.runInContext(fs.readFileSync(path.join(root,'pages',name,'index.js'),'utf8'),context);
  return Object.assign({}, definition, {data:structuredClone(definition.data), setData(patch,done) {Object.assign(this.data,patch); if(done) done();}});
}
function tick() {const [id,fn] = timers.entries().next().value; timers.delete(id); fn();}
function deferred() {let resolve; const promise = new Promise(done => {resolve=done;}); return {promise,resolve};}
let audio, audioEvents, destroyed = 0, played = 0, paused = 0, sought;
wx.createInnerAudioContext = () => {
  audioEvents = {};
  audio = {stop() {audioEvents.Stop();}, play() {played++; audioEvents.Play();}, pause() {paused++; audioEvents.Pause();}, seek:value => {sought=value;}, destroy() {destroyed++;}};
  for (const name of ['Play','Pause','Stop','Waiting','Canplay','TimeUpdate','Error','Ended']) audio['on'+name] = fn => {audioEvents[name]=fn;};
  return audio;
};
const playerContext = vm.createContext({module:{exports:{}},wx});
vm.runInContext(fs.readFileSync(path.join(root,'utils/player.js'),'utf8'),playerContext);
const createPlayer = playerContext.module.exports;
(async () => {
  let state;
  const player = createPlayer(value => {state=value;});
  player.setTracks([{src:'/a.mp3'},{src:'/b.mp3'}]);
  assert.equal(played,0,'no autoplay on entry');
  player.toggle(); assert.equal(state.playing,true);
  player.toggle(); assert.equal(paused,1);
  audio.duration=200; audio.currentTime=50; audioEvents.TimeUpdate();
  player.seek(25); assert.equal(sought,50);
  player.seek(900); assert.equal(sought,200);
  player.next(); assert.equal(state.index,1);
  audioEvents.Ended(); assert.equal(state.index,0);
  audioEvents.Error(); assert.ok(state.error); assert.equal(state.playing,false);
  player.destroy(); player.destroy(); assert.equal(destroyed,1);
  const before=state; audioEvents.TimeUpdate(); assert.equal(state,before,'ignore callbacks after destroy');
  const chat = page('chat');
  await chat.onShow(); // onShow dispatches start; await microtasks below.
  await new Promise(setImmediate);
  assert.equal(chat.data.owner,true);
  assert.equal(timers.size,1);
  api.request=async () => ({list:[{id:2,content:'two'},{id:1,content:'one'},{id:2,content:'two'}], partner:'Peer',partner_id:10,has_more:true});
  await chat.poll(chat._epoch);
  assert.deepEqual(Array.from(chat.data.list,row => row.id),[1,2]);
  let sent=0;
  const pending=deferred();
  api.mutate=async action => {if(action==='chat_send') {sent++; await pending.promise;}};
  chat.setData({draft:'hello'});
  const sending=chat.send(); chat.send(); assert.equal(sent,1);
  pending.resolve(); await sending; assert.equal(chat.data.draft,'');
  api.request=async () => ({list:[{id:3,content:'new partner'}],partner:'New peer',partner_id:11,has_more:false});
  await chat.poll(chat._epoch);
  assert.deepEqual(Array.from(chat.data.list,row => row.id),[3],'new owner pair clears previous conversation');
  assert.equal(timers.size,1,'old epoch cannot cancel new conversation polling');
  const previousEpoch=chat._epoch;
  await chat.start();
  chat.schedule(previousEpoch);
  assert.equal(timers.size,1,'late completion leaves the current poll scheduled');
  const slow=deferred(); api.request=() => slow.promise;
  const polling=chat.poll(chat._epoch);
  chat.onHide(); assert.equal(timers.size,0); assert.equal(chat.data.list.length,0);
  slow.resolve({list:[{id:99,content:'late private data'}],partner:'Peer'}); await polling;
  assert.equal(chat.data.list.length,0,'late private response discarded');
  api.request=async () => {throw Object.assign(new Error('revoked'),{code:403});};
  chat.onShow(); await new Promise(setImmediate);
  assert.equal(chat.data.owner,false); assert.equal(timers.size,0);
  const game=page('games'); await game.onShow();
  game.choose({currentTarget:{dataset:{mode:'dice'}}});
  game.roll(); game.roll(); assert.equal(timers.size,1);
  tick(); assert.ok(game.data.dice[0]>=1 && game.data.dice[0]<=6);
  game.roll(); tick(); assert.equal(game.data.finished,true);
  game.roll(); assert.equal(timers.size,0);
  game.choose({currentTarget:{dataset:{mode:'quiz'}}});
  for(let i=0;i<10;i++) {
    const answer={currentTarget:{dataset:{index:0}}};
    game.answer(answer); game.answer(answer); assert.equal(game.data.player,0);
    game.nextQuestion(); game.nextQuestion(); assert.equal(game.data.player,1);
    game.answer(answer); game.answer(answer); assert.equal(game.data.matches,i+1);
    game.nextQuestion();
  }
  assert.equal(game.data.finished,true); assert.equal(game.data.percent,100);
  game.choose({currentTarget:{dataset:{mode:'wheel'}}});
  game.spin(); game.spin(); assert.equal(timers.size,1);
  tick(); assert.ok(game.data.options.includes(game.data.result));
  const selected=game.data.options.indexOf(game.data.result);
  const pointer=((360-game.data.rotation%360)%360)/(360/game.data.options.length);
  assert.equal(Math.floor(pointer),selected,'wheel pointer agrees with selected result');
  game.spin(); game.onHide(); assert.equal(timers.size,0); assert.equal(game.data.mode,'');
  api.session=async () => ({owner:false}); await game.onShow();
  game.choose({currentTarget:{dataset:{mode:'dice'}}}); assert.equal(game.data.mode,'');
  api.request=async () => ({list:[{id:1,src:'/a.mp3',cover:'',name:'Track'}]});
  const music=page('music'); music.onShow(); await new Promise(setImmediate);
  assert.equal(music.data.list.length,1); music.toggle(); assert.equal(music.data.playing,true);
  const count=destroyed; music.onHide(); assert.equal(destroyed,count+1); assert.equal(music.data.playing,false);
  const late=deferred(); api.request=() => late.promise;
  music.onShow(); music.onUnload(); late.resolve({list:[{src:'/late'}]}); await new Promise(setImmediate);
  assert.equal(music._player,null,'no audio constructed after leaving page');
  console.log('PASS phase2 private lifecycle, deduplication, send lock, revocation, foreground audio, seek, errors, game rounds, duplicate taps and wheel pointer');
})().catch(error => {console.error(error); process.exitCode=1;});

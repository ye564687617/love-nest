const api = require('../../utils/api');
const games = require('../../utils/games');
Page({
  data: {loading:true, owner:false, error:'', mode:'', busy:false, result:'',
    dice:[0,0], turn:0, finished:false, wheelType:'food', options:games.presets.food,
    custom:'', rotation:0, history:[], wheelSize:300, question:null, questionIndex:0, player:0, selected:-1,
    revealed:false, matches:0, total:10, percent:0},
  async onShow() {
    this._active = true;
    const width = wx.getWindowInfo ? wx.getWindowInfo().windowWidth : 375;
    this.setData({wheelSize:Math.min(300, Math.floor(width * (1 - 76 / 750)))});
    const epoch = this._epoch = (this._epoch || 0) + 1;
    this.setData({loading:true, error:'', owner:false});
    try {
      const session = await api.session();
      if (this._active && epoch === this._epoch) this.setData({owner:session.owner});
    } catch (error) { if (this._active && epoch === this._epoch) this.setData({error:error.message}); }
    finally { if (this._active && epoch === this._epoch) this.setData({loading:false}); }
  },
  onHide() { this.stop(); },
  onUnload() { this.stop(); },
  stop() {
    this._active = false;
    this._epoch = (this._epoch || 0) + 1;
    this.reset();
    this.setData({mode:'', owner:false});
  },
  reset() {
    clearTimeout(this._timer);
    this._firstAnswer = null;
    this._questions = [];
    this.setData({busy:false, result:'', dice:[0,0], turn:0, finished:false,
      rotation:0, question:null, questionIndex:0, player:0, selected:-1, revealed:false, matches:0, percent:0});
  },
  choose(event) {
    if (!this.data.owner || !this._active) return;
    const mode = event.currentTarget.dataset.mode;
    if (!['dice','wheel','quiz'].includes(mode)) return;
    this.reset();
    this.setData({mode, error:''}, () => { if (mode === 'wheel') this.drawWheel(); });
    if (mode === 'quiz') this.startQuiz();
  },
  back() { this.reset(); this.setData({mode:'', error:''}); },
  again() {
    const mode = this.data.mode;
    this.reset();
    if (mode === 'quiz') this.startQuiz();
    if (mode === 'wheel') this.drawWheel();
  },
  roll() {
    if (!this.data.owner || this.data.busy || this.data.finished || !this._active) return;
    this.setData({busy:true});
    this._timer = setTimeout(() => {
      if (!this._active) return;
      const dice = this.data.dice.slice();
      dice[this.data.turn] = games.randomIndex(6) + 1;
      const finished = this.data.turn === 1;
      const result = !finished ? '' : dice[0] === dice[1] ? '平局，再来一局？' : (dice[0] > dice[1] ? '玩家一' : '玩家二') + '获胜';
      this.setData({dice, turn:1, finished, result, busy:false});
    }, 600);
  },
  wheelType(event) {
    if (this.data.busy) return;
    const wheelType = event.currentTarget.dataset.type;
    if (!['food','play','custom'].includes(wheelType)) return;
    this.setData({wheelType, result:'', error:'', rotation:0});
    if (wheelType !== 'custom') this.setData({options:games.presets[wheelType]}, () => this.drawWheel());
  },
  input(event) { this.setData({custom:event.detail.value}); },
  applyCustom() {
    if (this.data.busy) return;
    try { this.setData({options:games.customOptions(this.data.custom), result:'', error:'', rotation:0}, () => this.drawWheel()); }
    catch (error) { this.setData({error:error.message}); }
  },
  drawWheel() {
    if (!this._active || this.data.mode !== 'wheel') return;
    const ctx = wx.createCanvasContext('wheel', this);
    ctx.scale(this.data.wheelSize / 300, this.data.wheelSize / 300);
    const options = this.data.options;
    const slice = Math.PI * 2 / options.length;
    options.forEach((label, i) => {
      const start = -Math.PI / 2 + i * slice;
      ctx.beginPath(); ctx.moveTo(150,150); ctx.arc(150,150,144,start,start + slice); ctx.closePath();
      ctx.setFillStyle(i % 2 ? '#e9d1dc' : '#f7e9ef'); ctx.fill();
      ctx.save(); ctx.translate(150,150); ctx.rotate(start + slice / 2);
      ctx.setFillStyle('#542b3b'); ctx.setFontSize(12); ctx.setTextAlign('center');
      ctx.fillText(label.length > 6 ? label.slice(0,5) + '…' : label,88,4); ctx.restore();
    });
    ctx.draw();
  },
  spin() {
    if (!this.data.owner || this.data.busy || !this._active) return;
    const selected = games.randomIndex(this.data.options.length);
    const target = 360 - (selected + .5) * 360 / this.data.options.length;
    const rotation = this.data.rotation + 1440 + ((target - this.data.rotation % 360 + 360) % 360);
    this.setData({busy:true, result:'', rotation});
    this._timer = setTimeout(() => {
      if (!this._active) return;
      const result = this.data.options[selected];
      this.setData({busy:false, result, history:[result].concat(this.data.history).slice(0,10)});
    }, 2200);
  },
  startQuiz() {
    this._questions = games.sample(10);
    this._firstAnswer = null;
    this.setData({question:this._questions[0], total:this._questions.length});
  },
  answer(event) {
    if (!this.data.owner || this.data.busy || this.data.revealed || this.data.finished || !this._active) return;
    const selected = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(selected) || selected < 0 || selected >= this.data.question.options.length) return;
    if (this.data.player === 0) {
      this._firstAnswer = selected;
      this.setData({revealed:true, selected:-1});
    } else {
      const matches = this.data.matches + (selected === this._firstAnswer ? 1 : 0);
      this.setData({selected, matches, revealed:true, result:selected === this._firstAnswer ? '这题心有灵犀' : '这次答案不一样'});
    }
  },
  nextQuestion() {
    if (!this.data.owner || !this.data.revealed || !this._active) return;
    if (this.data.player === 0) { this.setData({player:1, revealed:false}); return; }
    const questionIndex = this.data.questionIndex + 1;
    if (questionIndex >= this.data.total) {
      this.setData({finished:true, revealed:false, percent:Math.round(this.data.matches / this.data.total * 100), result:''});
    } else {
      this._firstAnswer = null;
      this.setData({questionIndex, player:0, selected:-1, revealed:false, result:'', question:this._questions[questionIndex]});
    }
  },
  login() { wx.switchTab({url:'/pages/mine/index'}); }
});

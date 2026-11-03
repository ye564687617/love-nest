const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const elements = new Map();
let requests = [], confirmed = false;
function el(id) {
  if (!elements.has(id)) elements.set(id, { innerHTML:'', checked:[], querySelectorAll() { return this.checked.map(value => ({value})); } });
  return elements.get(id);
}
const context = vm.createContext({
  Admin: { el, esc:value => String(value),
    get:async () => ({policy:{owner_ids:[2],public_countdown_ids:[]},users:[{id:2,nickname:'Owner',username:'owner'}],countdowns:[{id:3,title:'Day',target_date:'2026-10-31'}]}),
    confirm:async () => confirmed,
    submit:async (_,callback) => callback(),
    api:async (...args) => requests.push(args)
  },
  toastr:{warning() {},error(message) { throw new Error(message); }}
});
vm.runInContext(fs.readFileSync('html/admin/assets/miniprogram.js','utf8'),context);
(async () => {
  await vm.runInContext('MiniPolicy.load()',context);
  assert.match(el('miniOwners').innerHTML,/value="2" checked/);
  assert.match(el('miniDates').innerHTML,/value="3"/);
  el('miniOwners').checked = [1,2,3];
  await vm.runInContext('MiniPolicy.save()',context);
  assert.equal(requests.length,0);
  el('miniOwners').checked = [2];
  await vm.runInContext('MiniPolicy.save()',context);
  assert.equal(requests.length,0);
  confirmed = true;
  el('miniDates').checked = [3];
  await vm.runInContext('MiniPolicy.save()',context);
  assert.equal(requests[0][2].owner_ids,'[2]');
  assert.equal(requests[0][2].public_countdown_ids,'[3]');
  console.log('PASS admin policy rendering, two-owner cap, confirmation and typed ID submission');
})().catch(error => { console.error(error); process.exitCode=1; });

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const nodes = new Map();
const handlers = new Map();
const errors = [];
const document = {
  body: { style: {} },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  getElementById(id) { return nodes.get('#' + id); }
};
function node(id) {
  if (!nodes.has(id)) nodes.set(id, { visible: false, content: null, focus() {}, querySelectorAll() { return []; } });
  return nodes.get(id);
}
function $(target) {
  if (typeof target === 'function') return;
  const el = target === document ? document : node(target);
  return {
    html(content) { el.content = content; return this; },
    attr() { return this; },
    show() { el.visible = true; return this; },
    hide() { el.visible = false; return this; },
    is() { return el.visible; },
    empty() { el.content = null; return this; },
    contents() { return { detach() { const content = el.content; el.content = null; return content; } }; },
    append(content) { el.content = content; return this; },
    on(event, selector, callback) { handlers.set(String(target) + ':' + event + ':' + (callback ? selector : ''), callback || selector); return this; }
  };
}
const window = {};
const context = vm.createContext({ window, document, jQuery: $, toastr: { error(msg) { errors.push(msg); } }, FormData });
vm.runInContext(fs.readFileSync('html/admin/assets/admin.js', 'utf8'), context);
const { Admin } = window;
function button() { return { disabled: false, setAttribute() {}, removeAttribute() {} }; }
(async () => {
  Admin.modal('Draft', 'original');
  const draft = { value: 'unsaved text', handler: () => 1 };
  node('#modalBox').content = draft;
  const cancel = Admin.confirm('<img src=x onerror=bad>');
  assert.ok(node('#modalBox').content.includes('&lt;img'));
  Admin.closeModal();
  assert.equal(await cancel, false);
  assert.equal(node('#modalBox').content, draft, 'cancel restores original draft and handlers');
  assert.equal(node('#modalMask').visible, true);
  const confirm = Admin.confirm('Proceed?');
  handlers.get('#cfYes:click:')();
  assert.equal(await confirm, true);
  assert.equal(node('#modalBox').content, draft);
  const backdrop = handlers.get('[object Object]:click:#modalMask');
  backdrop({ target: { id: 'modalMask' } });
  assert.equal(node('#modalMask').visible, true, 'backdrop does not discard a draft');
  const backdropConfirm = Admin.confirm('Cancel by backdrop');
  backdrop({ target: { id: 'modalMask' } });
  assert.equal(await backdropConfirm, false);
  assert.equal(node('#modalBox').content, draft);
  Admin.closeModal();
  assert.equal(node('#modalMask').visible, false);
  assert.equal(document.body.style.overflow, '');
  let calls = 0, finish;
  const save = button();
  const pending = Admin.submit(save, () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  await Admin.submit(save, () => { calls++; });
  assert.equal(calls, 1, 'duplicate submit ignored');
  finish(); await pending;
  assert.equal(save.disabled, false);
  await Admin.submit(save, () => { throw new Error('offline'); });
  assert.equal(errors.length, 1);
  await Admin.submit(save, () => { const error = new Error('shown already'); error.notified = true; throw error; });
  assert.equal(errors.length, 1, 'API failures do not display duplicate notifications');
  assert.equal(save.disabled, false);
  console.log('PASS nested dialogs, draft preservation, escaping, backdrop and submit recovery');
})().catch(error => { console.error(error); process.exitCode = 1; });

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const elements = new Map();
const inputs = [{ value: 'articles', checked: true }, { value: 'albums', checked: false }];
function el(id) {
  if (!elements.has(id)) elements.set(id, {
    value: '', hidden: false, disabled: false,
    querySelectorAll(selector) { return selector === 'input:checked' ? inputs.filter(input => input.checked) : inputs; }
  });
  return elements.get(id);
}
const rows = [
  { id: 1, username: 'admin', role: 'admin', permissions: ['albums', 'articles'], created_at: '' },
  { id: 2, username: 'writer', role: 'editor', permissions: ['articles'], created_at: '' }
];
let html = '', confirmed = false, calls = [], closed = 0;
const Admin = {
  el, esc: value => String(value ?? ''), time: () => '',
  get: async () => ({ list: rows, modules: { albums: '相册管理', articles: '文章管理' } }),
  modal(title, content) { html = content; el('permissionRole').value = 'editor'; },
  confirm: async () => confirmed,
  submit: async (button, action) => action(),
  api: async (...args) => { calls.push(args); },
  closeModal() { closed++; }
};
const source = fs.readFileSync('html/admin/users.php', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replaceAll('<?= $me ?>', '1');
const context = vm.createContext({ Admin, toastr: { error(message) { throw new Error(message); } } });
vm.runInContext(source, context);
(async () => {
  await vm.runInContext('Users.load()', context);
  assert.match(el('usersBody').innerHTML, /data-user="1" disabled/);
  vm.runInContext('Users.open(2)', context);
  assert.match(html, /value="articles" checked/);
  assert.match(html, /value="albums" >相册管理/);
  assert.equal(el('modulePermissions').hidden, false);
  el('permissionsAll').onclick();
  assert.ok(inputs.every(input => input.checked));
  el('permissionsNone').onclick();
  assert.ok(inputs.every(input => !input.checked));
  await el('permissionSave').onclick();
  assert.equal(calls.length, 0, 'cancelling confirmation never changes permissions');
  confirmed = true;
  await el('permissionSave').onclick();
  assert.equal(calls[0][2].permissions, '[]', 'empty selection is explicitly saved');
  assert.equal(closed, 1);
  el('permissionRole').value = 'admin';
  el('permissionRole').onchange();
  assert.equal(el('modulePermissions').hidden, true);
  await el('permissionSave').onclick();
  assert.equal(calls[1][2].role, 'admin');
  assert.ok(!('permissions' in calls[1][2]), 'administrator role does not submit editor-only restrictions');
  console.log('PASS permission dialog selection, cancellation, empty access and role switching');
})().catch(error => { console.error(error); process.exitCode = 1; });

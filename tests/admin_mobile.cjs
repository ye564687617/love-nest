const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor(text = '') {
    this.textContent = text;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.colSpan = 1;
    this.isConnected = true;
    const classes = new Set();
    this.classList = {
      toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
      add(name) { classes.add(name); },
      contains(name) { return classes.has(name); }
    };
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  focus() { document.activeElement = this; }
  getClientRects() { return [1]; }
  get firstChild() { return this.children[0]; }
  appendChild(child) {
    if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
    child.parent = this;
    this.children.push(child);
  }
  querySelector(selector) {
    if (selector === 'th') return this.isHeader ? this.children[0] : null;
    if (selector === ':scope > .record-value') return this.children.find(child => child.className === 'record-value');
    if (selector === '.side-link.active') return active;
    return null;
  }
  querySelectorAll(selector) {
    if (selector === 'tr') return this.rows;
    if (selector.startsWith('a[href]')) return [close, active, last];
    return [];
  }
}
const body = new Element(), sidebar = new Element(), toggle = new Element();
const close = new Element(), backdrop = new Element(), main = new Element();
const active = new Element(), last = new Element(), content = new Element();
active.scrollIntoView = () => {};
const headers = new Element();
headers.isHeader = true;
headers.children = ['文章', '操作'].map(label => new Element(label));
const cell = new Element(), actions = new Element(), title = new Element('Title');
title.onclick = () => 'preserved';
cell.appendChild(title);
cell.appendChild(new Element('Date'));
const row = new Element();
row.children = [cell, actions];
const table = new Element();
table.rows = [headers, row];
const handlers = {};
const ids = { adminSidebar: sidebar, navToggle: toggle, navClose: close, navBackdrop: backdrop };
const document = {
  body, activeElement: toggle,
  documentElement: { style: { setProperty(key, value) { viewportStyles[key] = value; } } },
  getElementById: id => ids[id],
  querySelector: selector => selector === '.main' ? main : content,
  querySelectorAll: () => [table],
  createElement: () => new Element(),
  addEventListener: (event, callback) => { handlers[event] = callback; }
};
const media = { matches: true, addEventListener(event, callback) { this.changed = callback; } };
const viewportStyles = {};
const viewportEvents = {};
const viewport = { height: 667, offsetTop: 0, addEventListener(event, callback) { viewportEvents[event] = callback; } };
let mutation;
vm.runInNewContext(fs.readFileSync('html/admin/assets/mobile.js', 'utf8'), {
  document, window: { matchMedia: () => media, visualViewport: viewport },
  MutationObserver: class { constructor(callback) { mutation = callback; } observe() {} }
});
assert.equal(sidebar.inert, true);
assert.equal(main.inert, false);
assert.equal(backdrop.hidden, true);
assert.equal(viewportStyles['--admin-viewport-height'], '667px');
viewport.height = 320;
viewport.offsetTop = 42;
viewportEvents.resize();
assert.equal(viewportStyles['--admin-viewport-height'], '320px');
viewportEvents.scroll();
assert.equal(viewportStyles['--admin-viewport-top'], '42px');
toggle.onclick();
assert.equal(main.inert, true);
assert.equal(sidebar.inert, false);
assert.equal(toggle.attributes['aria-expanded'], 'true');
assert.equal(sidebar.attributes['aria-modal'], 'true');
assert.equal(document.activeElement, close);
let prevented = false;
handlers.keydown({ key: 'Tab', shiftKey: true, preventDefault() { prevented = true; } });
assert.equal(prevented, true);
assert.equal(document.activeElement, last);
handlers.keydown({ key: 'Tab', preventDefault() {} });
assert.equal(document.activeElement, close);
handlers.keydown({ key: 'Escape', preventDefault() {} });
assert.equal(document.activeElement, toggle);
assert.equal(main.inert, false);
assert.equal(sidebar.inert, true);
toggle.onclick();
backdrop.onclick();
assert.equal(backdrop.hidden, true);
toggle.onclick();
media.matches = false;
media.changed();
assert.equal(sidebar.inert, false, 'desktop navigation stays accessible');
assert.equal(main.inert, false);
assert.equal(cell.dataset.label, '文章');
assert.equal(actions.classList.contains('record-actions'), true);
assert.equal(cell.children.length, 1);
assert.equal(cell.children[0].children[0], title);
assert.equal(title.onclick(), 'preserved');
mutation();
assert.equal(cell.children.length, 1, 'observer does not nest value wrappers');
const empty = new Element();
empty.colSpan = 2;
const emptyRow = new Element();
emptyRow.children = [empty];
table.rows.push(emptyRow);
mutation();
assert.equal(empty.children.length, 0, 'empty-state spanning cell stays intact');
row.hidden = true;
mutation();
assert.equal(row.hidden, true, 'table labeling preserves search filter state');
const css = require('postcss').parse(fs.readFileSync('html/admin/assets/mobile.css', 'utf8'));
function declaration(mediaQuery, selector, property) {
  let value;
  css.walkRules(selector, rule => {
    if (rule.parent.type !== 'atrule' || rule.parent.params !== mediaQuery) return;
    rule.walkDecls(property, decl => { value = decl.value; });
  });
  return value;
}
assert.equal(declaration('(max-width:900px)', '.modal-mask', 'height'), 'var(--admin-viewport-height, 100dvh)');
assert.equal(declaration('(max-width:900px)', '.moment-thumb .thumb-actions', 'position'), 'static');
assert.equal(declaration('(max-width:900px)', '.moment-thumbs', 'grid-template-columns'), 'repeat(2,minmax(0,1fr))');
assert.equal(declaration('(max-width:360px)', '.moment-thumbs:has(.moment-thumb)', 'grid-template-columns'), 'minmax(0,1fr)');
assert.equal(declaration('(max-width:900px)', '.mobile-records tr[hidden]', 'display'), 'none');
assert.equal(declaration('(max-width:900px)', '.captcha-row input', 'min-width'), '0');
console.log('PASS mobile drawer, focus trap, keyboard viewport resize/scroll, desktop reset, record labels and preserved handlers');
console.log('PASS responsive rules for keyboard dialog, image controls, narrow grids, filtered rows and login captcha');

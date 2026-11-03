const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(page, options = {}) {
    const timers = new Map();
    const handlers = new Map();
    const elements = new Map();
    const audio = new EventTarget();
    const document = new EventTarget();
    let nextId = 0;
    const element = () => Object.assign(new EventTarget(), {
        dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; },
        scrollTop: 0, scrollHeight: 1000, clientHeight: 400, innerHTML: '', textContent: ''
    });
    Object.assign(document, {
        readyState: 'complete', hidden: false,
        getElementById(id) {
            if (page === 'index' && !['countdownDays', 'countdownDesc', 'countdownProgress'].includes(id)) return null;
            if (!elements.has(id)) elements.set(id, element());
            return elements.get(id);
        },
        querySelector() { return null; }, querySelectorAll() { return []; }, createElement: element
    });
    if (page === 'chat') document.getElementById('chatInitData').dataset = { list: '[]', open: '1' };
    const window = new EventTarget();
    Object.assign(window, {
        setTimeout(fn, delay) { const id = ++nextId; timers.set(id, { fn, delay, interval: false }); return id; },
        setInterval(fn, delay) { const id = ++nextId; timers.set(id, { fn, delay, interval: true }); return id; },
        clearTimeout(id) { timers.delete(id); }, clearInterval(id) { timers.delete(id); },
        fetch() { return new Promise(() => {}); },
        __TOGETHER_DATE__: options.start || '2025-02-14',
        jQuery() { return {
            on(name, fn) { handlers.set(name, fn); },
            off(name, fn) { if (handlers.get(name) === fn) handlers.delete(name); }
        }; }
    });
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [options.now || '2026-10-30T12:00:00'])); }
    }
    elements.set('countdownProgress', Object.assign(element(), { setAttribute() {} }));
    const context = vm.createContext({
        Date: Clock,
        window, document, AbortController, console, _plAudio: audio,
        fetch: window.fetch, setInterval: window.setInterval, clearInterval: window.clearInterval,
        setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
        requestAnimationFrame(fn) { fn(); }
    });
    const source = fs.readFileSync(path.join(__dirname, '..', 'html/static/js', page + '.js'), 'utf8');
    return { window, document, audio, timers, handlers, elements, run() { vm.runInContext(source, context); } };
}

const index = harness('index');
index.run();
assert.equal([...index.timers.values()].filter(t => t.interval).length, 1);
const previousDispose = index.window.__disposeIndexPage;
index.run();
assert.equal([...index.timers.values()].filter(t => t.interval).length, 1, 'homepage reload replaces timers');
previousDispose();
index.handlers.get('pjax:beforeReplace.indexPage')();
assert.equal(index.timers.size, 0, 'homepage departure clears every timer');
assert.equal(index.handlers.size, 0, 'homepage departure removes navigation handler');
assert.equal(index.window._idxToggle, undefined, 'homepage departure releases player callback');
index.audio.dispatchEvent(new Event('play'));

for (const [start, now, days, label] of [
    ['2025-02-14', '2026-10-30T12:00:00', 107, 'ordinary calendar anniversary'],
    ['2025-02-14', '2027-02-14T12:00:00', 0, 'anniversary day remains today'],
    ['2025-02-14', '2027-02-15T12:00:00', 364, 'day after anniversary starts next cycle'],
    ['2024-02-29', '2025-02-28T12:00:00', 0, 'leap-day anniversary clamps to February end']
]) {
    const fixture = harness('index', { start, now });
    fixture.run();
    assert.equal(fixture.elements.get('countdownDays').textContent, days, label);
    fixture.window.__disposeIndexPage();
}

const chat = harness('chat');
chat.run();
assert.deepEqual([...chat.timers.values()].map(t => t.delay).sort((a, b) => a - b), [5000, 30000]);
chat.document.dispatchEvent(new Event('pjax:ready'));
assert.equal(chat.timers.size, 2, 'PJAX ready does not duplicate chat polling');
chat.run();
assert.equal(chat.timers.size, 2, 'chat reload replaces polling and heartbeat');
chat.handlers.get('pjax:beforeReplace.chatPage')();
assert.equal(chat.timers.size, 0, 'chat departure stops polling and heartbeat');
assert.equal(chat.handlers.size, 0, 'chat departure removes navigation handler');
chat.document.dispatchEvent(new Event('pjax:ready'));
assert.equal(chat.timers.size, 0, 'disposed chat cannot restart itself');
console.log('PASS homepage/chat lifecycle and four calendar anniversary cases');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function main() {
    let calls = 0, resolve;
    const context = vm.createContext({
        window: {}, AbortController, setTimeout, clearTimeout,
        fetch() { calls++; return new Promise(r => { resolve = r; }); }
    });
    vm.runInContext(fs.readFileSync('html/static/js/location.js', 'utf8'), context);
    const city = context.window.SiteLocation;
    const first = city.city();
    assert.equal(city.city(), first, 'concurrent city requests are deduplicated');
    resolve({ ok: true, json: async () => ({ code: 0, msg: 'local', data: { location: '' } }) });
    assert.equal((await first).value, '');
    const retry = city.city();
    assert.equal(calls, 2, 'empty location can be retried');
    resolve({ ok: true, json: async () => ({ code: 0, data: { location: '上海' } }) });
    assert.equal((await retry).value, '上海');
    assert.equal(city.city(), retry, 'successful city lookup is reused');

    let observe;
    const container = { dataset: {}, classList: { add() {}, remove() {} } };
    const listeners = [];
    const image = {
        tagName: 'IMG', nodeType: 1, dataset: {}, className: '', complete: true, naturalWidth: 640,
        closest(selector) { return selector === '.album-main-story' ? container : null; },
        hasAttribute() { return true; },
        getAttribute() { return '/uploads/test.jpg'; },
        addEventListener(name) { listeners.push(name); },
        querySelectorAll() { return []; }
    };
    vm.runInNewContext(fs.readFileSync('html/static/js/img-lazy.js', 'utf8'), {
        Date, location: { href: 'http://localhost:8090/' },
        setTimeout(fn) { fn(); },
        document: { body: {}, querySelectorAll() { return [image]; }, createElement() { throw Error('main image must never be wrapped'); } },
        MutationObserver: class { constructor(fn) { observe = fn; } observe() {} }
    });
    for (let i = 0; i < 5; i++) observe([{ addedNodes: [image] }]);
    assert.deepEqual(listeners, ['load', 'error'], 'repeated image scans retain one listener pair and no wrapper');
    console.log('PASS city deduplication/retry/cache and repeated homepage main-image scans');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

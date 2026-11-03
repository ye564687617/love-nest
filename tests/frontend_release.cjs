const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');

const imageSource = fs.readFileSync('html/static/js/img-lazy.js', 'utf8');
const previewImages = ['', 'data:image/png;base64,AAAA', 'blob:test', '/uploads/test.jpg'].map((src, index) => ({
    tagName: 'IMG', dataset: {}, className: '',
    getAttribute() { return src; },
    closest(selector) { return index === 3 && selector === '.chat-img-preview-bar' ? {} : null; }
}));
vm.runInNewContext(imageSource, {
    document: {body: {}, querySelectorAll() {return previewImages;}, createElement() {throw Error('Preview must not be wrapped');}},
    MutationObserver: class {observe() {}},
});
console.log('PASS empty/data/blob/composer images stay outside the global image loader');

let next = 0;
const timers = new Map(), handlers = new Map();
const loader = {visible: true, classList: {
    add() {loader.visible = false;}, remove() {loader.visible = true;}
}};
const window = {addEventListener(name, handler) {handlers.set(name, handler);}, jQuery() {
    return {on(names, handler) {names.split(' ').forEach(name => handlers.set(name, handler));}};
}};
const context = vm.createContext({window, document: {readyState:'complete', getElementById(){return loader;}},
    setTimeout(fn, delay) {const id=++next; timers.set(id,{fn,delay});return id;},
    clearTimeout(id){timers.delete(id);}
});
const navigation = fs.readFileSync('html/static/js/navigation-loader.js','utf8');
vm.runInContext(navigation,context);
assert.equal(loader.visible,false);
handlers.get('pjax:send.navigationLoader')();
assert.equal(loader.visible,false,'fast navigation does not flash an overlay');
handlers.get('pjax:end.navigationLoader')();
assert.equal(timers.size,0,'completion cancels pending overlay');
handlers.get('pjax:send.navigationLoader')();
[...timers.values()].find(timer=>timer.delay===200).fn();
assert.equal(loader.visible,true,'slow requests show feedback');
handlers.get('pjax:popstate.navigationLoader')();
assert.equal(loader.visible,false,'history navigation clears overlay');
const count=handlers.size;
vm.runInContext(navigation,context);
assert.equal(handlers.size,count,'repeated loading does not add handlers');
console.log('PASS immediate page readiness, delayed request feedback, history and duplicate initialization');

const exclusions = ['--exclude=html/inc/config.php','--exclude=html/inc/config.local.php','--exclude=html/inc/config.docker.php'];
const result=cp.spawnSync('tar',[...exclusions,'-cf','/dev/null','-v','html/admin/config.php','html/inc/config.php'],{encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
const listing=result.stdout+result.stderr;
assert.ok(listing.includes('html/admin/config.php'));
assert.ok(!listing.includes('html/inc/config.php'));
const packager=fs.readFileSync('package-release.sh','utf8');
assert.ok(packager.includes("--exclude='html/inc/config.php'"));
assert.ok(!packager.includes("--exclude='config.php'"));
console.log('PASS packaging keeps admin settings but excludes the database credential file');

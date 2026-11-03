const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const elements = new Map();
function el(id) {
  if (!elements.has(id)) elements.set(id, {
    value:'', textContent:'', disabled:false, hidden:false, files:[], style:{},
    pause() {}, load() {}, removeAttribute() {},
  });
  return elements.get(id);
}
const requests = [];
class XHR {
  constructor() { this.upload = {}; requests.push(this); }
  open(method, url) { assert.equal(method, 'POST'); assert.equal(url, '/api/upload_audio.php'); }
  send(body) { this.body = body; }
  finish(status, data) { this.status = status; this.responseText = JSON.stringify(data); this.onload(); }
}
const context = vm.createContext({
  Admin:{el, csrf:()=>'csrf-fixture', get:async()=>({list:[]})},
  XMLHttpRequest:XHR, FormData:class {append() {}},
});
vm.runInContext(fs.readFileSync('html/admin/playlist.php','utf8').match(/<script>([\s\S]*?)<\/script>/)[1], context);
const run = () => vm.runInContext("Playlist.uploadAudio(Admin.el('plAudio'))", context);
const file = {name:'Our Song.mp3', size:1024};
const url = '/uploads/music/20261103/' + 'a'.repeat(32) + '.mp3';
(async () => {
  el('plAudio').files = [{name:'bad.exe',size:10}];
  await run();
  assert.equal(requests.length, 0);
  el('plAudio').files = [file];
  let pending = run();
  assert.ok(el('plOk').disabled && el('plAudio').disabled && el('plUrl').disabled);
  await run();
  assert.equal(requests.length, 1, 'duplicate upload suppressed');
  requests[0].upload.onprogress({lengthComputable:true,loaded:50,total:100});
  assert.equal(el('plUploadProgress').value, 50);
  requests[0].finish(200,{code:0,data:{url}});
  await pending;
  assert.equal(el('plUrl').value, url);
  assert.equal(el('plTitle').value, 'Our Song');
  assert.equal(el('plAudioPreview').src, url);
  assert.ok(!el('plOk').disabled);
  pending = run();
  requests[1].finish(413,{});
  await pending;
  assert.match(el('plUploadStatus').textContent,/20MB/);
  assert.equal(el('plUrl').value,url, 'failed upload preserves saved address');
  assert.ok(!el('plOk').disabled);
  pending = run();
  requests[2].ontimeout();
  await pending;
  assert.match(el('plUploadStatus').textContent,/上传中断/);
  pending = run();
  elements.delete('plUrl');
  const replacement = el('plUrl');
  requests[3].finish(200,{code:0,data:{url}});
  await pending;
  assert.equal(replacement.value,'', 'closed/reopened dialog ignores earlier response');
  console.log('PASS audio upload progress, duplicate lock, preview, error recovery and stale dialog response');
})().catch(error => {console.error(error); process.exitCode=1;});

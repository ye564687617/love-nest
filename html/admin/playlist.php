<?php
require_once __DIR__ . '/inc/layout.php';
admin_head('音乐歌单');
?>
<div class="card">
  <div class="card-title"><i class="fa-solid fa-music"></i>音乐歌单
    <span style="flex:1"></span>
    <button class="btn small primary" onclick="Playlist.openModal()"><i class="fa-solid fa-plus"></i>添加歌曲</button>
  </div>
  <table class="tbl">
    <thead><tr><th>封面</th><th>歌名</th><th>歌手</th><th style="width:220px">操作</th></tr></thead>
    <tbody id="plBody"></tbody>
  </table>
  <div class="empty-tip" id="plEmpty" style="display:none">歌单是空的，添加属于你们的歌吧~</div>
</div>

<script>
const Playlist = {
  rows: [],

  init() { this.load(); },

  load() {
    Admin.get('playlist', 'list').then(d => {
      this.rows = d.list;
      Admin.el('plEmpty').style.display = d.list.length ? 'none' : 'block';
      Admin.el('plBody').innerHTML = d.list.map(s => `
        <tr>
          <td><img src="${Admin.esc(s.cover || '/static/image/1.png')}" style="width:44px;height:44px;border-radius:10px;object-fit:cover"></td>
          <td>${Admin.esc(s.title)}</td>
          <td class="muted">${Admin.esc(s.artist || '—')}</td>
          <td>
            ${s.url ? `<a class="btn small ghost" href="${Admin.esc(s.url)}" target="_blank" rel="noopener"><i class="fa-solid fa-play"></i>试听</a>` : ''}
            <button class="btn small" onclick="Playlist.openModal(${s.id})">编辑</button>
            <button class="btn small danger" onclick="Playlist.del(${s.id})">删除</button>
          </td>
        </tr>`).join('');
    });
  },

  openModal(id) {
    const s = id ? (this.rows.find(x => x.id == id) || {}) : {};
    Admin.modal(id ? '编辑歌曲' : '添加歌曲', `
      <div class="field"><label>歌名 *</label>
        <input type="text" id="plTitle" value="${Admin.esc(s.title || '')}" placeholder="例如：告白气球"></div>
      <div class="field"><label>歌手</label>
        <input type="text" id="plArtist" value="${Admin.esc(s.artist || '')}" placeholder="例如：周杰伦"></div>
      <div class="field"><label>封面</label>
        <div style="display:flex;gap:10px;align-items:center">
          <img id="plCoverPrev" src="${Admin.esc(s.cover || '/static/image/1.png')}" style="width:56px;height:56px;border-radius:12px;object-fit:cover">
          <input type="hidden" id="plCover" value="${Admin.esc(s.cover || '')}">
          <button class="btn small" onclick="Playlist.pickCover()"><i class="fa-solid fa-image"></i>选择封面</button>
        </div></div>
      <div class="field"><label for="plAudio">上传音乐（MP3，单首最大 15MB）</label>
        <input type="file" id="plAudio" accept=".mp3,audio/mpeg">
        <div id="plUploadStatus" class="muted" role="status" aria-live="polite"></div>
        <progress id="plUploadProgress" max="100" value="0" hidden style="width:100%"></progress></div>
      <div class="field"><label for="plUrl">播放地址</label>
        <input type="text" id="plUrl" value="${Admin.esc(s.url || '')}" placeholder="上传音乐，或填写 HTTPS 音频直链">
        <audio id="plAudioPreview" controls preload="none" ${s.url ? `src="${Admin.esc(s.url)}"` : 'hidden'} style="width:100%;margin-top:10px"></audio></div>
      <div class="field"><label>歌词（LRC）</label>
        <textarea id="plLyrics" rows="6">${Admin.esc(s.lyrics || '')}</textarea></div>
      <div class="actions"><button class="btn ghost" onclick="Admin.closeModal()">取消</button>
      <button class="btn primary" id="plOk">${id ? '保存' : '添加'}</button></div>`);
    const urlInput = Admin.el('plUrl');
    const preview = Admin.el('plAudioPreview');
    urlInput.onchange = () => this.preview(urlInput, preview);
    Admin.el('plAudio').onchange = event => this.uploadAudio(event.target);
    Admin.el('plOk').onclick = () => {
      const title = Admin.el('plTitle').value.trim();
      if (!title) return toastr.warning('请输入歌名');
      const data = {
        title,
        artist: Admin.el('plArtist').value.trim(),
        cover: Admin.el('plCover').value.trim(),
        url: Admin.el('plUrl').value.trim(),
        lyrics: Admin.el('plLyrics').value,
      };
      if (id) data.id = id;
      Admin.submit(Admin.el('plOk'), async () => {
        await Admin.api('playlist', id ? 'update' : 'create', data);
        Admin.closeModal(); this.load();
      });
    };
  },

  preview(input, audio) {
    const url = input.value.trim();
    audio.pause();
    audio.removeAttribute('src');
    audio.hidden = !url || !/^(https?:\/\/|\/(?!\/))/i.test(url);
    if (!audio.hidden) audio.src = url;
    audio.load();
  },

  async uploadAudio(input) {
    const file = input.files[0];
    if (!file) return;
    const status = Admin.el('plUploadStatus');
    const progress = Admin.el('plUploadProgress');
    const save = Admin.el('plOk');
    const urlInput = Admin.el('plUrl');
    if (save.disabled) { input.value = ''; return; }
    if (!/\.mp3$/i.test(file.name) || !file.size || file.size > 15 * 1024 * 1024) {
      status.textContent = '请选择 15MB 以内的 MP3 文件';
      input.value = '';
      return;
    }
    save.disabled = input.disabled = urlInput.disabled = true;
    progress.hidden = false;
    progress.value = 0;
    status.textContent = '正在上传音乐…';
    try {
      const url = await new Promise((resolve, reject) => {
        const body = new FormData();
        body.append('csrf_token', Admin.csrf());
        body.append('file', file);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload_audio.php');
        xhr.timeout = 180000;
        xhr.upload.onprogress = event => {
          if (event.lengthComputable) {
            progress.value = Math.round(event.loaded / event.total * 100);
            status.textContent = '正在上传音乐 ' + progress.value + '%';
          }
        };
        xhr.onload = () => {
          if (xhr.status === 413) return reject(new Error('服务器上传限制过小，请将 PHP 和宝塔上传限制调至至少 20MB'));
          try {
            const result = JSON.parse(xhr.responseText);
            if (xhr.status !== 200 || result.code !== 0) throw new Error(result.msg || '音乐上传失败');
            if (!/^\/uploads\/music\/[0-9]{8}\/[a-f0-9]{32}\.mp3$/.test(result.data.url)) throw new Error('服务器返回的音乐地址无效');
            resolve(result.data.url);
          } catch (error) {
            reject(new Error(error instanceof SyntaxError ? '服务器响应异常，请重试' : error.message));
          }
        };
        xhr.onerror = xhr.ontimeout = () => reject(new Error('上传中断，请重新选择文件重试'));
        xhr.send(body);
      });
      // A closed or replaced dialog must not receive an earlier upload result.
      if (Admin.el('plUrl') !== urlInput) return;
      urlInput.value = url;
      const title = Admin.el('plTitle');
      if (!title.value.trim()) title.value = file.name.replace(/\.mp3$/i, '').slice(0, 64);
      this.preview(urlInput, Admin.el('plAudioPreview'));
      progress.value = 100;
      status.textContent = '上传完成，保存歌曲后加入歌单';
    } catch (error) {
      if (Admin.el('plUrl') === urlInput) status.textContent = error.message;
    } finally {
      save.disabled = input.disabled = urlInput.disabled = false;
      input.value = '';
    }
  },

  pickCover() {
    Admin.pickImage(url => { Admin.el('plCover').value = url; Admin.el('plCoverPrev').src = url; });
  },

  del(id) {
    Admin.confirm('确定从歌单中删除这首歌吗？').then(ok => {
      if (ok) Admin.api('playlist', 'delete', { id }).then(() => this.load());
    });
  },
};
Playlist.init();
</script>
<?php admin_foot(); ?>

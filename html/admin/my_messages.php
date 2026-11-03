<?php
require_once __DIR__ . '/inc/layout.php';
admin_head('我的留言', true);
?>
<div class="card"><div class="card-title"><i class="fa-solid fa-comments"></i>我的留言 <span class="muted" id="messageTotal"></span></div>
<form id="newMessageForm" style="margin-bottom:20px"><div class="field"><label for="newMessageContent">留言</label><textarea id="newMessageContent" maxlength="500" rows="3" required placeholder="写下你想说的话..."></textarea></div><button class="btn primary" type="submit"><i class="fa-solid fa-paper-plane"></i>发布留言</button></form>
<div id="myMessageList"></div>
<div class="actions" style="margin-top:16px"><button class="btn" id="prevPage" title="上一页"><i class="fa-solid fa-chevron-left"></i></button><span id="pageNumber"></span><button class="btn" id="nextPage" title="下一页"><i class="fa-solid fa-chevron-right"></i></button></div>
</div>
<script src="/admin/assets/personal.js?v=20261030"></script>
<script>
let messagePage = 1;
document.getElementById('newMessageForm').onsubmit = async function (event) {
  event.preventDefault(); const button=this.querySelector('button');button.disabled=true;
  try {await Personal.api('message','', {content:document.getElementById('newMessageContent').value});this.reset();messagePage=1;await loadMyMessages();}
  catch(error){Personal.error(error);}finally{button.disabled=false;}
};
async function loadMyMessages() {
  try {
    const response = await fetch('/api/account_api.php?action=messages&page=' + messagePage, {credentials:'same-origin'});
    const result = await response.json(); if (result.code !== 0) throw new Error(result.msg);
    const data = result.data;
    const lastPage = Math.max(1, Math.ceil(data.total / 15));
    if (messagePage > lastPage) { messagePage = lastPage; return loadMyMessages(); }
    document.getElementById('messageTotal').textContent = data.total + ' 条';
    document.getElementById('pageNumber').textContent = messagePage;
    document.getElementById('prevPage').disabled = messagePage <= 1;
    document.getElementById('nextPage').disabled = messagePage * 15 >= data.total;
    document.getElementById('myMessageList').innerHTML = data.list.length ? data.list.map(message => `
      <article style="padding:16px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere">
        <div style="white-space:pre-wrap">${Admin.esc(message.content)}</div>
        ${message.img ? `<img src="${Admin.esc(message.img)}" alt="留言图片" style="max-width:180px;max-height:180px;margin-top:10px">` : ''}
        <div class="actions" style="margin-top:10px"><span class="muted">${Admin.esc(message.created_at)} · ${message.status == 1 ? '已展示' : '已隐藏'}</span><button class="btn small danger" data-message-id="${Number(message.id)}"><i class="fa-solid fa-trash"></i>删除</button></div>
      </article>`).join('') : '<div class="empty-tip">暂无留言</div>';
  } catch (error) { Personal.error(error); }
}
document.getElementById('prevPage').onclick = () => { messagePage--; loadMyMessages(); };
document.getElementById('nextPage').onclick = () => { messagePage++; loadMyMessages(); };
document.getElementById('myMessageList').addEventListener('click', async event => {
  const button = event.target.closest('[data-message-id]'); if (!button) return;
  if (!await Admin.confirm('确定删除这条留言吗？')) return;
  button.disabled = true;
  try { await Personal.api('account', 'delete_message', {id:button.dataset.messageId}); await loadMyMessages(); }
  catch (error) { Personal.error(error); button.disabled = false; }
});
loadMyMessages();
</script>
<?php admin_foot(); ?>

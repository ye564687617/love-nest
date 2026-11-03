<?php
require_once __DIR__ . '/inc/layout.php';
admin_head('私信管理', true);
?>
<div class="card">
  <div class="card-title"><i class="fa-solid fa-envelope"></i>私信管理 <span class="muted" id="privateStats"></span></div>
  <div class="field"><label for="privateContact">新对话</label><select id="privateContact"><option value="">选择联系人</option></select></div>
  <div class="personal-messages">
    <div id="conversationList" class="personal-conversations"></div>
    <div class="personal-thread">
      <h3 id="threadTitle">选择对话</h3>
      <div id="threadMessages" class="personal-thread-messages"><div class="empty-tip">暂无对话</div></div>
      <form id="privateForm"><div class="field"><label for="privateContent">消息</label><textarea id="privateContent" maxlength="1000" rows="3" required disabled></textarea></div><button id="privateSend" class="btn primary" type="submit" disabled><i class="fa-solid fa-paper-plane"></i>发送</button></form>
    </div>
  </div>
</div>
<script src="/admin/assets/personal.js?v=20261030"></script>
<script>
let privatePeer = 0;
let privateContacts = [];
let privateRequest = 0;
let privateRefreshing = false;
async function loadConversations() {
  const data = await Personal.api('private_msg', 'conversations');
  document.getElementById('privateStats').textContent = data.list.length + ' 对话 · ' + data.list.reduce((sum,row)=>sum+row.unread,0) + ' 未读';
  document.getElementById('conversationList').innerHTML = data.list.length ? data.list.map(row => `<button class="personal-conversation ${row.peer_id === privatePeer ? 'active' : ''}" data-peer-id="${row.peer_id}"><strong>${Admin.esc(row.nickname)}</strong>${row.unread ? `<span class="badge">${row.unread}</span>` : ''}<span>${Admin.esc(row.content)}</span></button>`).join('') : '<div class="empty-tip">暂无私信</div>';
}
async function openPrivatePeer(id, background = false) {
  privatePeer = Number(id); if (!privatePeer) return;
  const peer = privatePeer;
  const requestId = ++privateRequest;
  const contact = privateContacts.find(row=>Number(row.id) === privatePeer);
  document.getElementById('threadTitle').textContent = contact ? contact.nickname || contact.username : '对话';
  document.getElementById('privateContent').disabled = false;
  if (!background) {
    document.getElementById('privateSend').disabled = true;
    document.getElementById('threadMessages').textContent = '加载中…';
  }
  try {
    const response = await fetch('/api/private_msg_api.php?action=history&peer_id=' + privatePeer, {credentials:'same-origin'});
    const result = await response.json(); if (result.code !== 0) throw new Error(result.msg);
    if (requestId !== privateRequest) return;
    const box = document.getElementById('threadMessages');
    const followLatest = !background || box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const scrollTop = box.scrollTop;
    const html = result.data.list.length ? result.data.list.map(message => `<div class="personal-message ${message.is_me ? 'is-me' : ''}"><strong>${Admin.esc(message.from_name)}</strong><p>${Admin.esc(message.content)}</p><small class="muted">${Admin.esc(message.created_at)}</small></div>`).join('') : '<div class="empty-tip">暂无消息</div>';
    if (box.innerHTML !== html) box.innerHTML = html;
    box.scrollTop = followLatest ? box.scrollHeight : scrollTop;
    if (!background) document.getElementById('privateSend').disabled = false;
    await Personal.api('private_msg', 'read', {peer_id:peer});
    await loadConversations();
  } catch (error) { if (requestId === privateRequest && !background) Personal.error(error); }
}
document.getElementById('conversationList').onclick = event => {const button=event.target.closest('[data-peer-id]');if(button)openPrivatePeer(button.dataset.peerId);};
document.getElementById('privateContact').onchange = event => { if(event.target.value)openPrivatePeer(event.target.value); };
document.getElementById('privateForm').onsubmit = async event => {
  event.preventDefault(); const input=document.getElementById('privateContent');const peer=privatePeer;const content=input.value.trim();if(!peer||!content)return;
  document.getElementById('privateSend').disabled=true;
  try {await Personal.api('private_msg','send',{to_id:peer,content});if(privatePeer===peer){input.value='';await openPrivatePeer(peer);}else await loadConversations();}
  catch(error){Personal.error(error);}finally{document.getElementById('privateSend').disabled=!privatePeer;}
};
Personal.api('private_msg','contacts').then(data=>{privateContacts=data.list;document.getElementById('privateContact').innerHTML+=data.list.map(row=>`<option value="${row.id}">${Admin.esc(row.nickname||row.username)}</option>`).join('');}).catch(Personal.error);
loadConversations().catch(Personal.error);
async function refreshPrivateMessages() {
  if (document.hidden || privateRefreshing || (privatePeer && document.getElementById('privateSend').disabled)) return;
  privateRefreshing = true;
  try {
    if (privatePeer) await openPrivatePeer(privatePeer, true);
    else await loadConversations();
  } catch (error) { /* Retry quietly on the next refresh. */ }
  finally { privateRefreshing = false; }
}
const privateRefreshTimer = setInterval(refreshPrivateMessages, 5000);
document.addEventListener('visibilitychange', refreshPrivateMessages);
window.addEventListener('pagehide', () => clearInterval(privateRefreshTimer), {once:true});
</script>
<?php admin_foot(); ?>

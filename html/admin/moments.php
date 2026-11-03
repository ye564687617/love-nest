<?php require_once __DIR__.'/inc/layout.php'; admin_head('甜蜜瞬间'); ?>
<div class="workspace-heading"><div><h2>记录每一个瞬间</h2><p id="momentStats">甜蜜瞬间</p></div><button class="btn primary" onclick="Moments.openModal()"><i class="fa-solid fa-plus"></i>发布瞬间</button></div>
<div class="toolbar"><input class="search-input" id="momentSearch" type="search" placeholder="搜索当前页内容或地点" aria-label="搜索瞬间"><select class="btn ghost" id="momentFilter" aria-label="展示状态"><option value="all">全部状态</option><option value="1">公开</option><option value="0">隐藏</option></select></div>
<div class="moment-feed" id="momentsBody"></div><div id="momentsPager"></div>
<?php admin_foot(['/admin/assets/moments.js?v=20261030-5']); ?>

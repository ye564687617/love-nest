<?php require_once __DIR__.'/inc/layout.php'; admin_head('文章管理'); ?>
<link rel="stylesheet" href="/static/vendor/quill/quill.snow.css">
<script src="/static/vendor/quill/quill.js"></script>
<div class="workspace-heading"><div><h2>我们的故事</h2><p id="articleStats">文章管理</p></div><div class="workspace-actions"><a class="btn ghost" href="/articles.php" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i>查看文章</a><button class="btn primary" onclick="Articles.openModal()"><i class="fa-solid fa-plus"></i>写文章</button></div></div>
<div class="card"><div class="toolbar"><input type="search" id="articleSearch" class="search-input" placeholder="搜索文章标题" aria-label="搜索文章"><select id="articleFilter" class="btn ghost" aria-label="发布状态"><option value="all">全部状态</option><option value="1">已发布</option><option value="0">草稿</option></select></div><div class="table-scroll"><table class="tbl"><thead><tr><th>封面</th><th>文章</th><th>阅读</th><th>状态</th><th>操作</th></tr></thead><tbody id="artBody"></tbody></table></div><div class="empty-tip" id="artEmpty" hidden>暂无文章</div></div>
<?php admin_foot(['/admin/assets/articles.js?v=20261030-3']); ?>

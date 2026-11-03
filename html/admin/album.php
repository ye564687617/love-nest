<?php
require_once __DIR__ . '/inc/layout.php';
admin_head('相册管理');
?>
<div class="workspace-heading"><div><h2>照片与相册</h2><p id="albumSummary">正在加载相册</p></div><button class="btn primary" onclick="Album.newAlbum()"><i class="fa-solid fa-plus"></i>新建相册</button></div>
<div class="album-tabs" id="albumTabs"></div>
<section class="card" id="uploadCard" hidden style="margin-top:22px">
  <div class="card-title"><i class="fa-solid fa-cloud-arrow-up"></i><span id="uploadTitle">上传照片</span></div>
  <div class="dropzone" id="dropzone" role="button" tabindex="0" aria-label="选择或拖入照片上传"><i class="fa-solid fa-cloud-arrow-up"></i><div>选择照片或拖到这里</div><small class="muted">JPG、PNG、GIF、WebP / 每张不超过 5MB</small></div>
  <input type="file" id="fileInput" accept="image/jpeg,image/png,image/gif,image/webp" multiple hidden><div class="upload-queue" id="upProgress" aria-live="polite"></div>
</section>
<section class="card" id="photoCard" hidden>
  <div class="workspace-heading"><h2 id="photoTitle">照片</h2><div class="workspace-actions"><button class="btn ghost small" onclick="Album.rename()"><i class="fa-solid fa-pen"></i>重命名</button><button class="icon-btn" title="删除当前相册" onclick="Album.deleteAlbum()"><i class="fa-solid fa-trash"></i></button></div></div>
  <div class="toolbar"><input class="search-input" id="photoSearch" type="search" placeholder="搜索照片描述" aria-label="搜索照片描述"><button class="btn ghost small" onclick="Album.selectAll()">全选 / 取消</button><button class="icon-btn" id="density" title="切换缩略图大小" aria-pressed="false"><i class="fa-solid fa-grip"></i></button><span class="muted" id="selInfo"></span><button class="btn small primary" id="btnPublish" hidden onclick="Album.publishSelected()"><i class="fa-solid fa-heart"></i>发布瞬间</button><button class="btn small" id="btnMove" hidden onclick="Album.move()"><i class="fa-solid fa-folder-open"></i>移动到</button><button class="btn small danger" id="btnBatchDel" hidden onclick="Album.batchDelete()"><i class="fa-solid fa-trash"></i>删除所选</button><button class="btn small primary" id="btnSaveOrder" hidden onclick="Album.saveOrder()"><i class="fa-solid fa-floppy-disk"></i>保存排序</button></div>
  <div class="photo-grid" id="photoGrid" style="margin-top:18px"></div><div class="empty-tip" id="photoEmpty" hidden>暂无照片</div>
</section>
<?php admin_foot(['/admin/assets/album.js?v=20261030-1']); ?>

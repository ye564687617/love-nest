const Moments = {
  page: 1,
  rows: [],
  imgs: [],
  editId: 0,
  session: 0,
  async load(page = 1) {
    this.page = page;
    try {
      const d = await Admin.get("moments", "list", { page });
      if (!d.list.length && page > 1) return this.load(page - 1);
      this.rows = d.list;
      this.render();
      Admin.el("momentStats").textContent = d.total + " 条记录";
      Admin.pager(Admin.el("momentsPager"), page, d.total, 15, (p) =>
        this.load(p),
      );
    } catch (e) {
      toastr.error(e.message);
    }
  },
  render() {
    const q = Admin.el("momentSearch").value.toLowerCase(),
      f = Admin.el("momentFilter").value;
    const rows = this.rows.filter(
      (r) =>
        (r.content + " " + r.location).toLowerCase().includes(q) &&
        (f === "all" || String(r.status) === f),
    );
    Admin.el("momentsBody").innerHTML = rows.length
      ? rows
          .map(
            (r) =>
              `<article class="moment-tile">${r.images.length ? `<img src="${Admin.esc(r.images[0])}" alt="瞬间照片" loading="lazy">` : ""}<div class="moment-tile-body"><div class="tile-meta"><span>${Admin.time(r.created_at)}</span><span class="badge ${r.status == 1 ? "green" : "gray"}">${r.status == 1 ? "公开" : "隐藏"}</span></div><p>${Admin.esc(r.content || "图片记录")}</p><div class="tile-meta"><span>${Admin.esc(r.location || "未填写地点")}</span><span>${r.images.length} 张 / ${r.likes_count} 赞 ${r.is_top == 1 ? "/ 已置顶" : ""}</span></div><div class="workspace-actions"><button class="btn small" onclick="Moments.openModal(${r.id})"><i class="fa-solid fa-pen"></i>编辑</button><button class="icon-btn" title="${r.is_top == 1 ? "取消置顶" : "置顶"}" onclick="Moments.toggle(${r.id},'is_top')"><i class="fa-solid fa-thumbtack"></i></button><button class="icon-btn" title="${r.status == 1 ? "隐藏" : "公开"}" onclick="Moments.toggle(${r.id},'status')"><i class="fa-solid fa-eye${r.status == 1 ? "-slash" : ""}"></i></button><button class="icon-btn" title="删除瞬间" onclick="Moments.del(${r.id})"><i class="fa-solid fa-trash"></i></button></div></div></article>`,
          )
          .join("")
      : '<div class="empty-tip">暂无符合条件的瞬间</div>';
  },
  openModal(id, images) {
    const r = this.rows.find((x) => x.id == id) || {};
    this.editId = id || 0;
    this.imgs = [...(images || r.images || [])];
    this.draftKey = "moment-draft-" + (id || "new");
    const session = ++this.session;
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    Admin.modal(
      id ? "编辑瞬间" : "发布瞬间",
      `<div class="composer"><div><div class="field"><label for="mContent">这一刻的心情</label><textarea id="mContent" rows="5" maxlength="2000" placeholder="记录今天值得纪念的小事">${Admin.esc(r.content || "")}</textarea></div><div class="form-row"><div class="field"><label for="mLocation">地点</label><input type="text" id="mLocation" maxlength="64" value="${Admin.esc(r.location || "")}"></div><div class="field"><label for="mDate">记录时间</label><input type="datetime-local" id="mDate" value="${Admin.esc((r.created_at || now).replace(" ", "T").slice(0, 16))}"></div></div><div class="section-label">照片 <span class="muted" id="mImageCount"></span></div><div class="moment-thumbs" id="mImgs"></div><div class="toolbar" style="margin-top:12px"><label class="btn ghost" for="momentFiles"><i class="fa-solid fa-cloud-arrow-up"></i>本地上传</label><input hidden id="momentFiles" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple><button class="btn ghost" id="momentLibrary"><i class="fa-solid fa-images"></i>相册选图</button></div><div id="momentQueue" class="upload-queue"></div><div class="editor-status" id="momentDraftStatus"></div><div class="workspace-actions"><label class="check-label"><input type="checkbox" id="mVisible" ${r.status != 0 ? "checked" : ""}>公开展示</label><label class="check-label"><input type="checkbox" id="mPinned" ${r.is_top == 1 ? "checked" : ""}>置顶</label></div></div><aside class="composer-preview"><strong>瞬间预览</strong><p id="mPreviewText"></p><div id="mPreviewImages" class="moment-preview-grid"></div><p class="muted" id="mPreviewLocation"></p></aside></div><div class="actions"><button class="btn ghost" onclick="Admin.closeModal()">关闭</button><button class="btn primary" id="mOk"><i class="fa-solid fa-paper-plane"></i>${id ? "保存修改" : "发布瞬间"}</button></div>`,
    );
    try {
      const d = JSON.parse(localStorage.getItem(this.draftKey) || "null");
      if (d && confirm("有未发布的本地草稿，是否恢复？")) {
        Admin.el("mContent").value = d.content;
        Admin.el("mLocation").value = d.location;
        if (d.date) Admin.el("mDate").value = d.date;
        if (typeof d.visible === "boolean")
          Admin.el("mVisible").checked = d.visible;
        if (typeof d.pinned === "boolean")
          Admin.el("mPinned").checked = d.pinned;
        this.imgs = [
          ...new Set([...(images || []), ...(d.images || [])]),
        ].slice(0, 30);
      }
    } catch (e) {}
    const locationInput = Admin.el('mLocation');
    const locateButton = document.createElement('button');
    locateButton.type = 'button';
    locateButton.className = 'btn ghost small';
    locateButton.innerHTML = '<i class="fa-solid fa-location-dot" aria-hidden="true"></i> 获取城市';
    locationInput.after(locateButton);
    const locationHint = document.createElement('small');
    locationHint.className = 'hint';
    locationHint.textContent = '网络估算城市，可修改；不获取精确坐标';
    locateButton.after(locationHint);
    locateButton.onclick = async () => {
      const original = locationInput.value;
      locateButton.disabled = true;
      const result = await window.SiteLocation.city();
      if (Admin.el('mLocation') === locationInput && locationInput.value === original) {
        if (result.value) { locationInput.value = result.value; this.preview(); this.persist(); }
        locationHint.textContent = result.value ? '网络估算位置，可修改或清空' : result.message;
      }
      locateButton.disabled = false;
    };
    const queue = Admin.uploadQueue(Admin.el("momentQueue"), (url) => {
      if (session !== this.session || !Admin.el("mImgs")) return;
      if (this.imgs.length >= 30) throw new Error("最多30张图片");
      this.imgs.push(url);
      this.renderImgs();
      this.persist();
    });
    Admin.el("momentFiles").onchange = (e) => {
      if (e.target.files.length + this.imgs.length > 30)
        return toastr.warning("最多30张图片");
      queue(e.target.files);
      e.target.value = "";
    };
    Admin.el("momentLibrary").onclick = () => this.library();
    Admin.el("momentLibrary").hidden = !window.ADMIN_MODULES.includes("albums");
    Admin.el("mOk").onclick = () => this.save();
    ["mContent", "mLocation", "mDate", "mVisible", "mPinned"].forEach(
      (n) =>
        (Admin.el(n).oninput = () => {
          this.preview();
          this.persist();
        }),
    );
    this.renderImgs();
  },
  persist() {
    try {
      localStorage.setItem(
        this.draftKey,
        JSON.stringify({
          content: Admin.el("mContent").value,
          location: Admin.el("mLocation").value,
          images: this.imgs,
          date: Admin.el("mDate").value,
          visible: Admin.el("mVisible").checked,
          pinned: Admin.el("mPinned").checked,
        }),
      );
      Admin.el("momentDraftStatus").textContent = "草稿已保存在此浏览器";
    } catch (e) {}
  },
  preview() {
    Admin.el("mPreviewText").textContent =
      Admin.el("mContent").value || "记录这一刻的心情";
    Admin.el("mPreviewLocation").textContent = Admin.el("mLocation").value;
    Admin.el("mPreviewImages").innerHTML = this.imgs
      .slice(0, 9)
      .map((u) => `<img src="${Admin.esc(u)}" alt="">`)
      .join("");
  },
  renderImgs() {
    if (!Admin.el("mImgs")) return;
    Admin.el("mImgs").innerHTML = this.imgs
      .map(
        (u, i) =>
          `<div class="moment-thumb"><img src="${Admin.esc(u)}" alt="照片 ${i + 1}"><div class="thumb-actions"><button class="icon-btn" title="向前移动" onclick="Moments.move(${i},-1)" ${i === 0 ? "disabled" : ""}><i class="fa-solid fa-arrow-left"></i></button><button class="icon-btn" title="移除图片" onclick="Moments.remove(${i})"><i class="fa-solid fa-xmark"></i></button><button class="icon-btn" title="向后移动" onclick="Moments.move(${i},1)" ${i === this.imgs.length - 1 ? "disabled" : ""}><i class="fa-solid fa-arrow-right"></i></button></div></div>`,
      )
      .join("");
    Admin.el("mImageCount").textContent = this.imgs.length + " / 30";
    this.preview();
  },
  move(i, s) {
    const j = i + s;
    if (j < 0 || j >= this.imgs.length) return;
    [this.imgs[i], this.imgs[j]] = [this.imgs[j], this.imgs[i]];
    this.renderImgs();
    this.persist();
  },
  remove(i) {
    this.imgs.splice(i, 1);
    this.renderImgs();
    this.persist();
  },
  async library() {
    if (Admin.el("momentQueue").querySelector('[data-state="pending"]'))
      return toastr.warning("请等待上传完成后再从相册选图");
    const session = this.session;
    try {
      const d = await Admin.get("photos", "list");
      if (session !== this.session || !Admin.el("mImgs")) return;
      Admin.pickMedia(
        d.list,
        (urls) => {
          this.imgs = [...this.imgs, ...urls].slice(0, 30);
          this.renderImgs();
          this.persist();
        },
        30 - this.imgs.length,
      );
    } catch (e) {
      toastr.error(e.message);
    }
  },
  async save() {
    if (Admin.el("momentQueue").querySelector('[data-state="failed"]'))
      return toastr.warning("部分图片上传失败，请重试或移除失败任务后发布");
    if (
      [...Admin.el("momentQueue").querySelectorAll("small")].some((e) =>
        ["等待上传", "上传中", "保存中"].includes(e.textContent),
      )
    )
      return toastr.warning("请等待图片上传完成");
    const d = {
      content: Admin.el("mContent").value.trim(),
      location: Admin.el("mLocation").value.trim(),
      created_at: Admin.el("mDate").value,
      status: +Admin.el("mVisible").checked,
      is_top: +Admin.el("mPinned").checked,
      images: JSON.stringify(this.imgs),
    };
    if (!d.content && !this.imgs.length)
      return toastr.warning("请填写内容或添加照片");
    if (this.editId) d.id = this.editId;
    const b = Admin.el("mOk");
    b.disabled = true;
    try {
      await Admin.api("moments", this.editId ? "update" : "create", d);
      try {
        localStorage.removeItem(this.draftKey);
      } catch (e) {}
      Admin.closeModal();
      this.load(this.editId ? this.page : 1);
    } catch (e) {
      b.disabled = false;
    }
  },
  async toggle(id, field) {
    try {
      await Admin.api("moments", "toggle", { id, field });
      this.load(this.page);
    } catch (e) {}
  },
  async del(id) {
    if (await Admin.confirm("删除这条瞬间及相关点赞、评论？")) {
      try {
        await Admin.api("moments", "delete", { id });
        this.load(this.page);
      } catch (e) {}
    }
  },
};
Admin.el("momentSearch").oninput = () => Moments.render();
Admin.el("momentFilter").onchange = () => Moments.render();
Moments.load();
if (new URLSearchParams(location.search).has("compose")) {
  try {
    const images = JSON.parse(
      sessionStorage.getItem("moment-selected-images") || "[]",
    );
    if (Array.isArray(images) && images.length) {
      Moments.openModal(0, images.slice(0, 30));
      sessionStorage.removeItem("moment-selected-images");
      history.replaceState(null, "", location.pathname);
    }
  } catch (error) {
    toastr.error("无法读取所选照片，请返回相册重试");
  }
}

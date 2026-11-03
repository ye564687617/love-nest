const Album = {
  albums: [],
  photos: [],
  selected: new Set(),
  cur: 0,
  revision: 0,
  orderDirty: false,
  async init() {
    this.queue = Admin.uploadQueue(
      Admin.el("upProgress"),
      async (url, file, albumId) => {
        await Admin.api("photos", "add", { album_id: albumId, src: url });
        const result = await Admin.get("albums", "list");
        this.albums = result.list;
        this.renderAlbums();
        if (this.cur === albumId) await this.loadPhotos(true);
      },
    );
    const drop = Admin.el("dropzone"),
      input = Admin.el("fileInput");
    drop.onclick = () => input.click();
    drop.onkeydown = (event) => {
      if (["Enter", " "].includes(event.key)) {
        event.preventDefault();
        input.click();
      }
    };
    input.onchange = () => {
      this.queue(input.files, this.cur);
      input.value = "";
    };
    ["dragenter", "dragover"].forEach((name) =>
      drop.addEventListener(name, (event) => {
        event.preventDefault();
        drop.classList.add("dragover");
      }),
    );
    ["dragleave", "drop"].forEach((name) =>
      drop.addEventListener(name, (event) => {
        event.preventDefault();
        drop.classList.remove("dragover");
      }),
    );
    drop.addEventListener("drop", (event) =>
      this.queue(event.dataTransfer.files, this.cur),
    );
    Admin.el("photoSearch").oninput = () => this.render();
    Admin.el("density").onclick = (event) => {
      const compact = Admin.el("photoGrid").classList.toggle("compact");
      event.currentTarget.setAttribute("aria-pressed", compact);
    };
    try {
      await this.refresh();
    } catch (error) {
      toastr.error(error.message);
    }
  },
  async refresh(id = this.cur) {
    const data = await Admin.get("albums", "list");
    this.albums = data.list;
    this.cur = this.albums.some((album) => +album.id === +id)
      ? +id
      : +(this.albums[0]?.id || 0);
    this.renderAlbums();
    Admin.el("uploadCard").hidden = Admin.el("photoCard").hidden = !this.cur;
    if (this.cur) await this.loadPhotos();
  },
  renderAlbums() {
    Admin.el("albumSummary").textContent =
      `${this.albums.length} 本相册 / ${this.albums.reduce((sum, album) => sum + +album.photo_count, 0)} 张照片`;
    Admin.el("albumTabs").innerHTML = this.albums.length
      ? this.albums
          .map(
            (album) =>
              `<button class="album-tab ${+album.id === this.cur ? "active" : ""}" data-id="${album.id}" aria-pressed="${+album.id === this.cur}">${album.preview ? `<img src="${Admin.esc(album.preview)}" alt="" loading="lazy">` : '<div class="album-placeholder"><i class="fa-solid fa-images"></i></div>'}<span class="album-label"><strong>${Admin.esc(album.title)}</strong><small>${album.photo_count} 张照片</small></span></button>`,
          )
          .join("")
      : '<div class="empty-tip">还没有相册</div>';
    Admin.el("albumTabs")
      .querySelectorAll("[data-id]")
      .forEach(
        (button) =>
          (button.onclick = async () => {
            if (+button.dataset.id === this.cur) return;
            if (
              this.orderDirty &&
              !(await Admin.confirm("排序还未保存，确定切换相册？"))
            )
              return;
            this.cur = +button.dataset.id;
            this.selected.clear();
            this.orderDirty = false;
            this.renderAlbums();
            try {
              await this.loadPhotos();
            } catch (error) {
              toastr.error(error.message);
            }
          }),
      );
    const album = this.albums.find((item) => +item.id === this.cur);
    if (album) {
      Admin.el("photoTitle").textContent = album.title;
      Admin.el("uploadTitle").textContent = "上传到 " + album.title;
    }
  },
  async loadPhotos(preserve = false) {
    const id = this.cur,
      revision = ++this.revision,
      data = await Admin.get("photos", "list", { album_id: id });
    if (revision !== this.revision || id !== this.cur) return;
    if (preserve && this.orderDirty) {
      const existing = new Set(this.photos.map((photo) => photo.id));
      this.photos.push(...data.list.filter((photo) => !existing.has(photo.id)));
    } else {
      this.photos = data.list;
      this.orderDirty = false;
    }
    const ids = new Set(this.photos.map((photo) => photo.id));
    this.selected = new Set([...this.selected].filter((id) => ids.has(id)));
    this.render();
  },
  visible() {
    const query = Admin.el("photoSearch").value.trim().toLowerCase();
    return this.photos.filter((photo) =>
      (photo.desc || "").toLowerCase().includes(query),
    );
  },
  render() {
    const rows = this.visible(),
      grid = Admin.el("photoGrid");
    Admin.el("photoEmpty").hidden = rows.length > 0;
    grid.innerHTML = rows
      .map(
        (photo) =>
          `<div class="photo-item ${this.selected.has(photo.id) ? "selected" : ""}" data-id="${photo.id}" draggable="true"><img src="${Admin.esc(photo.src)}" alt="${Admin.esc(photo.desc || "相册照片")}" loading="lazy"><label class="photo-select"><input type="checkbox" aria-label="选择照片 ${photo.id}" ${this.selected.has(photo.id) ? "checked" : ""}></label>${photo.desc ? `<span class="desc">${Admin.esc(photo.desc)}</span>` : ""}<div class="ops"><button title="预览" data-command="preview"><i class="fa-solid fa-expand"></i></button><button title="编辑描述" data-command="describe"><i class="fa-solid fa-pen"></i></button><button title="设为封面" data-command="cover"><i class="fa-solid fa-star"></i></button><button title="向前移动" data-command="earlier"><i class="fa-solid fa-arrow-left"></i></button></div></div>`,
      )
      .join("");
    grid.querySelectorAll(".photo-item").forEach((element) => {
      const id = +element.dataset.id,
        photo = this.photos.find((item) => item.id === id);
      element.querySelector("input").onchange = (event) => {
        event.target.checked ? this.selected.add(id) : this.selected.delete(id);
        element.classList.toggle("selected", event.target.checked);
        this.syncSelection();
      };
      element.querySelector("img").onclick = () =>
        Admin.previewImage(photo.src);
      element.querySelectorAll("[data-command]").forEach(
        (button) =>
          (button.onclick = () => {
            const action = button.dataset.command;
            if (action === "preview") Admin.previewImage(photo.src);
            if (action === "describe") this.describe(photo);
            if (action === "cover")
              Admin.api("photos", "set_cover", { id })
                .then(() => this.refresh())
                .catch(() => {});
            if (action === "earlier") {
              const index = this.photos.indexOf(photo);
              if (index > 0) this.reorder(id, this.photos[index - 1].id);
            }
          }),
      );
      element.ondragstart = (event) =>
        event.dataTransfer.setData("text/plain", String(id));
      element.ondragover = (event) => event.preventDefault();
      element.ondrop = (event) => {
        event.preventDefault();
        this.reorder(+event.dataTransfer.getData("text/plain"), id);
      };
    });
    this.syncSelection();
  },
  reorder(from, to) {
    const first = this.photos.findIndex((photo) => photo.id === from),
      last = this.photos.findIndex((photo) => photo.id === to);
    if (first < 0 || last < 0 || first === last) return;
    this.photos.splice(last, 0, this.photos.splice(first, 1)[0]);
    this.orderDirty = true;
    this.render();
  },
  syncSelection() {
    const count = this.selected.size;
    Admin.el("selInfo").textContent = count ? `已选 ${count} 张` : "";
    ["btnPublish", "btnMove", "btnBatchDel"].forEach(
      (id) => (Admin.el(id).hidden = !count),
    );
    Admin.el("btnSaveOrder").hidden = !this.orderDirty;
  },
  selectAll() {
    const rows = this.visible(),
      all = rows.every((photo) => this.selected.has(photo.id));
    rows.forEach((photo) =>
      all ? this.selected.delete(photo.id) : this.selected.add(photo.id),
    );
    this.render();
  },
  async saveOrder() {
    try {
      await Admin.api("photos", "reorder", {
        ids: this.photos.map((photo) => photo.id),
      });
      this.orderDirty = false;
      this.syncSelection();
    } catch (error) {}
  },
  publishSelected() {
    const images = this.photos
      .filter((photo) => this.selected.has(photo.id))
      .map((photo) => photo.src);
    if (images.length > 30) return toastr.warning("一次最多发布 30 张照片");
    try {
      sessionStorage.setItem("moment-selected-images", JSON.stringify(images));
      location.href = "/admin/moments.php?compose=1";
    } catch (error) {
      toastr.error("浏览器存储不可用");
    }
  },
  async batchDelete() {
    if (
      !(await Admin.confirm(
        `删除所选 ${this.selected.size} 张照片？已发布瞬间不受影响。`,
      ))
    )
      return;
    try {
      await Admin.api("photos", "batch_delete", { ids: [...this.selected] });
      this.selected.clear();
      await this.refresh();
    } catch (error) {}
  },
  async deleteAlbum() {
    if (
      !(await Admin.confirm(
        "删除当前相册和其中的照片记录？已发布瞬间不受影响。",
      ))
    )
      return;
    try {
      await Admin.api("albums", "delete", { id: this.cur });
      this.cur = 0;
      this.selected.clear();
      await this.refresh();
    } catch (error) {}
  },
  editText(title, value, save) {
    Admin.modal(
      title,
      `<div class="field"><label for="albumText">${Admin.esc(title)}</label><input id="albumText" maxlength="255" value="${Admin.esc(value)}"></div><div class="actions"><button class="btn ghost" onclick="Admin.closeModal()">取消</button><button class="btn primary" id="albumTextSave">保存</button></div>`,
    );
    Admin.el("albumTextSave").onclick = async (event) => {
      const button = event.currentTarget,
        text = Admin.el("albumText").value.trim();
      button.disabled = true;
      try {
        await save(text);
        Admin.closeModal();
        await this.refresh();
      } catch (error) {
        button.disabled = false;
      }
    };
  },
  newAlbum() {
    this.editText("新建相册", "", async (title) => {
      const data = await Admin.api("albums", "create", { title });
      this.cur = +data.id;
    });
  },
  rename() {
    this.editText(
      "相册名称",
      this.albums.find((album) => +album.id === this.cur).title,
      (title) => Admin.api("albums", "rename", { id: this.cur, title }),
    );
  },
  describe(photo) {
    this.editText("照片描述", photo.desc || "", (desc) =>
      Admin.api("photos", "update", { id: photo.id, desc }),
    );
  },
  move() {
    const targets = this.albums.filter((album) => +album.id !== this.cur);
    if (!targets.length) return toastr.warning("请先新建另一本相册");
    Admin.modal(
      "移动照片",
      `<div class="field"><label for="targetAlbum">目标相册</label><select id="targetAlbum">${targets.map((album) => `<option value="${album.id}">${Admin.esc(album.title)}</option>`).join("")}</select></div><div class="actions"><button class="btn ghost" onclick="Admin.closeModal()">取消</button><button class="btn primary" id="movePhotos">移动 ${this.selected.size} 张</button></div>`,
    );
    Admin.el("movePhotos").onclick = async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await Admin.api("photos", "move", {
          ids: [...this.selected],
          album_id: Admin.el("targetAlbum").value,
        });
        this.selected.clear();
        Admin.closeModal();
        await this.refresh();
      } catch (error) {
        button.disabled = false;
      }
    };
  },
};
Album.init();

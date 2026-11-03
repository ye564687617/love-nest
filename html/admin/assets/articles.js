const Articles = {
  rows: [],
  editor: null,
  editId: 0,
  cover: "",
  uploads: 0,
  session: 0,
  async load() {
    try {
      this.rows = (await Admin.get("articles", "list")).list;
      this.render();
      Admin.el("articleStats").textContent = this.rows.length + " 篇文章";
    } catch (e) {
      toastr.error(e.message);
    }
  },
  render() {
    const q = Admin.el("articleSearch").value.toLowerCase(),
      f = Admin.el("articleFilter").value;
    const rows = this.rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) &&
        (f === "all" || String(r.status) === f),
    );
    Admin.el("artEmpty").hidden = !!rows.length;
    Admin.el("artBody").innerHTML = rows
      .map(
        (r) =>
          `<tr><td>${r.cover ? `<img class="article-row-cover" src="${Admin.esc(r.cover)}" alt="文章封面">` : '<i class="fa-regular fa-file-lines muted"></i>'}</td><td class="article-table-title">${Admin.esc(r.title)}<small>${Admin.time(r.created_at)}</small></td><td>${r.views}</td><td><span class="badge ${r.status == 1 ? "green" : "gray"}">${r.status == 1 ? "已发布" : "草稿"}</span></td><td><div class="workspace-actions"><button class="icon-btn" title="编辑文章" onclick="Articles.openModal(${r.id})"><i class="fa-solid fa-pen"></i></button>${r.status == 1 ? `<a class="icon-btn" title="查看文章" target="_blank" href="/articles.php?id=${r.id}"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ""}<button class="icon-btn" title="${r.status == 1 ? "转为草稿" : "发布文章"}" onclick="Articles.toggle(${r.id})"><i class="fa-solid fa-eye${r.status == 1 ? "-slash" : ""}"></i></button><button class="icon-btn" title="删除文章" onclick="Articles.del(${r.id})"><i class="fa-solid fa-trash"></i></button></div></td></tr>`,
      )
      .join("");
  },
  async openModal(id) {
    const request = (this.openRequest = (this.openRequest || 0) + 1);
    let a = {};
    try {
      if (id) a = await Admin.get("articles", "get", { id });
    } catch (e) {
      return toastr.error(e.message);
    }
    if (request !== this.openRequest) return;
    if (typeof Quill === "undefined")
      return toastr.error("编辑器资源加载失败，请刷新页面");
    this.editId = id || 0;
    this.cover = a.cover || "";
    this.uploads = 0;
    this.imageRange = null;
    const session = ++this.session;
    this.draftKey = "article-draft-" + (id || "new");
    Admin.modal(
      id ? "编辑文章" : "写文章",
      `<div class="article-editor-layout"><div><div class="field"><label class="muted" for="aTitle">文章标题</label><input type="text" class="editor-title" id="aTitle" maxlength="128" placeholder="给故事起一个名字" value="${Admin.esc(a.title || "")}"></div><div id="articleEditor"></div><div class="editor-status" id="articleEditorStatus"></div></div><aside><div class="field"><label>文章封面</label><img id="articleCoverPreview" class="cover-preview" alt="文章封面" ${this.cover ? 'src="' + Admin.esc(this.cover) + '"' : "hidden"}><label class="btn ghost" for="articleCover"><i class="fa-solid fa-image"></i>上传封面</label><input type="file" hidden id="articleCover" accept="image/jpeg,image/png,image/gif,image/webp"><button class="icon-btn" id="removeCover" title="移除封面"><i class="fa-solid fa-xmark"></i></button></div><div class="field"><label for="aExcerpt">摘要</label><textarea id="aExcerpt" maxlength="300" rows="4">${Admin.esc(a.excerpt || "")}</textarea></div><div class="field"><label for="aStatus">可见状态</label><select id="aStatus"><option value="1" ${a.status != 0 ? "selected" : ""}>公开发布</option><option value="0" ${a.status == 0 ? "selected" : ""}>保存为草稿</option></select></div><button class="btn ghost" id="articlePreview"><i class="fa-solid fa-eye"></i>预览正文</button></aside></div><input type="file" id="articleImage" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif"><div class="actions"><button class="btn ghost" onclick="Admin.closeModal()">关闭</button><button class="btn primary" id="aOk"><i class="fa-solid fa-floppy-disk"></i>保存文章</button></div>`,
    );
    const toolbar = [
      [{ header: [2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["blockquote", "code-block"],
      [{ align: [] }],
      ["link", "image"],
      ["clean"],
    ];
    this.editor = new Quill("#articleEditor", {
      theme: "snow",
      placeholder: "从这里开始写下你们的故事...",
      modules: { toolbar },
    });
    this.editor.clipboard.dangerouslyPasteHTML(a.content || "");
    this.editor.getModule("toolbar").addHandler("image", () => {
      this.imageRange = this.editor.getSelection(true);
      Admin.el("articleImage").click();
    });
    this.editor.on("text-change", () => this.persist());
    try {
      const draft = JSON.parse(localStorage.getItem(this.draftKey) || "null");
      if (draft && confirm("有未保存的文章草稿，是否恢复？")) {
        Admin.el("aTitle").value = draft.title;
        Admin.el("aExcerpt").value = draft.excerpt;
        this.editor.clipboard.dangerouslyPasteHTML(draft.content);
        this.cover = draft.cover || "";
        if (draft.status !== undefined)
          Admin.el("aStatus").value = draft.status;
        this.showCover();
      }
    } catch (e) {}
    ["aTitle", "aExcerpt", "aStatus"].forEach(
      (n) => (Admin.el(n).oninput = () => this.persist()),
    );
    Admin.el("articleCover").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      this.uploads++;
      this.status("封面上传中");
      try {
        const url = await Admin.upload(file);
        if (session === this.session && Admin.el("aTitle")) {
          this.cover = url;
          this.showCover();
          this.persist();
        }
      } catch (e) {
        toastr.error(e.message);
      } finally {
        if (session === this.session) {
          this.uploads--;
          this.status();
        }
      }
    };
    Admin.el("removeCover").onclick = () => {
      this.cover = "";
      this.showCover();
      this.persist();
    };
    Admin.el("articleImage").onchange = (e) => {
      const files = [...e.target.files];
      e.target.value = "";
      this.insertImages(files, session);
    };
    this.editor.root.addEventListener("paste", (e) => {
      const files = [...e.clipboardData.files].filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length) {
        e.preventDefault();
        this.imageRange = this.editor.getSelection(true);
        this.insertImages(files, session);
      }
    });
    this.editor.root.addEventListener("dragover", (e) => {
      if (e.dataTransfer.types.includes("Files")) e.preventDefault();
    });
    this.editor.root.addEventListener("drop", (e) => {
      const files = [...e.dataTransfer.files].filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length) {
        e.preventDefault();
        this.imageRange = this.editor.getSelection(true);
        this.insertImages(files, session);
      }
    });
    Admin.el("aOk").onclick = () => this.save();
    Admin.el("articlePreview").onclick = () => {
      const box = document.createElement("dialog");
      box.style.cssText =
        "max-width:800px;width:95%;max-height:85vh;padding:28px;border:1px solid #ddd;border-radius:8px;overflow:auto";
      box.innerHTML =
        '<button class="btn ghost" style="float:right">关闭</button><h2>' +
        Admin.esc(Admin.el("aTitle").value) +
        '</h2><div class="ql-editor">' +
        this.editor.getSemanticHTML() +
        "</div>";
      document.body.appendChild(box);
      box.querySelector("button").onclick = () => box.close();
      box.onclose = () => box.remove();
      box.showModal();
    };
    this.status();
  },
  status(text) {
    if (Admin.el("articleEditorStatus"))
      Admin.el("articleEditorStatus").textContent =
        text ||
        (this.uploads
          ? "图片上传中，请稍候"
          : this.editor.getText().trim().length + " 字");
  },
  showCover() {
    const img = Admin.el("articleCoverPreview");
    img.hidden = !this.cover;
    if (this.cover) img.src = this.cover;
    else img.removeAttribute("src");
  },
  persist() {
    if (!this.editor || !Admin.el("aTitle")) return;
    try {
      localStorage.setItem(
        this.draftKey,
        JSON.stringify({
          title: Admin.el("aTitle").value,
          excerpt: Admin.el("aExcerpt").value,
          content: this.editor.getSemanticHTML(),
          cover: this.cover,
          status: Admin.el("aStatus").value,
        }),
      );
      this.status(
        "本地草稿已保存 / " + this.editor.getText().trim().length + " 字",
      );
    } catch (e) {}
  },
  async insertImages(files, session) {
    let index = (
      this.imageRange ||
      this.editor.getSelection() || { index: this.editor.getLength() - 1 }
    ).index;
    for (const file of files) {
      this.uploads++;
      this.status("图片上传中");
      try {
        const url = await Admin.upload(file);
        if (session !== this.session || !Admin.el("aTitle")) return;
        this.editor.insertEmbed(index, "image", url, "user");
        this.editor.setSelection(++index, 0, "silent");
      } catch (e) {
        toastr.error(e.message);
      } finally {
        if (session === this.session) {
          this.uploads--;
          this.status();
        }
      }
    }
  },
  async save() {
    if (this.uploads) return toastr.warning("请等待图片上传完成");
    const d = {
      title: Admin.el("aTitle").value.trim(),
      content: this.editor.getSemanticHTML(),
      excerpt: Admin.el("aExcerpt").value.trim(),
      cover: this.cover,
      status: Admin.el("aStatus").value,
    };
    if (!d.title) return toastr.warning("请输入标题");
    if (this.editId) d.id = this.editId;
    const b = Admin.el("aOk");
    b.disabled = true;
    try {
      await Admin.api("articles", this.editId ? "update" : "create", d);
      try {
        localStorage.removeItem(this.draftKey);
      } catch (e) {}
      Admin.closeModal();
      this.load();
    } catch (e) {
      b.disabled = false;
    }
  },
  async toggle(id) {
    try {
      await Admin.api("articles", "toggle", { id });
      this.load();
    } catch (e) {}
  },
  async del(id) {
    if (await Admin.confirm("确定删除这篇文章？")) {
      try {
        await Admin.api("articles", "delete", { id });
        this.load();
      } catch (e) {}
    }
  },
};
Admin.el("articleSearch").oninput = () => Articles.render();
Admin.el("articleFilter").onchange = () => Articles.render();
Articles.load();

(function () {
  "use strict";
  Admin.upload = function (file, progress) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png|gif|webp)$/.test(file.type))
        return reject(new Error("请选择 JPG、PNG、GIF 或 WebP 图片"));
      if (file.size > 5 * 1024 * 1024)
        return reject(new Error("单张图片最大 5MB"));
      var body = new FormData();
      body.append("csrf_token", Admin.csrf());
      body.append("file", file);
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload_image.php");
      xhr.timeout = 120000;
      xhr.upload.onprogress = function (event) {
        if (progress && event.lengthComputable)
          progress((event.loaded / event.total) * 100);
      };
      xhr.onload = function () {
        try {
          var result = JSON.parse(xhr.responseText);
          if (result.code !== 0) throw new Error(result.msg);
          resolve(result.data.url);
        } catch (error) {
          reject(error);
        }
      };
      xhr.onerror = xhr.ontimeout = function () {
        reject(new Error("上传中断，请重试"));
      };
      xhr.send(body);
    });
  };
  Admin.uploadQueue = function (container, receive) {
    var jobs = [];
    var active = 0;
    function render(job) {
      job.row.querySelector("small").textContent = job.status;
      job.row.dataset.state = job.failed
        ? "failed"
        : job.status === "已完成"
          ? "complete"
          : "pending";
      job.row.querySelector("progress").value = job.progress;
      var retry = job.row.querySelector("button");
      retry.hidden = !job.failed;
      var remove = job.row.querySelector("button:last-child");
      if (remove !== retry) remove.hidden = !job.failed;
    }
    function pump() {
      while (active < 3) {
        var job = jobs.find(function (item) {
          return item.status === "等待上传";
        });
        if (!job) break;
        active++;
        job.status = "上传中";
        render(job);
        (function (item) {
          (item.url
            ? Promise.resolve(item.url)
            : Admin.upload(item.file, function (value) {
                item.progress = value;
                render(item);
              })
          )
            .then(function (url) {
              item.url = url;
              item.status = "保存中";
              render(item);
              return receive(url, item.file, item.meta);
            })
            .then(function () {
              item.status = "已完成";
              item.progress = 100;
            })
            .catch(function (error) {
              item.status = error.message;
              item.failed = true;
            })
            .finally(function () {
              active--;
              render(item);
              pump();
            });
        })(job);
      }
    }
    return function (files, meta) {
      Array.from(files).forEach(function (file) {
        var job = {
          file: file,
          meta: meta,
          status: "等待上传",
          progress: 0,
          failed: false,
          row: document.createElement("div"),
        };
        var preview = URL.createObjectURL(file);
        job.row.className = "queue-row";
        job.row.innerHTML =
          '<img alt=""><div><strong>' +
          Admin.esc(file.name) +
          '</strong><progress max="100" value="0"></progress><small></small></div><button type="button" class="icon-btn" title="重新上传" hidden><i class="fa-solid fa-rotate-right"></i></button>';
        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "icon-btn";
        remove.title = "移除失败任务";
        remove.hidden = true;
        remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        remove.onclick = function () {
          if (!job.failed) return;
          jobs.splice(jobs.indexOf(job), 1);
          job.row.remove();
        };
        job.row.appendChild(remove);
        job.row.querySelector("img").src = preview;
        job.row.querySelector("img").onload = function () {
          URL.revokeObjectURL(preview);
        };
        job.row.querySelector("img").onerror = function () {
          URL.revokeObjectURL(preview);
        };
        job.row.querySelector("button").onclick = function () {
          job.failed = false;
          job.status = "等待上传";
          pump();
        };
        container.appendChild(job.row);
        jobs.push(job);
        render(job);
      });
      pump();
    };
  };
  Admin.previewImage = function (url) {
    Admin.modal(
      "照片预览",
      '<img class="media-preview" src="' +
        Admin.esc(url) +
        '" alt="照片"><div class="actions"><button class="btn ghost" onclick="Admin.closeModal()">关闭</button></div>',
    );
  };
})();

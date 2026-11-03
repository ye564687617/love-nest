(function () {
  "use strict";
  const searchablePages = new Set([
    "lovelist.php",
    "countdowns.php",
    "playlist.php",
    "reports.php",
    "users.php",
  ]);
  const page = location.pathname.split("/").pop();
  if (searchablePages.has(page)) {
    document.querySelectorAll(".tbl").forEach((table) => {
      const wrapper = table.closest(".table-scroll") || table;
      const search = document.createElement("input");
      search.type = "search";
      search.className = "search-input table-filter";
      search.placeholder = "搜索当前页记录";
      search.setAttribute("aria-label", "搜索当前页记录");
      search.style.marginBottom = "16px";
      wrapper.before(search);
      const filter = () => {
        const query = search.value.trim().toLowerCase();
        table.querySelectorAll("tr").forEach((row) => {
          if (row.querySelector("th")) return;
          row.hidden = !row.textContent.toLowerCase().includes(query);
        });
      };
      search.addEventListener("input", filter);
      new MutationObserver(filter).observe(table, {
        childList: true,
        subtree: true,
      });
    });
  }
  document.querySelectorAll(".field").forEach((field, index) => {
    const label = field.querySelector("label");
    const control = field.querySelector(
      "input:not([type=hidden]),textarea,select",
    );
    if (!label || !control || label.htmlFor) return;
    if (!control.id) control.id = "field-control-" + index;
    label.htmlFor = control.id;
  });
  if (page === "config.php") {
    const card = document.querySelector(".content>.card");
    if (!card) return;
    const search = document.createElement("input");
    search.type = "search";
    search.className = "search-input";
    search.placeholder = "查找设置项";
    search.setAttribute("aria-label", "查找设置项");
    search.style.marginBottom = "22px";
    card.querySelector(".card-title").after(search);
    search.oninput = () =>
      card.querySelectorAll(".field").forEach((field) => {
        field.hidden = !field.textContent.includes(search.value.trim());
      });
  }
})();

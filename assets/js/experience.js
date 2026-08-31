// 经历页面
// 1. 点击标题行展开/收起项目经验（h2）
// 2. Future nested projects keep the Experience page's Sora brand accent.

(function () {
  "use strict";

  function assignProjectColors() {
    var projects = document.querySelectorAll(".project");
    projects.forEach(function (project) {
      project.style.setProperty("--project-accent", "var(--sora)");
      project.style.setProperty("--project-ink", "var(--sora-ink)");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var timeline = document.querySelector(".timeline");
    if (!timeline) return;

    timeline.querySelectorAll(".timeline__toggle").forEach(function (btn) {
      var row = btn.closest(".timeline__title-row");
      row.addEventListener("click", function () {
        var item = btn.closest(".timeline__item");
        var isOpen = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!isOpen));
        item.classList.toggle("is-open", !isOpen);
      });
    });

    assignProjectColors();
  });
})();

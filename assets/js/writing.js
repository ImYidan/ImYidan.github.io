// Writing page: accordion open/close with smooth animation.
// Each work is a <details class="writing-work"> element.
// Only one work open at a time within a panel.

(function () {
  "use strict";

  function stickyOffset() {
    var offset = 12;
    [".site-header", ".writing-tabs"].forEach(function (selector) {
      var el = document.querySelector(selector);
      if (!el) return;
      var style = window.getComputedStyle(el);
      if (style.position !== "sticky" && style.position !== "fixed") return;
      var rect = el.getBoundingClientRect();
      if (rect.bottom > 0) offset = Math.max(offset, rect.bottom + 12);
    });
    return offset;
  }

  function reduceMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function scrollSummaryIntoView(summary) {
    if (!summary) return;
    var y = window.scrollY + summary.getBoundingClientRect().top - stickyOffset();
    window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion() ? "auto" : "smooth" });
  }

  function clearBodyAnimation(work) {
    var body = work.querySelector(".writing-work__body");
    work.classList.remove("writing-work--animating", "writing-work--opening", "writing-work--closing");
    if (!body) return;
    body.style.removeProperty("max-height");
    body.style.removeProperty("opacity");
  }

  function waitForBodyTransition(work, callback) {
    var body = work.querySelector(".writing-work__body");
    var done = false;
    function finish() { if (done) return; done = true; if (body) body.removeEventListener("transitionend", onEnd); callback(); }
    function onEnd(event) { if (event.target === body && event.propertyName === "max-height") finish(); }
    if (body) body.addEventListener("transitionend", onEnd);
    window.setTimeout(finish, 520);
  }

  function animateOpenWork(work, afterOpen) {
    if (!work || work.open) { if (afterOpen) afterOpen(); return; }
    if (reduceMotion()) { work.open = true; updateFloatingCollapse(); if (afterOpen) afterOpen(); return; }
    var body = work.querySelector(".writing-work__body");
    if (!body) { work.open = true; updateFloatingCollapse(); if (afterOpen) afterOpen(); return; }
    clearBodyAnimation(work);
    work.open = true;
    updateFloatingCollapse();
    work.classList.add("writing-work--animating", "writing-work--opening");
    body.style.maxHeight = "0px";
    body.style.opacity = "0";
    body.offsetHeight;
    window.requestAnimationFrame(function () {
      body.style.maxHeight = body.scrollHeight + "px";
      body.style.opacity = "1";
    });
    waitForBodyTransition(work, function () { clearBodyAnimation(work); if (afterOpen) afterOpen(); updateFloatingCollapse(); });
  }

  function animateCloseWork(work, afterClose) {
    if (!work || !work.open) { if (afterClose) afterClose(); return; }
    if (reduceMotion()) { work.open = false; updateFloatingCollapse(); if (afterClose) afterClose(); return; }
    var body = work.querySelector(".writing-work__body");
    if (!body) { work.open = false; updateFloatingCollapse(); if (afterClose) afterClose(); return; }
    clearBodyAnimation(work);
    work.classList.add("writing-work--animating", "writing-work--closing");
    body.style.maxHeight = body.scrollHeight + "px";
    body.style.opacity = "1";
    body.offsetHeight;
    window.requestAnimationFrame(function () { body.style.maxHeight = "0px"; body.style.opacity = "0"; });
    waitForBodyTransition(work, function () { work.open = false; clearBodyAnimation(work); if (afterClose) afterClose(); updateFloatingCollapse(); });
  }

  function openWorks() {
    var panel = document.querySelector("[data-writing-panel]:not([hidden])") || document;
    return Array.prototype.slice.call(panel.querySelectorAll(".writing-work[open]"));
  }

  function currentOpenWork() {
    var works = openWorks();
    if (!works.length) return null;
    var targetY = stickyOffset() + (window.innerHeight - stickyOffset()) * 0.35;
    var best = works[0];
    var bestDistance = Infinity;
    works.forEach(function (work) {
      var rect = work.getBoundingClientRect();
      if (rect.top <= targetY && rect.bottom >= targetY) { best = work; bestDistance = 0; return; }
      var distance = Math.min(Math.abs(rect.top - targetY), Math.abs(rect.bottom - targetY));
      if (distance < bestDistance) { best = work; bestDistance = distance; }
    });
    return best;
  }

  function collapseWork(work) {
    if (!work) return;
    animateCloseWork(work, function () {
      scrollSummaryIntoView(work.querySelector(".writing-work__summary"));
    });
  }

  var floatingCollapse = null;

  function updateFloatingCollapse() {
    if (!floatingCollapse) return;
    floatingCollapse.hidden = openWorks().length === 0;
  }

  function setActiveTab(tabName) {
    document.querySelectorAll("[data-writing-tab]").forEach(function (tab) {
      var active = tab.getAttribute("data-writing-tab") === tabName;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll("[data-writing-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-writing-panel") !== tabName;
    });
    updateFloatingCollapse();
  }

  function collapseOtherWorks(activeWork) {
    var summary = activeWork.querySelector(".writing-work__summary");
    var previousTop = summary ? summary.getBoundingClientRect().top : null;
    var panel = activeWork.closest("[data-writing-panel]") || document;
    var others = Array.prototype.slice.call(panel.querySelectorAll(".writing-work[open]"))
      .filter(function (work) { return work !== activeWork; });
    if (!others.length) return;
    others.forEach(function (work) { animateCloseWork(work); });
    updateFloatingCollapse();
    window.setTimeout(function () {
      if (!summary) return;
      var offset = stickyOffset();
      var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      var rect = summary.getBoundingClientRect();
      var maxTop = Math.max(offset, viewportHeight - rect.height - 16);
      var desiredTop = Math.min(Math.max(previousTop, offset), maxTop);
      window.scrollBy(0, rect.top - desiredTop);
    }, reduceMotion() ? 0 : 340);
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.body.classList.add("writing-js-ready");
    floatingCollapse = document.createElement("button");
    floatingCollapse.className = "writing-floating-collapse";
    floatingCollapse.type = "button";
    floatingCollapse.textContent = "Collapse";
    floatingCollapse.hidden = true;
    document.body.appendChild(floatingCollapse);
    floatingCollapse.addEventListener("click", function () { collapseWork(currentOpenWork()); });

    document.querySelectorAll("[data-writing-tab]").forEach(function (tab) {
      tab.addEventListener("click", function () { setActiveTab(tab.getAttribute("data-writing-tab")); });
    });
    document.querySelectorAll(".writing-work__collapse").forEach(function (button) {
      button.addEventListener("click", function () { collapseWork(button.closest(".writing-work")); });
    });
    document.querySelectorAll(".writing-work").forEach(function (work) {
      var summary = work.querySelector(".writing-work__summary");
      if (!summary) return;
      summary.addEventListener("click", function (event) {
        event.preventDefault();
        if (work.open) animateCloseWork(work);
        else { animateOpenWork(work); collapseOtherWorks(work); }
      });
    });
    window.addEventListener("scroll", updateFloatingCollapse, { passive: true });
    updateFloatingCollapse();
  });
})();
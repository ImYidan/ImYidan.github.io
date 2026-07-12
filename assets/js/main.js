// Minimal site interactions: mobile nav toggle + link prefetch.
// No animation libraries, no scroll spies.

(function () {
  "use strict";

  var prefetched = new Set();

  function prefetchPage(anchor) {
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
    if (navigator.connection && (navigator.connection.saveData || /(^|-)2g$/.test(navigator.connection.effectiveType))) return;
    var url;
    try { url = new URL(anchor.href, window.location.href); } catch (e) { return; }
    if (url.origin !== window.location.origin || url.protocol.indexOf("http") !== 0) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return;
    url.hash = "";
    if (prefetched.has(url.href)) return;
    prefetched.add(url.href);
    var hint = document.createElement("link");
    hint.rel = "prefetch";
    hint.href = url.href;
    hint.as = "document";
    document.head.appendChild(hint);
  }

  ["pointerover", "touchstart", "focusin"].forEach(function (eventName) {
    document.addEventListener(eventName, function (e) {
      prefetchPage(e.target.closest && e.target.closest("a[href]"));
    }, { passive: true });
  });

  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector(".site-nav__toggle");
    var list = document.querySelector(".site-nav__list");
    if (!toggle || !list) return;

    toggle.addEventListener("click", function () {
      var isOpen = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isOpen));
      list.classList.toggle("is-open", !isOpen);
    });

    list.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        toggle.setAttribute("aria-expanded", "false");
        list.classList.remove("is-open");
      });
    });

    var mq = window.matchMedia("(min-width: 821px)");
    mq.addEventListener("change", function (e) {
      if (e.matches) {
        toggle.setAttribute("aria-expanded", "false");
        list.classList.remove("is-open");
      }
    });
  });
})();
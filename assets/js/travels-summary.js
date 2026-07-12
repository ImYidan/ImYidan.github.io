// ─────────────────────────────────────────────────────────────
//   travels-summary.js -- Travel summary modal (self-contained)
//   Binds #travel-summary-btn, parses #travel-summary-source,
//   builds a modal with vertical tabs. Does not depend on
//   internal variables from travels.js.
// ─────────────────────────────────────────────────────────────

(function () {
  "use strict";

  var SUMMARY_BTN = document.getElementById("travel-summary-btn");
  var SUMMARY_SOURCE_EL = document.getElementById("travel-summary-source");

  // Enhance "record" entries (e.g. "Rome Florence 7 & Pat Lee")
  // into styled rows with city chips, day count, and companions.
  function enhanceSummaryEntries(sectionEl) {
    sectionEl.querySelectorAll("h2").forEach(function (h) { h.classList.add("travel-summary__year"); });
    sectionEl.querySelectorAll("p").forEach(function (p) {
      var raw = (p.textContent || "").trim();
      if (!raw) return;
      var m = raw.match(/^(.+?)(\d+)\s*[&]\s*(.+)$/);
      if (!m) return; // non-entry paragraphs stay as-is
      var cities = m[1].trim().split(/\s+/).filter(Boolean);
      var days = m[2];
      var peopleRaw = m[3].trim();
      var solo = /^(none|solo|none|[-\u2014])$/i.test(peopleRaw);

      var entry = document.createElement("div");
      entry.className = "travel-summary__entry";
      entry.dataset.days = days;
      var citiesBox = document.createElement("div");
      citiesBox.className = "travel-summary__entry-cities";
      cities.forEach(function (c) {
        var chip = document.createElement("span");
        chip.className = "travel-summary__city";
        chip.textContent = c;
        citiesBox.appendChild(chip);
      });
      var meta = document.createElement("div");
      meta.className = "travel-summary__entry-meta";
      var daysEl = document.createElement("span");
      daysEl.className = "travel-summary__days";
      daysEl.textContent = days + " days";
      meta.appendChild(daysEl);
      if (solo) {
        var soloEl = document.createElement("span");
        soloEl.className = "travel-summary__people travel-summary__people--solo";
        soloEl.textContent = "Solo";
        meta.appendChild(soloEl);
      } else {
        peopleRaw.split(/\s+/).filter(Boolean).forEach(function (name) {
          var ppl = document.createElement("span");
          ppl.className = "travel-summary__people";
          ppl.textContent = name;
          meta.appendChild(ppl);
        });
      }
      entry.appendChild(citiesBox);
      entry.appendChild(meta);
      p.replaceWith(entry);
    });

    sectionEl.querySelectorAll("h2").forEach(function (yearHeading) {
      var totalDays = 0;
      var node = yearHeading.nextElementSibling;
      while (node && node.tagName !== "H2") {
        if (node.classList.contains("travel-summary__entry")) {
          totalDays += Number(node.dataset.days) || 0;
        }
        node = node.nextElementSibling;
      }

      var total = document.createElement("p");
      total.className = "travel-summary__year-total";
      total.textContent = totalDays + " days total";
      sectionEl.insertBefore(total, node);
    });
  }

  // Make year sections collapsible (collapsed by default)
  function makeYearsCollapsible(sectionEl) {
    sectionEl.querySelectorAll("h2.travel-summary__year").forEach(function (h2) {
      var entries = [];
      var totalDays = 0;
      var totalEl = null;
      var node = h2.nextElementSibling;
      while (node && node.tagName !== "H2") {
        if (node.classList.contains("travel-summary__entry")) {
          totalDays += Number(node.dataset.days) || 0;
          entries.push(node);
        } else if (node.classList.contains("travel-summary__year-total")) {
          totalEl = node;
        }
        node = node.nextElementSibling;
      }
      var nextH2 = node;

      var group = document.createElement("div");
      group.className = "travel-summary__year-group";

      var header = document.createElement("button");
      header.className = "travel-summary__year-header";
      header.type = "button";
      header.setAttribute("aria-expanded", "false");

      var label = document.createElement("span");
      label.className = "travel-summary__year-label";
      label.textContent = h2.textContent.trim();

      var totalSpan = document.createElement("span");
      totalSpan.className = "travel-summary__year-total";
      totalSpan.textContent = totalDays + " days total";

      var arrow = document.createElement("span");
      arrow.className = "travel-summary__year-arrow";
      arrow.innerHTML = "&#9660;";

      header.appendChild(label);
      header.appendChild(totalSpan);
      header.appendChild(arrow);

      var body = document.createElement("div");
      body.className = "travel-summary__year-body";
      body.style.maxHeight = "0";

      entries.forEach(function (entry) {
        body.appendChild(entry.cloneNode(true));
      });

      group.appendChild(header);
      group.appendChild(body);

      h2.parentNode.removeChild(h2);
      if (totalEl) totalEl.parentNode.removeChild(totalEl);
      entries.forEach(function (e) { e.parentNode.removeChild(e); });

      if (nextH2) sectionEl.insertBefore(group, nextH2);
      else sectionEl.appendChild(group);

      header.addEventListener("click", function () {
        var expanded = header.getAttribute("aria-expanded") === "true";
        if (expanded) {
          body.style.maxHeight = body.scrollHeight + "px";
          body.offsetHeight;
          header.setAttribute("aria-expanded", "false");
          body.style.maxHeight = "0";
        } else {
          header.setAttribute("aria-expanded", "true");
          body.style.maxHeight = body.scrollHeight + "px";
          body.addEventListener("transitionend", function onEnd(e) {
            if (e.propertyName === "max-height" && e.target === body) {
              body.style.maxHeight = "none";
              body.removeEventListener("transitionend", onEnd);
            }
          });
        }
      });
    });
  }

  function openSummaryModal() {
    closeSummaryModal();
    if (!SUMMARY_SOURCE_EL) return;

    var container = document.createElement("div");
    container.innerHTML = SUMMARY_SOURCE_EL.innerHTML;

    var h1Count = 0;
    var introEl = document.createElement("div");
    var continentSections = [];
    var currentContinentEl = null;
    var currentYear = null;
    var allEntriesByYear = {};

    Array.prototype.slice.call(container.childNodes).forEach(function (node) {
      if (node.nodeType === 1 && node.tagName === "H1") {
        h1Count++;
        if (h1Count > 1) {
          currentContinentEl = document.createElement("div");
          continentSections.push({ title: node.textContent.trim(), el: currentContinentEl });
        }
        return;
      }
      if (h1Count >= 2) {
        if (node.nodeType === 1 && node.tagName === "H2") {
          currentYear = node.textContent.trim();
        } else if (node.nodeType === 1 && node.tagName === "P" && currentYear) {
          var text = (node.textContent || "").trim();
          if (text) {
            if (!allEntriesByYear[currentYear]) allEntriesByYear[currentYear] = [];
            allEntriesByYear[currentYear].push(text);
          }
        }
      }
      if (h1Count < 2) {
        introEl.appendChild(node.cloneNode(true));
      } else if (currentContinentEl) {
        currentContinentEl.appendChild(node.cloneNode(true));
      }
    });


    if (!continentSections.length) {
      continentSections.push({ title: "Europe", el: introEl });
      introEl = document.createElement("div");
    }

    continentSections.forEach(function (s) {
      enhanceSummaryEntries(s.el);
      s.hasData = !!s.el.querySelector(".travel-summary__entry");
      if (!s.hasData) {
        s.el.innerHTML = '<p class="travel-summary__empty">No data yet</p>';
      }
    });


    // Build All section from collected entries
    var allYearsEl = document.createElement("div");
    var yearKeys = Object.keys(allEntriesByYear).sort(function (a, b) { return Number(b) - Number(a); });
    yearKeys.forEach(function (year) {
      var h2 = document.createElement("h2");
      h2.textContent = year;
      allYearsEl.appendChild(h2);
      allEntriesByYear[year].forEach(function (text) {
        var p = document.createElement("p");
        p.textContent = text;
        allYearsEl.appendChild(p);
      });
    });
    enhanceSummaryEntries(allYearsEl);

    var allYearsSection = {
      title: "All",
      el: allYearsEl,
      hasData: yearKeys.length > 0
    };

    continentSections.sort(function (a, b) {
      return Number(b.hasData) - Number(a.hasData);
    });

    var overlay = document.createElement("div");
    overlay.className = "travel-modal-overlay travel-summary-overlay";
    var modal = document.createElement("div");
    modal.className = "travel-modal travel-modal--summary";
    modal.addEventListener("click", function (e) { e.stopPropagation(); });

    var closeBtn = document.createElement("button");
    closeBtn.className = "travel-modal__close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", closeSummaryModal);

    var head = document.createElement("div");
    head.className = "travel-summary__head";
    var titleEl = document.createElement("h2");
    titleEl.className = "travel-modal__title";
    titleEl.textContent = "Travel Summary";
    head.appendChild(titleEl);

    var bodyWrap = document.createElement("div");
    bodyWrap.className = "travel-summary__body";
    var tabs = document.createElement("div");
    tabs.className = "travel-summary__tabs";
    var content = document.createElement("div");
    content.className = "travel-summary__content";

    var introHtml = introEl.innerHTML;

    function activateTab(section, tabBtn) {
      tabs.querySelectorAll(".travel-summary__tab").forEach(function (t) { t.classList.remove("is-active"); });
      tabBtn.classList.add("is-active");
      content.innerHTML = "";
      if (introHtml) {
        var heading = document.createElement("h4");
        heading.className = "travel-summary__intro-title";
        heading.textContent = "Introduction";
        content.appendChild(heading);
        var introDiv = document.createElement("div");
        introDiv.className = "travel-summary__intro";
        if (section.title === "All") {
          introDiv.textContent = "A summary of all travel destinations, days spent, and companions.";
        } else {
          introDiv.innerHTML = introHtml;
        }
        content.appendChild(introDiv);
      }
      var clone = section.el.cloneNode(true);
      makeYearsCollapsible(clone);
      content.appendChild(clone);
      content.scrollTop = 0;
    }

    var allTabs = [allYearsSection].concat(continentSections);
    allTabs.forEach(function (s, i) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "travel-summary__tab";
      tab.textContent = s.title;
      tab.disabled = !s.hasData;
      if (s.hasData) {
        tab.addEventListener("click", function () { activateTab(s, tab); });
      }
      tabs.appendChild(tab);
      if (i === 0 && s.hasData) activateTab(s, tab);
    });

    bodyWrap.appendChild(tabs);
    bodyWrap.appendChild(content);
    modal.appendChild(closeBtn);
    modal.appendChild(head);
    modal.appendChild(bodyWrap);
    overlay.appendChild(modal);
    overlay.addEventListener("click", closeSummaryModal);
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onSummaryEsc);
    requestAnimationFrame(function () { overlay.classList.add("is-open"); });
  }

  function closeSummaryModal() {
    var overlay = document.querySelector(".travel-summary-overlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (!document.querySelector(".travel-modal-overlay")) document.body.style.overflow = "";
      document.removeEventListener("keydown", onSummaryEsc);
    }, 280);
  }
  function onSummaryEsc(e) { if (e.key === "Escape") closeSummaryModal(); }

  if (SUMMARY_BTN) SUMMARY_BTN.addEventListener("click", openSummaryModal);
})();
// ════════════════════════════════════════════════════════════
//   travels.js -- Travel page controller
//
//   Parses notebook HTML where H1 = country, H2 = city.
//   Uses SearchEngine for filtering, CardGrid for card display.
//   The world map (travels-map.js) and summary modal
//   (travels-summary.js) are loaded separately.
// ════════════════════════════════════════════════════════════

(function () {
  "use strict";

  var SOURCE_EL = document.getElementById("travel-source");
  var GRID_EL = document.getElementById("travel-grid");
  if (!SOURCE_EL || !GRID_EL) return;

  var toolbar = document.querySelector("[data-search-toolbar]");
  var cards = [];
  var cardGrid = null;
  var searchEngine = null;
  var FILTERS_EL = document.getElementById("travel-filters");
  var activeContinent = "all";

  // ── Parse: H1=country, H2=city ───────────────────────

  function parseCards() {
    var container = document.createElement("div");
    container.innerHTML = SOURCE_EL.innerHTML;
    var cards = [];
    var currentCountry = null, currentContinent = "Default", currentCity = null, bodyNodes = [];

    Array.prototype.forEach.call(container.childNodes, function (node) {
      if (node.nodeType === 1 && node.dataset && node.dataset.travelContinent) {
        if (currentCity) cards.push(makeCard(currentCity, currentCountry, currentContinent, bodyNodes));
        currentContinent = node.dataset.travelContinent.trim();
        currentCity = null; bodyNodes = [];
      } else if (node.nodeType === 1 && node.tagName === "H1") {
        if (currentCity) cards.push(makeCard(currentCity, currentCountry, currentContinent, bodyNodes));
        currentCountry = node.textContent.trim();
        currentCity = null; bodyNodes = [];
      } else if (node.nodeType === 1 && node.tagName === "H2") {
        if (currentCity) cards.push(makeCard(currentCity, currentCountry, currentContinent, bodyNodes));
        var h2 = node.textContent.trim();
        var duration = null;
        var m = h2.match(/[(（]([^)）]+)[)）]\s*$/);
        if (m) { duration = m[1]; h2 = h2.replace(/\s*[(（][^)）]+[)）]\s*$/, "").trim(); }
        currentCity = { title: h2, duration: duration };
        bodyNodes = [];
      } else if (currentCity) {
        bodyNodes.push(node);
      }
    });
    if (currentCity) cards.push(makeCard(currentCity, currentCountry, currentContinent, bodyNodes));
    return cards;
  }

  function makeCard(city, country, continent, nodes) {
    var d = document.createElement("div");
    nodes.forEach(function (n) { d.appendChild(n.cloneNode(true)); });
    return {
      title: city.title,
      duration: city.duration,
      country: country || "Unknown",
      continent: continent || "Unknown",
      bodyNodes: nodes,
      bodyHtml: d.innerHTML,
      bodyText: (d.textContent || "").replace(/\s+/g, " ").trim()
    };
  }

  function nodesToHtml(nodes) {
    var d = document.createElement("div");
    nodes.forEach(function (n) { d.appendChild(n.cloneNode(true)); });
    return d.innerHTML;
  }

  // ── Card HTML builder ────────────────────────────────

  function buildCardHtml(card, pfx) {
    var html = "";
    html += '<div class="' + pfx + '-card__header">';
    html += '  <div class="' + pfx + '-card__heading">';
    html += '    <h3 class="' + pfx + '-card__title">' + escapeHtml(card.title) + "</h3>";
    html += '    <div class="' + pfx + '-card__meta">' + escapeHtml(card.country) +
      (card.duration ? " . " + escapeHtml(card.duration) : "") + "</div>";
    html += "  </div>";
    html += '  <button class="' + pfx + '-card__expand-btn" data-card-modal type="button" aria-label="Expand">';
    html += "    <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><polyline points=\"15 3 21 3 21 9\"/><polyline points=\"9 21 3 21 3 15\"/><line x1=\"21\" y1=\"3\" x2=\"14\" y2=\"10\"/><line x1=\"3\" y1=\"21\" x2=\"10\" y2=\"14\"/></svg>";
    html += "  </button>";
    html += "</div>";
    html += '<div class="' + pfx + '-card__body">';
    html += '  <div class="' + pfx + '-card__body-wrap">';
    html += '    <div class="' + pfx + '-card__body-inner prose">' + card.bodyHtml + "</div>";
    html += "  </div>";
    html += '  <div class="' + pfx + '-card__match" hidden></div>';
    html += "</div>";
    return html;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ── Continent filters ────────────────────────────────

  function syncContinentFilters(parsedCards) {
    if (!FILTERS_EL) return;
    var active = {};
    parsedCards.forEach(function (c) { active[c.continent] = true; });
    FILTERS_EL.querySelectorAll("[data-continent]").forEach(function (btn) {
      if (btn.dataset.continent === "all") return;
      if (!active[btn.dataset.continent]) btn.parentNode.removeChild(btn);
    });
    var existing = {};
    FILTERS_EL.querySelectorAll("[data-continent]").forEach(function (b) { existing[b.dataset.continent] = true; });
    Object.keys(active).filter(function (c) { return !existing[c]; }).forEach(function (continent) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "travel-filters__chip";
      btn.dataset.continent = continent;
      btn.textContent = continent;
      FILTERS_EL.appendChild(btn);
    });
  }

  // ── Init ─────────────────────────────────────────────

  cardGrid = CardGrid.create({
    grid: GRID_EL,
    prefix: "travel",
    mode: "row",
    collapsedLines: 3,
    buildCardHtml: buildCardHtml,
    modalSubtitle: function (card) {
      return escapeHtml(card.country) + " . " + escapeHtml(card.continent) +
        (card.duration ? " . " + escapeHtml(card.duration) : "");
    },
    modalBodyHtml: function (card) { return card.bodyHtml; }
  });

  searchEngine = SearchEngine.create({
    toolbar: toolbar,
    prefix: "travel",
    scopes: ["country", "city", "body"],
    onFilter: applyFilter
  });

  function applyFilter() {
    var terms = searchEngine.activeTerms();
    var shown = 0;
    cardGrid.clearExpansionState();

    cardGrid.getCards().forEach(function (card) {
      var text = [card.country, card.continent, card.title, card.bodyText].join(" ").toLowerCase();
      var continentMatch = activeContinent === "all" || card.continent === activeContinent;
      var match = continentMatch && searchEngine.matchesSearch(text);
      card.el.style.display = match ? "" : "none";

      var matchEl = card.el.querySelector(".travel-card__match");
      if (match) {
        shown++;
        if (terms.length && matchEl) {
          var preview = searchEngine.buildMatchPreview("City", card.title, terms) ||
            searchEngine.buildMatchPreview("Body", card.bodyText, terms);
          if (preview) {
            matchEl.innerHTML = '<span class="travel-card__match-label">' + preview.label +
              '</span><span class="travel-card__match-text">' + preview.html + "</span>";
            matchEl.hidden = false;
          } else { matchEl.hidden = true; }
        } else if (matchEl) { matchEl.hidden = true; }
      } else if (matchEl) { matchEl.hidden = true; }
    });

    searchEngine.setCount(cardGrid.getCards().length, shown);
    if (shown === 0 && cardGrid.getCards().length > 0) {
      cardGrid.showEmpty("No matching destinations. Try a different keyword.");
    } else {
      cardGrid.showEmpty(null);
    }
  }

  if (FILTERS_EL) {
    FILTERS_EL.addEventListener("click", function (e) {
      var chip = e.target.closest(".travel-filters__chip");
      if (!chip) return;
      FILTERS_EL.querySelectorAll(".travel-filters__chip").forEach(function (c) {
        c.classList.toggle("is-active", c === chip);
      });
      activeContinent = chip.dataset.continent;
      applyFilter();
    });
  }

  // ── Expose for travels-map.js ────────────────────────
  window.TravelsNS = {
    parseCards: parseCards,
    applyFilter: applyFilter,
    GRID_EL: GRID_EL,
    MAP_EL: document.getElementById("travel-map-container")
  };

  function init() {
    var parsed = parseCards();
    parsed.sort(function (a, b) {
      var cc = a.country.localeCompare(b.country);
      if (cc) return cc;
      return a.title.localeCompare(b.title);
    });
    syncContinentFilters(parsed);
    cardGrid.renderCards(parsed);
    searchEngine.init();
    applyFilter();
    searchEngine.hideLoading();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
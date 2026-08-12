// ════════════════════════════════════════════════════════════
//   travels-map.js —— 旅迹页面世界地图 + 气泡云
//   通过 window.renderTravelMap 注入，依赖 travels.js 暴露的 TravelsNS
// ════════════════════════════════════════════════════════════

(function () {
  "use strict";

  window.renderTravelMap = function () {
    var NS = window.TravelsNS;
    if (!NS || !NS.MAP_EL) return;
    var getCards = NS.getCards || NS.parseCards;
    var applyFilter = NS.applyFilter;
    var INPUT_EL = NS.INPUT_EL;
    var MAP_EL = NS.MAP_EL;
    var mapSearchTargets = {};

    function scrollMapFullyIntoView() {
      var rect = MAP_EL.getBoundingClientRect();
      var header = document.querySelector(".site-header");
      var headerHeight = header ? header.getBoundingClientRect().height : 0;
      var top = window.scrollY + rect.top - headerHeight - 16;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }

    function applyCountrySearch(country) {
      if (!country) return;
      var target = mapSearchTargets[country];
      if (NS.setSearchScopes) {
        var scopes = NS.getSearchScopes ? NS.getSearchScopes() : ["region", "title", "body"];
        var requiredScope = target ? target.scope : "region";
        if (scopes.indexOf(requiredScope) === -1) scopes.push(requiredScope);
        NS.setSearchScopes(scopes);
      }
      INPUT_EL.value = target ? target.value : country;
      applyFilter();
      INPUT_EL.blur();
      hideMapTooltip();
      requestAnimationFrame(scrollMapFullyIntoView);
    }

    var TOOLTIP_EL = null;
    function showMapTooltip(country, entry, e) {
      if (!TOOLTIP_EL) {
        TOOLTIP_EL = document.createElement("div");
        TOOLTIP_EL.className = "travel-map-tooltip";
        document.body.appendChild(TOOLTIP_EL);
      }
      TOOLTIP_EL.innerHTML = "";
      TOOLTIP_EL.classList.toggle("travel-map-tooltip--unvisited", !entry);
      var nameEl = document.createElement("strong");
      nameEl.textContent = entry ? country + " [" + getMapCount(entry) + "]" : country;
      TOOLTIP_EL.appendChild(nameEl);
      var mapPlaces = entry ? getMapPlaces(entry) : [];
      if (mapPlaces.length) {
        var citiesEl = document.createElement("span");
        citiesEl.textContent = mapPlaces.join(" · ");
        TOOLTIP_EL.appendChild(citiesEl);
      }
      TOOLTIP_EL.hidden = false;
      moveMapTooltip(e);
    }
    function moveMapTooltip(e) {
      if (!TOOLTIP_EL || TOOLTIP_EL.hidden) return;
      var left = Math.min(e.clientX + 14, window.innerWidth - TOOLTIP_EL.offsetWidth - 12);
      var top = Math.min(e.clientY + 14, window.innerHeight - TOOLTIP_EL.offsetHeight - 12);
      TOOLTIP_EL.style.left = Math.max(12, left) + "px";
      TOOLTIP_EL.style.top = Math.max(12, top) + "px";
    }
    function hideMapTooltip() {
      if (TOOLTIP_EL) TOOLTIP_EL.hidden = true;
    }

    var allCards = getCards();
    var countryCount = {};
    function getCardProvince(card) {
      var province = "";
      (card.bodyNodes || []).some(function (node) {
        if (!node || node.nodeType !== 1) return false;
        var el = node.matches && node.matches(".travel-province")
          ? node : (node.querySelector ? node.querySelector(".travel-province") : null);
        if (!el) return false;
        province = (el.textContent || "").trim();
        return !!province;
      });
      return province;
    }
    allCards.forEach(function (card) {
      if (card.type === "country") return;
      var key = card.country;
      if (!countryCount[key]) countryCount[key] = { count: 0, continent: card.continent, cities: [], provinces: [] };
      countryCount[key].count++;
      countryCount[key].cities.push(card.title);
      var province = getCardProvince(card);
      if (province && countryCount[key].provinces.indexOf(province) === -1) {
        countryCount[key].provinces.push(province);
      }
    });

    function isChinaEntry(entry) {
      return entry && (entry.cn === "中国" || String(entry.en).toLowerCase() === "china");
    }
    function getMapCount(entry) {
      return isChinaEntry(entry) && entry.data.provinces.length
        ? entry.data.provinces.length : entry.data.count;
    }
    function getMapPlaces(entry) {
      return isChinaEntry(entry) && entry.data.provinces.length
        ? entry.data.provinces : entry.data.cities;
    }

    function parseCountryHeading(heading) {
      var value = String(heading || "").trim();
      var match = value.match(/^(\S+)\s+(.+)$/);
      return match
        ? { name: value, cn: match[1], en: match[2].trim() }
        : { name: value, cn: value, en: value };
    }

    var entries = Object.keys(countryCount).map(function (k) {
      var names = parseCountryHeading(k);
      return { name: names.name, cn: names.cn, en: names.en, data: countryCount[k] };
    }).sort(function (a, b) { return getMapCount(b) - getMapCount(a); });

    var maxPlaces = entries.length ? getMapCount(entries[0]) : 1;
    var visitedSet = {};
    entries.forEach(function (e) { visitedSet[e.cn] = e; });
    var defaultHighlighted = {};

    MAP_EL.innerHTML = "";

    var mapUrls = [
      "/assets/data/world.geojson",
      "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json"
    ];

    function hideTravelPageLoading() {
      var el = document.getElementById("travel-page-loading");
      if (el) {
        el.classList.add("travel-page-loading--hidden");
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
      }
    }

    function tryFetchMap(idx) {
      if (idx >= mapUrls.length) { renderBubbleAndBlocks(); return; }
      fetch(mapUrls[idx])
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.type === "Topology") tryFetchMap(idx + 1);
          else renderWorldMap(data);
        })
        .catch(function () { tryFetchMap(idx + 1); });
    }

    function renderWorldMap(geojson) {
      var minLon = -180, maxLon = 180, minLat = -60, maxLat = 85;
      var width = 2000;
      var scale = width / (maxLon - minLon);
      var height = Math.round((maxLat - minLat) * scale);
      var offsetX = 0;
      var offsetY = 0;

      function project(lon, lat) {
        return [(lon - minLon) * scale + offsetX, (maxLat - lat) * scale + offsetY];
      }
      function simplifyRing(ring, tolerance) {
        if (!ring || ring.length < 8 || !tolerance) return ring || [];
        var simplified = [ring[0]];
        var last = project(ring[0][0], ring[0][1]);
        var toleranceSquared = tolerance * tolerance;
        for (var i = 1; i < ring.length - 1; i++) {
          var current = project(ring[i][0], ring[i][1]);
          var dx = current[0] - last[0];
          var dy = current[1] - last[1];
          if (dx * dx + dy * dy >= toleranceSquared) {
            simplified.push(ring[i]);
            last = current;
          }
        }
        return simplified.length >= 3 ? simplified : ring;
      }
      function ringToPath(ring, tolerance) {
        return simplifyRing(ring, tolerance).map(function (pt, i) {
          var p = project(pt[0], pt[1]);
          return (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1);
        }).join("") + "Z";
      }
      function polygonToPath(coords, tolerance) {
        if (!coords || !coords[0]) return "";
        if (typeof coords[0][0] === "number") return ringToPath(coords, tolerance);
        return coords.map(function (ring) { return ringToPath(ring, tolerance); }).join(" ");
      }
      function eachGeometryRing(geometry, callback) {
        if (!geometry || !geometry.coordinates) return;
        if (geometry.type === "Polygon") {
          geometry.coordinates.forEach(callback);
        } else if (geometry.type === "MultiPolygon") {
          geometry.coordinates.forEach(function (polygon) {
            polygon.forEach(callback);
          });
        }
      }
      function geometryBounds(geometry) {
        var bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        eachGeometryRing(geometry, function (ring) {
          ring.forEach(function (pt) {
            var projected = project(pt[0], pt[1]);
            bounds.minX = Math.min(bounds.minX, projected[0]);
            bounds.minY = Math.min(bounds.minY, projected[1]);
            bounds.maxX = Math.max(bounds.maxX, projected[0]);
            bounds.maxY = Math.max(bounds.maxY, projected[1]);
          });
        });
        return Number.isFinite(bounds.minX) ? bounds : null;
      }
      function boundsIntersect(a, b) {
        return a && b && a.maxX >= b.minX && a.minX <= b.maxX && a.maxY >= b.minY && a.minY <= b.maxY;
      }
      function ringArea(ring) {
        var area = 0;
        for (var i = 0; i < ring.length; i++) {
          var a = ring[i], b = ring[(i + 1) % ring.length];
          area += a[0] * b[1] - b[0] * a[1];
        }
        return Math.abs(area / 2);
      }
      function ringCenter(ring) {
        var lon = 0, lat = 0;
        ring.forEach(function (pt) { lon += pt[0]; lat += pt[1]; });
        return [lon / ring.length, lat / ring.length];
      }
      function focusRings(geometry) {
        if (!geometry || !geometry.coordinates) return [];
        if (geometry.type === "Polygon") return geometry.coordinates[0] ? [geometry.coordinates[0]] : [];
        if (geometry.type !== "MultiPolygon") return [];

        var polygons = geometry.coordinates.filter(function (polygon) {
          return polygon && polygon[0] && polygon[0].length;
        });
        if (!polygons.length) return [];

        var largest = polygons.reduce(function (best, polygon) {
          return ringArea(polygon[0]) > ringArea(best[0]) ? polygon : best;
        });
        var mainCenter = ringCenter(largest[0]);

        // 保留主体附近的岛屿，但忽略会把镜头拉到另一洲的海外领地。
        return polygons.filter(function (polygon) {
          var center = ringCenter(polygon[0]);
          var lonDistance = Math.abs(center[0] - mainCenter[0]);
          lonDistance = Math.min(lonDistance, 360 - lonDistance);
          var latDistance = center[1] - mainCenter[1];
          return Math.sqrt(lonDistance * lonDistance + latDistance * latDistance) <= 10;
        }).map(function (polygon) { return polygon[0]; });
      }

      function cleanMapValue(value) {
        return String(value || "").replace(/\u0000/g, "").trim();
      }
      function getCountryName(feature) {
        var props = feature.properties || {};
        return cleanMapValue(
          props.name || props.NAME || props.NAME_EN || props.ADMIN ||
          props.NAME_LONG || props.SOVEREIGNT || feature.id
        );
      }

      function normalizedCountryWords(value) {
        var ignored = { republic: true, democratic: true, federal: true };
        return cleanMapValue(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
          .split(/\s+/).filter(function (word) { return word && !ignored[word]; });
      }
      function findVisitedCountry(mapName) {
        var normalizedMapName = cleanMapValue(mapName).toLowerCase();
        var exact = entries.find(function (entry) {
          return cleanMapValue(entry.en).toLowerCase() === normalizedMapName;
        });
        if (exact) return exact;

        // China entries use Chinese names only (per-province storage), so match
        // "China" from GeoJSON against the Chinese name directly.
        if (normalizedMapName === "china") {
          var chinaEntry = entries.find(function (entry) { return entry.cn === "中国"; });
          if (chinaEntry) return chinaEntry;
        }

        var mapWords = normalizedCountryWords(mapName);
        var countryMatch = entries.find(function (entry) {
          var entryWords = normalizedCountryWords(entry.en);
          var significantWords = mapWords.filter(function (word) { return word.length > 3; });
          return significantWords.length && significantWords.every(function (word) {
            return entryWords.indexOf(word) !== -1;
          });
        });
        if (countryMatch) return countryMatch;

        // 兼容梵蒂冈这类记录在另一国家文件中的城邦：从城市标题识别，点击时改用城市筛选。
        var nestedMatch = null;
        entries.some(function (entry) {
          return entry.data.cities.some(function (cityTitle) {
            var cityNames = parseCountryHeading(cityTitle);
            var cityWords = normalizedCountryWords(cityNames.en);
            var matches = mapWords.some(function (word) { return word.length > 3; }) &&
              mapWords.every(function (word) { return cityWords.indexOf(word) !== -1; });
            if (!matches) return false;
            nestedMatch = {
              name: cityNames.name,
              cn: cityNames.cn,
              en: cityNames.en,
              data: { count: 1, continent: entry.data.continent, cities: [] }
            };
            mapSearchTargets[cityNames.cn] = { scope: "title", value: cityTitle };
            return true;
          });
        });
        return nestedMatch;
      }

      var svgInner = "";
      var countryFeatures = [];
      var initialPathTolerance = window.innerWidth <= 640 ? 0.26 : 0.14;
      var focusBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      geojson.features.forEach(function (f, idx) {
        var name = getCountryName(f);
        var visitedEntry = findVisitedCountry(name);
        var displayName = visitedEntry ? visitedEntry.cn : name;
        var isVisited = visitedEntry || defaultHighlighted[displayName];
        var d = "";
        if (f.geometry) {
          if (f.geometry.type === "Polygon") d = polygonToPath(f.geometry.coordinates, initialPathTolerance);
          else if (f.geometry.type === "MultiPolygon") d = f.geometry.coordinates.map(function (polygon) {
            return polygonToPath(polygon, initialPathTolerance);
          }).join(" ");
        }
        if (isVisited) {
          focusRings(f.geometry).forEach(function (ring) {
            ring.forEach(function (pt) {
              var projected = project(pt[0], pt[1]);
              focusBounds.minX = Math.min(focusBounds.minX, projected[0]);
              focusBounds.minY = Math.min(focusBounds.minY, projected[1]);
              focusBounds.maxX = Math.max(focusBounds.maxX, projected[0]);
              focusBounds.maxY = Math.max(focusBounds.maxY, projected[1]);
            });
          });
        }
        var bounds = geometryBounds(f.geometry);
        var cls = isVisited ? "travel-worldmap__country travel-worldmap__country--visited" : "travel-worldmap__country";
        var title = visitedEntry ? displayName + " [" + getMapCount(visitedEntry) + "]" : displayName;
        countryFeatures.push({
          feature: f,
          bounds: bounds,
          name: displayName,
          entry: visitedEntry,
          isVisited: !!isVisited,
          pathTolerance: initialPathTolerance,
          path: null,
          marker: null
        });
        svgInner += '<path d="' + d + '" class="' + cls + '" data-map-index="' + idx + '"><title>' + title + '</title></path>';
      });
      countryFeatures.forEach(function (item, idx) {
        if (!item.bounds) return;
        var centerX = (item.bounds.minX + item.bounds.maxX) / 2;
        var centerY = (item.bounds.minY + item.bounds.maxY) / 2;
        var markerCls = item.isVisited
          ? "travel-worldmap__marker travel-worldmap__marker--visited"
          : "travel-worldmap__marker";
        svgInner += '<circle cx="' + centerX.toFixed(1) + '" cy="' + centerY.toFixed(1) +
          '" r="1" class="' + markerCls + '" data-map-index="' + idx + '" style="display:none"></circle>';
      });

      MAP_EL.innerHTML = "";
      var layout = document.createElement("div");
      layout.className = "travel-map-layout";

      var viewport = document.createElement("div");
      viewport.className = "travel-map-viewport";
      viewport.style.touchAction = "pan-y";
      var canvas = document.createElement("div");
      canvas.className = "travel-map-canvas";
      canvas.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" style="width:' + width + 'px;height:' + height + 'px;max-width:none;display:block;shape-rendering:geometricPrecision">' + svgInner + '</svg>';
      viewport.appendChild(canvas);
      canvas.querySelectorAll(".travel-worldmap__country").forEach(function (path) {
        var featureRef = countryFeatures[Number(path.getAttribute("data-map-index"))];
        if (featureRef) featureRef.path = path;
        var titleEl = path.querySelector("title");
        var country = featureRef ? featureRef.name : (titleEl ? titleEl.textContent.split(" [")[0] : "");
        var entry = featureRef ? featureRef.entry : visitedSet[country];
        if (titleEl) titleEl.remove();
        path.setAttribute("aria-label", entry
          ? country + " [" + getMapCount(entry) + "]: " + getMapPlaces(entry).join(", ")
          : country);
        path.addEventListener("mouseenter", function (e) { showMapTooltip(country, entry, e); });
        path.addEventListener("mousemove", moveMapTooltip);
        path.addEventListener("mouseleave", hideMapTooltip);
      });
      canvas.querySelectorAll(".travel-worldmap__marker").forEach(function (marker) {
        var featureRef = countryFeatures[Number(marker.getAttribute("data-map-index"))];
        if (!featureRef) return;
        featureRef.marker = marker;
        var country = featureRef.name;
        var entry = featureRef.entry;
        marker.setAttribute("aria-label", entry
          ? country + " [" + getMapCount(entry) + "]: " + getMapPlaces(entry).join(", ")
          : country);
        marker.addEventListener("mouseenter", function (e) { showMapTooltip(country, entry, e); });
        marker.addEventListener("mousemove", moveMapTooltip);
        marker.addEventListener("mouseleave", hideMapTooltip);
      });

      var resetZoomBtn = document.createElement("button");
      resetZoomBtn.type = "button";
      resetZoomBtn.className = "travel-map-reset";
      resetZoomBtn.setAttribute("aria-label", "重置地图视野");
      resetZoomBtn.title = "重置地图视野";
      resetZoomBtn.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v6h6"/><path d="M5.6 10a8 8 0 1 1 1.9 7.5"/></svg>';
      resetZoomBtn.hidden = true;
      viewport.appendChild(resetZoomBtn);
      layout.appendChild(viewport);

      // pan / zoom 状态声明在 renderWorldMap 作用域，供 rAF 与事件处理函数共享
      var panX = 0, panY = 0, zoom = 1, defaultZoom = 1;
      var defaultPanX = 0, defaultPanY = 0;
      var mapAnimationFrame = null, initialAnimationRunning = false;
      var visibleMapFrame = null;

      function scheduleVisibleMapUpdate() {
        if (visibleMapFrame) return;
        visibleMapFrame = requestAnimationFrame(function () {
          visibleMapFrame = null;
          updateVisibleMap();
        });
      }
      function updateVisibleMap() {
        var vWidth = viewport.clientWidth || 400;
        var vHeight = viewport.clientHeight || 280;
        var relativeZoom = zoom / Math.max(defaultZoom, 0.01);
        // 小视口更早用点替代难以辨认的小国；大视口则尽量保留真实轮廓。
        var tinyCountryPixels = Math.max(5, Math.min(9, 10.5 - vWidth / 240));
        var showTinyCountryMarkers = relativeZoom >= 1.6;
        var basePathTolerance = vWidth <= 640 ? 0.26 : 0.14;
        // 极高倍率下仍保留较积极的下采样，避免拖动时反复绘制海岸线细碎节点。
        var margin = 96 / zoom;
        var visibleBounds = {
          minX: (-panX / zoom) - margin,
          minY: (-panY / zoom) - margin,
          maxX: ((vWidth - panX) / zoom) + margin,
          maxY: ((vHeight - panY) / zoom) + margin
        };
        countryFeatures.forEach(function (item, idx) {
          var isVisible = boundsIntersect(item.bounds, visibleBounds);
          if (item.path) item.path.style.display = isVisible ? "" : "none";
          var screenWidth = item.bounds ? (item.bounds.maxX - item.bounds.minX) * zoom : Infinity;
          var screenHeight = item.bounds ? (item.bounds.maxY - item.bounds.minY) * zoom : Infinity;
          var screenSpan = Math.max(screenWidth, screenHeight);
          var sizeFactor = screenSpan < 24 ? 3 : (screenSpan < 64 ? 1.8 : 1);
          // 按最终显示尺寸采样：轮廓越小简化越强，放大后则恢复更多细节。
          var sizeFactor = screenSpan < 24 ? 3 : (screenSpan < 64 ? 1.8 : 1);
          var detailFactor = Math.max(0.38, 1 / Math.sqrt(Math.max(1, relativeZoom)));
          var pathTolerance = Number((basePathTolerance * sizeFactor * detailFactor).toFixed(3));
          if (isVisible && item.path && item.pathTolerance !== pathTolerance) {
            var geometry = item.feature.geometry;
            var nextPath = "";
            if (geometry && geometry.type === "Polygon") {
              nextPath = polygonToPath(geometry.coordinates, pathTolerance);
            } else if (geometry && geometry.type === "MultiPolygon") {
              nextPath = geometry.coordinates.map(function (polygon) {
                return polygonToPath(polygon, pathTolerance);
              }).join(" ");
            }
            item.path.setAttribute("d", nextPath);
            item.pathTolerance = pathTolerance;
          }
          if (item.marker) {
            var useMarker = isVisible && showTinyCountryMarkers &&
              Math.max(screenWidth, screenHeight) < tinyCountryPixels;
            item.marker.style.display = useMarker ? "" : "none";
            if (useMarker) item.marker.setAttribute("r", (5 / zoom).toFixed(2));
          }
        });
      }

      function clampPan() {
        var vWidth = viewport.clientWidth || 400;
        var vHeight = viewport.clientHeight || 280;
        var contentW = width * zoom, contentH = height * zoom;
        if (contentW <= vWidth) panX = (vWidth - contentW) / 2;
        else panX = Math.max(vWidth - contentW, Math.min(0, panX));
        if (contentH <= vHeight) panY = (vHeight - contentH) / 2;
        else panY = Math.max(vHeight - contentH, Math.min(0, panY));
      }
      function applyTransform(hideReset) {
        clampPan();
        canvas.style.transform = "translate(" + panX + "px," + panY + "px) scale(" + zoom + ")";
        var changed = Math.abs(zoom - defaultZoom) > 0.02 ||
          Math.abs(panX - defaultPanX) > 2 || Math.abs(panY - defaultPanY) > 2;
        resetZoomBtn.hidden = !!hideReset || !changed;
        // 拖动时只移动已经渲染好的图层，避免每帧遍历和改写所有国家路径。
        if (!dragging) scheduleVisibleMapUpdate();
      }

      function getVisitedFitState() {
        var vWidth = viewport.clientWidth || 400;
        var vHeight = viewport.clientHeight || 280;
        var hasFocus = Number.isFinite(focusBounds.minX);
        var bboxW = hasFocus ? focusBounds.maxX - focusBounds.minX : width;
        var bboxH = hasFocus ? focusBounds.maxY - focusBounds.minY : height;
        var centerX = hasFocus ? (focusBounds.minX + focusBounds.maxX) / 2 : width / 2;
        var centerY = hasFocus ? (focusBounds.minY + focusBounds.maxY) / 2 : height / 2;
        var padding = Math.min(32, Math.max(18, vWidth * 0.045));
        var availableW = Math.max(1, vWidth - padding * 2);
        var availableH = Math.max(1, vHeight - padding * 2);

        var fitZoom = Math.max(0.5, Math.min(Math.min(availableW / bboxW, availableH / bboxH), 5));
        return {
          zoom: fitZoom,
          panX: vWidth / 2 - centerX * fitZoom,
          panY: vHeight / 2 - centerY * fitZoom,
          centerX: centerX,
          centerY: centerY
        };
      }
      function stopMapAnimation() {
        if (mapAnimationFrame) cancelAnimationFrame(mapAnimationFrame);
        mapAnimationFrame = null;
        initialAnimationRunning = false;
      }
      function fitVisitedCountries() {
        stopMapAnimation();
        var state = getVisitedFitState();
        zoom = state.zoom;
        panX = state.panX;
        panY = state.panY;
        clampPan();
        defaultZoom = zoom;
        defaultPanX = panX;
        defaultPanY = panY;
        state.panX = panX;
        state.panY = panY;
        applyTransform(true);
        return state;
     }
      // Country ISO-3166-1 alpha-2 → [longitude, latitude] approximate center.
      var COUNTRY_CENTERS = {
        "CN": [104.1954, 35.8617], "GB": [-3.4360, 55.3781],
        "US": [-95.7129, 37.0902], "FR": [2.2137, 46.6034],
        "DE": [10.4515, 51.1657],  "IT": [12.5674, 41.8719],
        "ES": [-3.7492, 40.4637],  "NL": [5.2913, 52.1326],
        "BE": [4.4699, 50.5039],   "AT": [14.5501, 47.5162],
        "GR": [22.9634, 39.0742],  "HU": [19.5033, 47.1625],
        "NO": [8.4689, 60.4720],   "SE": [14.4336, 59.2447],
        "VA": [12.4534, 41.9029],  "SM": [12.4478, 43.9424],
        "LU": [6.1296, 49.8153],   "CZ": [15.4729, 49.8175],
        "DK": [9.5018, 56.2639],   "IE": [-8.2439, 53.4129],
        "PL": [19.1451, 51.9194],  "PT": [-8.2245, 39.3999],
        "HR": [15.2000, 45.1000],  "SI": [14.9955, 46.1512],
        "SK": [19.6990, 48.6690],  "LT": [23.8813, 55.1694],
        "LV": [24.6032, 56.8796],  "EE": [25.0136, 58.5953],
        "BG": [25.4858, 42.7339],  "RO": [24.9668, 45.9432],
        "BA": [17.6799, 43.9159],  "RS": [21.0059, 44.0165],
        "JP": [138.2529, 36.2048], "KR": [127.7669, 35.9078],
        "SG": [103.8198, 1.3521],  "AU": [133.7751, -25.2744],
        "NZ": [174.8860, -40.9006], "CH": [8.2275, 46.8182],
      };
      function getGeoPoint(callback) {
        // Step 1: Cloudflare Pages geo (only available in production via CF).
        var isLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "0.0.0.0";
        if (isLocalhost) { callback(null); return; }
        fetch("/geo").then(function (r) { return r.json(); }).then(function (data) {
          if (data.latitude != null && data.longitude != null) {
            callback(project(data.longitude, data.latitude));
            return;
          }
          if (data.country) {
            var center = COUNTRY_CENTERS[data.country];
            if (center) { callback(project(center[0], center[1])); return; }
          }
          // Step 2: Fallback to browser geolocation (only if already granted).
          if (!navigator.permissions || !navigator.geolocation) { callback(null); return; }
          navigator.permissions.query({ name: "geolocation" }).then(function (permission) {
            if (permission.state !== "granted") { callback(null); return; }
            navigator.geolocation.getCurrentPosition(function (position) {
              callback(project(position.coords.longitude, position.coords.latitude));
            }, function () { callback(null); }, { maximumAge: 300000, timeout: 900 });
          }).catch(function () { callback(null); });
        }).catch(function () { callback(null); });
      }
      function animateInitialMap(finalState, clientPoint) {
        var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduceMotion) { applyTransform(true); return; }
        var vWidth = viewport.clientWidth || 400;
        var vHeight = viewport.clientHeight || 280;
        var focus = clientPoint || [finalState.centerX, finalState.centerY];
        var startZoom = Math.min(8, Math.max(finalState.zoom * 3.2, finalState.zoom + 1.4));
        var startPanX = vWidth / 2 - focus[0] * startZoom;
        var startPanY = vHeight / 2 - focus[1] * startZoom;
        var duration = 1050;
        var startedAt = performance.now();
        zoom = startZoom;
        panX = startPanX;
        panY = startPanY;
        initialAnimationRunning = true;
        applyTransform(true);

        function step(now) {
          var progress = Math.min(1, (now - startedAt) / duration);
          var eased = 1 - Math.pow(1 - progress, 3);
          zoom = startZoom + (finalState.zoom - startZoom) * eased;
          panX = startPanX + (finalState.panX - startPanX) * eased;
          panY = startPanY + (finalState.panY - startPanY) * eased;
          applyTransform(true);
          if (progress < 1) mapAnimationFrame = requestAnimationFrame(step);
          else {
            mapAnimationFrame = null;
            initialAnimationRunning = false;
            zoom = defaultZoom;
            panX = defaultPanX;
            panY = defaultPanY;
            applyTransform(true);
          }
        }
        mapAnimationFrame = requestAnimationFrame(step);
      }

      requestAnimationFrame(function () {
        var isMobile = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
        var ratio = isMobile ? 0.44 : 0.42;
        var minHeight = isMobile ? 170 : 220;
        var maxHeight = isMobile ? 260 : 360;
        var vpHeight = Math.max(minHeight, Math.min(maxHeight, (viewport.clientWidth || 400) * ratio));
        viewport.style.height = vpHeight + "px";
        var finalState = fitVisitedCountries();
        getGeoPoint(function (clientPoint) {
          if (!initialAnimationRunning && zoom === defaultZoom &&
              panX === defaultPanX && panY === defaultPanY) {
            animateInitialMap(finalState, clientPoint);
          }
        });
      });

      var resizeTimer;
      window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fitVisitedCountries, 100);
      });

      var dragging = false, activePointerId = null, dsX = 0, dsY = 0, dragStartX = 0, dragStartY = 0;
      var didDrag = false, suppressCountryClick = false;
      var clickDragThreshold = 4;
      function countryFromPoint(clientX, clientY) {
        var clicked = document.elementFromPoint(clientX, clientY);
        var path = clicked && clicked.closest && clicked.closest(
          ".travel-worldmap__country--visited, .travel-worldmap__marker--visited"
        );
        if (!path || !viewport.contains(path)) return "";
        return path.getAttribute("aria-label").split(" [")[0];
      }
      viewport.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        stopMapAnimation();
        dragging = true; didDrag = false; suppressCountryClick = false;
        activePointerId = e.pointerId;
        if (!countryFromPoint(e.clientX, e.clientY)) {
          viewport.setPointerCapture(activePointerId);
        }
        dragStartX = e.clientX; dragStartY = e.clientY;
        dsX = e.clientX - panX; dsY = e.clientY - panY;
        canvas.querySelector("svg").style.shapeRendering = "optimizeSpeed";
        if (e.pointerType === "mouse") e.preventDefault();
      });
      viewport.addEventListener("pointermove", function (e) {
        if (!dragging || e.pointerId !== activePointerId) return;
        if (!didDrag) {
          var dx = e.clientX - dragStartX;
          var dy = e.clientY - dragStartY;
          didDrag = dx * dx + dy * dy > clickDragThreshold * clickDragThreshold;
        }
        panX = e.clientX - dsX; panY = e.clientY - dsY; applyTransform();
      });
      function endPointerDrag(e) {
        if (!dragging || (e && e.pointerId !== activePointerId)) return;
        if (e && !didDrag) {
          var tappedCountry = countryFromPoint(e.clientX, e.clientY);
          if (tappedCountry) {
            suppressCountryClick = true;
            setTimeout(function () { suppressCountryClick = false; }, 0);
            applyCountrySearch(tappedCountry);
          }
        }
        if (dragging && didDrag) {
          suppressCountryClick = true;
          setTimeout(function () { suppressCountryClick = false; }, 0);
        }
        if (activePointerId !== null) {
          try { viewport.releasePointerCapture(activePointerId); } catch (ignore) {}
        }
        dragging = false; activePointerId = null;
        canvas.querySelector("svg").style.shapeRendering = "geometricPrecision";
        scheduleVisibleMapUpdate();
      }
      viewport.addEventListener("pointerup", endPointerDrag);
      viewport.addEventListener("pointercancel", endPointerDrag);
      viewport.addEventListener("wheel", function (e) {
        e.preventDefault();
        stopMapAnimation();
        var rect = viewport.getBoundingClientRect();
        var mx = e.clientX - rect.left, my = e.clientY - rect.top;
        var oldZoom = zoom;
        zoom = Math.max(0.5, Math.min(8, zoom - e.deltaY * 0.0015));
        var ratio = zoom / oldZoom;
        panX = mx - (mx - panX) * ratio; panY = my - (my - panY) * ratio;
        applyTransform();
      }, { passive: false });
      resetZoomBtn.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      resetZoomBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        stopMapAnimation();
        zoom = defaultZoom;
        panX = defaultPanX;
        panY = defaultPanY;
        applyTransform(true);
      });

      canvas.querySelectorAll(".travel-worldmap__country--visited, .travel-worldmap__marker--visited").forEach(function (path) {
        path.style.cursor = "pointer";
        path.addEventListener("click", function (e) {
          if (suppressCountryClick) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          var country = path.getAttribute("aria-label").split(" [")[0];
          if (!country) return;
          e.preventDefault();
          e.stopPropagation();
          applyCountrySearch(country);
        });
      });
      viewport.addEventListener("click", function (e) {
        if (suppressCountryClick) return;
        var country = countryFromPoint(e.clientX, e.clientY);
        applyCountrySearch(country);
      });

      layout.appendChild(renderBubbleCloud(entries, maxPlaces, 400, 350));
      MAP_EL.appendChild(layout);
      hideTravelPageLoading();
    }

    function renderBubbleAndBlocks() {
      var layout = document.createElement("div");
      layout.className = "travel-map-layout";
      layout.appendChild(renderBubbleCloud(entries, maxPlaces, 400, 350));
      var hint = document.createElement("p");
      hint.className = "travel-map-hint";
      hint.textContent = "下载 world.geojson 到 assets/data/ 可启用世界地图";
      layout.appendChild(hint);
      MAP_EL.appendChild(layout);
      hideTravelPageLoading();
    }

    function renderBubbleCloud(entriesArr, maxC, chartW, chartH) {
      var viewport = document.createElement("div");
      viewport.className = "travel-bubble-cloud";
      viewport.style.height = chartH + "px";
      viewport.style.touchAction = "pan-y";

      var packedBubbles = window.BubblePack.pack(entriesArr.map(function (e) {
        return { entry: e, radius: Math.round(22 + (getMapCount(e) / maxC) * 22) };
      }), chartW, chartH, 2);
      var bubbleData = packedBubbles.items;
      var placeW = packedBubbles.width;
      var placeH = packedBubbles.height;

      var canvas = document.createElement("div");
      canvas.className = "travel-bubble-canvas";
      canvas.style.width = placeW + "px";
      canvas.style.height = placeH + "px";

      var allBubbles = [];
      var activeRepulsionBubble = null;
      bubbleData.forEach(function (b) {
        var el = document.createElement("button");
        el.type = "button";
        el.className = "travel-bubble";
        el.style.width = (b.radius * 2) + "px";
        el.style.height = (b.radius * 2) + "px";
        el.style.left = (b.x - b.radius) + "px";
        el.style.top = (b.y - b.radius) + "px";
        el.style.fontSize = Math.max(8, Math.round(8 + (b.radius / 44) * 5)) + "px";
        el.textContent = b.entry.cn + " [" + getMapCount(b.entry) + "]";
        el.setAttribute("aria-label", b.entry.cn + " [" + getMapCount(b.entry) + "]: " + getMapPlaces(b.entry).join(", "));
        el.addEventListener("mouseenter", function (e) { showMapTooltip(b.entry.cn, b.entry, e); });
        el.addEventListener("mousemove", moveMapTooltip);
        el.addEventListener("mouseleave", hideMapTooltip);
        el.addEventListener("click", function () {
          if (didDrag) return;
          applyCountrySearch(b.entry.cn);
        });
        canvas.appendChild(el);
        allBubbles.push(el);
      });

      viewport.appendChild(canvas);

      var panX = 0, panY = 0, zoom = 1, defaultZoom = 1, minZoom = 1, maxZoom = 1, zoomEnabled = true;
      function clampPan() {
        var vW = viewport.clientWidth || 400;
        var vH = viewport.clientHeight || 280;
        var cW = placeW * zoom, cH = placeH * zoom;
        if (cW <= vW) panX = (vW - cW) / 2;
        else panX = Math.max(vW - cW, Math.min(0, panX));
        if (cH <= vH) panY = (vH - cH) / 2;
        else panY = Math.max(vH - cH, Math.min(0, panY));
      }
      function applyTransform() {
        zoom = Math.max(minZoom, Math.min(maxZoom, zoom));
        clampPan();
        canvas.style.transform = "translate(" + panX + "px," + panY + "px) scale(" + zoom + ")";
      }
      function fitBubbles() {
        var isMobile = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
        if (isMobile) {
          viewport.style.height = Math.max(220, Math.min(280, (viewport.clientWidth || 320) * 0.88)) + "px";
        } else {
          viewport.style.height = chartH + "px";
        }
        var vW = viewport.clientWidth || 400;
        var vH = viewport.clientHeight || 280;
        var availW = Math.max(1, vW);
        var availH = Math.max(1, vH);
        var naturalFits = placeW <= availW && placeH <= availH;
        var fitZoom = Math.min(availW / placeW, availH / placeH);
        zoomEnabled = !naturalFits;
        minZoom = naturalFits ? 1 : Math.min(fitZoom, 1);
        maxZoom = naturalFits ? 1 : minZoom * 2;
        zoom = minZoom;
        defaultZoom = zoom;
        panX = vW / 2 - placeW / 2 * zoom;
        panY = vH / 2 - placeH / 2 * zoom;
        applyTransform();
      }

      var dragging = false, activePointerId = null, dsX = 0, dsY = 0, dragStartX = 0, dragStartY = 0, didDrag = false;
      
      viewport.addEventListener("pointerdown", function (e) {
        if (!zoomEnabled) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        dragging = true; didDrag = false;
        activePointerId = e.pointerId;
        if (!e.target.closest(".travel-bubble")) {
          viewport.setPointerCapture(activePointerId);
        }
        dragStartX = e.clientX; dragStartY = e.clientY;
        dsX = e.clientX - panX; dsY = e.clientY - panY;
        if (e.pointerType === "mouse") e.preventDefault();
      });
      viewport.addEventListener("pointermove", function (e) {
        if (!dragging || e.pointerId !== activePointerId) return;
        var dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
        didDrag = didDrag || dx * dx + dy * dy > 4 * 4;
        panX = e.clientX - dsX; panY = e.clientY - dsY; applyTransform();
      });
      function endBubblePointerDrag(e) {
        if (!dragging || (e && e.pointerId !== activePointerId)) return;
        if (activePointerId !== null) {
          try { viewport.releasePointerCapture(activePointerId); } catch (ignore) {}
        }
        dragging = false; activePointerId = null;
      }
      viewport.addEventListener("pointerup", endBubblePointerDrag);
      viewport.addEventListener("pointercancel", endBubblePointerDrag);

      viewport.addEventListener("wheel", function (e) {
        e.stopPropagation();
        if (e.ctrlKey) e.preventDefault();
      }, { passive: false });

      canvas.addEventListener("mousemove", function (e) {
        if (dragging) return;
        var hoveredBubble = e.target.closest(".travel-bubble");
        if (hoveredBubble) activeRepulsionBubble = hoveredBubble;
        if (activeRepulsionBubble && !activeRepulsionBubble.isConnected) activeRepulsionBubble = null;
        var canvasScale = canvas.offsetWidth ? canvas.getBoundingClientRect().width / canvas.offsetWidth : 1;
        var sourceRect = activeRepulsionBubble && activeRepulsionBubble.getBoundingClientRect();
        if (sourceRect && !hoveredBubble) {
          var sourcePointerDistance = Math.hypot(
            e.clientX - (sourceRect.left + sourceRect.width / 2),
            e.clientY - (sourceRect.top + sourceRect.height / 2)
          );
          if (sourcePointerDistance > Math.max(90, sourceRect.width * 1.2)) {
            activeRepulsionBubble = null;
            sourceRect = null;
          }
        }
        var sourceRadius = sourceRect ? sourceRect.width / 2 : 0;
        var sourceCenterX = sourceRect ? sourceRect.left + sourceRect.width / 2 : e.clientX;
        var sourceCenterY = sourceRect ? sourceRect.top + sourceRect.height / 2 : e.clientY;
        var sourcePointerX = sourceCenterX - e.clientX;
        var sourcePointerY = sourceCenterY - e.clientY;
        var sourceDistance = Math.hypot(sourcePointerX, sourcePointerY);
        var sourceDirectionX = sourceDistance > 0.1 ? -sourcePointerX / sourceDistance : 0;
        var sourceDirectionY = sourceDistance > 0.1 ? -sourcePointerY / sourceDistance : 1;
        var sourceInfluence = Math.max(92, sourceRadius + 48);
        var sourceMaxPush = Math.max(3, Math.min(7, sourceRadius * 0.15));
        var sourcePush = sourceRadius && sourceDistance < sourceInfluence
          ? (1 - sourceDistance / sourceInfluence) * sourceMaxPush
          : 0;
        var projectedSourceX = sourceCenterX + sourceDirectionX * sourcePush;
        var projectedSourceY = sourceCenterY + sourceDirectionY * sourcePush;
        allBubbles.forEach(function (el) {
          var r = el.getBoundingClientRect();
          var centerX = r.left + r.width / 2, centerY = r.top + r.height / 2;
          var radius = r.width / 2;
          if (el === activeRepulsionBubble) {
            el.style.transform = "translate(" + (sourceDirectionX * sourcePush / Math.max(canvasScale, 0.01)) + "px," + (sourceDirectionY * sourcePush / Math.max(canvasScale, 0.01)) + "px)";
            return;
          }
          if (!sourceRadius) {
            var pointerX = e.clientX - centerX, pointerY = e.clientY - centerY;
            var pointerDistance = Math.hypot(pointerX, pointerY);
            var pointerInfluence = Math.max(80, radius + 36);
            if (pointerDistance < pointerInfluence && pointerDistance > 0.1) {
              var pointerForce = (1 - pointerDistance / pointerInfluence) * 6 / Math.max(canvasScale, 0.01);
              el.style.transform = "translate(" + (-pointerX / pointerDistance * pointerForce) + "px," + (-pointerY / pointerDistance * pointerForce) + "px)";
            } else { el.style.transform = ""; }
            return;
          }
          var sourceToTargetX = centerX - sourceCenterX;
          var sourceToTargetY = centerY - sourceCenterY;
          var sourceToTargetDistance = Math.hypot(sourceToTargetX, sourceToTargetY);
          var influenceRadius = sourceRadius + radius + Math.max(72, sourceRadius * 1.35);
          if (sourceToTargetDistance < influenceRadius && sourceToTargetDistance > 0.1) {
            var targetDirectionX = sourceToTargetX / sourceToTargetDistance;
            var targetDirectionY = sourceToTargetY / sourceToTargetDistance;
            var alignment = Math.max(0, targetDirectionX * sourceDirectionX + targetDirectionY * sourceDirectionY);
            var directionalWeight = 0.12 + 0.88 * alignment * alignment;
            var maxPush = Math.max(6, Math.min(12, (sourceRadius + radius) * 0.1));
            var directionalPush = (1 - sourceToTargetDistance / influenceRadius) * maxPush * directionalWeight;
            var projectedX = centerX - projectedSourceX;
            var projectedY = centerY - projectedSourceY;
            var projectedDistance = Math.hypot(projectedX, projectedY);
            var overlapPush = Math.max(0, sourceRadius + radius + 2 - projectedDistance);
            var force = Math.max(directionalPush, overlapPush) / Math.max(canvasScale, 0.01);
            var pushDirectionX = projectedDistance > 0.1 ? projectedX / projectedDistance : targetDirectionX;
            var pushDirectionY = projectedDistance > 0.1 ? projectedY / projectedDistance : targetDirectionY;
            el.style.transform = "translate(" + (pushDirectionX * force) + "px," + (pushDirectionY * force) + "px)";
          } else { el.style.transform = ""; }
        });
      });
      canvas.addEventListener("mouseleave", function () { activeRepulsionBubble = null; allBubbles.forEach(function (el) { el.style.transform = ""; }); });

      requestAnimationFrame(function () { fitBubbles(); });
      var resizeTimer;
      window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(fitBubbles, 100);
      });

      return viewport;
    }

    tryFetchMap(0);
  };
  // travels-map.js (defer) 在 travels.js 之后执行，确保 init() 已完成
  function scheduleTravelMap() {
    var map = document.getElementById("travel-map-container");
    if (!map) return;

    if (!("IntersectionObserver" in window)) {
      window.renderTravelMap();
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
      observer.disconnect();
      window.renderTravelMap();
    }, { rootMargin: "240px 0px" });
    observer.observe(map);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleTravelMap);
  } else {
    scheduleTravelMap();
  }
})();

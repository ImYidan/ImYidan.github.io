// ─────────────────────────────────────────────────────────────
//   travels-map.js -- World map + bubble cloud for travels page
//   Injected via window.renderTravelMap, depends on TravelsNS
//   exposed by travels.js.
// ─────────────────────────────────────────────────────────────// ════════════════════════════════════════════════════════════

(function () {
  "use strict";

  window.renderTravelMap = function () {
    var NS = window.TravelsNS;
    if (!NS || !NS.MAP_EL) return;
    var parseCards = NS.parseCards;
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
      if (NS.setSearchScopes) NS.setSearchScopes([target ? target.scope : "country"]);
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

    var allCards = parseCards();
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
    }).sort(function (a, b) { return b.data.count - a.data.count; });

    var maxCities = entries.length ? entries[0].data.count : 1;
    var visitedSet = {};
    entries.forEach(function (e) { visitedSet[e.cn] = e; });
    var defaultHighlighted = {};

    MAP_EL.innerHTML = "";

    var mapUrls = [
      "/assets/data/world.geojson",
      "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json"
    ];

    function hideTravelPageLoading() {
      var el = document.getElementById("page-loading");
      if (el) {
        el.classList.add("page-loading--hidden");
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

        // Keep islands near the mainland, but ignore overseas territories that would drag the camera to another continent.
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

        // Handle city-states like Vatican recorded in another country file: identify by city title, filter by city on click.
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
            mapSearchTargets[cityNames.cn] = { scope: "city", value: cityTitle };
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
      resetZoomBtn.setAttribute("aria-label", "Reset map view");
      resetZoomBtn.title = "Reset map view";
      resetZoomBtn.textContent = "↺";
      resetZoomBtn.hidden = true;
      viewport.appendChild(resetZoomBtn);
      layout.appendChild(viewport);

      // pan / zoom state lives in the renderWorldMap scope, shared by rAF and event handlers.
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
        // Small viewports switch to dots earlier for tiny countries; large viewports keep real outlines longer.
        var tinyCountryPixels = Math.max(5, Math.min(9, 10.5 - vWidth / 240));
        var showTinyCountryMarkers = relativeZoom >= 1.6;
        var basePathTolerance = vWidth <= 640 ? 0.26 : 0.14;
        // Even at very high zoom, keep aggressive downsampling to avoid redrawing coastlines on every drag frame.
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
          // Sample by final display size: smaller outlines get more simplification, larger ones restore more detail.
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
        // During drag, only translate the pre-rendered layer instead of re-traversing all country paths per frame.
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
        // Step 1: Cloudflare Pages geo (no permission needed, server-side).
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
      viewport.style.cursor = "grab";
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
        viewport.style.cursor = "grabbing";
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
        dragging = false; activePointerId = null; viewport.style.cursor = "grab";
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

      layout.appendChild(renderBubbleCloud(entries, maxCities, 400, 350));
      MAP_EL.appendChild(layout);
      hideTravelPageLoading();
    }

    function renderBubbleAndBlocks() {
      var layout = document.createElement("div");
      layout.className = "travel-map-layout";
      layout.appendChild(renderBubbleCloud(entries, maxCities, 400, 350));
      var hint = document.createElement("p");
      hint.className = "travel-map-hint";
      hint.textContent = "Download world.geojson into assets/data/ to enable the world map";
      layout.appendChild(hint);
      MAP_EL.appendChild(layout);
      hideTravelPageLoading();
    }

    function renderBubbleCloud(entriesArr, maxC, chartW, chartH) {
      var viewport = document.createElement("div");
      viewport.className = "travel-bubble-cloud";
      viewport.style.height = chartH + "px";
      viewport.style.touchAction = "pan-y";

      // Dynamic placement: grow area until all bubbles fit
      var placeW = chartW, placeH = chartH;
      var bubbleData;
      var attempts = 0;

      while (true) {
        bubbleData = entriesArr.map(function (e) {
          return { entry: e, radius: Math.round(22 + (e.data.count / maxC) * 22), x: 0, y: 0 };
        });
        var cx = placeW / 2, cy = placeH / 2, placed = [];
        var allOk = true;

        for (var bi = 0; bi < bubbleData.length; bi++) {
          var b = bubbleData[bi];
          if (placed.length === 0) { b.x = cx; b.y = cy; placed.push(b); continue; }
          var best = null, bestDist = Infinity;
          var searchMax = Math.max(placeW, placeH) * 1.5;
          for (var angle = 0; angle < Math.PI * 2; angle += 0.08) {
            for (var d = 3; d < searchMax; d += 1.5) {
              var x = cx + Math.cos(angle) * d, y = cy + Math.sin(angle) * d, ok = true;
              for (var i = 0; i < placed.length; i++) {
                var p = placed[i], ddx = x - p.x, ddy = y - p.y, md = b.radius + p.radius + 2;
                if (ddx * ddx + ddy * ddy < md * md) { ok = false; break; }
              }
              if (ok && x - b.radius > 2 && x + b.radius < placeW - 2 && y - b.radius > 2 && y + b.radius < placeH - 2) {
                if (d < bestDist) { bestDist = d; best = { x: x, y: y }; }
              }
            }
          }
          if (!best) { allOk = false; break; }
          b.x = best.x; b.y = best.y;
          placed.push(b);
        }

        if (allOk || attempts > 20) break;
        placeW = Math.round(placeW * 1.4);
        placeH = Math.round(placeH * 1.4);
        attempts++;
      }

      // The packing algorithm centers its search around the canvas, but an
      // irregular cluster can still end up visually off-centre. Re-centre the
      // occupied bubble bounds (rather than the empty canvas around them).
      if (bubbleData.length) {
        var bubbleMinX = Infinity, bubbleMaxX = -Infinity;
        var bubbleMinY = Infinity, bubbleMaxY = -Infinity;
        bubbleData.forEach(function (b) {
          bubbleMinX = Math.min(bubbleMinX, b.x - b.radius);
          bubbleMaxX = Math.max(bubbleMaxX, b.x + b.radius);
          bubbleMinY = Math.min(bubbleMinY, b.y - b.radius);
          bubbleMaxY = Math.max(bubbleMaxY, b.y + b.radius);
        });
        var bubbleShiftX = placeW / 2 - (bubbleMinX + bubbleMaxX) / 2;
        var bubbleShiftY = placeH / 2 - (bubbleMinY + bubbleMaxY) / 2;
        bubbleShiftX = Math.max(2 - bubbleMinX, Math.min(placeW - 2 - bubbleMaxX, bubbleShiftX));
        bubbleShiftY = Math.max(2 - bubbleMinY, Math.min(placeH - 2 - bubbleMaxY, bubbleShiftY));
        bubbleData.forEach(function (b) {
          b.x += bubbleShiftX;
          b.y += bubbleShiftY;
        });
      }

      var canvas = document.createElement("div");
      canvas.className = "travel-bubble-canvas";
      canvas.style.width = placeW + "px";
      canvas.style.height = placeH + "px";

      var allBubbles = [];
      bubbleData.forEach(function (b) {
        var el = document.createElement("button");
        el.type = "button";
        el.className = "travel-bubble";
        el.style.width = (b.radius * 2) + "px";
        el.style.height = (b.radius * 2) + "px";
        el.style.left = (b.x - b.radius) + "px";
        el.style.top = (b.y - b.radius) + "px";
        el.style.fontSize = Math.max(8, Math.round(8 + (b.radius / 44) * 5)) + "px";
        el.textContent = b.entry.cn + " [" + b.entry.data.count + "]";
        el.setAttribute("aria-label", b.entry.cn + " [" + b.entry.data.count + "]: " + b.entry.data.cities.join(", "));
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
        resetBtn.hidden = !zoomEnabled;
        var atTwoX = zoom >= maxZoom * 0.98;
        resetBtn.textContent = atTwoX ? "2x" : "1x";
        resetBtn.setAttribute("aria-label", atTwoX ? "\u5f53\u524d 2x\uff0c\u70b9\u51fb\u7f29\u5c0f\u5230 1x" : "\u5f53\u524d 1x\uff0c\u70b9\u51fb\u653e\u5927\u5230 2x");
        resetBtn.title = atTwoX ? "\u5f53\u524d 2x\uff0c\u70b9\u51fb\u7f29\u5c0f\u5230 1x" : "\u5f53\u524d 1x\uff0c\u70b9\u51fb\u653e\u5927\u5230 2x";
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
        viewport.style.cursor = zoomEnabled ? "grab" : "default";
        applyTransform();
      }

      var dragging = false, activePointerId = null, dsX = 0, dsY = 0, dragStartX = 0, dragStartY = 0, didDrag = false;
      viewport.style.cursor = "grab";
      viewport.addEventListener("pointerdown", function (e) {
        if (!zoomEnabled) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        dragging = true; didDrag = false;
        activePointerId = e.pointerId;
        viewport.setPointerCapture(activePointerId);
        dragStartX = e.clientX; dragStartY = e.clientY;
        dsX = e.clientX - panX; dsY = e.clientY - panY;
        viewport.style.cursor = "grabbing";
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
        dragging = false; activePointerId = null; viewport.style.cursor = zoomEnabled ? "grab" : "default";
      }
      viewport.addEventListener("pointerup", endBubblePointerDrag);
      viewport.addEventListener("pointercancel", endBubblePointerDrag);

      viewport.addEventListener("wheel", function (e) {
        e.stopPropagation();
        if (e.ctrlKey) e.preventDefault();
      }, { passive: false });

      var resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "travel-map-reset travel-map-reset--bubble";
      resetBtn.setAttribute("aria-label", "\u7f29\u56de\u9ed8\u8ba4\u5c3a\u5bf8");
      resetBtn.title = "\u7f29\u56de\u9ed8\u8ba4\u5c3a\u5bf8";
      resetBtn.textContent = "\u2212";
      resetBtn.hidden = true;
      resetBtn.addEventListener("click", function () {
        var vW = viewport.clientWidth || 400, vH = viewport.clientHeight || 280;
        zoom = zoom >= maxZoom * 0.98 ? minZoom : maxZoom;
        panX = vW / 2 - placeW / 2 * zoom;
        panY = vH / 2 - placeH / 2 * zoom;
        applyTransform();
      });
      viewport.appendChild(resetBtn);

      canvas.addEventListener("mousemove", function (e) {
        if (dragging) return;
        allBubbles.forEach(function (el) {
          var r = el.getBoundingClientRect();
          var bx = r.left + r.width / 2, by = r.top + r.height / 2;
          var ddx = e.clientX - bx, ddy = e.clientY - by;
          var dist = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dist < 80 && dist > 0.1) {
            var force = (1 - dist / 80) * 5;
            el.style.transform = "translate(" + (-ddx / dist * force) + "px," + (-ddy / dist * force) + "px)";
          } else { el.style.transform = ""; }
        });
      });
      canvas.addEventListener("mouseleave", function () { allBubbles.forEach(function (el) { el.style.transform = ""; }); });

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
  // travels-map.js (defer) runs after travels.js, ensuring init() has completed.
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

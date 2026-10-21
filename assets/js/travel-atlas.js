(() => {
  'use strict';
  const element = document.querySelector('#atlas-map');
  if (!element) return;
  const el = id => document.getElementById(id);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let world, china, footprints, countries, provinces;
  let mode = 'globe', region = 'world', rotation = [-105, -27, 0], spinning = !reduced.matches;
  let projection, path, zoomFactor = 1, lastFrame = 0, timer, selectedKey = 'China', zoomBehavior;
  const svg = window.d3 ? d3.select(element) : null;
  const width = 820, height = 570;
  let stageVisible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { stageVisible = entries[0].isIntersecting; }).observe(el('atlas-stage'));
  }
  const chinaFC = () => ({ type: 'FeatureCollection', features: china.features.filter(f => f.properties.name) });
  function reverseRingWinding(feature) {
    const normalize = rings => {
      rings.forEach((ring, index) => {
        const area = d3.geoArea({ type: 'Polygon', coordinates: [ring] });
        if ((index === 0 && area > 2 * Math.PI) || (index > 0 && area < 2 * Math.PI)) ring.reverse();
      });
    };
    if (feature.geometry.type === 'Polygon') normalize(feature.geometry.coordinates);
    if (feature.geometry.type === 'MultiPolygon') feature.geometry.coordinates.forEach(normalize);
    return feature;
  }
  function visited(feature) {
    if (region === 'china') return provinces.get(String(feature.properties.adcode));
    if (feature.properties.name === 'Hong Kong') return provinces.get('810000');
    return countries.get(feature.properties.name);
  }
  function placeRows(rows) {
    const parent = el('atlas-places');
    parent.replaceChildren();
    rows.forEach(row => {
      const item = document.createElement('div');
      const title = document.createElement('strong');
      const body = document.createElement('span');
      title.textContent = row.name;
      body.textContent = row.places.length ? row.places.join(' · ') : '已到访';
      item.append(title, body); parent.append(item);
    });
    parent.scrollTop = 0;
  }
  function showCountry(key) {
    const country = countries.get(key);
    if (!country) return;
    selectedKey = key;
    el('atlas-location-en').textContent = country.english;
    el('atlas-location').textContent = country.name;
    el('atlas-location-note').textContent = key === 'China' ? '14 个省级区域，收藏一路的风景。' : '已经走过，值得记住。';
    placeRows(key === 'China' ? footprints.provinces : [{ name: country.name, places: country.places }]);
    el('atlas-drill').hidden = key !== 'China';
    paintSelection();
  }
  function showProvince(code) {
    const province = provinces.get(String(code));
    selectedKey = String(code);
    const feature = china.features.find(f => String(f.properties.adcode) === String(code));
    el('atlas-location-en').textContent = 'CHINA · PROVINCE & REGION';
    el('atlas-location').textContent = province?.name || feature?.properties.name || '中国';
    el('atlas-location-note').textContent = province ? '这片土地，留下过我的足迹。' : '尚未到访，留给未来的旅程。';
    placeRows(province ? [province] : []);
    el('atlas-drill').hidden = true;
    paintSelection();
  }
  function paintSelection() {
    if (!svg) return;
    svg.selectAll('.atlas-land').classed('is-selected', f => (region === 'china' ? String(f.properties.adcode) : f.properties.name) === selectedKey);
  }
  function selectFeature(event, feature) {
    if (event.defaultPrevented) return;
    if (region === 'china') { showProvince(feature.properties.adcode); return; }
    if (feature.properties.name === 'Hong Kong') { setRegion('china'); showProvince('810000'); return; }
    if (countries.has(feature.properties.name)) { showCountry(feature.properties.name); return; }
    selectedKey = feature.properties.name;
    el('atlas-location-en').textContent = 'SOMEWHERE, SOMEDAY';
    el('atlas-location').textContent = feature.properties.name;
    el('atlas-location-note').textContent = '尚未到访，留给未来的旅程。';
    placeRows([]); el('atlas-drill').hidden = true; paintSelection();
  }
  function configureProjection() {
    if (mode === 'globe') {
      projection = d3.geoOrthographic().translate([width / 2, height / 2 - 5]).scale(246 * zoomFactor).rotate(rotation).clipAngle(90).precision(.4);
    } else if (region === 'china') {
      projection = d3.geoMercator().fitExtent([[32, 22], [width - 32, height - 35]], chinaFC());
    } else if (region === 'europe') {
      projection = d3.geoMercator().center([7, 49]).scale(800).translate([width / 2, height / 2]);
    } else if (region === 'middle-east') {
      projection = d3.geoMercator().center([51, 25]).scale(1450).translate([width / 2, height / 2]);
    } else {
      projection = d3.geoNaturalEarth1().fitExtent([[20, 25], [width - 20, height - 25]], { type: 'Sphere' });
    }
    path = d3.geoPath(projection);
  }
  function draw() {
    configureProjection();
    svg.select('.atlas-ocean').attr('d', mode === 'globe' || region === 'world' ? path({ type: 'Sphere' }) : null);
    svg.select('.atlas-graticule').attr('d', path(d3.geoGraticule10()));
    svg.selectAll('.atlas-land').attr('d', path);
    svg.selectAll('.atlas-map-label').attr('transform', datum => {
      const point = projection(datum.point);
      return `translate(${point[0]},${point[1]})`;
    });
  }
  function labels(layer) {
    let items = [];
    if (region === 'china') {
      items = [{ name: '香港', point: [114.17, 22.31], code: '810000' }];
    } else if (region === 'middle-east') {
      items = [{ name: '阿联酋', point: [54.5, 24.4], key: 'United Arab Emirates' }];
    }
    const group = layer.selectAll('.atlas-map-label').data(items).join('g').attr('class', 'atlas-map-label')
      .attr('role', 'button').attr('tabindex', 0).attr('aria-label', d => `查看${d.name}足迹`)
      .on('click', (event, d) => d.code ? showProvince(d.code) : showCountry(d.key))
      .on('keydown', (event, d) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); d.code ? showProvince(d.code) : showCountry(d.key); } });
    group.append('circle').attr('r', 5);
    group.append('path').attr('d', 'M5 0 L23 15 L44 15');
    group.append('text').attr('x', 47).attr('y', 19).text(d => d.name);
  }
  function render() {
    svg.selectAll('*').remove();
    svg.attr('data-mode', mode).attr('tabindex', mode === 'globe' ? 0 : null);
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient').attr('id', 'atlas-visited-gold').attr('x1', '0%').attr('x2', '100%').attr('y1', '0%').attr('y2', '100%');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#dbc28b');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#846a36');
    defs.append('clipPath').attr('id', 'atlas-viewport').append('rect').attr('width', width).attr('height', height);
    const viewport = svg.append('g').attr('clip-path', 'url(#atlas-viewport)');
    const layer = viewport.append('g').attr('class', 'atlas-map-layer');
    layer.append('path').attr('class', 'atlas-ocean');
    layer.append('path').attr('class', 'atlas-graticule');
    const features = region === 'china' ? china.features : world.features;
    const land = layer.selectAll('.atlas-land').data(features).join('path').attr('class', f => `atlas-land${visited(f) ? ' is-visited' : ''}${!f.properties.name ? ' atlas-boundary-lines' : ''}`)
      .attr('role', f => f.properties.name ? 'button' : null).attr('tabindex', f => visited(f) ? 0 : null)
      .attr('aria-label', f => `${visited(f)?.name || f.properties.name || ''}，${visited(f) ? '已到访，点击查看足迹' : '尚未到访'}`)
      .on('click', selectFeature).on('keydown', (event, f) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectFeature(event, f); } });
    land.append('title').text(f => `${visited(f)?.name || f.properties.name || ''}${visited(f) ? ' · 已到访' : ''}`);
    labels(layer);
    svg.on('.zoom', null).on('.drag', null);
    if (mode === 'globe') {
      let origin, start;
      svg.call(d3.drag().on('start', event => { spinning = false; updateRotationButton(); origin = rotation.slice(); start = [event.x, event.y]; })
        .on('drag', event => { rotation = [origin[0] + (event.x - start[0]) * .3, Math.max(-75, Math.min(75, origin[1] - (event.y - start[1]) * .3)), 0]; draw(); }));
    } else {
      zoomBehavior = d3.zoom().extent([[0, 0], [width, height]]).scaleExtent([1, 6]).translateExtent([[-width, -height], [width * 2, height * 2]])
        .on('zoom', event => layer.attr('transform', event.transform));
      svg.call(zoomBehavior).on('dblclick.zoom', null);
    }
    draw(); paintSelection();
    el('atlas-stage').dataset.mode = mode;
    el('atlas-globe').setAttribute('aria-pressed', String(mode === 'globe'));
    el('atlas-flat').setAttribute('aria-pressed', String(mode === 'flat'));
    document.querySelectorAll('[data-region]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.region === region)));
    el('atlas-rotation').hidden = mode !== 'globe';
    el('atlas-hint').textContent = mode === 'globe' ? '拖动旋转 · 点击金色区域查看足迹' : '拖动平移 · 滚轮或按钮缩放 · 点击查看足迹';
    updateRotationButton();
  }
  function updateRotationButton() {
    el('atlas-rotation').textContent = spinning ? 'Ⅱ' : '▷';
    el('atlas-rotation').setAttribute('aria-pressed', String(spinning));
    el('atlas-rotation').setAttribute('aria-label', spinning ? '暂停地球自转' : '开始地球自转');
  }
  function setRegion(next) {
    region = next; mode = next === 'world' ? mode : 'flat'; zoomFactor = 1;
    render();
    if (next === 'china' || next === 'world') showCountry('China');
    if (next === 'europe') showCountry('United Kingdom');
    if (next === 'middle-east') showCountry('United Arab Emirates');
  }
  function zoom(amount) {
    if (mode === 'globe') { zoomFactor = Math.max(.75, Math.min(2, zoomFactor * amount)); draw(); }
    else svg.call(zoomBehavior.scaleBy, amount);
  }
  async function init() {
    el('atlas-error').hidden = true;
    el('atlas-loading').hidden = false;
    try {
      if (!svg) throw new Error('Map library unavailable');
      [world, china, footprints] = await Promise.all(['/assets/data/atlas-world.geojson', '/assets/data/china-provinces.geojson', '/assets/data/travel-footprints.json?v=4'].map(async url => {
        const response = await fetch(url); if (!response.ok) throw new Error('Map data unavailable'); return response.json();
      }));
      world.features.forEach(reverseRingWinding); china.features.forEach(reverseRingWinding);
      countries = new Map(footprints.countries.map(country => [country.key, country]));
      provinces = new Map(footprints.provinces.map(province => [province.code, province]));
      render(); showCountry('China'); el('atlas-loading').hidden = true;
      if (timer) timer.stop();
      timer = d3.timer(elapsed => {
        const dt = elapsed - lastFrame;
        if (dt < 80) return;
        lastFrame = elapsed;
        if (mode !== 'globe' || !spinning || document.hidden || !stageVisible) return;
        rotation[0] += Math.min(dt, 150) * .002;
        draw();
      });
    } catch (error) {
      el('atlas-loading').hidden = true;
      el('atlas-error').hidden = false;
    }
  }
  document.querySelectorAll('[data-region]').forEach(button => button.addEventListener('click', () => { if (world) setRegion(button.dataset.region); }));
  el('atlas-globe').addEventListener('click', () => { if (!world) return; region = 'world'; mode = 'globe'; zoomFactor = 1; render(); });
  el('atlas-flat').addEventListener('click', () => { if (!world) return; mode = 'flat'; zoomFactor = 1; render(); });
  el('atlas-rotation').addEventListener('click', () => { spinning = !spinning; updateRotationButton(); });
  el('atlas-zoom-in').addEventListener('click', () => { if (world) zoom(1.3); });
  el('atlas-zoom-out').addEventListener('click', () => { if (world) zoom(1 / 1.3); });
  el('atlas-reset').addEventListener('click', () => { if (!world) return; rotation = [-105, -27, 0]; zoomFactor = 1; render(); });
  el('atlas-drill').addEventListener('click', () => { if (world) setRegion('china'); });
  el('atlas-retry').addEventListener('click', init);
  element.addEventListener('keydown', event => {
    if (mode !== 'globe' || !projection || event.target !== element) return;
    const delta = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[event.key];
    if (delta) { event.preventDefault(); spinning = false; rotation[0] += delta[0]; rotation[1] = Math.max(-75, Math.min(75, rotation[1] + delta[1])); draw(); updateRotationButton(); }
  });
  reduced.addEventListener('change', () => { if (reduced.matches) { spinning = false; updateRotationButton(); } });
  window.addEventListener('pagehide', () => timer?.stop());
  window.addEventListener('pageshow', event => { if (event.persisted) init(); });
  init();
})();

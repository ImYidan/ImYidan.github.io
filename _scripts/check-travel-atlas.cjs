const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/vendor/d3.min.js'), 'utf8'), context);
const source = fs.readFileSync(path.join(root, 'assets/js/travel-atlas.js'), 'utf8');
const normalize = source.slice(source.indexOf('  function reverseRingWinding'), source.indexOf('  function visited'));
vm.runInContext(normalize, context);
for (const filename of ['atlas-world.geojson', 'china-provinces.geojson']) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data', filename)));
  for (const feature of data.features) {
    context.reverseRingWinding(feature);
    assert(context.d3.geoArea(feature) < 2 * Math.PI, feature.properties.name + ' covers the globe');
    const once = JSON.stringify(feature);
    context.reverseRingWinding(feature);
    assert.equal(JSON.stringify(feature), once, 'Normalization must be stable');
  }
  console.log(filename + ': polygon winding and area passed');
}
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/travel-footprints.json')));
const provinces = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/china-provinces.geojson')));
assert.equal(data.countries.length, 8);
assert.equal(new Set(data.countries.map(c => c.key)).size, 8);
assert.equal(data.provinces.length, 14);
assert.equal(new Set(data.provinces.map(p => p.code)).size, 14);
assert.equal(provinces.features.filter(f => f.properties.name).length, 34);
const codes = new Set(provinces.features.map(f => String(f.properties.adcode)));
data.provinces.forEach(p => assert(codes.has(p.code), 'Missing province boundary ' + p.name));
assert(data.provinces.find(p => p.name === '浙江').places.includes('乌镇'));
assert(data.countries.find(c => c.name === '阿联酋').places.includes('阿布扎比'));
assert(data.countries.find(c => c.name === '比利时').places.includes('布鲁塞尔'));
assert(data.countries.find(c => c.name === '葡萄牙').places.includes('里斯本'));
console.log('8 countries, 14 visited regions, 34 province boundaries and supplied places passed');

assert.deepEqual(data.provinces.slice(0, 3).map(p => p.name), ["江苏", "浙江", "上海"]);
const page = fs.readFileSync(path.join(root, "pages/travels/index.html"), "utf8");
assert(!/<details class="travel-record-group" open>/.test(page), "Regional records must start collapsed");
console.log("Jiangsu, Zhejiang, Shanghai first; regional records closed by default passed");

assert.deepEqual(data.provinces.slice(0, 5).map(p => p.name), ["江苏", "浙江", "上海", "香港", "广东"]);
assert.deepEqual(data.provinces.slice(-3).map(p => p.name), ["黑龙江", "吉林", "辽宁"]);
console.log("Hong Kong and Guangdong follow Jiangsu/Zhejiang/Shanghai; northeast provinces last passed");

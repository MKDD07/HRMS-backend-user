import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Module from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSync } from 'esbuild';

const filename = fileURLToPath(new URL('./MetricOverview.jsx', import.meta.url));
const compiled = buildSync({ entryPoints: [filename], bundle: true, packages: 'external', write: false, format: 'cjs', platform: 'node', loader: { '.scss': 'empty' } });
const loaded = new Module(filename);
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled.outputFiles[0].text, filename);
const { MetricCard, MetricOverview } = loaded.exports;
const render = props => renderToStaticMarkup(React.createElement(MetricCard, { label: 'Pending approvals', value: 0, caption: 'Leave · expenses · attendance', ...props }));

const action = render({ onClick() {}, title: 'Navigate to Pending approvals', 'aria-expanded': true, 'aria-controls': 'details' });
assert.match(action, /^<button/);
assert.match(action, /class="metric-card"/);
assert.doesNotMatch(action, /class="[^"]*btn/);
assert.match(action, /type="button"/);
assert.match(action, /<div class="metric-card-label"><span>Pending approvals<\/span><svg/);
assert.match(action, /<strong aria-busy="false">0<\/strong>/);
assert.match(action, /<p><span>Leave · expenses · attendance<\/span><svg/);
assert.match(action, /aria-expanded="true"/);
assert.match(action, /aria-controls="details"/);
const staticCard = render({});
assert.match(staticCard, /^<div/);
assert.doesNotMatch(staticCard, /type="button"|lucide-arrow-up-right/);
assert.match(render({ value: React.createElement(React.Fragment, null, 3, React.createElement('em', null, ' / 10')) }), /3<em> \/ 10<\/em>/);
assert.match(render({ loading: true }), /aria-busy="true" aria-label="Loading value"/);
const skeleton = renderToStaticMarkup(React.createElement(MetricOverview, { loading: true }, [1, 2, 3].map(key => React.createElement(MetricCard, { key, label: '', value: '', caption: '' }))));
assert.equal((skeleton.match(/metric-card--loading/g) || []).length, 3);
assert.doesNotMatch(skeleton, /<button/);

// Keep every page summary on the shared internal structure.
const pages = fileURLToPath(new URL('../../pages/', import.meta.url));
function walk(directory) { return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]); }
let sections = 0;
for (const file of walk(pages).filter(file => file.endsWith('.jsx'))) {
  const source = readFileSync(file, 'utf8');
  if (!source.includes('MetricOverview')) continue;
  assert.doesNotMatch(source, /className="metric-card"/, `${file} must use MetricCard`);
  assert.match(source, /MetricCard/, `${file} needs the shared summary component`);
  sections++;
}
console.log(`Metric cards passed: shared markup, real actions, read-only state, captions, values, loading, and ${sections} migrated files.`);

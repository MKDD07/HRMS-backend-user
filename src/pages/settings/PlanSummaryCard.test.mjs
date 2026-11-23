import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Module from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const filename = fileURLToPath(new URL('./PlanSummaryCard.jsx', import.meta.url));
const compiled = buildSync({ entryPoints: [filename], bundle: true, packages: 'external', write: false, format: 'cjs', platform: 'node', loader: { '.scss': 'empty' } });
const loaded = new Module(filename);
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled.outputFiles[0].text, filename);
const { PlanSummaryCard } = loaded.exports;
const overview = { capacity: { legacy: true, employee_limit: 50, dashboard_limit: 5 }, usage: { employees: 20, dashboard_users: 2 }, subscription: { plan_id: 'business' } };
const render = props => renderToStaticMarkup(React.createElement(PlanSummaryCard, { overview, ...props }));
const result = render({ onOpen() { throw new Error('Rendering must not invoke navigation'); } });
assert.match(result, /class="card billing-summary card--blue"/);
assert.match(result, /View plans &amp; billing/);
assert.match(result, /Existing company workspace/);
assert.match(result, /30 available/);
assert.match(result, /3 available/);
assert.match(result, /Company subscription/);
assert.doesNotMatch(result, /business|Business/);
assert.match(render({ overview: null }), /skeleton--text/);
assert.doesNotMatch(render({ overview: null }), /Your workspace plan|Plan overview|Company subscription|View billing for capacity details/);
assert.match(render({ overview: null }), /aria-busy="true"/);
const full = render({ overview: { capacity: { employee_limit: 10, dashboard_limit: 0, expired: true }, usage: { employees: 12, dashboard_users: 0 } } });
assert.match(full, /Subscription expired/);
assert.match(full, /Capacity reached/);
assert.match(full, /value="10" max="10"/);
assert.match(full, /No additional capacity/);
assert.doesNotMatch(render({ onOpen: undefined }), /View plans &amp; billing/);
console.log('Plan summary checks passed: shared card, real capacity, test/live separation, missing data, expiry, zero limits, and navigation.');

assert.match(render({overview:{...overview,capacity:{...overview.capacity,legacy:false},plans:[{id:'team',name:'Team'}],liveSubscription:{plan_id:'team',source:'complimentary',ends_at:'2026-12-15T00:00:00Z'}}}),/Team plan/);

assert.doesNotMatch(result, /Test checkout/);

const plain = render({plain:true, controls:React.createElement("button",null,"Refresh")});
assert.doesNotMatch(plain,/card--blue/);
assert.match(plain,/>Refresh<\/button>/);
assert.equal((plain.match(/<h2>/g)||[]).length,1);

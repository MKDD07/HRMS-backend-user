import { build } from 'esbuild';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Bundle JSX for a dependency-free server-render check of the shared card's states.
const folder = await mkdtemp(join(process.cwd(), '.directory-check-'));
const output = join(folder, 'check.mjs');
try {
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import assert from 'node:assert/strict';
      import { EmployeeDirectory } from './src/components/employees/EmployeeDirectory.jsx';
      const employees = Array.from({ length: 13 }, (_, i) => ({ userid: 'user-' + i, first_name: 'Person', last_name: String(i), department: 'Engineering' }));
      const render = props => renderToStaticMarkup(<EmployeeDirectory employees={employees} {...props} />);
      const single = render({ selectedId: 'user-1', onSelect() {} });
      assert.equal((single.match(/aria-pressed="true"/g) || []).length, 1);
      assert.equal((single.match(/class="[^"]*employee-directory-card(?: |")/g) || []).length, 12);
      assert.match(single, /1.12 of 13/);
      assert.ok(single.includes('Search employees'));
      assert.ok(single.includes('aria-expanded="false"'));
      assert.ok(single.includes('role="list"'));
      assert.equal((single.match(/role="listitem"/g) || []).length, 12);
      assert.doesNotMatch(single, /employee-directory-card[^"]*btn/);
      const locked = render({employees:[{userid:'locked',first_name:'Locked',plan_locked:true}],onSelect(){},renderActions:()=> <button>Grant access</button>});
      assert.match(locked,/is-plan-locked/);
      assert.match(locked,/disabled=""/);
      assert.ok(!locked.includes('Grant access'));
      const multi = render({ multi: true, selectedIds: ['user-0', 'user-2'], onToggle() {}, onSelectAll() {}, onClearAll() {} });
      assert.equal((multi.match(/aria-pressed="true"/g) || []).length, 2);
      assert.ok(multi.includes('Select all'));
      assert.ok(multi.includes('2 selected'));
      assert.ok(render({ employees: [] }).includes('No employees match'));
      assert.ok(render({ loading: true }).includes('Loading employee directory'));
      assert.ok(render({ error: 'Unavailable' }).includes('role="alert"'));
      const external = render({ toolbar: <><input aria-label="External filter" placeholder="Find a colleague" value="Person" onChange={() => {}} /><select value="Engineering" onChange={() => {}}><option>Engineering</option></select></>, totalCount: 30 });
      assert.ok(external.includes('aria-label="External filter"'));
      assert.ok(external.includes('placeholder="Find a colleague"'));
      assert.ok(external.includes('13 of 30 employees'));
      assert.ok(external.includes('1 active'));
      const readOnly = render({ employees: [{ user_id: 'read-only', name: 'Read only colleague' }] });
      assert.doesNotMatch(readOnly, /aria-pressed=/);
      assert.doesNotMatch(readOnly.split('<footer>')[0], /lucide-chevron-right/);
      const fallbackId = render({ employees: [{ user_id: 'fallback-id', name: 'Fallback identity' }], selectedId: 'fallback-id', onSelect() {} });
      assert.match(fallbackId, /aria-pressed="true"/);
      const title = render({ headerTitle: 'Team members', headerSubtitle: 'Browse your team' });
      assert.ok(title.includes('Team members'));
      assert.ok(title.includes('Browse your team'));
      const customProps = render({ employees: employees.slice(0, 1), getCardProps: () => ({ className: 'custom-entry', draggable: true }), renderActions: () => <button type="button">Add to team</button> });
      assert.match(customProps, /employee-directory-entry custom-entry/);
      assert.match(customProps, /draggable="true"/);
      assert.equal((customProps.match(/Add to team/g) || []).length, 1);
      const grid = render({ variant: 'grid', employees: employees.slice(0, 1), onSelect() {} });
      assert.match(grid, /class="card employee-directory employee-directory--grid/);
      assert.match(grid, /class="employee-directory-entry card/);
      assert.ok(!render({ searchOnly: true }).includes('Toggle directory filters'));
      assert.doesNotMatch(render({ pageSize: 0 }), /NaN|Infinity/);
      assert.match(render({ loading: true }), /role="status"/);
      const refresh = render({ loading: true, onRefresh() {} });
      assert.doesNotMatch(refresh, /aria-label="Refresh directory"/);
      const inline = render({ employees: employees.slice(0, 1), onSelect() {}, actionsPlacement: 'inline', renderActions: () => <button type="button">Grant access</button> });
      assert.match(inline, /employee-directory--inline-actions/);
      assert.ok(inline.includes('</button><div class="employee-directory-entry-actions"><button type="button">Grant access'));
      assert.doesNotMatch(inline.split('<footer>')[0], /lucide-chevron-right/);
      console.log('Shared directory checks passed.');
    ` },
    bundle: true, packages: 'external', platform: 'node', format: 'esm', loader: { '.css': 'empty', '.scss': 'empty' }, write: false,
  });
  await writeFile(output, result.outputFiles[0].text);
  await import(pathToFileURL(output));
} finally {
  await unlink(output).catch(() => {});
  await rmdir(folder);
}

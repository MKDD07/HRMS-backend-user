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
      const single = render({ selectedId: 'user-1' });
      assert.equal((single.match(/aria-pressed="true"/g) || []).length, 1);
      assert.equal((single.match(/class="employee-directory-card /g) || []).length, 12);
      assert.ok(single.includes('1-12 of 13'));
      assert.ok(single.includes('Search employees'));
      assert.ok(single.includes('All departments'));
      const multi = render({ multi: true, selectedIds: ['user-0', 'user-2'] });
      assert.equal((multi.match(/aria-pressed="true"/g) || []).length, 2);
      assert.ok(multi.includes('Select all 13'));
      assert.ok(multi.includes('2 selected'));
      assert.ok(render({ employees: [] }).includes('No employees match'));
      assert.ok(render({ loading: true }).includes('Loading employee records'));
      assert.ok(render({ error: 'Unavailable' }).includes('role="alert"'));
      assert.ok(!render({ toolbar: <input aria-label="External filter" /> }).includes('Search employees'));
      console.log('Shared directory checks passed.');
    ` },
    bundle: true, packages: 'external', platform: 'node', format: 'esm', loader: { '.css': 'empty' }, write: false,
  });
  await writeFile(output, result.outputFiles[0].text);
  await import(pathToFileURL(output));
} finally {
  await unlink(output).catch(() => {});
  await rmdir(folder);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { assignDepartmentColors, randomDepartmentColor, departmentTheme, DEPARTMENT_PALETTE } from './departmentTheme.js';
test('twenty departments get distinct pastel colors and saved colors remain stable', () => {
  const records = assignDepartmentColors(Array.from({ length: 20 }, (_, index) => ({ name: 'Department ' + index })));
  assert.equal(DEPARTMENT_PALETTE.length, 20);
  assert.equal(new Set(records.map(record => record.themeIndex)).size, 20);
  assert.equal(new Set(records.map(record => departmentTheme(record.name, record.themeIndex)['--department-tint'])).size, 20);
  assert.deepEqual(assignDepartmentColors([...records, { name: 'Extra department' }]).slice(0, 20), records);
});
test('random selection uses unused colors before reusing the palette', () => {
  const records = assignDepartmentColors([{ name: 'Engineering' }, { name: 'Design' }]);
  for (const value of [0, .4, .999]) assert.equal(records.some(record => record.themeIndex === randomDepartmentColor(records, () => value)), false);
  const full = Array.from({ length: 20 }, (_, themeIndex) => ({ themeIndex }));
  assert.equal(randomDepartmentColor(full, () => .999), 19);
});

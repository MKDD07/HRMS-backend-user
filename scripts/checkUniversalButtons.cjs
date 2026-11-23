const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const failures = [];
let pages = 0, buttons = 0;
for (const file of walk('src').filter(file => /\.(jsx|tsx)$/.test(file))) {
  const ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx', ...(file.endsWith('.tsx') ? ['typescript'] : [])] });
  if (file.startsWith(path.join('src', 'pages'))) pages++;
  traverse(ast, { JSXOpeningElement({ node }) {
    if (node.name.name === 'Button') buttons++;
    // A switch is a separate input primitive, not an action button.
    if (node.name.name === 'button' && ![path.join('src', 'components', 'ui', 'Button.jsx'), path.join('src', 'components', 'ui', 'Toggle.jsx')].includes(file)) failures.push(`${file}:${node.loc.start.line}: use the universal Button`);
  } });
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`Universal button audit passed: ${pages} page files checked, ${buttons} shared Button usages, no page-specific native buttons.`);

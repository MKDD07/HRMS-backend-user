export const DEPARTMENT_PALETTE = [165, 265, 35, 205, 325, 85, 240, 15, 185, 285, 55, 145, 225, 345, 105, 305, 125, 5, 255, 65];
const validIndex = index => Number.isInteger(index) && index >= 0 && index < DEPARTMENT_PALETTE.length;
const hashIndex = name => Array.from(name).reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 0) % DEPARTMENT_PALETTE.length;
export function departmentTheme(name, themeIndex) {
  const hue = DEPARTMENT_PALETTE[validIndex(themeIndex) ? themeIndex : hashIndex(name)];
  return { '--department-accent': `hsl(${hue} 42% 38%)`, '--department-tint': `hsl(${hue} 70% 93%)`, '--department-glow': `hsl(${(hue + 22) % 360} 65% 97%)` };
}
export function assignDepartmentColors(records) {
  const used = new Set(records.filter(record => validIndex(record.themeIndex)).map(record => record.themeIndex));
  return records.map(record => {
    if (validIndex(record.themeIndex)) return record;
    let index = hashIndex(record.name);
    for (let attempt = 0; attempt < DEPARTMENT_PALETTE.length && used.has(index); attempt++) index = (index + 1) % DEPARTMENT_PALETTE.length;
    used.add(index);
    return { ...record, themeIndex: index };
  });
}
export function randomDepartmentColor(records, random = Math.random) {
  const unused = DEPARTMENT_PALETTE.map((_, index) => index).filter(index => !records.some(record => record.themeIndex === index));
  const choices = unused.length ? unused : DEPARTMENT_PALETTE.map((_, index) => index);
  return choices[Math.floor(random() * choices.length)];
}

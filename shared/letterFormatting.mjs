export function letterRuns(line) {
  return line.split(/(\*\*[^*]+\*\*|\[[^\]]*(?:required|missing)[^\]]*\]|\{\{[^}]+\}\})/gi).filter(Boolean).map(text => {
    const bold = text.startsWith('**') && text.endsWith('**');
    const value = bold ? text.slice(2,-2) : text;
    const blank = /^\[[^\]]*(required|missing)[^\]]*\]$|^\{\{.+\}\}$/i.test(value);
    return { text: blank ? '                          ' : value, bold: blank ? false : bold, ...(blank ? { underline: {} } : {}) };
  });
}
export function missingLetterDetails(text) {
  return [...new Set((text.match(/\[[^\]]*(?:required|missing)[^\]]*\]|\{\{[^}]+\}\}/gi) || []).map(value => value.replace(/^\[|\]$|^\{\{|\}\}$/g,'')))];
}

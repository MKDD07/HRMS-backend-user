import searchStyles from '../../components/ui/UniversalSearch.scss?raw';
import componentStyles from '../../styles/components.scss?raw';

// Add a category and its snippets here to extend the library.
export const SNIPPET_CATEGORIES = [
  { id: 'search', label: 'Search' },
  { id: 'buttons', label: 'Buttons' }
];
export const SNIPPETS = [
  { id: 'search-outlined', category: 'search', variant: 'outlined', title: 'Main search', description: 'Search icon, subtle border, and keyboard hint.' },
  { id: 'search-filled', category: 'search', variant: 'filled', title: 'Filled search', description: 'A soft background for record filters.' },
  { id: 'search-compact', category: 'search', variant: 'compact', title: 'Compact search', description: 'A smaller field for navigation and tight spaces.' },
  ...['colored', 'outline', 'fadeout', 'focus', 'danger'].map(variant => ({
    id: `button-${variant}`, category: 'buttons', variant,
    title: `${variant[0].toUpperCase()}${variant.slice(1)} button`, description: `Shared Button component with the ${variant} style.`
  }))
];
export function snippetCode(snippet, language, options = {}) {
  const { showIcon = true, iconName = snippet.category === 'search' ? 'Search' : 'Plus', iconOnly = false, showKeyboardHint = true } = options;
  const iconImport = showIcon ? `import { ${iconName} } from 'lucide-react';\n` : '';
  if (language === 'scss') return snippet.category === 'search' ? searchStyles : componentStyles.split('/* Button group */')[0];
  if (snippet.category === 'buttons') return `${iconImport}import { Button } from './components/ui/Button';

<Button id="${snippet.id}" variant="${snippet.variant}"${showIcon ? ` icon={${iconName}}` : ''}${showIcon && iconOnly ? ` iconOnly aria-label="${snippet.variant === 'danger' ? 'Delete' : 'Continue'}"` : ''} onClick={handleClick}${showIcon && iconOnly ? ' />' : `>\n  ${snippet.variant === 'danger' ? 'Delete' : 'Continue'}\n</Button>`}`;
  return `${iconImport}import { useState } from 'react';
import { UniversalSearch } from './components/ui/UniversalSearch';

export function SearchField() {
  const [query, setQuery] = useState('');
  return (
    <UniversalSearch
      id="${snippet.id}"
      variant="${snippet.variant}"
      value={query}
      onChange={setQuery}
      label="Search employees"
      placeholder="Search employees..."${showIcon ? `\n      icon={${iconName}}` : '\n      showIcon={false}'}
      shortcut="k"
      showKeyboardHint={${showKeyboardHint}}
    />
  );
}`;
}
